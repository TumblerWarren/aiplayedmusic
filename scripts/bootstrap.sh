#!/usr/bin/env bash
# Install project-local Android build tools. Requires a full JDK 17+ and internet access.
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
tools_dir="$project_dir/.build-tools"
mkdir -p "$tools_dir"
fetch() { curl --fail --location --retry 2 --connect-timeout 15 --max-time 600 "$1" -o "$2"; }
if [[ ! -x "$tools_dir/gradle-8.11.1/bin/gradle" ]]; then
  fetch https://services.gradle.org/distributions/gradle-8.11.1-bin.zip "$tools_dir/gradle.zip"
  fetch https://services.gradle.org/distributions/gradle-8.11.1-bin.zip.sha256 "$tools_dir/gradle.sha256"
  python3 - "$tools_dir/gradle.zip" "$tools_dir/gradle.sha256" <<'PY'
import hashlib, pathlib, sys
archive, checksum = map(pathlib.Path, sys.argv[1:])
if hashlib.sha256(archive.read_bytes()).hexdigest() != checksum.read_text().strip().split()[0]:
    raise SystemExit('Gradle checksum mismatch')
PY
  unzip -q "$tools_dir/gradle.zip" -d "$tools_dir"
fi
export ANDROID_HOME="${ANDROID_HOME:-$tools_dir/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
if [[ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
  fetch https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip "$tools_dir/android-commandline.zip"
  mkdir -p "$tools_dir/sdk-extract" "$ANDROID_HOME/cmdline-tools"
  unzip -q -o "$tools_dir/android-commandline.zip" -d "$tools_dir/sdk-extract"
  mv "$tools_dir/sdk-extract/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi
# The Android license prompt is interactive on first use.
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" 'platforms;android-35' 'build-tools;35.0.0' 'platform-tools'
# Use environment selection instead of overwriting the user's local.properties.
"$tools_dir/gradle-8.11.1/bin/gradle" -p "$project_dir" :app:assembleDebug :app:lintDebug
printf '\nAPK: %s\n' "$project_dir/app/build/outputs/apk/debug/app-debug.apk"
