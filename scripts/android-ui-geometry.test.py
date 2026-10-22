import unittest
import ast
from pathlib import Path
from types import SimpleNamespace
import xml.etree.ElementTree as ET
from android_ui_geometry import visible_bounds, find_node, scroll_gesture, system_night, fixture_indexed, find_folder_row, find_view


class GeometryChecks(unittest.TestCase):
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

    def test_actual_os_mode_is_distinct_from_a_requested_setting(self):
        self.assertFalse(system_night('mNightMode=2 mCurUiMode=0x11'))
        self.assertTrue(system_night('mNightMode=2 mCurUiMode=0x21'))
        with self.assertRaises(AssertionError):
            system_night('mode not available')

    def test_music_is_ready_only_after_its_metadata_is_indexed(self):
        self.assertFalse(fixture_indexed('No result found.'))
        self.assertFalse(fixture_indexed('Row: 0 _id=5, title=Theme Song, duration=0'))
        self.assertFalse(fixture_indexed('Row: 0 _id=5, title=Theme Song remix, duration=300000'))
        self.assertTrue(fixture_indexed('Row: 0 _id=5, title=Theme Song, duration=300000'))


if __name__ == '__main__':
    unittest.main()
