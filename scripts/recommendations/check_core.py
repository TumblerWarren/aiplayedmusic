import json
from pathlib import Path
import subprocess
import zipfile


def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT)


out = Path('verification/recommendations/core')
out.mkdir(parents=True, exist_ok=True)
apks = list(Path('scripts/recommendations/android-gate/build/outputs/apk/debug').glob('*-debug.apk'))
assert len(apks) == 1
with zipfile.ZipFile(apks[0]) as apk:
    native = [name for name in apk.namelist() if name.startswith('lib/') and name.endswith('.so')]
    report = {'apk_bytes': apks[0].stat().st_size, 'native_libraries': native}
    (out / 'packaging.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
run('adb', 'install', '-r', str(apks[0]))
result = run('adb', 'shell', 'am', 'instrument', '-r', '-w', 'app.aiplayed.modelgate/app.aiplayed.modelgate.CoreGate')
(out / 'instrumentation.txt').write_text(result)
print(result)
assert 'INSTRUMENTATION_CODE: -1' in result
report = run('adb', 'exec-out', 'run-as', 'app.aiplayed.modelgate', 'cat', 'files/core-gate.json')
(out / 'core-gate.json').write_text(report)
assert json.loads(report)['passed']
