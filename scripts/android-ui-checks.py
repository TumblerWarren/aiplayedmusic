"""Standalone APK checks on an Android emulator; retain raw UI trees, images and video."""
import argparse
import glob
import json
import os
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from android_media_session import is_playing, session_text
from android_recording import stop_recording
from android_ui_geometry import visible_bounds, scroll_bounds, scroll_gesture, find_folder_row, find_view, find_node

OUT = Path('verification/android-v'+json.loads(Path('package.json').read_text())['version'])
PKG = 'app.localmusic.player'
results = []
failures = []
DESTINATIONS = ['Songs','For You','Albums','Artists','Folders','Playlists','Favourites','Recently played']

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
    box = visible_bounds(node)
    assert box is not None, node.attrib
    return box

def find(value, root=None):
    root = root if root is not None else tree()
    return find_node(root, value, package=PKG, exact=True)

def wait(value, timeout=40):
    end = time.monotonic() + timeout
    sheet_scrolls = 0
    while time.monotonic() < end:
        root = tree()
        node = find(value, root)
        precision = value.startswith(('Increase ', 'Decrease ')) and find('Sound studio', root) is not None
        if node is not None and precision:
            left, top, right, bottom = scroll_bounds(root)
            x1, y1, x2, y2 = bounds(node)
            if not (left <= x1 < x2 <= right and top + 8 <= y1 < y2 <= bottom - 8):
                node = None
        if node is not None:
            return node
        if value in DESTINATIONS and find('Close', root) is not None:
            # Browse rows deliberately scroll on compact screens and large text.
            # Rotation/font changes move the sheet. Keep both gesture ends
            # inside its live ScrollView, away from the handle and backdrop.
            try:
                swipe(*scroll_gesture(root, reverse=sheet_scrolls == 0))
                sheet_scrolls += 1
            except AssertionError:
                pass  # A fitting/non-scrolling sheet may still be animating in.
        elif value in ['Include subfolders when playing', 'Choose folder'] and find('Settings', root) is not None:
            try:
                swipe(*scroll_gesture(root, reverse=value == 'Choose folder' or sheet_scrolls == 0))
                sheet_scrolls += 1
            except AssertionError:
                pass
        elif precision:
            # The dial can fit while its separate +/- buttons remain below the
            # viewport. Reveal the actual target without touching the dial.
            raw = next((n for n in root.iter('node') if label(n) == value), None)
            box = list(map(int, re.findall(r'-?\d+', raw.get('bounds', '')))) if raw is not None else []
            _, top, _, _ = scroll_bounds(root)
            swipe(*scroll_gesture(root, reverse=len(box) == 4 and box[1] <= top + 8))
        time.sleep(.3)
    raise AssertionError('Missing UI control: ' + value)

def tap(value):
    node = wait(value) if isinstance(value, str) else value
    assert node.get('enabled') != 'false', 'Control is disabled: ' + str(value)
    x1, y1, x2, y2 = bounds(node)
    shell('input', 'tap', (x1+x2)//2, (y1+y2)//2)
    time.sleep(.3)

def dialog_button(title, timeout=20):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        node=next((n for n in tree().iter('node') if n.get('resource-id','').startswith('android:id/button')
            and label(n).casefold()==title.casefold() and visible_bounds(n)),None)
        if node is not None:return node
        time.sleep(.3)
    raise AssertionError('Missing native dialog action: '+title)

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
    wait('Close')
    tap(destination)
    assert wait_absent('Close'), 'Browse did not close after selecting ' + destination
    wait('+ Browse')

def open_folder(path, picker=False, timeout=40):
    expected = ('folder-picker:' if picker else 'folder-screen:') + path
    end = time.monotonic() + timeout
    last_tap = 0
    while time.monotonic() < end:
        root = tree()
        if find_view(root, expected) is not None:
            return
        row = find_folder_row(root, path)
        if row is not None:
            # A row can move while the native list restores its scroll offset.
            # Re-read it before tapping and require the destination to open.
            if time.monotonic() - last_tap >= 2:
                tap(row)
                last_tap = time.monotonic()
        elif not last_tap:
            try:
                swipe(*scroll_gesture(root))
            except AssertionError:
                pass  # Folder-picker catalog may still be loading.
        time.sleep(.3)
    shot('folder-navigation-timeout')
    raise AssertionError('Folder did not open: ' + path)


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

def artwork_style():
    root = tree()
    styles = [n.get('resource-id', '').split('artwork-animation-')[-1] for n in root.iter('node') if 'artwork-animation-' in n.get('resource-id', '') and visible_bounds(n)]
    assert len(styles) == 1 and styles[0] in ['pulse', 'wave', 'orbit', 'equalizer', 'disc'], 'Random artwork style is missing'
    return styles[0]

def knob_node(name, root=None):
    return find_view(tree() if root is None else root, 'knob-' + name)

def visible_knob(name):
    for _ in range(10):
        root = tree()
        left, top, right, bottom = scroll_bounds(root)
        node = knob_node(name, root)
        if node is not None:
            x1, y1, x2, y2 = bounds(node)
            # Android can report a positive but cropped rectangle. Rotation
            # requires the whole square face, not merely its visible fragment.
            if left <= x1 < x2 <= right and top + 8 <= y1 < y2 <= bottom - 8 and abs((y2 - y1) - (x2 - x1)) <= 4:
                return node
        raw = next((n for n in root.iter('node') if n.get('resource-id', '').split(':id/')[-1] == 'knob-' + name), None)
        box = list(map(int, re.findall(r'-?\d+', raw.get('bounds', '')))) if raw is not None else []
        reverse = len(box) == 4 and box[1] <= top + 8
        # Scroll inside the current viewport's margin, clear of every dial.
        swipe(*scroll_gesture(root, reverse=reverse))
    raise AssertionError('Rotary control not visible: ' + name)

def knob_value(name):
    # Reading an accessibility value does not require an onscreen hit target.
    # Scrolling to the precision buttons can move the dial above the viewport.
    node=next((n for n in tree().iter('node') if n.get('resource-id', '').split(':id/')[-1] == 'knob-' + name), None)
    assert node is not None and node.get('range-current') is not None, 'Knob accessibility range is missing'
    announced=re.search(r'([+-]?\d+(?:\.\d+)?)\s*dB\b',label(node))
    if announced: return float(announced[1])
    return float(node.get('range-current'))

def wait_knob_value(name, predicate, description, timeout=10):
    end = time.monotonic() + timeout
    while True:
        value = knob_value(name)
        if predicate(value):
            return value
        assert time.monotonic() < end, f'{name}: {description}; observed {value}'
        time.sleep(.2)

def rotate_knob(name,degrees,cancel=False):
    x1,y1,x2,y2=bounds(visible_knob(name))
    raw=shell('am','instrument','-w','-r','-e','action','rotate','-e','cx',str((x1+x2)/2),'-e','cy',str((y1+y2)/2),'-e','radius',str((x2-x1)*.36),'-e','degrees',str(degrees),'-e','cancel',str(cancel).lower(),'app.aiplayed.uicheck/app.aiplayed.uicheck.Dump')
    assert 'rotated' in raw, raw
    time.sleep(.6)

def check_full_interactions():
    search_bounds = bounds(wait('Search your music'))
    check('Search retains its full intrinsic height before scrolling', search_bounds[3]-search_bounds[1] >= 100)
    # Real press hold frames preserve the native clipped highlight for review.
    browse_button = wait('+ Browse'); x1,y1,x2,y2 = bounds(browse_button)
    holding = subprocess.Popen(['adb','shell','input','swipe',str((x1+x2)//2),str((y1+y2)//2),str((x1+x2)//2),str((y1+y2)//2),'1000'])
    time.sleep(.15); shot('browse-pressed', dump=False); holding.wait()
    if find('Close') is not None: tap('Close')
    for destination in ['Songs','For You','Albums','Artists','Folders','Playlists','Favourites','Recently played']:
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
    assert initial == 'A00 Song', 'Playback must start from the known fixture queue'
    for destination in ['Albums','Artists','Folders','Playlists','Favourites','Recently played','Songs']:
        browse(destination)
        media = shell('dumpsys','media_session')
        (OUT/('media-'+destination.lower().replace(' ','-')+'.txt')).write_text(media)
        check('Playback continues in '+destination, is_playing(media) and initial in session_text(media))
    # Swipe only artwork/title; the transport controls have independent targets.
    start_record('player-and-accessibility')
    node=wait('Open now playing'); x1,y1,x2,y2=bounds(node)
    swipe(x2-30,(y1+y2)/2,x1+30,(y1+y2)/2)
    check('Mini-player swipe advances exactly one track', media_title()=='A01 Song')
    tap('Open now playing'); wait('NOW PLAYING'); shot('player')
    selected_artwork_style = artwork_style()
    (OUT/'artwork-style.json').write_text(json.dumps({'initial': selected_artwork_style}))
    check('Full player renders a supported artwork style')
    current=media_title(); art=next((n for n in tree().iter('node') if n.get('resource-id','').endswith('player-artwork-swipe')),None)
    assert art is not None, 'Artwork gesture test target missing'
    x1,y1,x2,y2=bounds(art); cy=(y1+y2)/2
    swipe(x2-35,cy,x1+35,cy); check('Artwork swipe advances exactly one track', media_title()=='B00 Song')
    current=media_title(); swipe((x1+x2)/2,cy-80,(x1+x2)/2,cy+80)
    check('Vertical artwork gesture keeps current song', media_title()==current)
    swipe((x1+x2)/2,cy,(x1+x2)/2+10,cy)
    check('Short artwork gesture keeps current song', media_title()==current)
    pause=wait('Pause'); x1,y1,x2,y2=bounds(pause)
    holding=subprocess.Popen(['adb','shell','input','swipe',str((x1+x2)//2),str((y1+y2)//2),str((x1+x2)//2),str((y1+y2)//2),'1000']);time.sleep(.15);shot('player-button-pressed',dump=False);holding.wait()
    if find('Play') is not None: tap('Play')
    # Artwork/mini-player swipes above may have changed tracks; record the current style.
    current_artwork_style = artwork_style()
    tap('Pause'); wait('Play')
    check('Pausing keeps the selected artwork style', artwork_style() == current_artwork_style)
    tap('Play'); wait('Pause')
    check('Resuming keeps the selected artwork style', artwork_style() == current_artwork_style)
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
        wait('+ Browse'); tap('+ Browse'); wait('Close'); shot('browse-font-'+scale+'-rotation-'+rotation); tap('Close')
        assert wait_absent('Close'), 'Browse did not close after font/rotation check'
        check('Browse works with font '+scale+' rotation '+rotation, find('+ Browse') is not None)
    browse('Folders')
    for path in ['/storage/emulated/0', '/storage/emulated/0/Music', '/storage/emulated/0/Music/AiplayedChecks']:
        open_folder(path)
    check('Folder navigation reaches the fixture directory')
    controls = bounds(wait('Folders and songs'))
    folder_play = next(n for n in tree().iter('node') if label(n).startswith('Play folder · ') and visible_bounds(n))
    check('Nested folder controls have no leftover search-sized gap', 0 <= bounds(folder_play)[1] - controls[3] < 108)
    check('Include subfolders is absent from folder screens', find('Include subfolders when playing') is None)
    shot('folders-expanded-compact-controls')
    tap('Settings'); wait('Include subfolders when playing')
    shot('settings-include-subfolders')
    check('Include subfolders is available in Settings')
    tap('Choose folder'); wait('Close folder browser')
    for path in ['/storage/emulated/0', '/storage/emulated/0/Music', '/storage/emulated/0/Music/AiplayedChecks']:
        open_folder(path, picker=True)
    rail_bounds(); tap('Jump to Z'); shot('folder-picker')
    check('Folder picker A-Z gesture lands on the Z folder', any(label(n).startswith('/storage/emulated/0/Music/AiplayedChecks/ZFolder, ') for n in tree().iter('node')))
    tap('Close folder browser')
    start_record('patterns-and-rotary-controls')
    for destination in ['Library','Playlists','Sound','Settings']:
        tap(destination)
        node=wait(destination); x1,y1,x2,y2=bounds(node)
        holding=subprocess.Popen(['adb','shell','input','swipe',str((x1+x2)//2),str((y1+y2)//2),str((x1+x2)//2),str((y1+y2)//2),'1000'])
        time.sleep(.2); shot('navbar-'+destination.lower()+'-pressed',dump=False); holding.wait()


def check_sound_controls():
    tap('Sound'); wait('Sound studio')
    if find('Play') is not None: tap('Play')
    visible_knob('bass'); before=knob_value('bass'); shot('sound-rotary-controls')
    rotate_knob('bass',90); raised=wait_knob_value('bass', lambda value: value > before, 'clockwise rotation did not increase the value')
    check('Clockwise dial rotation increases Bass',raised>before)
    rotate_knob('bass',-60); lowered=wait_knob_value('bass', lambda value: value < raised, 'anticlockwise rotation did not decrease the value')
    check('Anticlockwise dial rotation decreases Bass',lowered<raised)
    rotate_knob('bass',60,cancel=True)
    restored=wait_knob_value('bass', lambda value: abs(value-lowered)<.05, 'cancel did not restore the committed value')
    check('Cancelled knob rotation restores the committed value',abs(restored-lowered)<.05)
    tap('Increase Bass'); precise=wait_knob_value('bass', lambda value: abs(value-lowered-.5)<.05, 'precision press did not add exactly 0.5 dB')
    check('Round precision button advances one exact step',abs(precise-lowered-.5)<.05)
    check('Playback continues while rotating sound controls',is_playing(shell('dumpsys','media_session')))
    tap('Library'); tap('Sound'); visible_knob('bass')
    saved=wait_knob_value('bass', lambda value: abs(value-precise)<.05, 'saved Bass value did not survive navigation')
    check('Rotary setting persists after leaving Sound',abs(saved-precise)<.05)
    shot('sound-rotary-saved')


def mix_control(value, timeout=60, reverse=False):
    end=time.monotonic()+timeout
    previous=None
    direction=reverse
    while time.monotonic()<end:
        root=tree();node=find(value,root)
        if node is not None:return node
        # Offscreen native nodes retain their content position, even when their
        # clipped bounds are inverted. Follow the target instead of oscillating
        # after three short swipes in a compact landscape viewport.
        raw=next((n for n in root.iter('node') if n.get('package')==PKG and label(n)==value),None)
        signature=tuple((label(n),n.get('bounds')) for n in root.iter('node'))
        if signature==previous:direction=not direction
        previous=signature
        if raw is not None:
            box=list(map(int,re.findall(r'-?\d+',raw.get('bounds',''))))
            try:
                _,top,_,bottom=scroll_bounds(root)
                if len(box)==4 and box[2]>box[0]:direction=box[1]<top
            except AssertionError:pass
        try:swipe(*scroll_gesture(root,reverse=direction))
        except AssertionError:pass
        time.sleep(.5)
    raise AssertionError('Missing personal mix control: '+value)


def check_personal_mixes():
    # Unplug only the emulator: manual analysis must work without charging.
    shell('dumpsys','battery','unplug')
    try:
        tap('Library');browse('For You');wait('Enable personal mixes')
        initial=media_title();tap('Enable personal mixes')
        wait('Paused while music plays')
        check('Enabling local mixes preserves playback',is_playing(shell('dumpsys','media_session')) and media_title()==initial)
        tap(mix_control('Analyse now'))
        check('Manual analysis waits for playback priority',find('Paused while music plays') is not None)
        tap('Pause')
        tap(mix_control('Preview your mix 1',timeout=180))
        check('Partial analysis exposes a mix preview',find('Hide songs') is not None)
        shot('for-you-partial-preview')
        tap(mix_control('Play your mix 1',reverse=True));wait('Pause');title=media_title()
        tap(mix_control('Refresh suggestions',reverse=True));time.sleep(.5)
        check('Refreshing suggestions preserves the playing song',is_playing(shell('dumpsys','media_session')) and media_title()==title)
        tap(mix_control('Save as playlist'))
        wait('Playlist name');tap('Playlist name');shell('input','keycombination','113','29');shell('input','keyevent','67');shell('input','text','OfflineMix');shell('input','keyevent','4')
        tap(mix_control('Save playlist'))
        assert wait_absent('Playlist name'),'Saving a personal mix did not close the dialog'
        browse('Playlists');wait('OfflineMix')
        check('A personal mix saves as an ordinary playlist')
        browse('For You')
        for scale,rotation in [('1.6','0'),('1.6','1'),('1.0','0')]:
            shell('settings','put','system','font_scale',scale);shell('settings','put','system','user_rotation',rotation);time.sleep(1)
            # A font-scale change may recreate the Activity and return to Songs.
            # Reopen the surface under test; playback must remain independent.
            wait('+ Browse');browse('For You')
            tap(mix_control('Refresh suggestions',reverse=True));shot('for-you-font-'+scale+'-rotation-'+rotation)
            check('For You refresh remains accessible at font '+scale+' rotation '+rotation,media_title()==title)
        tap('Settings');tap(mix_control('Personal mixes'))
        wait('Enable personal mixes')
        check('Settings exposes recommendation opt-in and analysis controls',find('Enable personal mixes') is not None)
        tap(mix_control('Delete audio analysis'));tap(dialog_button('Delete'));time.sleep(1)
        mix_control('Personal mixes are off',reverse=True)
        check('Deleting analysis switches personal mixes off')
        tap('Library');browse('Playlists');wait('OfflineMix')
        check('Deleting analysis retains saved playlists')
    finally:
        shell('dumpsys','battery','reset',check=False)


def check_analysis_reset():
    tap('Settings');tap(mix_control('Personal mixes'));wait('Enable personal mixes')
    tap(mix_control('Delete audio analysis'))
    wait('Delete audio analysis?')
    tap(dialog_button('Delete'))
    mix_control('Personal mixes are off',reverse=True)
    check('The native delete confirmation clears analysis and leaves recommendations off')
    shot('analysis-reset-confirmed')


def play_sound_fixture():
    end = time.monotonic() + 45
    while True:
        root = tree()
        song = next((n for n in root.iter('node') if n.get('package') == PKG and label(n).startswith('A00 Song, ') and visible_bounds(n)), None)
        if song is not None:
            tap(song)
            wait('Pause')
            return
        if find('Scan for songs', root) is not None:
            tap('Scan for songs')
        assert time.monotonic() < end, 'The indexed Sound fixture did not appear'
        time.sleep(.3)


recording = None
recordings = []
def start_record(name):
    global recording
    if recording:
        stop_recording(recording, shell)
        adb('pull','/sdcard/'+recordings[-1]+'.mp4',str(OUT/(recordings[-1]+'.mp4')),check=False)
    recordings.append(name)
    recording = subprocess.Popen(['adb','shell','screenrecord','--time-limit','180','/sdcard/'+name+'.mp4'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
def run_checks(apk, scenario='all'):
    global recording
    OUT.mkdir(parents=True, exist_ok=True)
    try:
        adb('install', '-r', '/tmp/aiplayed-ui-helper/ui-helper.apk', timeout=120)
        adb('install', '-r', apk, timeout=120)
        if scenario != 'all':
            assert shell('getprop', 'ro.kernel.qemu').strip() == '1', 'Fresh-data focused checks require an emulator'
            shell('am', 'force-stop', PKG)
            shell('pm', 'clear', PKG)
        for permission in ['READ_MEDIA_AUDIO', 'POST_NOTIFICATIONS']:
            shell('pm', 'grant', PKG, 'android.permission.'+permission)
        shell('settings', 'put', 'system', 'accelerometer_rotation', '0')
        shell('settings', 'put', 'system', 'user_rotation', '0')
        shell('wm', 'size', '1080x1920')
        shell('wm', 'density', '420')
        # Indexed metadata covers every alphabet section, album, artist and nested folder.
        fixtures = Path('/tmp/aiplayed-fixtures'); fixtures.mkdir(exist_ok=True)
        for letter in ('' if scenario == 'recommendations-reset' else 'A' if scenario == 'sound' else 'ABCDEF' if scenario == 'recommendations' else 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'):
            remote = '/sdcard/Music/AiplayedChecks/'+letter+'Folder/Nested'
            shell('mkdir', '-p', remote)
            for i in range(1 if scenario == 'sound' else 2):
                if scenario == 'recommendations':
                    # This focused UI path needs indexed audio, not an external encoder.
                    import array, math, sys, wave
                    local = fixtures / f'{letter}{i:02} Song.wav'
                    samples=array.array('h',(int(300*math.sin(n*2*math.pi*440/8000)) for n in range(8000)))
                    if sys.byteorder!='little':samples.byteswap()
                    with wave.open(str(local),'wb') as output:
                        output.setnchannels(1);output.setsampwidth(2);output.setframerate(8000)
                        for second in range(900):output.writeframesraw(samples.tobytes())
                else:
                    local = fixtures / f'{letter}{i:02}.mp3'
                    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=900', '-af', 'volume=0.01', '-codec:a', 'libmp3lame', '-b:a', '32k', '-metadata', f'title={letter}{i:02} Song', '-metadata', f'album={letter}Album', '-metadata', f'artist={letter}Artist', str(local)], check=True, timeout=30)
                adb('push', local, remote+'/'+local.name)
                shell('am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', 'file://'+(remote+'/'+local.name).replace(' ','%20'))
        time.sleep(2)
        activity = shell('cmd', 'package', 'resolve-activity', '--brief', PKG).strip().splitlines()[-1]
        shell('am', 'force-stop', PKG)
        start_record('startup-and-browse')
        subprocess.Popen(['adb', 'shell', 'am', 'start', '-n', activity], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for i, delay in enumerate([.08, .12, .2, .4]):
            time.sleep(delay); shot('startup-'+str(i), dump=False)
        wait('+ Browse', timeout=60); shot('songs-expanded')
        check('Cold start reaches the Library')
        if scenario == 'all':
            check_full_interactions()
        elif scenario != 'recommendations-reset':
            play_sound_fixture()
        if scenario not in ['recommendations', 'recommendations-reset']: check_sound_controls()
        if scenario in ['all', 'recommendations']: check_personal_mixes()
        if scenario == 'recommendations-reset': check_analysis_reset()
        assert not failures, '; '.join(failures)
        (OUT/'result.json').write_text(json.dumps({'passed':True,'checks':results},indent=2))
    except Exception as error:
        (OUT/'result.json').write_text(json.dumps({'passed':False,'checks':results,'failures':failures,'error':str(error)},indent=2))
        try:
            shot('failure')
            print('FAILURE UI TREE:',(OUT/'failure.xml').read_text(),flush=True)
        except Exception: pass
        raise
    finally:
        (OUT/'logcat.txt').write_bytes(adb('logcat','-d',check=False).stdout)
        if recording:
            stop_recording(recording, shell)

        for name in recordings: adb('pull','/sdcard/'+name+'.mp4',str(OUT/(name+'.mp4')),check=False)
        shell('settings','put','system','font_scale','1.0',check=False)
        shell('settings','put','system','user_rotation','0',check=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apk', help='Existing standalone APK; defaults to the local release output')
    parser.add_argument('--scenario', choices=['all', 'sound', 'recommendations', 'recommendations-reset'], default='all')
    parser.add_argument('--repeat', type=int, default=1, help='Repeat a focused scenario with fresh emulator app data')
    args = parser.parse_args()
    if not 1 <= args.repeat <= 5 or (args.scenario == 'all' and args.repeat != 1):
        parser.error('Use --scenario sound or recommendations for 1 to 5 isolated repeats; the full suite runs once')
    candidates = [args.apk] if args.apk else glob.glob('android/app/build/outputs/apk/release/*.apk')
    if not candidates or not Path(candidates[0]).is_file():
        parser.error('No release APK found; supply --apk PATH to validate an existing candidate')
    base = OUT
    for iteration in range(args.repeat):
        OUT = base if args.scenario == 'all' else base / (args.scenario + '-run-' + str(iteration + 1))
        results.clear(); failures.clear(); recordings.clear(); recording = None
        run_checks(candidates[0], args.scenario)
