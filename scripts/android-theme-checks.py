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
from android_ui_geometry import find_node, find_view, visible_bounds, scroll_gesture, configuration_night, fixture_indexed
from android_recording import stop_recording

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
    for _ in range(4):
        raw = shell('am', 'instrument', '-w', '-r', 'app.aiplayed.uicheck/app.aiplayed.uicheck.Dump')
        try:
            return ET.fromstring(raw[raw.index('<?xml'):raw.rindex('</hierarchy>') + len('</hierarchy>')])
        except (ValueError, ET.ParseError):
            time.sleep(.3)
    raise AssertionError('Could not read the emulator accessibility tree')

def label(n):
    return n.get('content-desc') or n.get('text', '')

def find(value, root=None):
    root = root if root is not None else tree()
    return find_node(root, value, package=PKG, exact=value in ['Theme', 'System', 'Light', 'Dark', 'Settings', 'Close'])

def wait(value):
    end = time.monotonic() + 45
    scrolls = 0
    while time.monotonic() < end:
        root = tree()
        node = find(value, root)
        if node is not None:
            return node
        if value in ['Theme', 'Choose folder', 'Search your music'] or (value in ['Songs', 'For You', 'Albums', 'Artists', 'Folders', 'Playlists', 'Favourites', 'Recently played'] and find('Close', root) is not None):
            try:
                reverse = value in ['Choose folder', 'Search your music'] or (value == 'Theme' and scrolls == 0)
                shell('input', 'swipe', *scroll_gesture(root, reverse=reverse), 350)
                scrolls += 1
            except AssertionError:
                pass
        time.sleep(.3)
    raise AssertionError('Missing control: ' + value)

def tap(value):
    node = wait(value)
    x1, y1, x2, y2 = visible_bounds(node)
    assert x2 > x1 and y2 > y1, value + ' has empty bounds'
    shell('input', 'tap', (x1+x2)//2, (y1+y2)//2)
    time.sleep(.4)

def wait_absent(value):
    end = time.monotonic() + 10
    while time.monotonic() < end:
        if find(value) is None:
            return
        time.sleep(.2)
    raise AssertionError('Control did not close: ' + value)


def wait_view(test_id):
    end = time.monotonic() + 15
    while time.monotonic() < end:
        node = find_view(tree(), test_id)
        if node is not None:
            return node
        time.sleep(.2)
    raise AssertionError('Screen did not open: ' + test_id)


def open_theme():
    if find_view(tree(), 'settings-screen') is None:
        tap('Settings')
        wait_view('settings-screen')
    tap('Theme')
    wait('System')
    wait('Close')


def check(name, passed):
    assert passed, name
    checks.append(name)
    print('PASS:', name, flush=True)

def shot(name):
    file = out / (name + '.png')
    file.write_bytes(adb('exec-out', 'screencap', '-p').stdout)
    (out / (name + '.xml')).write_text(ET.tostring(tree(), encoding='unicode'))
    return file

def appearance_region(image, root, surface):
    if surface != 'sheet':
        return image
    panel = find_view(root, 'sheet-panel')
    assert panel is not None, 'The themed sheet panel is not visible'
    return image.crop(visible_bounds(panel))


def appearance(name, dark, surface='background'):
    end = time.monotonic() + 10
    while True:
        file = out / (name + '.png')
        file.write_bytes(adb('exec-out', 'screencap', '-p').stdout)
        with Image.open(file) as image:
            image = image.convert('RGB')
            # Judge the sheet itself: its coloured header and cards need not
            # occupy an arbitrary fraction of the whole phone display.
            image = appearance_region(image, tree() if surface == 'sheet' else None, surface)
            expected = ((45, 48, 57) if surface == 'sheet' else (23, 25, 30)) if dark else (255, 251, 246)
            count = next((count for count, color in image.getcolors(image.width * image.height) if color == expected), 0)
            matched = count > image.width * image.height * .08
        if matched or time.monotonic() >= end:
            break
        time.sleep(.3)
    (out / (name + '.xml')).write_text(ET.tostring(tree(), encoding='unicode'))
    check(name + ' uses chosen ' + surface + ' colour', matched)

def phone(dark):
    shell('cmd', 'uimode', 'night', 'yes' if dark else 'no')
    end = time.monotonic() + 5
    while True:
        service = shell('dumpsys', 'uimode')
        configuration = shell('am', 'get-config')
        raw = service + '\nAPPLIED RESOURCE CONFIGURATION\n' + configuration
        applied = configuration_night(configuration)
        if applied == dark or time.monotonic() >= end:
            break
        time.sleep(.25)
    (out / ('phone-request-' + str(dark) + '.txt')).write_text(raw)
    # A requested dark case must never silently become a light case on API26.
    # Failure to establish the prerequisite is a test-environment failure.
    assert applied == dark, 'Phone night-mode request was not applied'
    return applied

def wait_for_fixture():
    end = time.monotonic() + 90
    while True:
        raw = shell('content', 'query', '--uri', 'content://media/external/audio/media', '--projection', '_id:title:duration', check=False)
        (out / 'media-index.txt').write_text(raw)
        if fixture_indexed(raw):
            return
        assert time.monotonic() < end, 'Test song was not indexed by Android MediaStore'
        time.sleep(.5)

def start_fixture():
    # API31 images also index bundled ringtones. Locate the fixture itself,
    # including below the first virtualized page, rather than shuffle those files.
    end = time.monotonic() + 30
    while True:
        root = tree()
        if find('Theme Song, Theme Artist', root) is not None:
            break
        jump = find('Jump to T', root)
        if jump is not None and jump.get('enabled') == 'true':
            tap('Jump to T')
        elif find('Scan for songs', root) is not None:
            tap('Scan for songs')
        assert time.monotonic() < end, 'Indexed fixture did not appear in the library'
        time.sleep(.5)
    tap('Theme Song, Theme Artist')
    end = time.monotonic() + 15
    while True:
        raw = shell('dumpsys', 'media_session')
        (out / 'media-session.txt').write_text(raw)
        if is_playing(raw):
            return
        assert time.monotonic() < end, 'Fixture playback did not become active'
        time.sleep(.3)

def preference(value):
    open_theme()
    tap(value)
    wait_absent('Close')
    wait_view('settings-screen')
    time.sleep(.5)


def browse(value):
    tap('+ Browse')
    wait('Close')
    tap(value)
    wait_absent('Close')
    wait('+ Browse')


def dismiss_playlist_dialog():
    # The scrim covers the whole window in accessibility, but its center is
    # covered by the dialog. Use the visible dialog button and await dismissal.
    tap('Cancel')
    wait_absent('Close dialog')


def return_from_player():
    wait_absent('Close')
    end = time.monotonic() + 20
    while find('+ Browse') is None:
        if find('chevron-down') is not None:
            tap('chevron-down')
        assert time.monotonic() < end, 'Player did not return to Library'
        time.sleep(.3)

recording = None
try:
    adb('install', '-r', args.helper)
    adb('install', '-r', args.apk)
    shell('pm', 'grant', PKG, 'android.permission.' + ('READ_MEDIA_AUDIO' if api >= 33 else 'READ_EXTERNAL_STORAGE'))
    shell('pm', 'grant', 'app.aiplayed.uicheck', 'android.permission.' + ('READ_MEDIA_AUDIO' if api >= 33 else 'READ_EXTERNAL_STORAGE'))
    if api >= 33:
        shell('pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS')
    shell('wm', 'size', '1080x1920'); shell('wm', 'density', '420')
    shell('settings', 'put', 'system', 'accelerometer_rotation', '0')
    shell('settings', 'put', 'system', 'user_rotation', '0')
    fixture = out / 'theme.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=900', '-af', 'volume=0.01', '-codec:a', 'libmp3lame', '-metadata', 'title=Theme Song', '-metadata', 'artist=Theme Artist', '-metadata', 'album=Theme Album', str(fixture)], check=True)
    shell('mkdir', '-p', '/sdcard/Music/ThemeChecks/Nested')
    adb('push', fixture, '/sdcard/Music/ThemeChecks/Nested/theme.mp3')
    scanned = shell('am', 'instrument', '-w', '-r', '-e', 'action', 'scan', '-e', 'path', '/sdcard/Music/ThemeChecks/Nested/theme.mp3', 'app.aiplayed.uicheck/app.aiplayed.uicheck.Dump')
    (out / 'fixture-scan.txt').write_text(scanned)
    assert 'scanned=content://media/' in scanned, 'Fixture scan callback did not return an indexed song'
    wait_for_fixture()
    applied_dark = phone(True)
    activity = shell('cmd', 'package', 'resolve-activity', '--brief', PKG).strip().splitlines()[-1]
    shell('am', 'start', '-n', activity)
    wait('+ Browse')
    appearance('fresh-install-follows-dark-phone', applied_dark)
    for choice in ['System', 'Light', 'Dark']:
        preference(choice)
        for system_dark in [False, True]:
            applied_dark = phone(system_dark)
            dark = choice == 'Dark' or (choice == 'System' and applied_dark)
            appearance(choice.lower() + '-phone-' + ('dark' if system_dark else 'light'), dark)
            # Cold launch for each combination; video includes the native splash handoff.
            shell('am', 'force-stop', PKG)
            name = choice.lower() + '-startup-phone-' + ('dark' if system_dark else 'light')
            remote = '/sdcard/' + name + '.mp4'
            recording = subprocess.Popen(['adb', 'shell', 'screenrecord', '--size', '720x1280', '--bit-rate', '2000000', '--time-limit', '15', remote], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(.3); shell('am', 'start', '-n', activity)
            wait('+ Browse')
            appearance(name, dark)
            start_fixture()
            check(name + ' notification playback is active', is_playing(shell('dumpsys', 'media_session')))
            shell('cmd', 'statusbar', 'expand-notifications'); time.sleep(.6)
            shot(name + '-notification-card')
            shell('cmd', 'statusbar', 'collapse')
            wait('+ Browse')  # Wait for this app, rather than tapping through the shade.
            stop_recording(recording, shell); recording = None
            video = out / (name + '.mp4')
            adb('pull', remote, str(video))
            probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(video)], check=True, capture_output=True, text=True, timeout=20)
            duration = float(json.loads(probe.stdout)['format']['duration'])
            check(name + ' retains a playable startup video', duration > 0)
            open_theme()
            selected = wait(choice)
            check(name + ' retains saved selection', selected.get('selected') == 'true')
            shot(name + '-saved-choice'); tap('Close'); wait_absent('Close')
    preference('Dark'); tap('Library'); browse('Songs')
    tap('Search your music'); shell('input', 'text', 'Theme'); shell('input', 'keyevent', '4')
    phone(False); appearance('dark-search-restored', True)
    check('theme changes retain search', any(n.get('text') == 'Theme' for n in tree().iter('node')))
    start_fixture()
    check('fixture starts playback', is_playing(shell('dumpsys', 'media_session')))
    for destination in ['Songs', 'For You', 'Albums', 'Artists', 'Folders', 'Playlists', 'Favourites', 'Recently played']:
        browse(destination); appearance('dark-' + destination.lower().replace(' ', '-'), True)
        tap('+ Browse'); shot('dark-browse-' + destination.lower().replace(' ', '-')); tap('Close')
        check(destination + ' navigation preserves playback', is_playing(shell('dumpsys', 'media_session')))
    tap('Sound')
    for tab in ['Tone', 'Output', 'Playback']:
        tap(tab); appearance('dark-sound-' + tab.lower(), True)
    tap('Reset'); shot('dark-sound-reset-dialog'); tap('Cancel')
    tap('Library'); browse('Playlists'); tap('New playlist'); shot('dark-new-playlist-dialog'); dismiss_playlist_dialog()
    tap('Settings'); tap('Choose folder'); shot('dark-folder-picker'); tap('Close folder browser')
    tap('Library'); tap('Open now playing'); appearance('dark-player', True)
    tap('Lyrics'); shot('dark-lyrics'); phone(True); shot('dark-open-lyrics-phone-change'); tap('Close')
    check('open lyrics and phone changes preserve playback', is_playing(shell('dumpsys', 'media_session')))
    return_from_player(); preference('System'); tap('Library'); tap('+ Browse')
    for dark in [False, True]:
        phone(dark)
        check('System phone change keeps Browse open (' + str(dark) + ')', find('Close') is not None)
        appearance('system-open-browse-' + ('dark' if dark else 'light'), dark, surface='sheet')
    tap('Close'); wait_absent('Close')
    for scale, rotation in [('1.6', '0'), ('1.6', '1'), ('1.0', '0')]:
        shell('settings', 'put', 'system', 'font_scale', scale)
        shell('settings', 'put', 'system', 'user_rotation', rotation)
        time.sleep(1); tap('+ Browse'); wait('Close')
        appearance('dark-browse-font-' + scale + '-rotation-' + rotation, True, surface='sheet')
        tap('Close'); wait_absent('Close')
        check('Browse opens and closes at font ' + scale + ' rotation ' + rotation, find('+ Browse') is not None)
    (out / 'result.json').write_text(json.dumps({'passed': True, 'api': api, 'checks': checks}, indent=2))
except Exception as error:
    (out / 'result.json').write_text(json.dumps({'passed': False, 'api': api, 'checks': checks, 'error': str(error)}, indent=2))
    try:
        shot('failure')
    except Exception:
        pass
    raise
finally:
    if recording is not None:
        stop_recording(recording, shell)
    (out / 'logcat.txt').write_bytes(adb('logcat', '-d', check=False).stdout)
    shell('settings', 'put', 'system', 'font_scale', '1.0', check=False)
    shell('settings', 'put', 'system', 'user_rotation', '0', check=False)
    phone(False)
