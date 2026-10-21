"""Manual candidate-APK appearance checks. Retains screenshots, XML and startup videos.

Requires adb, the CI inspector APK, Pillow, ffmpeg and an API26+ emulator.
Never compiles or publishes the application. See docs/DARK_MODE.md.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from PIL import Image
from android_media_session import is_playing

parser = argparse.ArgumentParser()
parser.add_argument('--apk', required=True)
parser.add_argument('--helper', default='/tmp/aiplayed-ui-helper/ui-helper.apk')
args = parser.parse_args()
PKG = 'app.localmusic.player'

def adb(*args, check=True):
    return subprocess.run(['adb', *map(str, args)], check=check, capture_output=True, timeout=120)

def shell(*args, check=True):
    return adb('shell', *args, check=check).stdout.decode(errors='replace')

api = int(shell('getprop', 'ro.build.version.sdk').strip())
out = Path(f'verification/android-theme-api{api}')
out.mkdir(parents=True, exist_ok=True)
checks = []

def tree():
    raw = shell('am', 'instrument', '-w', '-r', 'app.aiplayed.uicheck/app.aiplayed.uicheck.Dump')
    return ET.fromstring(raw[raw.index('<?xml'):raw.rindex('</hierarchy>') + len('</hierarchy>')])

def label(n):
    return n.get('content-desc') or n.get('text', '')

def find(value, root=None):
    root = root if root is not None else tree()
    def visible(n):
        box = list(map(int, re.findall(r'\d+', n.get('bounds', ''))))
        return len(box) == 4 and box[2] > box[0] and box[3] > box[1]
    candidates = [n for n in root.iter('node') if visible(n)]
    exact = next((n for n in candidates if label(n) == value), None)
    return exact if exact is not None else next((n for n in candidates if re.match(re.escape(value) + r'(?:[ ,\n]|$)', label(n))), None)

def wait(value):
    end = time.monotonic() + 45
    while time.monotonic() < end:
        node = find(value)
        if node is not None:
            return node
        if value == 'Theme':
            shell('input', 'swipe', 160, 1450, 160, 650, 350)
        time.sleep(.3)
    raise AssertionError('Missing control: ' + value)

def tap(value):
    node = wait(value)
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds')))
    assert x2 > x1 and y2 > y1, value + ' has empty bounds'
    shell('input', 'tap', (x1+x2)//2, (y1+y2)//2)
    time.sleep(.4)

def check(name, passed):
    assert passed, name
    checks.append(name)
    print('PASS:', name, flush=True)

def shot(name):
    file = out / (name + '.png')
    file.write_bytes(adb('exec-out', 'screencap', '-p').stdout)
    (out / (name + '.xml')).write_text(ET.tostring(tree(), encoding='unicode'))
    return file

def appearance(name, dark):
    file = shot(name)
    image = Image.open(file).convert('RGB')
    count = sum(1 for pixel in image.getdata() if pixel == ((23, 25, 30) if dark else (255, 251, 246)))
    check(name + ' uses chosen screen background', count > image.width * image.height * .08)

def phone(dark):
    shell('cmd', 'uimode', 'night', 'yes' if dark else 'no')
    time.sleep(1)

def preference(value):
    tap('Settings'); tap('Theme'); tap(value)
    wait('Settings')
    time.sleep(.8)

def browse(value):
    tap('+ Browse')
    # On smaller screens Recently played may need a scroll inside the sheet.
    for _ in range(3):
        if find(value) is not None:
            break
        shell('input', 'swipe', 450, 1600, 450, 900, 350)
        time.sleep(.4)
    tap(value); wait('+ Browse')

recording = None
try:
    adb('install', '-r', args.helper)
    adb('install', '-r', args.apk)
    shell('pm', 'grant', PKG, 'android.permission.' + ('READ_MEDIA_AUDIO' if api >= 33 else 'READ_EXTERNAL_STORAGE'))
    if api >= 33:
        shell('pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS')
    shell('wm', 'size', '1080x1920'); shell('wm', 'density', '420')
    shell('settings', 'put', 'system', 'accelerometer_rotation', '0')
    shell('settings', 'put', 'system', 'user_rotation', '0')
    fixture = out / 'theme.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=300', '-af', 'volume=0.01', '-codec:a', 'libmp3lame', '-metadata', 'title=Theme Song', '-metadata', 'artist=Theme Artist', '-metadata', 'album=Theme Album', str(fixture)], check=True)
    shell('mkdir', '-p', '/sdcard/Music/ThemeChecks/Nested')
    adb('push', fixture, '/sdcard/Music/ThemeChecks/Nested/theme.mp3')
    shell('am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', 'file:///sdcard/Music/ThemeChecks/Nested/theme.mp3')
    phone(True)
    activity = shell('cmd', 'package', 'resolve-activity', '--brief', PKG).strip().splitlines()[-1]
    shell('am', 'start', '-n', activity)
    wait('+ Browse')
    appearance('fresh-install-follows-dark-phone', True)
    for choice in ['System', 'Light', 'Dark']:
        preference(choice)
        for system_dark in [False, True]:
            phone(system_dark)
            dark = choice == 'Dark' or (choice == 'System' and system_dark)
            appearance(choice.lower() + '-phone-' + ('dark' if system_dark else 'light'), dark)
            # Cold launch for each combination; video includes the native splash handoff.
            shell('am', 'force-stop', PKG)
            name = choice.lower() + '-startup-phone-' + ('dark' if system_dark else 'light')
            remote = '/sdcard/' + name + '.mp4'
            recording = subprocess.Popen(['adb', 'shell', 'screenrecord', '--time-limit', '15', remote], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(.3); shell('am', 'start', '-n', activity)
            wait('+ Browse')
            appearance(name, dark)
            shell('pkill', '-INT', 'screenrecord', check=False)
            recording.wait(timeout=20); recording = None
            adb('pull', remote, str(out / (name + '.mp4')))
            tap('Settings'); tap('Theme')
            selected = wait(choice)
            check(name + ' retains saved selection', selected.get('selected') == 'true')
            shot(name + '-saved-choice'); tap('Close')
    preference('Dark'); tap('Library'); browse('Songs')
    tap('Search your music'); shell('input', 'text', 'Theme'); shell('input', 'keyevent', '4')
    phone(False); appearance('dark-search-restored', True)
    check('theme changes retain search', any(n.get('text') == 'Theme' for n in tree().iter('node')))
    tap('Shuffle all')
    time.sleep(1)
    check('fixture starts playback', is_playing(shell('dumpsys', 'media_session')))
    for destination in ['Songs', 'Albums', 'Artists', 'Folders', 'Playlists', 'Favourites', 'Recently played']:
        browse(destination); appearance('dark-' + destination.lower().replace(' ', '-'), True)
        tap('+ Browse'); shot('dark-browse-' + destination.lower().replace(' ', '-')); tap('Close')
        check(destination + ' navigation preserves playback', is_playing(shell('dumpsys', 'media_session')))
    tap('Sound')
    for tab in ['Tone', 'Output', 'Playback']:
        tap(tab); appearance('dark-sound-' + tab.lower(), True)
    tap('Reset'); shot('dark-sound-reset-dialog'); tap('Cancel')
    tap('Library'); browse('Playlists'); tap('New playlist'); shot('dark-new-playlist-dialog'); tap('Close dialog')
    tap('Settings'); tap('Choose folder'); shot('dark-folder-picker'); tap('Close folder browser')
    tap('Library'); tap('Open now playing'); appearance('dark-player', True)
    tap('Lyrics'); shot('dark-lyrics'); phone(True); shot('dark-open-lyrics-phone-change'); tap('Close')
    check('open lyrics and phone changes preserve playback', is_playing(shell('dumpsys', 'media_session')))
    shell('input', 'keyevent', '4'); preference('System'); tap('Library'); tap('+ Browse')
    phone(False); shot('system-open-browse-light'); phone(True); shot('system-open-browse-dark'); tap('Close')
    for scale, rotation in [('1.6', '0'), ('1.6', '1'), ('1.0', '0')]:
        shell('settings', 'put', 'system', 'font_scale', scale)
        shell('settings', 'put', 'system', 'user_rotation', rotation)
        time.sleep(1); tap('+ Browse'); shot('dark-browse-font-' + scale + '-rotation-' + rotation); tap('Close')
    (out / 'result.json').write_text(json.dumps({'passed': True, 'api': api, 'checks': checks}, indent=2))
except Exception as error:
    (out / 'result.json').write_text(json.dumps({'passed': False, 'api': api, 'checks': checks, 'error': str(error)}, indent=2))
    try:
        shot('failure')
    except Exception:
        pass
    raise
finally:
    if recording:
        shell('pkill', '-INT', 'screenrecord', check=False)
        try:
            recording.wait(timeout=20)
        except subprocess.TimeoutExpired:
            recording.terminate()
    (out / 'logcat.txt').write_bytes(adb('logcat', '-d', check=False).stdout)
    shell('settings', 'put', 'system', 'font_scale', '1.0', check=False)
    shell('settings', 'put', 'system', 'user_rotation', '0', check=False)
    phone(False)
