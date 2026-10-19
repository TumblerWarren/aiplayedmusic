# Music for Android

Independent local music player inspired by Mi Music. Android 8.0 (API 26) and later; targets Android 15 (API 35). Package: `app.localmusic.player`. Uses native Android Java APIs without third-party runtime libraries.

**Current status: source draft only. No APK has been compiled or tested.** The managed environment has Java but no Android SDK or Gradle. Terminal HTTP requests fail to connect to its configured proxy. Network-permission attempts did not complete. Do not treat syntax checks as a successful Android build.

## Implemented in source

- On-device audio discovery, search, sorting, albums, artists and folders.
- Persistent favourites, listening history, and create/rename/delete playlists.
- Background playback with media notification, lock-screen media session, audio focus, and pause on headphone/Bluetooth disconnection.
- Now-playing screen, seeking, shuffle, repeat, queue editing and reordering.
- Device-provided equalizer bands and presets, playback speed and sleep timer.
- System/light/dark themes; minimum duration/size filters; excluded folders.
- Local UTF-8 text/LRC lyrics import with timed highlighting.
- Song information and sharing through Android's share sheet.

There are no ads, video features, accounts, analytics SDKs, or internet permission. Playback formats depend on the phone's codecs; DRM-protected or unsupported files cannot be played. Audio must be available through Android's shared media library, including a mounted SD card when indexed there. App-private files and cloud-only files are outside this scanner.

The UI is an original interpretation, not an exact copy of every Mi Music screen or setting. The supplied Play Store listing was inspected; the original app binary and settings screens were not available. REA was not installed or used because package downloads were unavailable. Exact visual/settings parity remains unverified and needs screenshots or an APK of the intended original version.

## Build in Android Studio

1. Open this folder in a current Android Studio compatible with Android Gradle Plugin 8.9.2.
2. Use a full JDK 17 or newer and install Android SDK Platform 35 and Build Tools 35.0.0.
3. Allow Gradle 8.11.1 and Android Gradle Plugin dependencies to download.
4. Run `:app:assembleDebug` and `:app:lintDebug`, or choose **Build APK(s)**.
5. The installable debug-signed APK is generated at `app/build/outputs/apk/debug/app-debug.apk`.

A wrapper JAR is not bundled. `gradlew` uses a project-local Gradle installation created by the script below, a wrapper JAR if added, or Gradle from PATH. Android Studio can select the specified Gradle distribution directly.

## Build from Linux/macOS

With a full JDK 17+, Python 3, curl and unzip installed, run:

```sh
./scripts/bootstrap.sh
```

The script downloads Gradle and the Android command-line tools into `.build-tools`, asks you to accept the Android SDK licences, installs the SDK packages, compiles a debug APK and runs Android Lint. **This script has not been exercised here because downloads are blocked.**

With the tools already installed:

```sh
export ANDROID_HOME=/path/to/android-sdk
./gradlew :app:assembleDebug :app:lintDebug
```

A manual GitHub Actions workflow is included as another build route. In this repository, run **Build Android APK** under Actions, then download the `music-debug-apk` artifact. No remote build has been started yet.

## Validation so far

- Five Java source files parse with Java 17 source syntax.
- Four Android XML files parse successfully.
- Manifest inspection confirms no internet permission.
- No Android type checking, Android Lint, APK packaging/signing, emulator execution, device playback or UI verification has run.

See `verification/DEVICE_CHECKLIST.md` for checks required before calling this ready. A debug build receives an automatically generated development signing key. A distributable release requires a private signing configuration, which is intentionally absent from this source.
