"""Run the independent on-device parity gate, failing on instrumentation exceptions."""
import json
from pathlib import Path
import subprocess
import zipfile


def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT)


out = Path('verification/recommendations')
out.mkdir(parents=True, exist_ok=True)
apks = list(Path('scripts/recommendations/android-gate/build/outputs/apk/debug').glob('*-debug.apk'))
assert len(apks) == 1, f'Expected one validation APK: {apks}'
with zipfile.ZipFile(apks[0]) as apk:
    native = [n for n in apk.namelist() if n.startswith('lib/') and n.endswith('.so')]
    (out / 'runtime-packaging.json').write_text(json.dumps({'apk_bytes': apks[0].stat().st_size, 'native_libraries': native}, indent=2))
run('adb', 'install', '-r', str(apks[0]))
result = run('adb', 'shell', 'am', 'instrument', '-w', 'app.aiplayed.modelgate/app.aiplayed.modelgate.ModelGate')
(out / 'instrumentation.txt').write_text(result)
print(result)
assert 'INSTRUMENTATION_CODE: -1' in result, 'Android parity instrumentation failed'
report = run('adb', 'exec-out', 'run-as', 'app.aiplayed.modelgate', 'cat', 'files/android-parity.json')
(out / 'android-parity.json').write_text(report)
parsed = json.loads(report)
assert parsed['passed'] and len(parsed['clips']) >= 8
print('Android parity passed:', len(parsed['clips']), 'music clips')
