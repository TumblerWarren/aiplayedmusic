package app.aiplayed.modelgate;

import android.app.Instrumentation;
import android.os.Bundle;
import android.os.SystemClock;
import org.json.JSONArray;
import org.json.JSONObject;
import org.tensorflow.lite.Interpreter;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.security.MessageDigest;
import java.util.Arrays;

public final class ModelGate extends Instrumentation {
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            JSONObject manifest = new JSONObject(new String(bytes("manifest.json"), java.nio.charset.StandardCharsets.UTF_8));
            byte[] modelBytes = bytes(manifest.getString("file"));
            StringBuilder digest = new StringBuilder();
            for (byte b : MessageDigest.getInstance("SHA-256").digest(modelBytes)) digest.append(String.format("%02x", b & 255));
            require(digest.toString().equals(manifest.getString("sha256")), "Model checksum mismatch");
            require(modelBytes.length <= 20_000_000, "Model size exceeds ceiling");
            ByteBuffer model = ByteBuffer.allocateDirect(modelBytes.length).order(ByteOrder.nativeOrder());
            model.put(modelBytes).rewind();
            JSONObject p = manifest.getJSONObject("preprocessing");
            require(!p.getBoolean("center") && p.getInt("pad") == 0 && p.getInt("power") == 2 && !p.getBoolean("normalized"), "Unsupported preprocessing");
            require(p.getInt("n_fft") == p.getInt("win_length"), "Unsupported window");
            LogMel transform = new LogMel(p.getInt("n_fft"), p.getInt("hop_length"), p.getInt("n_mels"),
                p.getInt("segment_samples"), (float)p.getDouble("log_offset"), floats("window.f32"), floats("mel-filters.f32"));
            JSONArray names = new JSONArray(new String(bytes("golden.json"), java.nio.charset.StandardCharsets.UTF_8));
            JSONArray clips = new JSONArray();
            long peakPssKiB = 0, peakNativeHeapBytes = 0;
            try (Interpreter interpreter = new Interpreter(model, new Interpreter.Options().setNumThreads(2))) {
                for (int i = 0; i < names.length(); i++) {
                    String name = names.getString(i), base = "golden/" + name;
                    float[] expected = floats(base + ".embedding.f32");
                    float[] sourcePcm = floats(base + ".source.f32");
                    int sourceRate = Integer.parseInt(new String(bytes(base + ".source-rate.txt"), java.nio.charset.StandardCharsets.UTF_8));
                    float[] pcm = SincResampler.apply(sourcePcm, sourceRate, p.getInt("sample_rate"));
                    float[] logmel = transform.apply(pcm);
                    float[] referenceMel = floats(base + ".mel.f32");
                    require(logmel.length == referenceMel.length, "Spectrogram shape mismatch");
                    float maximumError = 0;
                    for (int j = 0; j < logmel.length; j++) maximumError = Math.max(maximumError, Math.abs(logmel[j] - referenceMel[j]));
                    float[] runtimeOnly = infer(interpreter, referenceMel);
                    long began = SystemClock.elapsedRealtimeNanos();
                    float[] actual = infer(interpreter, logmel);
                    double elapsed = (SystemClock.elapsedRealtimeNanos() - began) / 1e6;
                    double runtimeCosine = cosine(expected, runtimeOnly), fullCosine = cosine(expected, actual);
                    require(runtimeCosine >= .999 && fullCosine >= .999, name + " parity failed: " + runtimeCosine + ", " + fullCosine);
                    JSONObject clip = new JSONObject();
                    clip.put("clip", name).put("runtime_cosine", runtimeCosine).put("preprocessing_and_runtime_cosine", fullCosine)
                        .put("mel_max_absolute_error", maximumError).put("inference_ms", elapsed);
                    clips.put(clip);
                    android.os.Debug.MemoryInfo memory = new android.os.Debug.MemoryInfo();
                    android.os.Debug.getMemoryInfo(memory);
                    peakPssKiB = Math.max(peakPssKiB, memory.getTotalPss());
                    peakNativeHeapBytes = Math.max(peakNativeHeapBytes, android.os.Debug.getNativeHeapAllocatedSize());
                }
            }
            JSONObject report = new JSONObject();
            report.put("passed", true).put("device", android.os.Build.MODEL).put("abi", Arrays.toString(android.os.Build.SUPPORTED_ABIS))
                .put("sdk", android.os.Build.VERSION.SDK_INT).put("clips", clips)
                .put("measurement_kind", "emulator; physical phone measurements pending")
                .put("java_heap_bytes", Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory())
                .put("peak_native_heap_bytes", peakNativeHeapBytes).put("peak_process_pss_kib", peakPssKiB);
            try (java.io.FileOutputStream stream = getTargetContext().openFileOutput("android-parity.json", 0)) {
                stream.write(report.toString(2).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            }
            result.putString("stream", report.toString());
            finish(-1, result);
        } catch (Throwable error) {
            result.putString("stream", android.util.Log.getStackTraceString(error));
            finish(1, result);
        }
    }

    private float[] infer(Interpreter interpreter, float[] input) {
        ByteBuffer tensor = ByteBuffer.allocateDirect(input.length * 4).order(ByteOrder.nativeOrder());
        tensor.asFloatBuffer().put(input);
        float[][] output = new float[1][960];
        interpreter.run(tensor, output);
        return output[0];
    }
    private byte[] bytes(String name) throws Exception {
        try (InputStream input = getTargetContext().getAssets().open(name)) { java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream(); byte[] chunk = new byte[16384]; int n; while ((n = input.read(chunk)) != -1) out.write(chunk, 0, n); return out.toByteArray(); }
    }
    private float[] floats(String name) throws Exception {
        byte[] data = bytes(name);
        float[] values = new float[data.length / 4];
        ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(values);
        return values;
    }
    private static double cosine(float[] a, float[] b) {
        double dot = 0, aa = 0, bb = 0;
        for (int i = 0; i < a.length; i++) { dot += (double)a[i] * b[i]; aa += (double)a[i] * a[i]; bb += (double)b[i] * b[i]; }
        double value = dot / Math.sqrt(aa * bb);
        require(Double.isFinite(value), "Non-finite embedding");
        return value;
    }
    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
