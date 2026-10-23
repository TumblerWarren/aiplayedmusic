package app.localmusic.player.recommendations;

import android.content.Context;
import org.json.JSONObject;
import org.tensorflow.lite.Interpreter;
import java.io.*;
import java.nio.*;
import java.nio.channels.FileChannel;
import java.security.MessageDigest;

/** Standalone CPU FP32 runtime. The validated model is an APK asset, never downloaded. */
public final class ModelRuntime implements AutoCloseable {
    public static final String MODEL_SHA="b71333936779151d44e6b6e90e97af6729bc6f1c7f69a901b1a4d3881abb4723";
    public static final String PREPROCESS_VERSION="ssondo-logmel-v1";
    private final Interpreter interpreter;
    private final LogMel transform;
    public ModelRuntime(Context context) throws Exception {
        JSONObject manifest=new JSONObject(new String(asset(context,"manifest.json"),java.nio.charset.StandardCharsets.UTF_8));
        if(!MODEL_SHA.equals(manifest.getString("sha256"))||!"FP32".equals(manifest.getString("weights"))||manifest.getInt("embedding_dimensions")!=960)throw new IOException("Unapproved model manifest");
        File file=new File(context.getNoBackupFilesDir(),"ssondo-"+MODEL_SHA+".tflite");
        if(!file.exists()||!MODEL_SHA.equals(hash(file))){
            File temporary=new File(file.getPath()+".tmp");
            try(InputStream source=context.getAssets().open("recommendations/"+manifest.getString("file"));OutputStream target=new FileOutputStream(temporary)){
                byte[] buffer=new byte[65536];int read;while((read=source.read(buffer))!=-1)target.write(buffer,0,read);
            }
            if(temporary.length()>20_000_000||!MODEL_SHA.equals(hash(temporary))){temporary.delete();throw new IOException("Model checksum mismatch");}
            if(!temporary.renameTo(file)){temporary.delete();throw new IOException("Couldn't prepare local model");}
        }
        try(FileInputStream stream=new FileInputStream(file)){
            MappedByteBuffer model=stream.getChannel().map(FileChannel.MapMode.READ_ONLY,0,file.length());
            interpreter=new Interpreter(model,new Interpreter.Options().setNumThreads(2));
        }
        JSONObject p=manifest.getJSONObject("preprocessing");
        transform=new LogMel(p.getInt("n_fft"),p.getInt("hop_length"),p.getInt("n_mels"),p.getInt("segment_samples"),
            (float)p.getDouble("log_offset"),floats(context,"window.f32"),floats(context,"mel-filters.f32"));
    }
    public float[] embed(AudioDecoder.Decoded decoded)throws IOException{
        float[] input=transform.apply(SincResampler.apply(decoded.mono,decoded.sampleRate,32000));
        for(float value:input)if(!Float.isFinite(value))throw new IOException("Invalid decoded audio amplitude");
        ByteBuffer tensor=ByteBuffer.allocateDirect(input.length*4).order(ByteOrder.nativeOrder());tensor.asFloatBuffer().put(input);
        float[][] output=new float[1][960];interpreter.run(tensor,output);
        // Keep original FP32 segment vectors; normalise only for cosine/ranking and pooled vectors.
        for(float value:output[0])if(!Float.isFinite(value))throw new IllegalStateException("Non-finite model output");
        return output[0];
    }
    @Override public void close(){interpreter.close();}
    private static byte[] asset(Context context,String name)throws IOException{
        try(InputStream input=context.getAssets().open("recommendations/"+name);ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] bytes=new byte[16384];int count;while((count=input.read(bytes))!=-1)out.write(bytes,0,count);return out.toByteArray();
        }
    }
    private static float[] floats(Context context,String name)throws IOException{byte[] bytes=asset(context,name);float[] result=new float[bytes.length/4];ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(result);return result;}
    private static String hash(File file)throws Exception{
        MessageDigest digest=MessageDigest.getInstance("SHA-256");try(InputStream input=new FileInputStream(file)){byte[] bytes=new byte[65536];int read;while((read=input.read(bytes))!=-1)digest.update(bytes,0,read);}
        StringBuilder value=new StringBuilder();for(byte b:digest.digest())value.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return value.toString();
    }
}
