#!/usr/bin/env bash
# One shell is required: emulator-runner executes separate script lines independently.
set -euo pipefail
adb logcat -G 16M
baseline_result=0
python scripts/android-ui-checks.py --apk /tmp/search-baseline.apk --scenario search || baseline_result=$?
mkdir -p verification/search-overlay/baseline
cp -r verification/android-v1.3.0/search-run-1/. verification/search-overlay/baseline/
python - "$baseline_result" <<'CHECK'
import json,sys
from pathlib import Path
assert int(sys.argv[1]) != 0, 'Baseline unexpectedly passed; inspect comparison validity'
result=json.loads(Path('verification/search-overlay/baseline/result.json').read_text())
assert 'songs: returned search has its full expanded height' in result.get('failures', []), 'Baseline failed before the target regression'
CHECK
adb logcat -c
python scripts/android-ui-checks.py --apk /tmp/search-candidate.apk --scenario search --repeat 2

