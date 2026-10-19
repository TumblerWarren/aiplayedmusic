package app.localmusic.player;

import java.util.Arrays;

/** Platform-independent DSP. RBJ biquads; stereo-linked dynamics and look-ahead peak limiting.
 * See docs/AUDIO_ENGINE.md for equations, references and explicit measurement limits. */
public final class DspCore {
    public static final double[] FREQUENCIES={31,63,125,250,500,1000,2000,4000,8000,16000};
    public static final double CEILING=Math.pow(10,-1.0/20);
    public static final class Settings {
        public final double[] bands;
        public final boolean enabled,bypass,limiter,autoHeadroom,mono;
        public final double preamp,volume,bass,treble,balance,width;
        public final int dynamics;
        public Settings(double[] bands,boolean enabled,boolean bypass,boolean limiter,boolean autoHeadroom,
                        double preamp,double volume,double bass,double treble,double balance,double width,boolean mono,int dynamics) {
            this.bands=new double[10];for(int i=0;i<10;i++)this.bands[i]=clamp(bands!=null&&i<bands.length?bands[i]:0,-12,12);
            this.enabled=enabled;this.bypass=bypass;this.limiter=limiter;this.autoHeadroom=autoHeadroom;this.mono=mono;
            this.preamp=clamp(preamp,-24,0);this.volume=clamp(volume,100,300);this.bass=clamp(bass,-12,12);
            this.treble=clamp(treble,-12,12);this.balance=clamp(balance,-1,1);this.width=clamp(width,0,1.5);
            this.dynamics=Math.max(0,Math.min(2,dynamics));
        }
        public static Settings defaults(){return new Settings(new double[10],false,false,true,true,0,100,0,0,0,1,false,0);}
    }
    public static double clamp(double v,double min,double max){return Double.isFinite(v)?Math.max(min,Math.min(max,v)):Math.max(min,Math.min(max,0));}
    public static double dbToGain(double db){return Math.pow(10,db/20);}
    public static double gainToDb(double v){return 20*Math.log10(Math.max(1e-8,v));}

    /** Transposed direct-form II, independent L/R state and normalized a0. */
    static final class Biquad {
        double b0=1,b1,b2,a1,a2;final double[] z1=new double[2],z2=new double[2];
        double process(double x,int ch){double y=b0*x+z1[ch];z1[ch]=b1*x-a1*y+z2[ch];z2[ch]=b2*x-a2*y;return y;}
        static Biquad create(int kind,double hz,double db,int rate){
            Biquad f=new Biquad();if(Math.abs(db)<1e-9||hz>=rate*.475)return f;
            double a=Math.pow(10,db/40),w=2*Math.PI*hz/rate,c=Math.cos(w),s=Math.sin(w);
            double alpha=s/(2*1.4),a0;
            if(kind==0){f.b0=1+alpha*a;f.b1=-2*c;f.b2=1-alpha*a;a0=1+alpha/a;f.a1=-2*c;f.a2=1-alpha/a;}
            else {
                alpha=s/Math.sqrt(2);double k=2*Math.sqrt(a)*alpha;
                if(kind==1){f.b0=a*((a+1)-(a-1)*c+k);f.b1=2*a*((a-1)-(a+1)*c);f.b2=a*((a+1)-(a-1)*c-k);a0=(a+1)+(a-1)*c+k;f.a1=-2*((a-1)+(a+1)*c);f.a2=(a+1)+(a-1)*c-k;}
                else {f.b0=a*((a+1)+(a-1)*c+k);f.b1=-2*a*((a-1)+(a+1)*c);f.b2=a*((a+1)+(a-1)*c-k);a0=(a+1)-(a-1)*c+k;f.a1=2*((a-1)-(a+1)*c);f.a2=(a+1)-(a-1)*c-k;}
            }
            f.b0/=a0;f.b1/=a0;f.b2/=a0;f.a1/=a0;f.a2/=a0;return f;
        }
        double response(double w){double c=Math.cos(w),s=Math.sin(w),c2=Math.cos(2*w),s2=Math.sin(2*w);
            double nr=b0+b1*c+b2*c2,ni=b1*s+b2*s2,dr=1+a1*c+a2*c2,di=a1*s+a2*s2;
            return Math.sqrt((nr*nr+ni*ni)/(dr*dr+di*di));}
    }
    static final class Bank {
        final Biquad[] filters=new Biquad[12];
        Bank(Settings s,int rate){for(int i=0;i<10;i++)filters[i]=Biquad.create(0,FREQUENCIES[i],s.enabled&&!s.bypass?s.bands[i]:0,rate);
            filters[10]=Biquad.create(1,80,s.bypass?0:s.bass,rate);filters[11]=Biquad.create(2,8000,s.bypass?0:s.treble,rate);}
        double process(double x,int ch){for(Biquad f:filters)x=f.process(x,ch);return x;}
        double peakDb(int rate){double max=1;for(int i=0;i<=512;i++){double hz=10*Math.pow(Math.min(rate*.475,22000)/10,i/512.0),g=1;for(Biquad f:filters)g*=f.response(2*Math.PI*hz/rate);max=Math.max(max,g);}return gainToDb(max);}
    }

    private final int rate,channels,lookahead,capacity,fadeFrames;
    private final double[] ringL,ringR,peaks;
    private final long[] peakIds;
    private int head,tail,bypassProtection;private long frame;
    private Bank bank,oldBank;private int fade;
    private Settings settings;
    private double gain=1,linearTarget=1,balance=0,width=1,limiterGain=1,compressorGain=1;
    private final double smoothing,release,attackComp,releaseComp;
    public volatile double headroomDb,outputPeak,limiterReductionDb,compressionReductionDb;

    public DspCore(int rate,int channels,Settings s){
        if(rate<8000||channels<1||channels>2)throw new IllegalArgumentException("DSP supports mono/stereo PCM at 8 kHz or higher");
        this.rate=rate;this.channels=channels;lookahead=Math.max(1,rate/200);capacity=lookahead+2;fadeFrames=Math.max(1,rate/50);
        ringL=new double[capacity];ringR=new double[capacity];peaks=new double[capacity];peakIds=new long[capacity];
        smoothing=1-Math.exp(-1.0/(.02*rate));release=1-Math.exp(-1.0/(.08*rate));
        attackComp=1-Math.exp(-1.0/(.01*rate));releaseComp=1-Math.exp(-1.0/(.15*rate));
        settings=s;bank=new Bank(s,rate);updateHeadroom();gain=targetGain();balance=s.bypass?0:s.balance;width=s.bypass?1:s.mono?0:s.width;
    }
    public int latencyFrames(){return lookahead;}
    public void setSettings(Settings s){
        if(s==settings)return;
        boolean filtersChanged=s.enabled!=settings.enabled||s.bypass!=settings.bypass||s.bass!=settings.bass||s.treble!=settings.treble||!Arrays.equals(s.bands,settings.bands);
        settings=s;
        if(filtersChanged){oldBank=bank;bank=new Bank(s,rate);fade=0;}
        updateHeadroom();
    }
    private void updateHeadroom(){headroomDb=settings.autoHeadroom&&!settings.bypass?Math.max(0,bank.peakDb(rate)):0;if(headroomDb>0.01)headroomDb+=.5;linearTarget=settings.bypass?1:dbToGain(settings.preamp-headroomDb)*settings.volume/100;}
    private double targetGain(){return linearTarget;}
    /** Soft-knee gain computer (Giannoulis et al., Eq. 4); no hidden make-up gain. */
    public static double compressorDb(double level,double threshold,double ratio,double knee){
        double over=level-threshold;if(over<=-knee/2)return 0;
        if(over>=knee/2)return (1/ratio-1)*over;
        return (1/ratio-1)*Math.pow(over+knee/2,2)/(2*knee);
    }
    /** Returns false only while filling the fixed 5 ms look-ahead. No leading silence emitted. */
    public boolean process(double left,double right,float[] out){
        left=Double.isFinite(left)?left:0;right=Double.isFinite(right)?right:0;
        double l=bank.process(left,0),r=bank.process(right,1);
        if(oldBank!=null){double t=Math.min(1,++fade/(double)fadeFrames);l=oldBank.process(left,0)*(1-t)+l*t;r=oldBank.process(right,1)*(1-t)+r*t;if(t==1)oldBank=null;}
        gain+=(targetGain()-gain)*smoothing;balance+=((settings.bypass?0:settings.balance)-balance)*smoothing;
        width+=((settings.bypass?1:settings.mono?0:settings.width)-width)*smoothing;
        if(channels==2){double mid=(l+r)*.5,side=(l-r)*.5*width;l=mid+side;r=mid-side;l*=1-Math.max(0,balance);r*=1+Math.min(0,balance);}
        l*=gain;r*=gain;
        int mode=settings.bypass?0:settings.dynamics;
        double target=mode==0?1:dbToGain(compressorDb(gainToDb(Math.max(Math.abs(l),Math.abs(r))),mode==1?-12:-18,mode==1?1.5:2,6));
        compressorGain+=(target-compressorGain)*(target<compressorGain?attackComp:releaseComp);
        l*=compressorGain;r*=compressorGain;compressionReductionDb=-gainToDb(compressorGain);
        // A bypass request must not release protection for the hot samples still in the FIFO,
        // or for a gain/filter crossfade that has not yet reached the original signal.
        if(!settings.bypass||oldBank!=null||gain>1.000001||width>1.000001)bypassProtection=lookahead+1;
        else if(bypassProtection>0)bypassProtection--;
        return delay(l,r,out);
    }
    /** Drain with unprocessed zero frames; caller emits only the remaining real frames. */
    public boolean drain(float[] out){return delay(0,0,out);}
    private boolean delay(double l,double r,float[] out){
        int slot=(int)(frame%capacity);ringL[slot]=l;ringR[slot]=r;double peak=Math.max(Math.abs(l),Math.abs(r));
        while(head!=tail&&peakIds[head]<frame-lookahead)head=(head+1)%capacity;
        while(head!=tail&&peaks[(tail-1+capacity)%capacity]<=peak)tail=(tail-1+capacity)%capacity;
        peaks[tail]=peak;peakIds[tail]=frame;tail=(tail+1)%capacity;
        boolean available=frame>=lookahead;
        if(available){int read=(int)((frame-lookahead)%capacity);double required=settings.limiter&&(!settings.bypass||bypassProtection>0)?Math.min(1,CEILING/Math.max(1e-12,peaks[head])):1;
            limiterGain=required<limiterGain?required:limiterGain+(required-limiterGain)*release;
            double ol=ringL[read]*limiterGain,or=ringR[read]*limiterGain;
            out[0]=(float)ol;out[1]=(float)or;outputPeak=Math.max(Math.max(Math.abs(ol),Math.abs(or)),outputPeak*.9998);limiterReductionDb=-gainToDb(limiterGain);
        }
        frame++;return available;
    }
}
