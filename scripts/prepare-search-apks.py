"""Isolated UI comparison: replace only JS in a retained APK; never publish it."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import zipfile

BASE='360cf0a50749b94ae35c6ca433cffebcaae272d4'
paths=['App.js','src/IndexedSongList.js']
fixed={name:Path(name).read_text() for name in paths}
original=next(Path('candidate').rglob('*.apk'))
sdk=Path(os.environ['ANDROID_HOME'])/'build-tools/36.0.0'
report={}
def run(*args):subprocess.run(list(map(str,args)),check=True)
try:
    for stage in ['baseline','candidate']:
        for name in paths:
            source=subprocess.check_output(['git','show',BASE+':'+name],text=True) if stage=='baseline' else fixed[name]
            if name.endswith('IndexedSongList.js'):
                source=source.replace('const PRELUDE =', "const trace = data => console.info('SEARCH_PROBE', JSON.stringify(data));\nconst PRELUDE =")
                metrics='headerHeight, focused, hidden: hidden.value, scrollable: scrollable.value, maximum: maxOffset.value, y: y.value' if stage=='baseline' else 'height: measuredHeader.value, focused: inputFocused.value, hidden: hidden.value, scrollable: scrollable.value, maximum: maxOffset.value, y: y.value'
                assert 'runOnJS(saveScroll)(next);' in source
                source=source.replace('runOnJS(saveScroll)(next);', "runOnJS(saveScroll)(next); runOnJS(trace)({kind:'scroll', "+metrics+", raw:event.contentOffset.y});")
                source=source.replace('dimensions.current.content = content;', "dimensions.current.content = content; trace({kind:'content', content, viewport:dimensions.current.viewport, headerHeight});")
            Path(name).write_text(source)
        run('android/gradlew','-p','android',':app:createBundleReleaseJsAndAssets','-PreactNativeArchitectures=x86_64','--no-daemon')
        bundles=list(Path('android/app/build/generated/assets').rglob('index.android.bundle'))
        assert len(bundles)==1,bundles
        bundle=bundles[0].read_bytes()
        assert b'SEARCH_PROBE' in bundle,'Probe marker missing'
        unsigned=Path('/tmp/search-'+stage+'-unsigned.apk');output=Path('/tmp/search-'+stage+'.apk')
        with zipfile.ZipFile(original) as src,zipfile.ZipFile(unsigned,'w') as dst:
            for entry in src.infolist():
                if entry.filename.startswith('META-INF/') and (entry.filename.endswith(('.RSA','.DSA','.EC','.SF')) or entry.filename=='META-INF/MANIFEST.MF'):continue
                dst.writestr(entry,bundle if entry.filename=='assets/index.android.bundle' else src.read(entry))
        with zipfile.ZipFile(original) as src,zipfile.ZipFile(unsigned) as dst:
            for entry in dst.namelist():
                if entry!='assets/index.android.bundle':assert src.read(entry)==dst.read(entry),entry
        run(sdk/'zipalign','-P','16','-f','4',unsigned,output)
        run(sdk/'apksigner','sign','--ks','android/app/debug.keystore','--ks-key-alias','androiddebugkey','--ks-pass','pass:android','--key-pass','pass:android',output)
        run(sdk/'apksigner','verify',output)
        report[stage]={'apk_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'js_sha256':hashlib.sha256(bundle).hexdigest(),'native_resources_model_unchanged':True}
finally:
    for name,source in fixed.items():Path(name).write_text(source)
Path('verification/search-overlay').mkdir(parents=True,exist_ok=True)
Path('verification/search-overlay/apk-comparison.json').write_text(json.dumps(report,indent=2))

