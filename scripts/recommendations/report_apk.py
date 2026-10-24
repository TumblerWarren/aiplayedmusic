"""Separate the universal APK increase from model and standalone runtime bytes."""
from pathlib import Path
import hashlib
import json
import zipfile

BASELINE_BYTES = 71535618
apks = list(Path('android/app/build/outputs/apk/release').glob('*.apk'))
assert len(apks) == 1
apk = apks[0]
with zipfile.ZipFile(apk) as archive:
    entries = archive.infolist()
    model = [item for item in entries if item.filename.endswith('ssondo-matpac-mobilenetv3-fp32.tflite')]
    runtime = [item for item in entries if item.filename.startswith('lib/') and item.filename.endswith(('/libLiteRt.so', '/liblitert_jni.so'))]
    assert len(model) == 1 and model[0].file_size == 11979512
    assert hashlib.sha256(archive.read(model[0])).hexdigest() == 'b71333936779151d44e6b6e90e97af6729bc6f1c7f69a901b1a4d3881abb4723'
    for abi in ['armeabi-v7a', 'arm64-v8a', 'x86_64']:
        assert any(item.filename == f'lib/{abi}/liblitert_jni.so' for item in runtime), abi
    report = {'apk_bytes': apk.stat().st_size, 'v1_2_6_apk_bytes': BASELINE_BYTES,
              'apk_increase_bytes': apk.stat().st_size - BASELINE_BYTES,
              'model_file_bytes': model[0].file_size, 'model_compressed_bytes': model[0].compress_size,
              'runtime_native_compressed_bytes': sum(item.compress_size for item in runtime),
              'runtime_native_uncompressed_bytes': sum(item.file_size for item in runtime),
              'runtime_libraries': [{'file': item.filename, 'bytes': item.file_size, 'compressed_bytes': item.compress_size} for item in runtime],
              'note': 'Total APK increase also includes WorkManager, Java APIs, UI and other dependency/resource changes; native runtime bytes are reported separately.'}
out = Path('verification/recommendations/apk-size.json')
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
