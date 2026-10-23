"""Pinned embedding-only FP32 export. Outputs remain gate artifacts until approved."""
from pathlib import Path
import hashlib
import json
import resource
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request

SOURCE = '231d260cc1be2eb93b060accc8bfa218feff3a74'
REVISION = 'afc946ee816eb2287b62c7cadadd59e507996b23'
CHECKSUM = '87cff558a9a442e97d630a79f391bce8663d31a3adcbbf0b0a8cc41cb41854fc'
OUT = Path('.model-tools/output')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def download(url, path, expected):
    path = Path(path)
    if not path.exists() or sha(path) != expected:
        with urllib.request.urlopen(url, timeout=120) as response, path.open('wb') as target:
            shutil.copyfileobj(response, target)
    assert sha(path) == expected, f'Checksum mismatch: {path.name}'
    return path


def save(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2) + '\n')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    import numpy as np
    import torch
    import torchaudio
    import soundfile as sf
    torch.set_num_threads(2)
    source = Path('.model-tools/ssondo').resolve()
    assert subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip() == SOURCE
    sys.path.insert(0, str(source / 'inference_ssondo'))
    from ssondo import get_ssondo
    checkpoint = download(f'https://huggingface.co/mohammedali2501/ssondo/resolve/{REVISION}/matpac_mobilenetv3.ckpt',
                          OUT.parent / 'checkpoint.ckpt', CHECKSUM)
    # Check the immutable checkpoint hash BEFORE trusted upstream pickle deserialisation.
    config = torch.load(checkpoint, map_location='cpu', weights_only=False)['training_config']
    save('checkpoint-config.json', config)
    reference = get_ssondo(str(checkpoint), device='cpu').eval().float()
    mel = reference.logmel.MelSpectrogram
    samples = int(reference.slicer.window_length * reference.slicer.sr)
    print('REFERENCE', json.dumps({'samples': samples, 'sample_rate': mel.sample_rate,
          'dimensions': reference.embedding_dim, 'parameters': sum(p.numel() for p in reference.backbone.parameters())}), flush=True)
    assert reference.embedding_dim == 960
    assert samples == 10 * mel.sample_rate, 'Checkpoint segment length differs from the agreed ten seconds'

    class EmbeddingOnly(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.backbone = reference.backbone

        def forward(self, logmel):
            return self.backbone(logmel).reshape(1, 960)

    embedding = EmbeddingOnly().eval().float()
    embedding.requires_grad_(False)
    with torch.no_grad():
        example = reference.preprocess(torch.zeros(samples)).contiguous()
    import litert_torch
    start = time.perf_counter()
    converted = litert_torch.convert(embedding, (example,))
    model = OUT / 'ssondo-matpac-mobilenetv3-fp32.tflite'
    converted.export(str(model))
    size = model.stat().st_size
    manifest = {
        'schema': 1, 'model': 'matpac-mobilenetv3', 'weights': 'FP32', 'inference': 'FP32',
        'source_repository': 'MedAliAdlouni/ssondo', 'source_revision': SOURCE,
        'checkpoint_repository': 'mohammedali2501/ssondo', 'checkpoint_revision': REVISION,
        'checkpoint_sha256': CHECKSUM, 'file': model.name, 'sha256': sha(model), 'bytes': size,
        'ceiling_bytes': 20_000_000, 'runtime': 'LiteRT CPU Interpreter', 'runtime_version': '2.3.0',
        'input_shape': list(example.shape), 'embedding_dimensions': 960,
        'export_seconds': time.perf_counter() - start,
        'preprocessing': {'version': 1, 'sample_rate': mel.sample_rate, 'segment_samples': samples,
            'n_fft': mel.n_fft, 'win_length': mel.win_length, 'hop_length': mel.hop_length,
            'n_mels': mel.n_mels, 'f_min': mel.f_min, 'f_max': mel.f_max,
            'center': mel.spectrogram.center, 'power': mel.spectrogram.power,
            'normalized': mel.spectrogram.normalized, 'pad': mel.spectrogram.pad,
            'mel_scale': mel.mel_scale.mel_scale, 'norm': mel.mel_scale.norm,
            'log_offset': reference.logmel.log_offset,
            'short_audio': 'Right zero-pad before reference preprocessing; upstream default slicer does not pad short inputs',
            'resampling': 'torchaudio sinc_interp_hann, lowpass_filter_width=6, rolloff=0.99'},
    }
    shutil.copy(source / 'LICENSE', OUT / 'LICENSE-SSONDO.txt')
    save('manifest.json', manifest)
    print('EXPORT', json.dumps(manifest), flush=True)
    assert size <= 20_000_000, f'Model gate failed: {size} bytes exceeds 20 MB'

    from ai_edge_litert.interpreter import Interpreter
    from ai_edge_litert import schema_py_generated as schema
    flat = schema.Model.GetRootAsModel(model.read_bytes(), 0)
    for g in range(flat.SubgraphsLength()):
        graph = flat.Subgraphs(g)
        for t in range(graph.TensorsLength()):
            tensor = graph.Tensors(t)
            assert tensor.Type() != schema.TensorType.FLOAT16, 'FP16 is forbidden'
            q = tensor.Quantization()
            assert q is None or q.ScaleLength() == 0, 'Quantisation is forbidden'
    interpreter = Interpreter(model_path=str(model), num_threads=2)
    interpreter.allocate_tensors()
    inp, output = interpreter.get_input_details()[0], interpreter.get_output_details()[0]
    assert inp['dtype'] == np.float32 and output['dtype'] == np.float32
    fixtures = json.loads(Path('scripts/recommendations/fixtures.json').read_text())
    fixture_dir = OUT.parent / 'fixtures'
    fixture_dir.mkdir(exist_ok=True)
    golden_dir = OUT / 'golden'
    golden_dir.mkdir(exist_ok=True)
    mel.spectrogram.window.numpy().astype('<f4').tofile(OUT / 'window.f32')
    mel.mel_scale.fb.numpy().astype('<f4').tofile(OUT / 'mel-filters.f32')
    vectors, exports, results, names = [], [], [], []
    def check_clip(name, source_pcm, source_rate):
        pcm = torchaudio.functional.resample(source_pcm, source_rate, mel.sample_rate)
        pcm = pcm[:samples]
        pcm = torch.nn.functional.pad(pcm, (0, max(0, samples - len(pcm))))
        logmel = reference.preprocess(pcm).contiguous()
        original = reference.get_embeddings(pcm).numpy().reshape(-1)
        interpreter.set_tensor(inp['index'], logmel.numpy())
        began = time.perf_counter()
        interpreter.invoke()
        elapsed = time.perf_counter() - began
        exported = interpreter.get_tensor(output['index']).reshape(-1)
        cosine = float(np.dot(original, exported) / (np.linalg.norm(original) * np.linalg.norm(exported)))
        assert np.isfinite(exported).all() and cosine >= .999, (name, cosine)
        results.append({'clip': name, 'cosine': cosine, 'inference_ms': elapsed * 1000})
        vectors.append(original); exports.append(exported); names.append(name)
        source_pcm.numpy().astype('<f4').tofile(golden_dir / (name + '.source.f32'))
        (golden_dir / (name + '.source-rate.txt')).write_text(str(source_rate))
        pcm.numpy().astype('<f4').tofile(golden_dir / (name + '.pcm.f32'))
        logmel.numpy().astype('<f4').tofile(golden_dir / (name + '.mel.f32'))
        original.astype('<f4').tofile(golden_dir / (name + '.embedding.f32'))

    with torch.inference_mode():
        for fixture in fixtures:
            base = 'https://librosa.org/data/audio/' + urllib.parse.quote(fixture['path'])
            audio = download(base + '.ogg', fixture_dir / (fixture['id'] + '.ogg'), fixture['sha256'])
            download(base + '.toml', OUT / (fixture['id'] + '-licence.toml'), fixture['licence_sha256'])
            decoded, source_rate = sf.read(str(audio), dtype='float32', always_2d=True)
            signal = torch.from_numpy(decoded.mean(axis=1))
            source_samples = 10 * source_rate
            starts = sorted(set([0, max(0, (len(signal) - source_samples) // 2), max(0, len(signal) - source_samples)]))
            for section, offset in enumerate(starts):
                check_clip(f"{fixture['id']}-{section}", signal[offset:offset + source_samples], source_rate)
        # Padding, resampling and log-offset edge cases supplement held-out music.
        generator = torch.Generator().manual_seed(1030)
        for rate in (16000, 22050, 32000, 44100, 48000):
            time_axis = torch.arange(rate // 4, dtype=torch.float32) / rate
            signal = .1 * torch.sin(2 * torch.pi * 440 * time_axis) + .01 * torch.randn(len(time_axis), generator=generator)
            check_clip(f'short-{rate}', signal, rate)
        check_clip('silence', torch.zeros(samples), mel.sample_rate)
        check_clip('one-sample', torch.tensor([.5]), mel.sample_rate)
    py, edge = np.stack(vectors), np.stack(exports)
    py /= np.linalg.norm(py, axis=1, keepdims=True)
    edge /= np.linalg.norm(edge, axis=1, keepdims=True)
    a, b = py @ py.T, edge @ edge.T
    comparisons = 0
    for query in range(len(py)):
        for i in range(len(py)):
            for j in range(i + 1, len(py)):
                if query in (i, j) or abs(a[query, i] - a[query, j]) < .01:
                    continue
                assert (a[query, i] > a[query, j]) == (b[query, i] > b[query, j])
                comparisons += 1
    save('golden.json', names)
    report = {'gate': 'python-export', 'passed': True, 'clips': results, 'retrieval_comparisons': comparisons,
              'minimum_cosine': min(r['cosine'] for r in results), 'model_bytes': size,
              'host_peak_rss_kib': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
              'measurement_device': 'GitHub hosted Linux x86_64 CPU; not a physical Android phone',
              'physical_phone_measurements': 'pending'}
    save('python-parity.json', report)
    (OUT / 'environment.txt').write_bytes(subprocess.check_output([sys.executable, '-m', 'pip', 'freeze']))
    print('PARITY', json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
