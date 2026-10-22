"""Offline regressions for the actual theme driver; never start adb or an emulator."""
import ast
from pathlib import Path
import subprocess
from types import SimpleNamespace
import unittest
import xml.etree.ElementTree as ET
from android_recording import stop_recording
from android_ui_geometry import find_node, find_view, visible_bounds, scroll_gesture

PKG = 'app.localmusic.player'


def driver_functions(*names, **globals):
    source = ast.parse(Path('scripts/android-theme-checks.py').read_text())
    body = [node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in names]
    namespace = dict(PKG=PKG, find_node=find_node, find_view=find_view, visible_bounds=visible_bounds, scroll_gesture=scroll_gesture, **globals)
    exec(compile(ast.Module(body=body, type_ignores=[]), '<theme driver>', 'exec'), namespace)
    return namespace


class ThemeDriverChecks(unittest.TestCase):
    def test_player_return_waits_for_lyrics_dismissal_and_library_destination(self):
        root = ET.fromstring('<hierarchy><node package="app.localmusic.player" content-desc="Close" clickable="true" bounds="[800,1000][1020,1120]"/></hierarchy>')
        clock = SimpleNamespace(seconds=0, navigating=False, destination_at=0)
        taps = []
        def sleep(seconds):
            clock.seconds += seconds
            if clock.seconds >= .4 and not clock.navigating:
                root.clear()
                root.append(ET.Element('node', {'package': PKG, 'content-desc': 'chevron-down', 'clickable': 'true', 'bounds': '[32,79][158,205]'}))
            if clock.navigating and clock.seconds >= clock.destination_at:
                root.clear()
                for label in ['+ Browse', 'Settings']:
                    root.append(ET.Element('node', {'package': PKG, 'content-desc': label, 'clickable': 'true', 'bounds': '[765,74][1028,200]'}))
        def shell(*args):
            self.assertEqual(args[:2], ('input', 'tap'))
            self.assertGreaterEqual(clock.seconds, .4, 'wait for the lyrics window to disappear')
            self.assertEqual(args[2:], (95, 142), 'tap the recorded visible player return button')
            taps.append(args[2:])
            if len(taps) == 2:
                clock.navigating = True
                clock.destination_at = clock.seconds + .6
        driver = driver_functions('find', 'wait', 'tap', 'wait_absent', 'return_from_player', tree=lambda: root, shell=shell,
            time=SimpleNamespace(monotonic=lambda: clock.seconds, sleep=sleep))
        driver['return_from_player']()
        self.assertEqual(taps, [(95, 142), (95, 142)], 'retry an input consumed while the dialog closes')
        self.assertGreaterEqual(clock.seconds, clock.destination_at, 'wait for the actual library destination')
        self.assertIsNotNone(driver['find']('Settings'))

    def test_fixture_below_api31_ringtones_is_located_and_played_without_shuffle(self):
        for below_fold in [False, True]:
            with self.subTest(below_fold=below_fold):
                root = ET.fromstring('<hierarchy><node package="app.localmusic.player" content-desc="Calm, Unknown artist" clickable="true" bounds="[42,520][954,709]"/>'
                    '<node package="app.localmusic.player" content-desc="Jump to T" clickable="true" enabled="true" bounds="[970,1178][1075,1210]"/>'
                    '<node package="app.localmusic.player" text="Theme Song" bounds="[200,1500][700,1600]"/></hierarchy>')
                def reveal():
                    root.append(ET.Element('node', {'package': PKG, 'content-desc': 'Theme Song, Theme Artist', 'clickable': 'true', 'bounds': '[42,520][954,709]'}))
                if not below_fold: reveal()
                calls = []
                clock = SimpleNamespace(seconds=0)
                def tap(value):
                    calls.append(value)
                    if value == 'Jump to T': reveal()
                    elif value != 'Theme Song, Theme Artist': self.fail('must play the fixture row, not the mini-player or system ringtones')
                class Evidence:
                    def __truediv__(self, path): return self
                    def write_text(self, value): pass
                driver = driver_functions('find', 'start_fixture', tree=lambda: root, tap=tap, out=Evidence(),
                    shell=lambda *args: 'playing', is_playing=lambda raw: raw == 'playing',
                    time=SimpleNamespace(monotonic=lambda: clock.seconds, sleep=lambda seconds: setattr(clock, 'seconds', clock.seconds+seconds)))
                driver['start_fixture']()
                self.assertEqual(calls, ['Jump to T', 'Theme Song, Theme Artist'] if below_fold else ['Theme Song, Theme Artist'])

    def test_search_is_restored_to_view_after_alphabet_navigation(self):
        clock = SimpleNamespace(seconds=0)
        root = ET.fromstring('<hierarchy><node scrollable="true" bounds="[0,520][1080,1421]"/></hierarchy>')
        def shell(*args):
            self.assertEqual(args[:2], ('input', 'swipe'))
            self.assertLess(args[3], args[5], 'scroll back toward the search header')
            root.append(ET.Element('node', {'package': PKG, 'content-desc': 'Search your music', 'bounds': '[52,210][1027,321]'}))
        driver = driver_functions('find', 'wait', tree=lambda: root, shell=shell,
            time=SimpleNamespace(monotonic=lambda: clock.seconds, sleep=lambda seconds: setattr(clock, 'seconds', clock.seconds+seconds)))
        self.assertEqual(driver['wait']('Search your music').get('content-desc'), 'Search your music')

    def test_theme_does_not_match_the_recorded_theme_song_or_system_ui(self):
        root = ET.fromstring('<hierarchy><node package="app.localmusic.player" content-desc="Theme Song, Theme Artist" clickable="true" bounds="[42,520][954,709]"/>'
            '<node package="com.android.systemui" content-desc="Theme" clickable="true" bounds="[20,100][300,200]"/></hierarchy>')
        driver = driver_functions('find', tree=lambda: root)
        self.assertIsNone(driver['find']('Theme'))
        self.assertIs(driver['find']('Theme Song'), root[0])
        root.append(ET.fromstring('<node package="app.localmusic.player" content-desc="Theme" clickable="true" bounds="[20,300][1000,450]"/>'))
        self.assertIs(driver['find']('Theme'), root[-1])

    def test_saved_choice_targets_selected_button_instead_of_its_text_child(self):
        root = ET.fromstring('<hierarchy><node package="app.localmusic.player" text="System" selected="false" bounds="[80,900][200,950]"/>'
            '<node package="app.localmusic.player" content-desc="System" clickable="true" selected="true" bounds="[20,850][1000,1000]"/></hierarchy>')
        driver = driver_functions('find', tree=lambda: root)
        self.assertIs(driver['find']('System'), root[1])
        self.assertEqual(driver['find']('System').get('selected'), 'true')

    def test_open_theme_waits_for_settings_before_opening_the_menu(self):
        clock = SimpleNamespace(seconds=0)
        root = ET.fromstring('<hierarchy><node package="app.localmusic.player" content-desc="Theme Song, Theme Artist" clickable="true" bounds="[42,520][954,709]"/></hierarchy>')
        calls = []
        def sleep(seconds): clock.seconds += seconds
        def tap(value):
            calls.append(value)
            if value == 'Settings':
                root.append(ET.fromstring('<node resource-id="settings-screen" bounds="[0,70][1080,1600]"/>'))
            elif value == 'Theme':
                self.assertIsNotNone(find_view(root, 'settings-screen'))
                for title in ['System', 'Close']:
                    root.append(ET.Element('node', {'package': PKG, 'content-desc': title, 'clickable': 'true', 'bounds': '[20,900][1000,1050]'}))
        driver = driver_functions('find', 'wait', 'wait_view', 'open_theme', tree=lambda: root, tap=tap,
            time=SimpleNamespace(monotonic=lambda: clock.seconds, sleep=sleep))
        driver['open_theme']()
        self.assertEqual(calls, ['Settings', 'Theme'])

    def test_browse_scrolls_inside_current_sheet_bounds(self):
        clock = SimpleNamespace(seconds=0)
        root = ET.fromstring('<hierarchy><node package="app.localmusic.player" content-desc="Close" clickable="true" bounds="[800,1020][1000,1120]"/>'
            '<node scrollable="true" bounds="[0,1150][1080,1800]"/></hierarchy>')
        gestures = []
        def shell(*args):
            self.assertEqual(args[:2], ('input', 'swipe'))
            _, _, x1, y1, x2, y2, duration = args
            self.assertTrue(1150 < y2 < y1 < 1800)
            gestures.append(args)
            root.append(ET.Element('node', {'package': PKG, 'content-desc': 'Folders', 'clickable': 'true', 'bounds': '[20,1400][1000,1550]'}))
        def sleep(seconds): clock.seconds += seconds
        driver = driver_functions('find', 'wait', tree=lambda: root, shell=shell,
            time=SimpleNamespace(monotonic=lambda: clock.seconds, sleep=sleep))
        self.assertEqual(driver['wait']('Folders').get('content-desc'), 'Folders')
        self.assertEqual(len(gestures), 1)

    def test_recorder_shutdown_is_bounded_and_reaps_hung_adb(self):
        for timeouts in [0, 1, 2, 3]:
            with self.subTest(timeouts=timeouts):
                actions = []
                class Process:
                    returncode = None
                    remaining = timeouts
                    def poll(self): return self.returncode
                    def wait(self, timeout):
                        actions.append(('wait', timeout))
                        if self.remaining:
                            self.remaining -= 1
                            raise subprocess.TimeoutExpired('adb screenrecord', timeout)
                        self.returncode = 0
                        return 0
                    def terminate(self): actions.append(('terminate',))
                    def kill(self): actions.append(('kill',))
                def shell(*args, **kwargs):
                    actions.append(args)
                    return '1234\n' if args[0] == 'pidof' else ''
                process = Process()
                self.assertEqual(stop_recording(process, shell), 0)
                self.assertIn(('kill', '-2', '1234'), actions)
                self.assertEqual(('kill', '-15', '1234') in actions, timeouts >= 1)
                self.assertEqual(('terminate',) in actions, timeouts >= 2)
                self.assertEqual(('kill',) in actions, timeouts >= 3)
                self.assertIsNotNone(process.returncode)

    def test_completed_recorder_does_not_receive_signals(self):
        process = SimpleNamespace(poll=lambda: 0, returncode=0)
        def shell(*args, **kwargs): self.fail('completed recording must not be signalled')
        self.assertEqual(stop_recording(process, shell), 0)

    def test_playlist_dialog_dismisses_via_visible_cancel_instead_of_covered_scrim_center(self):
        clock = SimpleNamespace(seconds=0)
        root = ET.fromstring('<hierarchy><node package="app.localmusic.player" content-desc="Close dialog" clickable="true" bounds="[0,0][1080,1600]"/>'
            '<node package="app.localmusic.player" text="Cancel" clickable="true" bounds="[600,900][800,1000]"/></hierarchy>')
        taps = []
        def shell(*args):
            self.assertEqual(args[:2], ('input', 'tap'))
            taps.append(args[2:])
            if 600 < args[2] < 800 and 900 < args[3] < 1000:
                root.clear()
                root.append(ET.Element('node', {'package': PKG, 'content-desc': 'Settings', 'clickable': 'true', 'bounds': '[800,1500][1000,1600]'}))
        def sleep(seconds): clock.seconds += seconds
        driver = driver_functions('find', 'wait', 'tap', 'wait_absent', 'dismiss_playlist_dialog', tree=lambda: root, shell=shell,
            time=SimpleNamespace(monotonic=lambda: clock.seconds, sleep=sleep))
        driver['tap']('Close dialog')
        self.assertIsNotNone(driver['find']('Close dialog'), 'covered scrim center does not dismiss the dialog')
        driver['dismiss_playlist_dialog']()
        self.assertEqual(taps, [(540, 800), (700, 950)])
        self.assertIsNone(driver['find']('Close dialog'))
        self.assertIsNotNone(driver['find']('Settings'))


if __name__ == '__main__':
    unittest.main()
