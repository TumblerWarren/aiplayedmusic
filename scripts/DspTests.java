package app.localmusic.player;
import java.util.*;

public final class DspTests {
    static int checks=0;
    static void check(boolean value,String message){checks++;if(!value)throw new AssertionError(message);}
    static DspCore.Settings settings(double[] bands,boolean eq,boolean bypass,boolean limiter,boolean headroom,double volume,double balance,boolean mono,int dynamics){return new DspCore.Settings(bands,eq,bypass,limiter,headroom,0,volume,0,0,balance,1,mono,dynamics);}
    static float[][] render(DspCore dsp,float[][] input){float[][] result=new float[input.length][2];float[] out=new float[2];int at=0;for(float[] frame:input)if(dsp.process(frame[0],frame[1],out))result[at++]=out.clone();while(at<input.length)if(dsp.drain(out))result[at++]=out.clone();return result;}
    static float[][] sine(int rate,int n,double hz,double amplitude){float[][] result=new float[n][2];for(int i=0;i<n;i++)result[i][0]=result[i][1]=(float)(amplitude*Math.sin(2*Math.PI*hz*i/rate));return result;}
    static double rms(float[][] input,int start){double sum=0;for(int i=start;i<input.length;i++)sum+=input[i][0]*input[i][0];return Math.sqrt(sum/(input.length-start));}
    public static void main(String[] args){
        Random random=new Random(2718);float[][] raw=new float[1000][2];for(float[] f:raw){f[0]=(random.nextInt(65536)-32768)/32768f;f[1]=(random.nextInt(65536)-32768)/32768f;}
        DspCore.Settings bypass=settings(null,false,true,false,false,100,0,false,0);
        float[][] unchanged=render(new DspCore(48000,2,bypass),raw);
        for(int i=0;i<raw.length;i++)check(Arrays.equals(raw[i],unchanged[i]),"Bypass must preserve every PCM sample and frame");
        float[][] shortFile=Arrays.copyOf(raw,17),shortOut=render(new DspCore(48000,2,bypass),shortFile);
        for(int i=0;i<17;i++)check(Arrays.equals(shortFile[i],shortOut[i]),"Short stream drain lost/repeated a frame");
        float[][] tone=sine(48000,48000,1000,.05);
        float[][] boosted=render(new DspCore(48000,2,settings(null,false,false,true,false,300,0,false,0)),tone);
        check(Math.abs(rms(boosted,24000)/rms(tone,24000)-3)<.0001,"300% must produce 3x amplitude below limiter threshold");
        for(int rate:new int[]{8000,22050,44100,48000,96000}){
            float[][] impulse=new float[rate/5][2];for(int i=0;i<impulse.length;i++){impulse[i][0]=(i%97==0?1f:.4f);impulse[i][1]=impulse[i][0]*.25f;}
            float[][] limited=render(new DspCore(rate,2,settings(null,false,false,true,false,300,0,false,0)),impulse);
            for(float[] frame:limited){check(Math.abs(frame[0])<=DspCore.CEILING+1e-6,"Limiter ceiling exceeded at "+rate);check(Math.abs(frame[1]-frame[0]*.25)<1e-6,"Stereo-linked limiter changed channel ratio");}
        }
        double[] bands=new double[10];bands[5]=6;
        float[][] eq=render(new DspCore(48000,2,settings(bands,true,false,false,false,100,0,false,0)),tone);
        check(Math.abs(20*Math.log10(rms(eq,24000)/rms(tone,24000))-6)<.02,"RBJ center-frequency response must be +6 dB");
        DspCore auto=new DspCore(48000,2,settings(bands,true,false,true,true,100,0,false,0));
        check(auto.headroomDb>=6&&auto.headroomDb<7,"Headroom must compensate measured EQ peak");
        float[][] stereo=new float[48000][2];for(int i=0;i<stereo.length;i++){stereo[i][0]=tone[i][0];stereo[i][1]=-tone[i][1];}
        for(float[] frame:render(new DspCore(48000,2,settings(null,false,false,false,false,100,0,true,0)),stereo))check(Math.abs(frame[0])<1e-8&&Math.abs(frame[1])<1e-8,"Mono sum must cancel opposite-polarity channels");
        for(float[] frame:render(new DspCore(48000,2,settings(null,false,false,false,false,100,-1,false,0)),tone))check(Math.abs(frame[1])<1e-8,"Left balance must mute right channel");
        check(DspCore.compressorDb(-40,-18,2,6)==0,"Quiet signals must not be compressed");
        check(Math.abs(DspCore.compressorDb(-6,-18,2,6)+6)<1e-8,"2:1 compression curve is incorrect");
        check(Math.abs(DspCore.compressorDb(-18,-18,2,6)+.375)<1e-8,"Soft-knee interpolation is incorrect");
        Arrays.fill(bands,12);
        for(int rate:new int[]{8000,44100,48000,96000}){
            DspCore dsp=new DspCore(rate,2,new DspCore.Settings(bands,true,false,true,true,0,300,12,12,.5,1.5,false,2));
            float[][] extreme=render(dsp,sine(rate,rate/2,Math.min(2000,rate/8),.99));
            for(float[] frame:extreme)check(Float.isFinite(frame[0])&&Float.isFinite(frame[1])&&Math.abs(frame[0])<=DspCore.CEILING+1e-6&&Math.abs(frame[1])<=DspCore.CEILING+1e-6,"Extreme settings must remain finite and bounded");
        }
        DspCore changing=new DspCore(48000,2,DspCore.Settings.defaults());float[] frame=new float[2];
        for(int i=0;i<48000;i++){if(i==20000)changing.setSettings(settings(bands,true,false,true,true,300,1,true,1));changing.process(Math.sin(i*.1),Math.sin(i*.13),frame);check(Float.isFinite(frame[0])&&Math.abs(frame[0])<=DspCore.CEILING+1e-6,"Changing EQ/gain destabilized output");}
        System.out.println("Audio DSP verified: "+checks+" assertions (bypass, exact drain, gain, limiter, frequency response, headroom, mono, balance, dynamics, rate/setting stress).");
    }
}
