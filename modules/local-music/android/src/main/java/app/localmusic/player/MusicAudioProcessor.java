package app.localmusic.player;

import androidx.media3.common.C;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.audio.AudioProcessorChain;
import androidx.media3.common.audio.BaseAudioProcessor;
import androidx.media3.exoplayer.audio.DefaultAudioSink;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;

/** Final PCM stage, deliberately AFTER Sonic and silence skipping so the limiter sees their output. */
@androidx.annotation.OptIn(markerClass=androidx.media3.common.util.UnstableApi.class)
public final class MusicAudioProcessor extends BaseAudioProcessor {
    private volatile DspCore.Settings settings=DspCore.Settings.defaults();
    private volatile DspCore core;
    public volatile int sampleRate,channels;
    private long received,emitted;
    private final float[] frame=new float[2];
    public void update(DspCore.Settings value){settings=value;}
    public DspCore metrics(){return core;}
    @Override protected AudioFormat onConfigure(AudioFormat format){
        return format.encoding==C.ENCODING_PCM_16BIT&&format.channelCount<=2&&format.sampleRate>=8000?format:AudioFormat.NOT_SET;
    }
    @Override protected void onFlush(){
        received=emitted=0;sampleRate=isActive()?inputAudioFormat.sampleRate:0;channels=isActive()?inputAudioFormat.channelCount:0;
        core=sampleRate>0?new DspCore(sampleRate,channels,settings):null;
    }
    @Override public void queueInput(ByteBuffer input){
        DspCore dsp=core;if(dsp==null)return;dsp.setSettings(settings);input.order(ByteOrder.nativeOrder());
        ByteBuffer output=replaceOutputBuffer(input.remaining());
        while(input.remaining()>=channels*2){
            float l=input.getShort()/32768f,r=channels==2?input.getShort()/32768f:l;received++;
            if(dsp.process(l,r,frame)){write(output);emitted++;}
        }
        output.flip();
    }
    @Override protected void onQueueEndOfStream(){
        DspCore dsp=core;if(dsp==null||received==emitted)return;
        ByteBuffer output=replaceOutputBuffer((int)(received-emitted)*channels*2);
        while(emitted<received)if(dsp.drain(frame)){write(output);emitted++;}
        output.flip();
    }
    private void write(ByteBuffer output){for(int ch=0;ch<channels;ch++)output.putShort((short)Math.max(-32768,Math.min(32767,Math.round(frame[ch]*32768))));}
    @Override protected void onReset(){core=null;sampleRate=channels=0;}

    public AudioProcessorChain chain(){
        DefaultAudioSink.DefaultAudioProcessorChain timing=new DefaultAudioSink.DefaultAudioProcessorChain(new AudioProcessor[0]);
        AudioProcessor[] base=timing.getAudioProcessors(),all=Arrays.copyOf(base,base.length+1);all[base.length]=this;
        return new AudioProcessorChain(){
            public AudioProcessor[] getAudioProcessors(){return all;}
            public PlaybackParameters applyPlaybackParameters(PlaybackParameters p){return timing.applyPlaybackParameters(p);}
            public boolean applySkipSilenceEnabled(boolean v){return timing.applySkipSilenceEnabled(v);}
            public long getMediaDuration(long v){return timing.getMediaDuration(v);}
            public long getSkippedOutputFrameCount(){return timing.getSkippedOutputFrameCount();}
        };
    }
}
