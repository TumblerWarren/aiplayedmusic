package app.localmusic.player;

/** Signal regressions from the four-iteration audio review. */
public final class DspRegressionTests {
    private static int checks;
    private static void check(boolean ok,String message){checks++;if(!ok)throw new AssertionError(message);}
    private static DspCore.Settings shelf(double bass,boolean headroom){
        return new DspCore.Settings(null,false,false,false,headroom,0,100,bass,0,0,1,false,0);
    }
    private static void rapidFilterChanges(){
        DspCore dsp=new DspCore(48000,2,shelf(12,false));float[] frame=new float[2];
        for(int i=0;i<48000;i++)dsp.process(.05,.05,frame);
        dsp.setSettings(shelf(-12,false));
        // Let the new bank receive a few frames, then update it again mid-fade.
        for(int i=0;i<10;i++)dsp.process(.05,.05,frame);
        dsp.setSettings(shelf(6,false));double maxStep=0,previous=frame[0];
        for(int i=0;i<5000;i++){dsp.process(.05,.05,frame);maxStep=Math.max(maxStep,Math.abs(frame[0]-previous));previous=frame[0];}
        check(maxStep<.005,"Rapid filter updates caused a discontinuity: maximum adjacent-sample step "+maxStep);
        check(Math.abs(frame[0]-.05*DspCore.dbToGain(6))<1e-5,"Latest queued filter setting did not settle");
        System.out.printf(java.util.Locale.ROOT,"Rapid EQ updates: maximum adjacent-sample step %.8f%n",maxStep);
    }
    private static void transitionHeadroom(){
        DspCore dsp=new DspCore(48000,2,shelf(12,true));float[] frame=new float[2];
        for(int i=0;i<48000;i++)dsp.process(.8,.8,frame);
        dsp.setSettings(shelf(0,true));double peak=0;
        for(int i=0;i<10000;i++){dsp.process(.8,.8,frame);peak=Math.max(peak,Math.abs(frame[0]));}
        check(peak<=.80001,"Automatic headroom was released before the boosted bank faded out: peak "+peak);
        check(Math.abs(frame[0]-.8)<.0001,"Transition compensation did not return to unity");
        System.out.printf(java.util.Locale.ROOT,"EQ-to-flat transition with limiter off: peak %.8f%n",peak);
    }
    private static void addedBoostAndQueuedBypass(){
        DspCore dsp=new DspCore(48000,2,shelf(0,true));float[] frame=new float[2];
        for(int i=0;i<48000;i++)dsp.process(.8,.8,frame);
        dsp.setSettings(shelf(12,true));double peak=0;
        for(int i=0;i<10000;i++){dsp.process(.8,.8,frame);peak=Math.max(peak,Math.abs(frame[0]));}
        check(peak<=.80001,"Adding EQ with automatic headroom exposed uncompensated gain: "+peak);
        dsp.setSettings(shelf(-12,true));for(int i=0;i<120;i++)dsp.process(.8,.8,frame);
        dsp.setSettings(new DspCore.Settings(null,false,true,false,true,0,100,0,0,0,1,false,0));
        for(int i=0;i<10000;i++){dsp.process(.8,.8,frame);check(Math.abs(frame[0])<=.80001,"Queued bypass exposed boosted filter output");}
        check(Math.abs(frame[0]-.8)<1e-5,"Queued bypass did not settle to the original signal");
    }
    private static double responseDb(double[] bands,double hz){
        DspCore.Bank bank=new DspCore.Bank(new DspCore.Settings(bands,true,false,false,false,0,100,0,0,0,1,false,0),48000);
        double response=1;for(DspCore.Biquad filter:bank.filters)response*=filter.response(2*Math.PI*hz/48000);
        return DspCore.gainToDb(response);
    }
    private static void tonePresets(){
        String[] names=TonePresets.names();check(names.length==10,"Tone preset catalog must contain ten presets");
        String original=names[0];names[0]="modified";check(TonePresets.names()[0].equals(original),"Preset names must be defensive copies");
        java.util.Set<String> curves=new java.util.HashSet<>();
        for(String name:TonePresets.names()){
            double[] bands=TonePresets.bands(name);check(bands.length==10,name+": use ten bands");
            for(double band:bands)check(Double.isFinite(band)&&Math.abs(band)<=6,name+": preset must stay moderate and finite");
            check(curves.add(java.util.Arrays.toString(bands)),name+": duplicate tone curve");
            check(!TonePresets.detail(name).isBlank(),name+": missing description");
            double first=bands[0];bands[0]=99;check(TonePresets.bands(name)[0]==first,name+": preset arrays must be defensive copies");
        }
        boolean rejected=false;try{TonePresets.bands("unknown");}catch(IllegalArgumentException e){rejected=true;}check(rejected,"Unknown presets must be rejected");
        String[] legacyNames={"Flat","Warm","Bass","Vocal","Acoustic","Bright"};
        double[][] legacy={{0,0,0,0,0,0,0,0,0,0},{2,2,1,0,0,0,-1,-1,-2,-2},{5,4,3,1,0,0,0,0,0,0},{-2,-2,-1,0,1,3,3,1,0,-1},{0,1,1,0,-1,0,1,2,1,0},{-1,-1,0,0,0,1,2,3,3,2}};
        for(int i=0;i<legacyNames.length;i++)check(java.util.Arrays.equals(TonePresets.bands(legacyNames[i]),legacy[i]),"Existing tone preset changed: "+legacyNames[i]);
        for(double hz:new double[]{31,63,125,500,1000,4000,8000,16000})check(Math.abs(responseDb(TonePresets.bands("Flat"),hz))<1e-8,"Flat must remain neutral");
        for(String name:new String[]{"Warm","Bass","Rock","Jazz"})check(responseDb(TonePresets.bands(name),63)>responseDb(TonePresets.bands(name),500),name+": expected bass emphasis");
        for(String name:new String[]{"Vocal","Speech"})check(responseDb(TonePresets.bands(name),2000)>responseDb(TonePresets.bands(name),63),name+": expected presence over bass");
        for(String name:new String[]{"Acoustic","Bright","Classical"})check(responseDb(TonePresets.bands(name),4000)>responseDb(TonePresets.bands(name),500),name+": expected upper-frequency lift");
        System.out.println("Tone presets verified: ten distinct curves, measured response intent and defensive copies.");
    }
    private static void combinedPresetStress(String fixture)throws Exception{
        int combinations=0;java.util.Random random=new java.util.Random(20261020);
        for(String tone:TonePresets.names())for(String line:java.nio.file.Files.readAllLines(java.nio.file.Path.of(fixture))){
            String[] p=line.split("\t");double volume=Double.parseDouble(p[1]),width=Double.parseDouble(p[3])/100;
            int dynamics=Integer.parseInt(p[2]);boolean mono=Boolean.parseBoolean(p[4]),limiter=Boolean.parseBoolean(p[5]);
            for(int rate:new int[]{8000,22050,44100,48000,96000})for(int channels:new int[]{1,2}){
                DspCore.Settings s=new DspCore.Settings(TonePresets.bands(tone),true,false,limiter,true,0,volume,0,0,0,width,mono,dynamics);
                DspCore dsp=new DspCore(rate,channels,s);float[] frame=new float[2];int count=rate/25,emitted=0;
                for(int i=0;i<count;i++){
                    double left=random.nextDouble()*2-1,right=channels==1?left:random.nextDouble()*2-1;
                    if(dsp.process(left,right,frame)){emitted++;check(Float.isFinite(frame[0])&&Float.isFinite(frame[1])&&Math.abs(frame[0])<=DspCore.CEILING+1e-6&&Math.abs(frame[1])<=DspCore.CEILING+1e-6,tone+" + "+p[0]+": unstable/clipping output at "+rate);}
                }
                while(emitted<count)if(dsp.drain(frame)){emitted++;check(Float.isFinite(frame[0])&&Float.isFinite(frame[1])&&Math.abs(frame[0])<=DspCore.CEILING+1e-6&&Math.abs(frame[1])<=DspCore.CEILING+1e-6,"Preset EOF drain exceeded the peak ceiling");}
                check(emitted==count,"Preset combination changed the frame count");combinations++;
            }
        }
        System.out.println("Combined tone/output stress passed: "+combinations+" combinations at 8/22.05/44.1/48/96 kHz in mono/stereo.");
    }
    private static void automationAndDrain(){
        float[] frame=new float[2];DspCore dsp=new DspCore(48000,2,DspCore.Settings.defaults());
        for(int i=0;i<48000;i++){
            if(i%96==0){int n=i/96;dsp.setSettings(new DspCore.Settings(TonePresets.bands(TonePresets.names()[n%10]),true,n%17==0,true,true,0,100+n%5*50,n%3-1,0,0,n%2==0?1.5:.6,n%19==0,n%3));}
            dsp.process(.95*Math.sin(i*.17),.95*Math.sin(i*.31),frame);
            check(Float.isFinite(frame[0])&&Float.isFinite(frame[1])&&Math.abs(frame[0])<=1.000001&&Math.abs(frame[1])<=1.000001,"Rapid automation/bypass exceeded full scale");
        }
        double[] last=TonePresets.bands("Speech");dsp.setSettings(new DspCore.Settings(last,true,false,true,true,0,100,0,0,0,1,false,0));
        DspCore reference=new DspCore(48000,2,new DspCore.Settings(last,true,false,true,true,0,100,0,0,0,1,false,0));float[] expected=new float[2];
        // Allow the existing 150 ms compressor release to settle after automation stops.
        for(int i=0;i<96000;i++){double x=.05*Math.sin(i*.17);dsp.process(x,x,frame);reference.process(x,x,expected);}
        check(Math.abs(frame[0]-expected[0])<1e-6,"Rapid updates did not converge to the final requested preset: "+frame[0]+" vs "+expected[0]);
        for(int rate:new int[]{8000,48000,192000})for(int length:new int[]{1,17,rate/200,rate/200+1,rate/100+1}){
            float[][] raw=new float[length][2];raw[length-1][0]=.25f;raw[length-1][1]=-.125f;
            float[][] out=DspTests.render(new DspCore(rate,2,new DspCore.Settings(null,false,true,false,false,0,100,0,0,0,1,false,0)),raw);
            for(int i=0;i<length;i++)check(java.util.Arrays.equals(raw[i],out[i]),"Short stream/last-sample drain changed frame "+i+" at "+rate);
        }
        DspCore invalid=new DspCore(48000,2,DspCore.Settings.defaults());
        for(int i=0;i<1000;i++){invalid.process(Double.NaN,Double.POSITIVE_INFINITY,frame);check(Float.isFinite(frame[0])&&Float.isFinite(frame[1]),"Invalid samples poisoned DSP state");}
        System.out.println("Rapid automation, bypass, final-state convergence, invalid samples and short-stream drain passed.");
    }
    private static void writeCatalog(String path)throws Exception{
        StringBuilder json=new StringBuilder("{\"soundPresets\":[");String[] names=TonePresets.names();
        for(int i=0;i<names.length;i++){if(i>0)json.append(',');json.append('"').append(names[i]).append('"');}
        json.append("],\"equalizerPresets\":{");
        for(int i=0;i<names.length;i++){if(i>0)json.append(',');json.append('"').append(names[i]).append("\":{\"bands\":").append(java.util.Arrays.toString(TonePresets.bands(names[i]))).append('}');}
        json.append("},\"equalizerPresetDetails\":{");
        for(int i=0;i<names.length;i++){if(i>0)json.append(',');json.append('"').append(names[i]).append("\":\"").append(TonePresets.detail(names[i])).append('"');}
        java.nio.file.Files.writeString(java.nio.file.Path.of(path),json.append("}}").toString());
    }
    public static void main(String[] args)throws Exception{
        if(args.length>0&&args[0].equals("headroom"))transitionHeadroom();
        else {rapidFilterChanges();transitionHeadroom();addedBoostAndQueuedBypass();tonePresets();automationAndDrain();if(args.length>0)combinedPresetStress(args[0]);if(args.length>1)writeCatalog(args[1]);}
        System.out.println("DSP transition regressions passed: "+checks+" assertions.");
    }
}
