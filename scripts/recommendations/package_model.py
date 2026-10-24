"""Publishable bundle contains no fixture music and no classification/distillation heads."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path('.model-tools')
output = root / 'output'
manifest = json.loads((output / 'manifest.json').read_text())
python = json.loads((output / 'python-parity.json').read_text())
android = json.loads((root / 'android/android-parity.json').read_text())
assert python['passed'] and android['passed'] and len(android['clips']) == 29
assert manifest['sha256'] == 'b71333936779151d44e6b6e90e97af6729bc6f1c7f69a901b1a4d3881abb4723'
assert manifest['weights'] == manifest['inference'] == 'FP32'
assert manifest['bytes'] == 11979512 <= 20_000_000
for clip in android['clips']:
    assert clip['runtime_cosine'] >= .999 and clip['preprocessing_and_runtime_cosine'] >= .999
files = [manifest['file'], 'manifest.json', 'window.f32', 'mel-filters.f32', 'LICENSE-SSONDO.txt']
archive = root / 'ssondo-fp32-v1.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
    for name in files:
        item = zipfile.ZipInfo(name, date_time=(2026, 10, 23, 0, 0, 0))
        item.compress_type = zipfile.ZIP_DEFLATED
        bundle.writestr(item, (output / name).read_bytes(), compresslevel=9)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(root / 'SHA256SUMS').write_text(digest + '  ' + archive.name + '\n')
(root / 'model-release-notes.md').write_text(f'''Pinned S-SONDO matpac-mobilenetv3 embedding-only FP32 model, MIT licensed.

Model: {manifest['bytes']:,} bytes. Model SHA-256: `{manifest['sha256']}`.
Bundle: {archive.stat().st_size:,} bytes. Bundle SHA-256: `{digest}`.
Source: `{manifest['source_revision']}`. Checkpoint: `{manifest['checkpoint_revision']}`.
Runtime: standalone LiteRT CPU Interpreter 2.3.0. No quantisation.

Python/export parity passed on 29 inputs, including 22 held-out music segments and
short-input/resampling cases. Android CPU Interpreter and native resampling/log-mel
parity passed on the same inputs at cosine agreement >= 0.999. Reports are attached.
These measurements use hosted CPU and an Android 35 x86_64 emulator. Physical-phone
performance and recommendation relevance evaluation remain pending.

This is a model-assets prerelease, not an application APK release. It must not
replace the latest application release. Application v1.2.6 is preserved.
''')
print(json.dumps({'bundle_sha256': digest, 'bundle_bytes': archive.stat().st_size, 'model_bytes': manifest['bytes']}))
