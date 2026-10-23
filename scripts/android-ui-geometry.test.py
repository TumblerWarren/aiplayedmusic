import unittest
import ast
from pathlib import Path
from types import SimpleNamespace
import xml.etree.ElementTree as ET
from android_ui_geometry import visible_bounds, find_node, scroll_bounds, scroll_gesture, system_night, fixture_indexed, find_folder_row, find_view, configuration_night


class GeometryChecks(unittest.TestCase):
    def test_action_lookup_uses_the_app_button_instead_of_a_heading_or_other_package(self):
        source = ast.parse(Path('scripts/android-ui-checks.py').read_text())
        functions = [node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in ['label', 'find']]
        root = ET.fromstring('<hierarchy><node package="com.android.systemui" content-desc="Sound" clickable="true" bounds="[0,0][400,100]"/>'
            '<node package="app.localmusic.player" text="Sound" bounds="[0,120][400,200]"/>'
            '<node package="app.localmusic.player" content-desc="Sound" clickable="true" bounds="[500,1700][700,1820]"/></hierarchy>')
        namespace = dict(tree=lambda: root, PKG='app.localmusic.player', find_node=find_node, visible_bounds=visible_bounds)
        exec(compile(ast.Module(body=functions, type_ignores=[]), '<action lookup>', 'exec'), namespace)
        self.assertIs(namespace['find']('Sound'), root[2])

    def test_db_readback_keeps_fractional_values_when_the_dial_is_offscreen(self):
        source = ast.parse(Path('scripts/android-ui-checks.py').read_text())
        functions = [node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in ['label', 'knob_value']]
        root = ET.parse('scripts/fixtures/run71-clipped-bass.xml').getroot()
        root[1][0].set('bounds', '[126,-500][462,-164]')
        namespace = dict(tree=lambda: root, re=__import__('re'))
        exec(compile(ast.Module(body=functions, type_ignores=[]), '<semantic readback>', 'exec'), namespace)
        self.assertEqual(namespace['knob_value']('bass'), 2.5, 'range-current is rounded to 2.0 in the captured native tree')

    def test_sound_state_wait_accepts_delayed_exact_commits_and_rejects_wrong_steps(self):
        source = ast.parse(Path('scripts/android-ui-checks.py').read_text())
        function = next(node for node in source.body if isinstance(node, ast.FunctionDef) and node.name == 'wait_knob_value')
        for values, succeeds in [([2.5, 2.5, 3.0], True), ([3.5], False)]:
            clock = SimpleNamespace(seconds=0, reads=0)
            def read(name):
                value = values[min(clock.reads, len(values)-1)]
                clock.reads += 1
                return value
            namespace = dict(knob_value=read, time=SimpleNamespace(monotonic=lambda: clock.seconds,
                sleep=lambda seconds: setattr(clock, 'seconds', clock.seconds+seconds)))
            exec(compile(ast.Module(body=[function], type_ignores=[]), '<commit wait>', 'exec'), namespace)
            if succeeds:
                self.assertEqual(namespace['wait_knob_value']('bass', lambda value: abs(value-3.0)<.05, 'expected one half-dB step', timeout=1), 3.0)
                self.assertEqual(clock.reads, 3)
            else:
                with self.assertRaisesRegex(AssertionError, 'expected one half-dB step; observed 3.5'):
                    namespace['wait_knob_value']('bass', lambda value: abs(value-3.0)<.05, 'expected one half-dB step', timeout=1)
                self.assertLessEqual(clock.seconds, 1.2)

    def test_precision_button_is_revealed_separately_from_the_visible_dial(self):
        source = ast.parse(Path('scripts/android-ui-checks.py').read_text())
        functions = [node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in ['label', 'bounds', 'find', 'wait', 'tap']]
        root = ET.parse('scripts/fixtures/run71-clipped-bass.xml').getroot()
        self.assertIsNotNone(find_view(root, 'knob-bass'), 'the recorded dial face already fits')
        self.assertIsNone(find_node(root, 'Increase Bass'), 'the separate button is clipped below the viewport')
        clock = SimpleNamespace(seconds=0)
        gestures, taps = [], []
        def swipe(x1, y1, x2, y2):
            self.assertTrue(0 < x1 == x2 < 126, 'scroll outside the dial')
            self.assertTrue(378 < y2 < y1 < 1484, 'scroll inside Sound and above the mini-player')
            gestures.append((x1, y1, x2, y2))
            root[1][0].set('bounds', '[126,498][462,834]')
            root[1][2].set('bounds', '[315,923][441,1049]')
        def shell(*args):
            self.assertEqual(args[:2], ('input', 'tap'))
            taps.append(args[2:])
        namespace = dict(tree=lambda: root, PKG='app.localmusic.player', visible_bounds=visible_bounds,
            find_node=find_node, scroll_bounds=scroll_bounds, scroll_gesture=scroll_gesture,
            swipe=swipe, shell=shell, DESTINATIONS=[], re=__import__('re'),
            time=SimpleNamespace(monotonic=lambda: clock.seconds, sleep=lambda seconds: setattr(clock, 'seconds', clock.seconds+seconds)))
        exec(compile(ast.Module(body=functions, type_ignores=[]), '<precision navigation>', 'exec'), namespace)
        namespace['tap']('Increase Bass')
        self.assertEqual(len(gestures), 1)
        self.assertEqual(taps, [(378, 986)])

    def test_choose_folder_keeps_scrolling_up_past_multiple_settings_rows(self):
        source = ast.parse(Path('scripts/android-ui-checks.py').read_text())
        functions = [node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in ['label', 'find', 'wait']]
        root = ET.fromstring('<hierarchy><node text="Settings" bounds="[52,95][744,177]"/>'
            '<node scrollable="true" bounds="[0,242][1080,1421]"/>'
            '<node content-desc="Choose folder" bounds="[20,-500][1000,-400]"/></hierarchy>')
        for node in root.iter('node'): node.set('package', 'app.localmusic.player')
        clock = SimpleNamespace(seconds=0)
        swipes = []
        def swipe(x1, y1, x2, y2):
            self.assertTrue(242 < y1 < y2 < 1421, 'keep scrolling toward the top until Choose folder appears')
            swipes.append((x1, y1, x2, y2))
            clock.seconds += .5
            if len(swipes) == 3: root[-1].set('bounds', '[20,300][1000,440]')
        namespace = dict(tree=lambda: root, PKG='app.localmusic.player', find_node=find_node, visible_bounds=visible_bounds, scroll_gesture=scroll_gesture, swipe=swipe,
            DESTINATIONS=[], time=SimpleNamespace(monotonic=lambda: clock.seconds, sleep=lambda seconds: setattr(clock, 'seconds', clock.seconds+seconds)))
        exec(compile(ast.Module(body=functions, type_ignores=[]), '<settings navigation>', 'exec'), namespace)
        self.assertIs(namespace['wait']('Choose folder', timeout=5), root[-1])
        self.assertEqual(len(swipes), 3)

    def test_settings_swipe_stays_above_the_miniplayer(self):
        root = ET.fromstring('<hierarchy><node scrollable="true" bounds="[0,242][1080,1421]"/><node content-desc="Open now playing" bounds="[74,1450][770,1576]"/></hierarchy>')
        x1, y1, x2, y2 = scroll_gesture(root)
        self.assertTrue(0 < x1 == x2 < 1080)
        self.assertTrue(242 < y2 < y1 < 1421)

    def test_browse_gestures_follow_sheet_bounds_after_rotation_and_font_changes(self):
        for box in ['[0,1150][1080,1800]', '[0,120][1920,900]', '[0,500][1080,1800]']:
            root = ET.fromstring(f'<hierarchy><node content-desc="Drag down to close" bounds="[0,100][1080,200]"/><node scrollable="true" bounds="{box}"/></hierarchy>')
            left, top, right, bottom = visible_bounds(root[1])
            for reverse in [False, True]:
                x1, y1, x2, y2 = scroll_gesture(root, reverse=reverse)
                self.assertTrue(left < x1 == x2 < right)
                self.assertTrue(top < min(y1, y2) < max(y1, y2) < bottom)
                self.assertEqual(y1 < y2, reverse)

    def test_clipped_labels_cannot_match_or_be_tapped(self):
        root = ET.fromstring('<hierarchy><node text="Theme" bounds="[20,1648][600,1421]"/><node text="Theme" bounds="[20,-100][600,-20]"/><node text="Theme" bounds="[20,300][600,350]"/></hierarchy>')
        self.assertIsNone(visible_bounds(root[0]))
        self.assertEqual(find_node(root, 'Theme'), root[2])
        # Screen dumps can expose nodes wholly above the viewport; do not turn
        # their negative coordinates into positive, tappable positions.
        self.assertIsNone(visible_bounds(root[1]))

    def test_folder_navigation_uses_full_path_clickable_rows_and_confirms_destination(self):
        root = ET.fromstring('<hierarchy><node text="Music" bounds="[20,90][300,150]"/>'
            '<node clickable="true" content-desc="Open folder /storage/emulated/0/Musicals" bounds="[20,300][1000,440]"/>'
            '<node clickable="true" content-desc="Open folder /storage/emulated/0/Music" bounds="[20,450][1000,590]"/>'
            '<node text="Music" bounds="[100,470][700,530]"/>'
            '<node resource-id="folder-screen:/storage/emulated/0" bounds="[0,70][1080,1600]"/></hierarchy>')
        path = '/storage/emulated/0/Music'
        self.assertIs(find_folder_row(root, path), root[2])
        self.assertIsNone(find_view(root, 'folder-screen:' + path))
        root[-1].set('resource-id', 'folder-screen:' + path)
        self.assertIs(find_view(root, 'folder-screen:' + path), root[-1])
        # Picker rows include count metadata and must also match exact paths.
        root[2].set('content-desc', path + ', 52 songs')
        self.assertIs(find_folder_row(root, path), root[2])
        root[2].set('bounds', '[20,1700][1000,1600]')
        self.assertIsNone(find_folder_row(root, path))

    def test_folder_open_retries_a_stale_tap_and_requires_the_destination(self):
        source = ast.parse(Path('scripts/android-ui-checks.py').read_text())
        function = next(node for node in source.body if isinstance(node, ast.FunctionDef) and node.name == 'open_folder')
        path = '/storage/emulated/0/Music'
        root = ET.fromstring('<hierarchy><node clickable="true" content-desc="Open folder /storage/emulated/0/Music" bounds="[20,400][1000,540]"/>'
            '<node resource-id="folder-screen:/storage/emulated/0" bounds="[0,70][1080,1600]"/></hierarchy>')
        clock = SimpleNamespace(seconds=0)
        taps, screenshots = [], []
        def sleep(seconds): clock.seconds += seconds
        def tap(row):
            taps.append(row.get('bounds'))
            if len(taps) == 1:
                row.set('bounds', '[20,600][1000,740]')
            else:
                root[-1].set('resource-id', 'folder-screen:' + path)
        namespace = dict(time=SimpleNamespace(monotonic=lambda: clock.seconds, sleep=sleep),
            tree=lambda: root, tap=tap, shot=screenshots.append,
            find_view=find_view, find_folder_row=find_folder_row, scroll_gesture=scroll_gesture)
        exec(compile(ast.Module(body=[function], type_ignores=[]), '<folder navigation>', 'exec'), namespace)
        namespace['open_folder'](path, timeout=5)
        self.assertEqual(taps, ['[20,400][1000,540]', '[20,600][1000,740]'])
        self.assertFalse(screenshots)
        # Finding/tapping the correct label is insufficient if the destination never opens.
        root[-1].set('resource-id', 'folder-screen:/storage/emulated/0')
        clock.seconds = 0
        namespace['tap'] = lambda row: None
        with self.assertRaisesRegex(AssertionError, 'Folder did not open'):
            namespace['open_folder'](path, timeout=1)
        self.assertEqual(screenshots, ['folder-navigation-timeout'])

    def test_rotary_navigation_scrolls_past_the_recorded_inverted_bass_bounds(self):
        source = ast.parse(Path('scripts/android-ui-checks.py').read_text())
        functions = [node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in ['bounds', 'knob_node', 'visible_knob']]
        root = ET.fromstring('<hierarchy><node scrollable="true" bounds="[0,350][1080,1484]">'
            '<node resource-id="knob-bass" content-desc="Bass, 0.0 dB" range-current="0.0" bounds="[126,1718][462,1484]"/>'
            '</node></hierarchy>')
        swipes = []
        def swipe(x1, y1, x2, y2, *args):
            self.assertTrue(0 < x1 == x2 < 126, 'scroll in the margin, outside the rotary face')
            self.assertTrue(350 < min(y1, y2) < max(y1, y2) < 1484)
            swipes.append((x1, y1, x2, y2))
            root[0][0].set('bounds', '[126,700][462,1036]')
        namespace = dict(tree=lambda: root, visible_bounds=visible_bounds, find_view=find_view,
            scroll_gesture=scroll_gesture, scroll_bounds=scroll_bounds, swipe=swipe, re=__import__('re'))
        exec(compile(ast.Module(body=functions, type_ignores=[]), '<rotary navigation>', 'exec'), namespace)
        self.assertIs(namespace['visible_knob']('bass'), root[0][0])
        self.assertEqual(len(swipes), 1)
        # The same control can be clipped above the viewport after restoring scroll.
        root[0][0].set('bounds', '[126,350][462,120]')
        self.assertIs(namespace['visible_knob']('bass'), root[0][0])
        self.assertGreater(swipes[-1][3], swipes[-1][1])
        # A partially visible, positive rectangle is still too short for a rotation.
        root[0][0].set('bounds', '[126,1300][462,1484]')
        self.assertIs(namespace['visible_knob']('bass'), root[0][0])
        self.assertEqual(len(swipes), 3)

    def test_actual_os_mode_is_distinct_from_a_requested_setting(self):
        self.assertFalse(system_night('mNightMode=2 mCurUiMode=0x11'))
        self.assertTrue(system_night('mNightMode=2 mCurUiMode=0x21'))
        with self.assertRaises(AssertionError):
            system_night('mode not available')

    def test_applied_resource_mode_is_distinct_from_service_night_mode(self):
        self.assertFalse(configuration_night('config: en-rUS-ldltr-sw411dp-port-notnight-420dpi-v26\nabi: x86_64'))
        self.assertTrue(configuration_night('config: en-rUS-ldltr-sw411dp-port-night-420dpi-v35'))
        self.assertFalse(configuration_night('mCurUiMode=0x21\nconfig: en-rUS-port-notnight-420dpi-v26'))
        with self.assertRaises(AssertionError):
            configuration_night('mCurUiMode=0x21')

    def test_music_is_ready_only_after_its_metadata_is_indexed(self):
        self.assertFalse(fixture_indexed('No result found.'))
        self.assertFalse(fixture_indexed('Row: 0 _id=5, title=Theme Song, duration=0'))
        self.assertFalse(fixture_indexed('Row: 0 _id=5, title=Theme Song remix, duration=300000'))
        self.assertTrue(fixture_indexed('Row: 0 _id=5, title=Theme Song, duration=300000'))


if __name__ == '__main__':
    unittest.main()
