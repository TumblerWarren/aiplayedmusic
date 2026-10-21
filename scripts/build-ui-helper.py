"""Build a CI inspector APK using installed Android SDK tools; no app modifications."""
import os
from pathlib import Path
import subprocess
import zipfile

def run(*args): subprocess.run(list(map(str, args)), check=True)

sdk = Path(os.environ['ANDROID_HOME'])
build = sdk/'build-tools/36.0.0'
platform = sdk/'platforms/android-36/android.jar'
source = Path('scripts/android-ui-helper')
out = Path('/tmp/aiplayed-ui-helper'); out.mkdir(exist_ok=True)
classes = out/'classes'; classes.mkdir(exist_ok=True)
dex = out/'dex'; dex.mkdir(exist_ok=True)
run('javac', '-source', '8', '-target', '8', '-cp', platform, '-d', classes, source/'Dump.java')
run('jar', 'cf', out/'helper.jar', '-C', classes, '.')
run(build/'d8', '--min-api', '26', '--lib', platform, '--output', dex, out/'helper.jar')
apk = out/'ui-helper.apk'
run(build/'aapt2', 'link', '-I', platform, '--manifest', source/'AndroidManifest.xml', '-o', apk)
with zipfile.ZipFile(apk, 'a') as archive: archive.write(dex/'classes.dex', 'classes.dex')
aligned = out/'aligned.apk'
run(build/'zipalign', '-f', '4', apk, aligned)
apk.unlink(); aligned.rename(apk)
keystore = Path('android/app/debug.keystore')
if not keystore.exists():
    keystore = out/'inspector.keystore'
    if not keystore.exists():
        run('keytool', '-genkeypair', '-keystore', keystore, '-storepass', 'android', '-keypass', 'android', '-alias', 'inspector', '-dname', 'CN=Aiplayed UI inspector', '-keyalg', 'RSA', '-validity', '3650')
run(build/'apksigner', 'sign', '--ks', keystore, '--ks-pass', 'pass:android', '--key-pass', 'pass:android', apk)
run(build/'apksigner', 'verify', apk)
print('Built animation-safe CI inspector:', apk)
