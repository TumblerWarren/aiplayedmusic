package app.localmusic.player.recommendations;

import android.content.Context;
import android.media.AudioFormat;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.net.Uri;
import android.os.SystemClock;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;
import java.util.concurrent.CancellationException;
import java.util.function.BooleanSupplier;

/** Bounded original-file decoder. It never reads playback audio or its DSP output. */
public final class AudioDecoder {
    public static final class Decoded {
        public final float[] mono;
        public final int sampleRate;
        public Decoded(float[] mono,int sampleRate){this.mono=mono;this.sampleRate=sampleRate;}
    }
    private AudioDecoder(){}
    public static Decoded section(Context context,Uri uri,long startMs,BooleanSupplier allowed) throws IOException {
        MediaExtractor extractor=new MediaExtractor();MediaCodec codec=null;
        try{
            extractor.setDataSource(context,uri,null);
            MediaFormat input=null;
            for(int i=0;i<extractor.getTrackCount();i++){
                MediaFormat candidate=extractor.getTrackFormat(i);String mime=candidate.getString(MediaFormat.KEY_MIME);
                if(mime!=null&&mime.startsWith("audio/")){extractor.selectTrack(i);input=candidate;break;}
            }
            if(input==null)throw new IOException("No audio track");
            int rate=input.getInteger(MediaFormat.KEY_SAMPLE_RATE),channels=input.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
            if(rate<8000||rate>192000||channels<1||channels>16)throw new IOException("Unsupported audio format");
            long startUs=Math.max(0,startMs)*1000,endUs=startUs+10_000_000;
            extractor.seekTo(startUs,MediaExtractor.SEEK_TO_PREVIOUS_SYNC);
            codec=MediaCodec.createDecoderByType(input.getString(MediaFormat.KEY_MIME));codec.configure(input,null,null,0);codec.start();
            MediaCodec.BufferInfo info=new MediaCodec.BufferInfo();boolean sentEnd=false,done=false;
            int encoding=AudioFormat.ENCODING_PCM_16BIT,count=0,initialRate=rate;
            float[] mono=new float[rate*10];
            long deadline=SystemClock.elapsedRealtime()+30000;
            while(!done){
                if(!allowed.getAsBoolean())throw new CancellationException("Analysis paused");
                if(SystemClock.elapsedRealtime()>deadline)throw new IOException("Audio decoding timed out");
                if(!sentEnd){int index=codec.dequeueInputBuffer(10000);if(index>=0){
                    ByteBuffer buffer=codec.getInputBuffer(index);long timestamp=extractor.getSampleTime();
                    int size=timestamp<0||timestamp>endUs+1000000?-1:extractor.readSampleData(buffer,0);
                    if(size<0){codec.queueInputBuffer(index,0,0,0,MediaCodec.BUFFER_FLAG_END_OF_STREAM);sentEnd=true;}
                    else{codec.queueInputBuffer(index,0,size,timestamp,0);extractor.advance();}
                }}
                int index=codec.dequeueOutputBuffer(info,10000);
                if(index==MediaCodec.INFO_OUTPUT_FORMAT_CHANGED){
                    MediaFormat format=codec.getOutputFormat();rate=format.getInteger(MediaFormat.KEY_SAMPLE_RATE);channels=format.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
                    encoding=format.containsKey(MediaFormat.KEY_PCM_ENCODING)?format.getInteger(MediaFormat.KEY_PCM_ENCODING):AudioFormat.ENCODING_PCM_16BIT;
                    if(rate<8000||rate>192000||channels<1||channels>16)throw new IOException("Unsupported decoded format");
                    if(rate!=initialRate){if(count>0)throw new IOException("Sample rate changed within the audio section");mono=new float[rate*10];initialRate=rate;}
                }else if(index>=0){
                    ByteBuffer buffer=codec.getOutputBuffer(index);
                    if(buffer!=null&&info.size>0&&(info.flags&MediaCodec.BUFFER_FLAG_CODEC_CONFIG)==0){
                        buffer.position(info.offset);buffer.limit(info.offset+info.size);buffer.order(ByteOrder.LITTLE_ENDIAN);
                        int bytes=encoding==AudioFormat.ENCODING_PCM_FLOAT||encoding==AudioFormat.ENCODING_PCM_32BIT?4:encoding==AudioFormat.ENCODING_PCM_24BIT_PACKED?3:encoding==AudioFormat.ENCODING_PCM_8BIT?1:2;
                        int frames=buffer.remaining()/(bytes*channels);
                        for(int frame=0;frame<frames;frame++){
                            float sum=0;
                            for(int channel=0;channel<channels;channel++)sum+=sample(buffer,encoding);
                            long timestamp=info.presentationTimeUs+frame*1000000L/rate;
                            if(timestamp>=startUs&&timestamp<endUs&&count<mono.length)mono[count++]=sum/channels;
                            if(timestamp>=endUs)done=true;
                        }
                    }
                    done|=(info.flags&MediaCodec.BUFFER_FLAG_END_OF_STREAM)!=0;
                    codec.releaseOutputBuffer(index,false);
                }
            }
            if(count==0)throw new IOException("Audio section is empty");
            return new Decoded(Arrays.copyOf(mono,count),rate);
        }finally{
            if(codec!=null){try{codec.stop();}catch(Exception ignored){}codec.release();}
            extractor.release();
        }
    }
    private static float sample(ByteBuffer buffer,int encoding) throws IOException {
        if(encoding==AudioFormat.ENCODING_PCM_FLOAT){float value=buffer.getFloat();if(!Float.isFinite(value))throw new IOException("Non-finite decoded audio");return value;}
        if(encoding==AudioFormat.ENCODING_PCM_16BIT)return buffer.getShort()/32768f;
        if(encoding==AudioFormat.ENCODING_PCM_8BIT)return ((buffer.get()&255)-128)/128f;
        if(encoding==AudioFormat.ENCODING_PCM_32BIT)return (float)(buffer.getInt()/2147483648d);
        if(encoding==AudioFormat.ENCODING_PCM_24BIT_PACKED){int value=(buffer.get()&255)|((buffer.get()&255)<<8)|(buffer.get()<<16);return value/8388608f;}
        throw new IOException("Unsupported decoded PCM encoding");
    }
}
