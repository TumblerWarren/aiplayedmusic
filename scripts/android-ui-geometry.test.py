import unittest
import xml.etree.ElementTree as ET
from android_ui_geometry import visible_bounds, find_node, scroll_gesture, system_night, fixture_indexed


class GeometryChecks(unittest.TestCase):
    def test_settings_swipe_stays_above_the_miniplayer(self):
        root = ET.fromstring('<hierarchy><node scrollable="true" bounds="[0,242][1080,1421]"/><node content-desc="Open now playing" bounds="[74,1450][770,1576]"/></hierarchy>')
        x1, y1, x2, y2 = scroll_gesture(root)
        self.assertTrue(0 < x1 == x2 < 1080)
        self.assertTrue(242 < y2 < y1 < 1421)

    def test_clipped_labels_cannot_match_or_be_tapped(self):
        root = ET.fromstring('<hierarchy><node text="Theme" bounds="[20,1648][600,1421]"/><node text="Theme" bounds="[20,-100][600,-20]"/><node text="Theme" bounds="[20,300][600,350]"/></hierarchy>')
        self.assertIsNone(visible_bounds(root[0]))
        self.assertEqual(find_node(root, 'Theme'), root[2])
        # Screen dumps can expose nodes wholly above the viewport; do not turn
        # their negative coordinates into positive, tappable positions.
        self.assertIsNone(visible_bounds(root[1]))

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
