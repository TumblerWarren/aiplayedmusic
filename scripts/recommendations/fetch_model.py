"""Build-time download only. Production Android has neither a download path nor Internet permission."""
from pathlib import Path
import hashlib
import json
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
PIN = json.loads((Path(__file__).parent / 'model-assets.json').read_text())
EXPECTED = {'ssondo-matpac-mobilenetv3-fp32.tflite', 'manifest.json', 'window.f32', 'mel-filters.f32', 'LICENSE-SSONDO.txt'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def install(bundle, destination):
    data = Path(bundle).read_bytes()
    assert len(data) == PIN['bundle_bytes'] and digest(data) == PIN['bundle_sha256'], 'Pinned model bundle checksum mismatch'
    with zipfile.ZipFile(bundle) as archive:
        assert set(archive.namelist()) == EXPECTED and len(archive.namelist()) == len(EXPECTED), 'Unexpected model bundle entries'
        manifest = json.loads(archive.read('manifest.json'))
        assert manifest['weights'] == manifest['inference'] == 'FP32'
        assert manifest['bytes'] == PIN['model_bytes'] <= 20_000_000
        assert manifest['runtime_version'] == PIN['runtime_version'] and manifest['embedding_dimensions'] == 960
        assert manifest['source_revision'] == PIN['source_revision'] and manifest['checkpoint_revision'] == PIN['checkpoint_revision']
        assert digest(archive.read(manifest['file'])) == PIN['model_sha256'] == manifest['sha256']
        destination = Path(destination)
        destination.mkdir(parents=True, exist_ok=True)
        for name in sorted(EXPECTED):
            (destination / name).write_bytes(archive.read(name))
    print(f"Verified and bundled FP32 model: {PIN['model_bytes']:,} bytes; SHA-256 {PIN['model_sha256']}")


def main():
    cache = ROOT / '.build-tools/model-assets'
    cache.mkdir(parents=True, exist_ok=True)
    bundle = cache / 'ssondo-fp32-v1.zip'
    if not bundle.exists() or digest(bundle.read_bytes()) != PIN['bundle_sha256']:
        request = urllib.request.Request(PIN['url'], headers={'User-Agent': 'Aiplayed-model-build/1.3.0'})
        with urllib.request.urlopen(request, timeout=120) as source:
            data = source.read(PIN['bundle_bytes'] + 1)
        assert len(data) == PIN['bundle_bytes'] and digest(data) == PIN['bundle_sha256'], 'Pinned model download checksum mismatch'
        bundle.write_bytes(data)
    install(bundle, ROOT / 'modules/local-music/android/src/main/assets/recommendations')


if __name__ == '__main__':
    main()
