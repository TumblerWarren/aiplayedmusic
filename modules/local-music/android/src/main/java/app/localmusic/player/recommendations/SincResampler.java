package app.localmusic.player.recommendations;

/** Matches torchaudio's default sinc_interp_hann (width 6, rolloff .99). */
public final class SincResampler {
    private SincResampler() {}
    public static float[] apply(float[] pcm, int sourceRate, int targetRate) {
        if (sourceRate < 1000 || targetRate < 1000) throw new IllegalArgumentException("Invalid sample rate");
        if (sourceRate == targetRate) return pcm.clone();
        int divisor = gcd(sourceRate, targetRate);
        int original = sourceRate / divisor, target = targetRate / divisor;
        double base = Math.min(original, target) * .99;
        int width = (int)Math.ceil(6 * original / base);
        int taps = width * 2 + original;
        float[][] kernel = new float[target][taps];
        for (int phase = 0; phase < target; phase++) {
            for (int tap = 0; tap < taps; tap++) {
                double t = ((double)(tap - width) / original - (double)phase / target) * base;
                t = Math.max(-6, Math.min(6, t));
                double window = Math.cos(t * Math.PI / 12);
                double angle = t * Math.PI;
                kernel[phase][tap] = (float)((angle == 0 ? 1 : Math.sin(angle) / angle) * window * window * base / original);
            }
        }
        int[] first = new int[target], last = new int[target];
        for (int phase = 0; phase < target; phase++) {
            int begin = 0, end = taps;
            while (begin < end && kernel[phase][begin] == 0f) begin++;
            while (end > begin && kernel[phase][end - 1] == 0f) end--;
            first[phase] = begin; last[phase] = end;
        }
        int length = (int)Math.ceil((double)target * pcm.length / original);
        float[] result = new float[length];
        for (int block = 0, index = 0; index < length; block++) {
            for (int phase = 0; phase < target && index < length; phase++, index++) {
                float sum = 0;
                int start = block * original - width;
                for (int tap = first[phase]; tap < last[phase]; tap++) {
                    int at = start + tap;
                    if (at >= 0 && at < pcm.length) sum += pcm[at] * kernel[phase][tap];
                }
                result[index] = sum;
            }
        }
        return result;
    }
    private static int gcd(int a, int b) { while (b != 0) { int next = a % b; a = b; b = next; } return a; }
}
