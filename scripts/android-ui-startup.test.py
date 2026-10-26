"""Replay the captured emulator launcher blocker without adb."""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
import xml.etree.ElementTree as ET
from android_ui_geometry import find_node, launcher_anr_close, visible_bounds


class StartupChecks(unittest.TestCase):
    def setUp(self):
        self.blocked = ET.parse('scripts/fixtures/emulator-launcher-anr.xml').getroot()
        self.ready = ET.fromstring('<hierarchy><node package="app.localmusic.player" content-desc="+ Browse" bounds="[760,84][1028,210]"/></hierarchy>')

    def run_wait(self, roots, recover=True):
        clock = SimpleNamespace(seconds=0)
        commands, evidence = [], []
        class Output:
            def __truediv__(self, name):
                evidence.append(name)
                return self
            def write_text(self, text):
                ET.fromstring(text)
        remaining = iter(roots)
        current = roots[-1]
        def tree():
            nonlocal current
            current = next(remaining, current)
            return current
        source = ast.parse(Path('scripts/android-ui-checks.py').read_text())
        functions = [n for n in source.body if isinstance(n, ast.FunctionDef) and n.name in ['find', 'bounds', 'wait']]
        namespace = dict(tree=tree, PKG='app.localmusic.player', find_node=find_node,
                         visible_bounds=visible_bounds, launcher_anr_close=launcher_anr_close,
                         DESTINATIONS=[], OUT=Output(), ET=ET,
                         shell=lambda *args: commands.append(args),
                         shot=lambda name, **kwargs: evidence.append(name + '.png'),
                         time=SimpleNamespace(monotonic=lambda: clock.seconds,
                                              sleep=lambda seconds: setattr(clock, 'seconds', clock.seconds+seconds)))
        exec(compile(ast.Module(body=functions, type_ignores=[]), '<startup driver>', 'exec'), namespace)
        self.commands, self.evidence = commands, evidence
        return namespace['wait']('+ Browse', timeout=2, recover_launcher=recover)

    def test_actual_launcher_dialog_is_closed_and_browse_still_required(self):
        node = self.run_wait([self.blocked, self.ready])
        self.assertEqual(node.get('content-desc'), '+ Browse')
        self.assertEqual(self.commands, [('input', 'tap', 540, 961)])
        self.assertEqual(self.evidence, ['launcher-anr.png', 'launcher-anr.xml'])

    def test_repeated_launcher_blocker_stops_after_one_recovery(self):
        with self.assertRaisesRegex(AssertionError, 'Emulator infrastructure failure'):
            self.run_wait([self.blocked])
        self.assertEqual(len(self.commands), 1)

    def test_missing_app_control_does_not_pass_after_dismissing_launcher(self):
        with self.assertRaisesRegex(AssertionError, 'Missing UI control: \\+ Browse'):
            self.run_wait([self.blocked, ET.fromstring('<hierarchy/>')])
        self.assertEqual(len(self.commands), 1)

    def test_app_anr_is_never_bypassed(self):
        for node in self.blocked.iter('node'):
            if node.get('resource-id') == 'android:id/alertTitle':
                node.set('text', "Aiplayed isn't responding")
        with self.assertRaisesRegex(AssertionError, 'Missing UI control'):
            self.run_wait([self.blocked])
        self.assertEqual(self.commands, [])

    def test_recovery_is_opt_in_for_startup(self):
        with self.assertRaisesRegex(AssertionError, 'Missing UI control'):
            self.run_wait([self.blocked], recover=False)
        self.assertEqual(self.commands, [])

    def test_non_system_imitation_cannot_be_dismissed(self):
        for node in self.blocked.iter('node'):
            node.set('package', 'app.localmusic.player')
        self.assertIsNone(launcher_anr_close(self.blocked))


if __name__ == '__main__':
    unittest.main()
