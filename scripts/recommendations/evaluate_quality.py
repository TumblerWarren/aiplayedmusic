"""Small licensed-corpus retrieval/indexing study; not a human relevance or phone benchmark."""
import hashlib
import json
from pathlib import Path
import resource
import subprocess
import time
import urllib.parse
import urllib.request
import numpy as np
import soundfile as sf
import torch
import torchaudio
from ai_edge_litert.interpreter import Interpreter

ROOT = Path('.model-tools/quality');ROOT.mkdir(parents=True,exist_ok=True)
OUT = Path('verification/recommendations/quality');OUT.mkdir(parents=True,exist_ok=True)
ASSETS = Path('modules/local-music/android/src/main/assets/recommendations')
manifest=json.loads((ASSETS/'manifest.json').read_text());p=manifest['preprocessing']
torch.set_num_threads(2)
mel=torchaudio.transforms.MelSpectrogram(sample_rate=32000,n_fft=1024,win_length=1024,hop_length=512,f_min=50,f_max=16000,n_mels=128,center=False,power=2,norm='slaney',mel_scale='slaney')
interpreter=Interpreter(model_path=str(ASSETS/manifest['file']),num_threads=2);interpreter.allocate_tensors()
input_index=interpreter.get_input_details()[0]['index'];output_index=interpreter.get_output_details()[0]['index']
fixtures=json.loads(Path('scripts/recommendations/fixtures.json').read_text())
for f in fixtures:
    f['url']='https://librosa.org/data/audio/'+urllib.parse.quote(f['path'])+'.ogg'
    f['source']='https://librosa.org/doc/latest/recordings.html'
    f['category']={'choice':'electronic','nutcracker':'classical','brahms':'classical','pistachio':'piano','sweetwaltz':'piano','vibeace':'jazz','trumpet':'jazz','fishin':'vocal'}[f['id']]
    f['licence_url']='https://librosa.org/data/audio/'+urllib.parse.quote(f['path'])+'.toml'
for name,identifier,category,author in [
 ('Yasomati-nandana_(Sri_Nama-kirtana).ogg','bengali-bhajan','devotional','A. C. Bhaktivedanta Swami'),
 ('Kirtana_in_Hindi.ogg','hindi-kirtana','devotional','Subhashish Panigrahi (field recording)'),
 ('Local_musicians_singing_bhajan_at_Kamakhya_temple,_Guwahati,_Assam,_India.ogg','assam-bhajan','devotional','Subhashish Panigrahi (field recording)'),
 ('Hare_Kṛṣṇa_Kīrtana_and_purport.ogg','long-kirtana-and-speech','devotional-mixed','A. C. Bhaktivedanta Swami')]:
    key=hashlib.md5(name.encode()).hexdigest()
    fixtures.append({'id':identifier,'category':category,'author':author,'url':f'https://upload.wikimedia.org/wikipedia/commons/{key[0]}/{key[:2]}/'+urllib.parse.quote(name),
        'source':'https://commons.wikimedia.org/wiki/File:'+urllib.parse.quote(name),'licence_url':'https://creativecommons.org/licenses/by-sa/3.0/'})
records=[];pooled=[];rows=[]
for index,f in enumerate(fixtures):
    path=ROOT/(f['id']+'.ogg')
    if not path.exists():
        request=urllib.request.Request(f['url'],headers={'User-Agent':'Aiplayed-evaluation/1.3 (https://github.com/TumblerWarren/aiplayedmusic)'})
        with urllib.request.urlopen(request,timeout=120) as response:path.write_bytes(response.read(100_000_001))
    assert path.stat().st_size<=100_000_000
    if f.get('licence_sha256'):
        with urllib.request.urlopen(f['licence_url'],timeout=60) as response:licence=response.read()
        assert hashlib.sha256(licence).hexdigest()==f['licence_sha256']
        (OUT/(f['id']+'-licence.toml')).write_bytes(licence)
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    if f.get('sha256'):assert digest==f['sha256']
    vectors=[];timings=[]
    with sf.SoundFile(path) as audio,torch.inference_mode():
        duration=len(audio)/audio.samplerate
        for seconds in sorted(set([0,max(0,(duration-10)/2),max(0,duration-10)])):
            began=time.perf_counter();audio.seek(int(seconds*audio.samplerate))
            decoded=audio.read(int(10*audio.samplerate),dtype='float32',always_2d=True).mean(axis=1)
            signal=torchaudio.functional.resample(torch.from_numpy(decoded),audio.samplerate,32000)[:320000]
            signal=torch.nn.functional.pad(signal,(0,320000-len(signal)))
            tensor=torch.log(mel(signal)+.001).reshape(1,1,128,624).numpy()
            interpreter.set_tensor(input_index,tensor);inference=time.perf_counter();interpreter.invoke()
            vector=interpreter.get_tensor(output_index).reshape(-1)
            vectors.append(vector)
            timings.append({'start_seconds':seconds,'decode_preprocess_inference_ms':(time.perf_counter()-began)*1000,'inference_ms':(time.perf_counter()-inference)*1000})
    vector=np.mean(vectors,axis=0).astype('<f4');vector.tofile(ROOT/f'{index}.f32');pooled.append(vector/np.linalg.norm(vector))
    rows.append(f"{index}\t{f['id']}\t{f['id']}\t{str(f['id'] in ['choice','bengali-bhajan']).lower()}\t{ROOT / str(index)}.f32")
    records.append({'id':f['id'],'category':f['category'],'duration_seconds':duration,'source':f['source'],'licence_url':f['licence_url'],'author':f.get('author'),'sha256':digest,'source_bytes':path.stat().st_size,'segments':timings})
(ROOT/'tracks.tsv').write_text('\n'.join(rows)+'\n')
similarity=np.stack(pooled)@np.stack(pooled).T
for i,record in enumerate(records):
    order=[int(j) for j in np.argsort(-similarity[i]) if j!=i][:3]
    record['nearest']=[{'id':records[j]['id'],'cosine':float(similarity[i,j]),'category':records[j]['category']} for j in order]
classes=ROOT/'classes';classes.mkdir(exist_ok=True)
subprocess.run(['javac','-d',str(classes),'modules/local-music/android/src/main/java/app/localmusic/player/recommendations/TasteRanker.java','scripts/recommendations/tests/QualityRanking.java'],check=True)
mixes=json.loads(subprocess.check_output(['java','-cp',str(classes),'QualityRanking',str(ROOT/'tracks.tsv')],text=True))
for mix in mixes:mix['tracks']=[records[i]['id'] for i in mix.pop('ids')]
report={'study':'small licensed public corpus','model_sha256':manifest['sha256'],'records':records,'taste_snapshots':mixes,
        'host_peak_rss_kib':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,'measurement_device':'GitHub hosted Linux x86_64 CPU, includes Python/torch overhead',
        'physical_phone_measurements':'pending','human_relevance_evaluation':'pending; coarse source categories are descriptive, not ground-truth personal preference',
        'limitation':'Twelve recordings are a smoke evaluation, not a broad ranking-quality claim. The long recording includes speech; three-section pooling can mix different content.'}
(OUT/'retrieval-and-cost.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
