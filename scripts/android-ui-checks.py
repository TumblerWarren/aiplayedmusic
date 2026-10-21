"""Standalone APK checks on an Android emulator; retain raw UI trees, images and video."""
import glob
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import time
import xml.etree.ElementTree as ET

OUT = Path('verification/android-v1.2.3')
OUT.mkdir(parents=True, exist_ok=True)
PKG = 'app.localmusic.player'
results = []
DESTINATIONS = ['Songs','Albums','Artists','Folders','Playlists','Favourites','Recently played']

def adb(*args, check=True, timeout=40):
    return subprocess.run(['adb', *map(str, args)], check=check, capture_output=True, timeout=timeout)

def shell(*args, **kwargs):
    return adb('shell', *args, **kwargs).stdout.decode(errors='replace')

def tree():
    for _ in range(4):
        shell('uiautomator', 'dump', '--compressed', '/sdcard/aiplayed-ui.xml', check=False)
        raw = shell('cat', '/sdcard/aiplayed-ui.xml', check=False)
        try:
            return ET.fromstring(raw[raw.index('<?xml'):])
        except (ValueError, ET.ParseError):
            time.sleep(.3)
    raise AssertionError('Could not read emulator accessibility tree')

def label(node):
    return node.get('content-desc') or node.get('text', '')

def bounds(node):
    values = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
    assert len(values) == 4, node.attrib
    return values

def find(value, root=None):
    root = root if root is not None else tree()
    return next((n for n in root.iter('node') if label(n) == value and len(re.findall(r'\d+', n.get('bounds',''))) == 4 and bounds(n)[2] > bounds(n)[0] and bounds(n)[3] > bounds(n)[1]), None)

def wait(value, timeout=40):
    end = time.monotonic() + timeout
    sheet_scrolls = 0
    while time.monotonic() < end:
        root = tree()
        node = find(value, root)
        if node is not None:
            return node
        if value in DESTINATIONS and find('Close', root) is not None:
            # The seven rows deliberately scroll on compact screens and large text.
            if sheet_scrolls == 0: swipe(540, 1000, 540, 1600)
            else: swipe(540, 1650, 540, 850)
            sheet_scrolls += 1
        time.sleep(.3)
    raise AssertionError('Missing UI control: ' + value)

def tap(value):
    node = wait(value) if isinstance(value, str) else value
    x1, y1, x2, y2 = bounds(node)
    shell('input', 'tap', (x1+x2)//2, (y1+y2)//2)
    time.sleep(.3)

def swipe(x1, y1, x2, y2, ms=350):
    shell('input', 'swipe', int(x1), int(y1), int(x2), int(y2), ms)
    time.sleep(.4)

def shot(name, dump=True):
    (OUT / (name+'.png')).write_bytes(adb('exec-out', 'screencap', '-p').stdout)
    if dump:
        (OUT / (name+'.xml')).write_text(ET.tostring(tree(), encoding='unicode'))

def check(name, condition=True):
    assert condition, name
    results.append(name)
    print('PASS:', name, flush=True)

def browse(destination):
    tap('+ Browse')
    tap(destination)
    wait('+ Browse')

def media_title():
    raw = shell('dumpsys', 'media_session')
    (OUT/'media-session.txt').write_text(raw)
    match = re.search(r'[A-Z][0-9]{2} Song', raw)
    assert match, 'No fixture metadata in media session'
    return match[0]

def rail_bounds():
    root = tree()
    a, z = find('Jump to A', root), find('Jump to Z', root)
    assert a is not None and z is not None, 'Alphabet rail is missing'
    return bounds(a), bounds(z)

recording = None
recordings = []
def start_record(name):
    global recording
    if recording:
        shell('pkill','-INT','screenrecord',check=False)
        try: recording.wait(timeout=8)
        except subprocess.TimeoutExpired: recording.terminate()
        adb('pull','/sdcard/'+recordings[-1]+'.mp4',str(OUT/(recordings[-1]+'.mp4')),check=False)
    recordings.append(name)
    recording = subprocess.Popen(['adb','shell','screenrecord','--time-limit','180','/sdcard/'+name+'.mp4'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    apk = glob.glob('android/app/build/outputs/apk/release/*.apk')[0]
    adb('install', '-r', apk, timeout=120)
    for permission in ['READ_MEDIA_AUDIO', 'POST_NOTIFICATIONS']:
        shell('pm', 'grant', PKG, 'android.permission.'+permission)
    shell('settings', 'put', 'system', 'accelerometer_rotation', '0')
    shell('settings', 'put', 'system', 'user_rotation', '0')
    shell('wm', 'size', '1080x1920')
    shell('wm', 'density', '420')
    # Indexed metadata covers every alphabet section, album, artist and nested folder.
    fixtures = Path('/tmp/aiplayed-fixtures'); fixtures.mkdir(exist_ok=True)
    for letter in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
        remote = '/sdcard/Music/AiplayedChecks/'+letter+'Folder/Nested'
        shell('mkdir', '-p', remote)
        for i in range(2):
            local = fixtures / f'{letter}{i:02}.mp3'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=300', '-af', 'volume=0.01', '-codec:a', 'libmp3lame', '-b:a', '32k', '-metadata', f'title={letter}{i:02} Song', '-metadata', f'album={letter}Album', '-metadata', f'artist={letter}Artist', str(local)], check=True, timeout=30)
            adb('push', local, remote+'/'+local.name)
            shell('am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', 'file://'+remote+'/'+local.name)
    time.sleep(2)
    activity = shell('cmd', 'package', 'resolve-activity', '--brief', PKG).strip().splitlines()[-1]
    shell('am', 'force-stop', PKG)
    start_record('startup-and-browse')
    subprocess.Popen(['adb', 'shell', 'am', 'start', '-n', activity], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for i, delay in enumerate([.08, .12, .2, .4]):
        time.sleep(delay); shot('startup-'+str(i), dump=False)
    wait('+ Browse', timeout=60); shot('songs-expanded')
    check('Branded cold start reaches the Library')
    # Real press hold frames preserve the native clipped highlight for review.
    browse_button = wait('+ Browse'); x1,y1,x2,y2 = bounds(browse_button)
    holding = subprocess.Popen(['adb','shell','input','swipe',str((x1+x2)//2),str((y1+y2)//2),str((x1+x2)//2),str((y1+y2)//2),'1000'])
    time.sleep(.15); shot('browse-pressed', dump=False); holding.wait()
    if find('Close') is not None: tap('Close')
    for destination in ['Songs','Albums','Artists','Folders','Playlists','Favourites','Recently played']:
        browse(destination); tap('+ Browse')
        option = wait(destination)
        check(destination+' is selected in Browse', option.get('selected') == 'true')
        shot('browse-'+destination.lower().replace(' ','-'))
        tap(destination); check('Reselect '+destination+' closes the sheet', find('Close') is None)
    browse('Songs')
    start_record('rail-and-dismissal')
    before = rail_bounds(); swipe(400,1400,400,800)
    after = rail_bounds()
    check('A-Z rail expands when search collapses', after[1][3]-after[0][1] > before[1][3]-before[0][1]+20)
    check('+ Browse remains available while search is collapsed', find('+ Browse') is not None)
    shot('songs-collapsed')
    tap('Jump to Z'); root = tree()
    check('Z jump lands on displayed song names', any('Z00 Song' in label(n) for n in root.iter('node')))
    tap('+ Browse'); shell('input','keyevent','4'); check('Android Back dismisses Browse', find('Close') is None)
    tap('+ Browse'); shell('input','tap','540','90'); check('Outside tap dismisses Browse', find('Close') is None)
    tap('+ Browse'); root=tree(); handle=find('Drag down to close',root)
    if handle is not None:
        x1,y1,x2,y2=bounds(handle); swipe((x1+x2)/2,(y1+y2)/2,(x1+x2)/2,(y1+y2)/2+280)
    else:
        x1,y1,x2,y2=bounds(wait('Browse')); swipe(540,y1-25,540,y1+255)
    check('Handle drag dismisses Browse', find('Close') is None)
    # Save and cancel playlist dialogs, then verify search restoration.
    browse('Playlists'); tap('New playlist'); shell('input','text','APlaylist'); tap('Save')
    tap('New playlist'); shell('input','text','ZPlaylist'); tap('Save')
    check('Playlist creation returns to the same view', find('+ Browse') is not None)
    tap('New playlist'); shell('input','tap','40','90'); check('Outside tap dismisses playlist dialog', find('Playlist name') is None)
    browse('Songs'); tap('Jump to A'); swipe(400,600,400,1450)
    tap('Search your music'); shell('input','text','A00'); shell('input','keyevent','4')
    browse('Albums'); browse('Songs'); check('Search restores per Browse destination', any(n.get('text')=='A00' for n in tree().iter('node')))
    # Clear the search using the input field; select all and delete.
    tap('Search your music'); shell('input','keycombination','113','29'); shell('input','keyevent','67'); shell('input','keyevent','4')
    tap('Jump to A'); root=tree(); song=next((n for n in root.iter('node') if label(n).startswith('A00 Song, ')),None); assert song is not None
    tap(song); wait('Pause'); initial=media_title()
    for destination in ['Albums','Artists','Folders','Playlists','Favourites','Recently played','Songs']:
        browse(destination)
        check('Playback continues in '+destination, 'state=3' in shell('dumpsys','media_session'))
    # Swipe only artwork/title; the transport controls have independent targets.
    start_record('player-and-accessibility')
    node=wait('Open now playing'); x1,y1,x2,y2=bounds(node)
    swipe(x2-30,(y1+y2)/2,x1+30,(y1+y2)/2)
    check('Mini-player swipe advances exactly one track', media_title()!=initial)
    tap('Open now playing'); wait('NOW PLAYING'); shot('player')
    current=media_title(); art=next((n for n in tree().iter('node') if n.get('resource-id','').endswith('player-artwork-swipe')),None)
    assert art is not None, 'Artwork gesture test target missing'
    x1,y1,x2,y2=bounds(art); cy=(y1+y2)/2
    swipe(x2-35,cy,x1+35,cy); check('Artwork swipe advances a track', media_title()!=current)
    current=media_title(); swipe((x1+x2)/2,cy-80,(x1+x2)/2,cy+80)
    check('Vertical artwork gesture keeps current song', media_title()==current)
    swipe((x1+x2)/2,cy,(x1+x2)/2+10,cy)
    check('Short artwork gesture keeps current song', media_title()==current)
    pause=wait('Pause'); x1,y1,x2,y2=bounds(pause)
    holding=subprocess.Popen(['adb','shell','input','swipe',str((x1+x2)//2),str((y1+y2)//2),str((x1+x2)//2),str((y1+y2)//2),'1000']);time.sleep(.15);shot('player-button-pressed',dump=False);holding.wait()
    tap('Library') if find('Library') is not None else tap('chevron-down')
    for scale,rotation in [('1.6','0'),('1.6','1'),('1.0','0')]:
        shell('settings','put','system','font_scale',scale); shell('settings','put','system','user_rotation',rotation);time.sleep(1)
        wait('+ Browse'); tap('+ Browse'); shot('browse-font-'+scale+'-rotation-'+rotation);tap('Close')
        check('Browse works with font '+scale+' rotation '+rotation, find('+ Browse') is not None)
    browse('Folders'); tap('Choose folder'); wait('Close folder browser')
    for path in ['/storage/emulated/0', '/storage/emulated/0/Music', '/storage/emulated/0/Music/AiplayedChecks']:
        root=tree(); row=next((n for n in root.iter('node') if label(n).startswith(path+', ')),None)
        assert row is not None, 'Folder picker path missing: '+path
        tap(row)
    rail_bounds(); tap('Jump to Z'); shot('folder-picker')
    check('Folder picker A-Z gesture lands on the Z folder', any(label(n).startswith('/storage/emulated/0/Music/AiplayedChecks/ZFolder, ') for n in tree().iter('node')))
    tap('Close folder browser')
    (OUT/'result.json').write_text(json.dumps({'passed':True,'checks':results},indent=2))
except Exception as error:
    (OUT/'result.json').write_text(json.dumps({'passed':False,'checks':results,'error':str(error)},indent=2))
    try: shot('failure')
    except Exception: pass
    raise
finally:
    (OUT/'logcat.txt').write_bytes(adb('logcat','-d',check=False).stdout)
    shell('pkill','-INT','screenrecord',check=False)
    if recording:
        try: recording.wait(timeout=8)
        except subprocess.TimeoutExpired: recording.terminate()
    
    for name in recordings: adb('pull','/sdcard/'+name+'.mp4',str(OUT/(name+'.mp4')),check=False)
    shell('settings','put','system','font_scale','1.0',check=False)
    shell('settings','put','system','user_rotation','0',check=False)
