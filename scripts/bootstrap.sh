#!/usr/bin/env bash
# Install a project-local Android SDK, generate Expo Android, and build a standalone APK.
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
tools_dir="$project_dir/.build-tools"
mkdir -p "$tools_dir"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$tools_dir/gradle-cache}"
export npm_config_cache="${npm_config_cache:-$tools_dir/npm-cache}"
export ANDROID_USER_HOME="${ANDROID_USER_HOME:-$tools_dir/android-user}"
export ANDROID_HOME="${ANDROID_HOME:-$tools_dir/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
if [[ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
  curl --fail --location --retry 2 --connect-timeout 15 --max-time 600 https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o "$tools_dir/android-commandline.zip"
  mkdir -p "$tools_dir/sdk-extract" "$ANDROID_HOME/cmdline-tools"
  unzip -q -o "$tools_dir/android-commandline.zip" -d "$tools_dir/sdk-extract"
  mv "$tools_dir/sdk-extract/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
# First-time SDK licence acceptance is interactive.
sdkmanager --licenses
sdkmanager 'platforms;android-36' 'build-tools;36.0.0' 'platform-tools'
npm install --no-audit --no-fund
npm run check
npx expo install --check
export MUSIC_OFFLINE_BUILD=1
npx expo prebuild --platform android --no-install --clean
(cd android && ./gradlew :app:assembleRelease :app:lintRelease)
printf '\nAPK directory: %s\n' "$project_dir/android/app/build/outputs/apk/release"
