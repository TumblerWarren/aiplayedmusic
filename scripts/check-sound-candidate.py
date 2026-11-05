"""Focused checks against the unchanged failed-build candidate."""
import os
import runpy
import sys
import time
from pathlib import Path

sys.path.insert(0, 'scripts')
checks = runpy.run_path('scripts/android-ui-checks.py', run_name='focused_sound')
context = checks['check_sound_controls'].__globals__
original = context['check_sound_controls']
rotation = os.environ.get('ROTATION', '1')

def rotated_controls():
    context['shell']('settings', 'put', 'system', 'user_rotation', rotation)
    context['shell']('settings', 'put', 'system', 'font_scale', '1.0')
    time.sleep(2)
    context['shot']('before-sound-rotation-' + rotation)
    original()

context['check_sound_controls'] = rotated_controls
context['OUT'] = context['OUT'] / ('sound-rotation-' + rotation)
checks['run_checks'](str(next(Path('candidate').rglob('*.apk'))), 'sound')
