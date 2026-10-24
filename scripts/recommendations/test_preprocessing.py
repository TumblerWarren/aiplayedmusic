"""Verify the native FFT against NumPy, including the short-input padding adapter."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import numpy as np

SOURCE = Path(__file__).resolve().parents[2] / 'modules/local-music/android/recommendation-runtime/src/main/java/app/localmusic/player/recommendations'


class TransformTests(unittest.TestCase):
    def test_fft_and_short_padding(self):
        rng = np.random.default_rng(130)
        fft, hop, bands, samples = 1024, 512, 8, 4096
        # Independent direct spectrum oracle; float tables stand in for checkpoint assets.
        window = (.5 - .5 * np.cos(2 * np.pi * np.arange(fft) / fft)).astype('<f4')
        filters = rng.random((fft // 2 + 1, bands), dtype=np.float32) / 100
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            window.tofile(root / 'window')
            filters.tofile(root / 'filters')
            helper = root / 'Probe.java'
            helper.write_text('''
import java.nio.*;
import java.nio.file.*;
import app.localmusic.player.recommendations.LogMel;
public class Probe {
 static float[] read(String path) throws Exception {
  byte[] bytes=Files.readAllBytes(Path.of(path)); float[] f=new float[bytes.length/4];
  ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(f); return f;
 }
 public static void main(String[] a) throws Exception {
  float[] result=new LogMel(1024,512,8,4096,.001f,read(a[0]),read(a[1])).apply(read(a[2]));
  ByteBuffer b=ByteBuffer.allocate(result.length*4).order(ByteOrder.LITTLE_ENDIAN);
  b.asFloatBuffer().put(result); Files.write(Path.of(a[3]),b.array());
 }
}''')
            javac = [shutil.which('javac')] if shutil.which('javac') else ['java', '-m', 'jdk.compiler/com.sun.tools.javac.Main']
            subprocess.run(javac + ['-d', str(root), str(SOURCE / 'LogMel.java'), str(helper)], check=True)
            for length in (1, 333, samples):
                with self.subTest(samples=length):
                    pcm = rng.normal(0, .05, length).astype('<f4')
                    pcm.tofile(root / 'pcm')
                    subprocess.run(['java', '-cp', str(root), 'Probe', str(root / 'window'), str(root / 'filters'), str(root / 'pcm'), str(root / 'result')], check=True)
                    padded = np.pad(pcm, (0, samples - length))
                    frames = np.stack([padded[i:i + fft] * window for i in range(0, samples - fft + 1, hop)])
                    power = np.abs(np.fft.rfft(frames)) ** 2
                    expected = np.log(power @ filters + .001).T
                    actual = np.fromfile(root / 'result', dtype='<f4').reshape(expected.shape)
                    np.testing.assert_allclose(actual, expected, atol=3e-6, rtol=1e-5)


if __name__ == '__main__':
    unittest.main()
