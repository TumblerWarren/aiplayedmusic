package app.localmusic.player.recommendations;

/** CPU log-power Slaney mel transform using checkpoint-pinned FP32 filter tables. */
public final class LogMel {
    private final int fftSize, hop, bands, frames, samples;
    private final float offset;
    private final float[] window, filters;

    public LogMel(int fftSize, int hop, int bands, int samples, float offset, float[] window, float[] filters) {
        if (fftSize <= 0 || (fftSize & (fftSize - 1)) != 0) throw new IllegalArgumentException("Power-of-two FFT required");
        this.fftSize = fftSize; this.hop = hop; this.bands = bands; this.samples = samples; this.offset = offset;
        this.window = window; this.filters = filters;
        frames = 1 + (samples - fftSize) / hop;
        if (window.length != fftSize || filters.length != (fftSize / 2 + 1) * bands) throw new IllegalArgumentException("Invalid checkpoint tables");
    }

    public float[] apply(float[] pcm) {
        float[] output = new float[bands * frames];
        double[] real = new double[fftSize], imaginary = new double[fftSize];
        float[] power = new float[fftSize / 2 + 1];
        for (int frame = 0; frame < frames; frame++) {
            for (int i = 0; i < fftSize; i++) {
                int index = frame * hop + i;
                // Reference adapter right-pads short inputs with zeros and truncates at ten seconds.
                real[i] = index < pcm.length && index < samples ? pcm[index] * window[i] : 0;
                imaginary[i] = 0;
            }
            fft(real, imaginary);
            for (int bin = 0; bin < power.length; bin++) power[bin] = (float)(real[bin] * real[bin] + imaginary[bin] * imaginary[bin]);
            for (int band = 0; band < bands; band++) {
                float sum = 0;
                for (int bin = 0; bin < power.length; bin++) sum += power[bin] * filters[bin * bands + band];
                output[band * frames + frame] = (float)Math.log(sum + offset);
            }
        }
        return output;
    }

    private static void fft(double[] real, double[] imaginary) {
        int length = real.length;
        for (int i = 1, j = 0; i < length; i++) {
            int bit = length >> 1;
            for (; (j & bit) != 0; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) { double t = real[i]; real[i] = real[j]; real[j] = t; }
        }
        for (int span = 2; span <= length; span <<= 1) {
            double angle = -2 * Math.PI / span;
            double stepReal = Math.cos(angle), stepImaginary = Math.sin(angle);
            for (int start = 0; start < length; start += span) {
                double wr = 1, wi = 0;
                for (int j = 0; j < span / 2; j++) {
                    int even = start + j, odd = even + span / 2;
                    double tr = wr * real[odd] - wi * imaginary[odd];
                    double ti = wr * imaginary[odd] + wi * real[odd];
                    real[odd] = real[even] - tr; imaginary[odd] = imaginary[even] - ti;
                    real[even] += tr; imaginary[even] += ti;
                    double next = wr * stepReal - wi * stepImaginary;
                    wi = wr * stepImaginary + wi * stepReal; wr = next;
                }
            }
        }
    }
}
