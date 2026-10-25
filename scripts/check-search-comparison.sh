#!/usr/bin/env bash
# The previous candidate already reproduced clipping in run 40171682388.
# Verify the corrected candidate independently; do not block it on the old app.
set -euo pipefail
adb logcat -G 16M
python scripts/android-ui-checks.py --apk /tmp/search-candidate.apk --scenario search --repeat 2
