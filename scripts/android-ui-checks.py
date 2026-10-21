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
from android_media_session import is_playing, session_text

OUT = Path('verification/android-v'+json.loads(Path('package.json').read_text())['version'])
OUT.mkdir(parents=True, exist_ok=True)
PKG = 'app.localmusic.player'
results = []
failures = []
DESTINATIONS = ['Songs','Albums','Artists','Folders','Playlists','Favourites','Recently played']

def adb(*args, check=True, timeout=40):
    return subprocess.run(['adb', *map(str, args)], check=check, capture_output=True, timeout=timeout)

def shell(*args, **kwargs):
    return adb('shell', *args, **kwargs).stdout.decode(errors='replace')

def tree():
    for _ in range(4):
        raw = shell('am', 'instrument', '-w', '-r', 'app.aiplayed.uicheck/app.aiplayed.uicheck.Dump', check=False)
        try:
            return ET.fromstring(raw[raw.index('<?xml'):raw.rindex('</hierarchy>')+len('</hierarchy>')])
        except (ValueError, ET.ParseError):
            time.sleep(.3)
    raise AssertionError('Could not read emulator accessibility tree')

def wait_absent(value, timeout=8):
    end = time.monotonic()+timeout
    while time.monotonic() < end:
        if find(value) is None: return True
        time.sleep(.2)
    return False

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
    if condition:
        results.append(name)
        print('PASS:', name, flush=True)
    else:
        failures.append(name)
        print('FAIL:', name, flush=True)
        shot('failed-check-'+str(len(failures)))

def browse(destination):
    tap('+ Browse')
    tap(destination)
    wait('+ Browse')

def media_title():
    raw = shell('dumpsys', 'media_session')
    (OUT/'media-session.txt').write_text(raw)
    match = re.search(r'[A-Z][0-9]{2} Song', session_text(raw))
    assert match, 'No fixture metadata in media session'
    return match[0]

def rail_bounds():
    root = tree()
    a, z = find('Jump to A', root), find('Jump to Z', root)
    assert a is not None and z is not None, 'Alphabet rail is missing'
    return bounds(a), bounds(z)

def knob_node(name):
    return next((n for n in tree().iter('node') if n.get('resource-id','').endswith('knob-'+name) and bounds(n)[2]>bounds(n)[0] and bounds(n)[3]>bounds(n)[1]),None)

def visible_knob(name):
    for _ in range(10):
        node=knob_node(name)
        if node is not None:
            box=bounds(node)
            if box[1]>=300 and box[3]<=1150: return node
            if box[1]<300: swipe(70,650,70,1000); continue
        # Scroll in the page margin, outside every rotary face and precision button.
        swipe(70,1300,70,800)
    raise AssertionError('Rotary control not visible: '+name)

def knob_value(name):
    node=knob_node(name)
    assert node is not None and node.get('range-current') is not None, 'Knob accessibility range is missing'
    announced=re.search(r'([+-]?\d+(?:\.\d+)?)\s*dB\b',label(node))
    if announced: return float(announced[1])
    return float(node.get('range-current'))

def rotate_knob(name,degrees,cancel=False):
    x1,y1,x2,y2=bounds(visible_knob(name))
    raw=shell('am','instrument','-w','-r','-e','action','rotate','-e','cx',str((x1+x2)/2),'-e','cy',str((y1+y2)/2),'-e','radius',str((x2-x1)*.36),'-e','degrees',str(degrees),'-e','cancel',str(cancel).lower(),'app.aiplayed.uicheck/app.aiplayed.uicheck.Dump')
    assert 'rotated' in raw, raw
    time.sleep(.6)

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
    adb('install', '-r', '/tmp/aiplayed-ui-helper/ui-helper.apk', timeout=120)
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
    search_bounds = bounds(wait('Search your music'))
    check('Search retains its full intrinsic height before scrolling', search_bounds[3]-search_bounds[1] >= 100)
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
    (OUT/'rail-geometry.json').write_text(json.dumps({'expandedHeader':before,'collapsedHeader':after},indent=2))
    check('A-Z rail expands when search collapses', after[1][3]-after[0][1] > before[1][3]-before[0][1]+20)
    check('+ Browse remains available while search is collapsed', find('+ Browse') is not None)
    shot('songs-collapsed')
    tap('Jump to Z'); root = tree()
    check('Z jump lands on displayed song names', any('Z00 Song' in label(n) for n in root.iter('node')))
    tap('+ Browse'); shell('input','keyevent','4'); check('Android Back dismisses Browse', wait_absent('Close'))
    if find('Close') is not None: tap('Close')
    tap('+ Browse'); handle_top=bounds(wait('Drag down to close'))[1]; shell('input','tap','40',max(80,handle_top-25)); check('Outside tap dismisses Browse', wait_absent('Close'))
    if find('Close') is not None: tap('Close')
    tap('+ Browse'); root=tree(); handle=find('Drag down to close',root)
    if handle is not None:
        x1,y1,x2,y2=bounds(handle); swipe((x1+x2)/2,(y1+y2)/2,(x1+x2)/2,(y1+y2)/2+280)
    else:
        x1,y1,x2,y2=bounds(wait('Browse')); swipe(540,y1-25,540,y1+255)
    check('Handle drag dismisses Browse', wait_absent('Close'))
    if find('Close') is not None: tap('Close')
    # Save and cancel playlist dialogs, then verify search restoration.
    browse('Playlists')
    playlist_root=tree(); actions=[n for n in playlist_root.iter('node') if label(n)=='New playlist' and n.get('clickable')=='true']
    check('Empty Playlists has exactly one centered create action', len(actions)==1 and abs((bounds(actions[0])[0]+bounds(actions[0])[2])/2-540)<35)
    search=bounds(wait('Search your music')); count=bounds(wait('0 playlists'))
    check('Playlist controls have clear spacing below search',count[1]-search[3]>=12)
    shot('playlists-empty')
    tap('New playlist'); shell('input','text','APlaylist'); shot('playlist-keyboard'); tap('Save'); assert wait_absent('Playlist name'), 'First playlist save did not close the dialog'
    tap('New playlist'); shell('input','text','ZPlaylist'); tap('Save'); assert wait_absent('Playlist name'), 'Second playlist save did not close the dialog'
    check('Playlist creation returns to the same view', find('+ Browse') is not None)
    check('Populated Playlists keeps one create action',sum(label(n)=='New playlist' and n.get('clickable')=='true' for n in tree().iter('node'))==1)
    shot('playlists-populated')
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
        media = shell('dumpsys','media_session')
        (OUT/('media-'+destination.lower().replace(' ','-')+'.txt')).write_text(media)
        check('Playback continues in '+destination, is_playing(media) and initial in session_text(media))
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
    if find('Play') is not None: tap('Play')
    lyrics_track = media_title()
    tap('Lyrics'); wait('Choose lyrics file'); shot('lyrics-current-design')
    resumed = shell('dumpsys','activity','activities')
    resumed = '\n'.join(line for line in resumed.splitlines() if 'mResumedActivity' in line or 'topResumedActivity' in line)
    check('Lyrics opens in the current interface without the legacy native player', 'NativeMusicActivity' not in resumed and find('Close') is not None)
    check('Playback continues while viewing lyrics', is_playing(shell('dumpsys','media_session')))
    tap('Choose lyrics file'); time.sleep(1); shell('input','keyevent','4'); wait('Choose lyrics file')
    check('Cancelling the lyrics file picker returns to the same lyrics sheet', find('Close') is not None)
    tap('Close'); wait('NOW PLAYING')
    check('Closing lyrics preserves the full player and uninterrupted playback', is_playing(shell('dumpsys','media_session')) and media_title() == lyrics_track)
    tap('Library') if find('Library') is not None else tap('chevron-down')
    for scale,rotation in [('1.6','0'),('1.6','1'),('1.0','0')]:
        shell('settings','put','system','font_scale',scale); shell('settings','put','system','user_rotation',rotation);time.sleep(1)
        wait('+ Browse'); tap('+ Browse'); shot('browse-font-'+scale+'-rotation-'+rotation);tap('Close')
        check('Browse works with font '+scale+' rotation '+rotation, find('+ Browse') is not None)
    tap('Settings'); tap('Choose folder'); wait('Close folder browser')
    for path in ['/storage/emulated/0', '/storage/emulated/0/Music', '/storage/emulated/0/Music/AiplayedChecks']:
        root=tree(); row=next((n for n in root.iter('node') if label(n).startswith(path+', ')),None)
        assert row is not None, 'Folder picker path missing: '+path
        tap(row)
    rail_bounds(); tap('Jump to Z'); shot('folder-picker')
    check('Folder picker A-Z gesture lands on the Z folder', any(label(n).startswith('/storage/emulated/0/Music/AiplayedChecks/ZFolder, ') for n in tree().iter('node')))
    tap('Close folder browser')
    start_record('patterns-and-rotary-controls')
    for destination in ['Library','Playlists','Sound','Settings']:
        tap(destination)
        node=wait(destination); x1,y1,x2,y2=bounds(node)
        holding=subprocess.Popen(['adb','shell','input','swipe',str((x1+x2)//2),str((y1+y2)//2),str((x1+x2)//2),str((y1+y2)//2),'1000'])
        time.sleep(.2); shot('navbar-'+destination.lower()+'-pressed',dump=False); holding.wait()
    tap('Sound'); wait('Sound studio')
    if find('Play') is not None: tap('Play')
    visible_knob('bass'); before=knob_value('bass'); shot('sound-rotary-controls')
    rotate_knob('bass',90); raised=knob_value('bass')
    check('Clockwise dial rotation increases Bass',raised>before)
    rotate_knob('bass',-60); lowered=knob_value('bass')
    check('Anticlockwise dial rotation decreases Bass',lowered<raised)
    rotate_knob('bass',60,cancel=True)
    check('Cancelled knob rotation restores the committed value',abs(knob_value('bass')-lowered)<.05)
    tap('Increase Bass'); time.sleep(.5); precise=knob_value('bass')
    check('Round precision button advances one exact step',abs(precise-lowered-.5)<.05)
    check('Playback continues while rotating sound controls',is_playing(shell('dumpsys','media_session')))
    tap('Library'); tap('Sound'); visible_knob('bass')
    check('Rotary setting persists after leaving Sound',abs(knob_value('bass')-precise)<.05)
    shot('sound-rotary-saved')
    assert not failures, '; '.join(failures)
    (OUT/'result.json').write_text(json.dumps({'passed':True,'checks':results},indent=2))
except Exception as error:
    (OUT/'result.json').write_text(json.dumps({'passed':False,'checks':results,'failures':failures,'error':str(error)},indent=2))
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
