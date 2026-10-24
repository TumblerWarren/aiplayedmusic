# AI Played Music — Expo Android app

A local music player inspired by Mi Music, built with **Expo SDK 56 and React Native**. Android 8.0+; application ID `app.localmusic.player`.

**Current release:** [Aiplayed v1.2.6 APK](https://github.com/TumblerWarren/aiplayedmusic/releases/download/v1.2.6/Aiplayed-v1.2.6.apk), Android version code **9**. [Release notes and checksum](https://github.com/TumblerWarren/aiplayedmusic/releases/tag/v1.2.6). The previous stable [v1.2.5](https://github.com/TumblerWarren/aiplayedmusic/releases/tag/v1.2.5) is retained.

The v1.3.0 candidate adds offline personal mixes using a bundled, validated S-SONDO FP32 model. See [implementation and validation](docs/offline-personal-mixes.md). The published v1.2.6 APK remains available.

Version 1.2.6 includes System/Light/Dark themes, the music-note launcher icon, compact folder controls, Settings-only folder selection and subfolder preferences, and automatic Pulse/Wave/Orbit playback artwork. Version 1.3.0 refreshes these effects, retains the original rotating disc alongside the new Equalizer artwork, and gives page headers a tinted overlay and more breathing room. There is no animation style setting.

Automated checks cover library behavior, navigation, live control previews, isolated playback updates and actual Java DSP signals. GitHub builds additionally verify native compilation, Android Lint, signing, launcher branding and offline permissions. This is a development-signed sideload APK. Physical-device playback/UI testing remains pending. See the [responsiveness design and measurement plan](docs/RESPONSIVENESS.md) and [sound engineering references](docs/AUDIO_ENGINE.md).

Release builds run in GitHub Actions. Local behavior and DSP checks can run without generating an Android project.

## Architecture and features

- `App.js`: Expo / React Native library, search, albums/artists/folders, favourites, playlists, queue, now-playing screen, themes and common settings.
- `modules/local-music/`: an autolinked local Expo module, using Kotlin to bridge the Android playback service and MediaStore library scanner.
- Version 1.2 uses Media3 playlists and native PCM processing, with 10-band EQ, automatic EQ headroom, preamp, bass/treble, 100–300% gain, a stereo-linked sample-peak limiter, optional dynamics, balance/width/mono, saved sound profiles, independent speed/pitch, silence skipping and sleep fade. These controls have custom Expo screens. See [implementation details and limits](docs/AUDIO_ENGINE.md).
- Library filters and selected music roots have custom Expo controls. The in-app folder browser chooses roots and keeps descendant folders under their parents. It scans audio indexed by MediaStore, not arbitrary unindexed or cloud-provider files. Local text/LRC lyrics use the current rounded sheet. The retired native application UI has been removed; see the [UI migration audit](docs/UI_MIGRATION.md).
- No advertising, streaming, accounts, analytics SDK or microphone access. Offline release builds remove internet/network-state permissions; development builds retain network access for Metro.

This needs a **development build or standalone APK**, not Expo Go, because the custom playback module must be compiled into the app. It is Android-only; no iOS or web player is included.

## Build an APK with GitHub Actions

The `Build Expo Android APK` workflow builds manually from Actions or after a push/merge to `main` whose commit message contains `[build apk]`. Other pushes skip packaging. It installs the compatible Expo dependencies, runs the selector tests and Expo compatibility checks, generates Android with Expo prebuild, and runs Gradle compilation and Android Lint.

After a successful run, download the `aiplayedmusic-apk` artifact. The GitHub APK includes 32-bit ARM, 64-bit ARM and x86_64 for the configured emulators. The standalone release-mode APK bundles JavaScript and runs without Metro. Expo's generated Android template uses the development signing configuration unless private release signing is added; this artifact is for sideloading and testing, not a production store release. Only candidates that pass every gate are promoted for installation; inspect diagnostics for a failed run. `unverified-candidate-apk` is diagnostic evidence, not a validated release.

New releases derive their tag, APK name and evidence directory from `package.json`. Update its version, `app.config.js` version/versionCode and `verification/RELEASE_NOTES_<version>.md` together before requesting a new release. Rebuilding an already released version preserves the published tag and assets. Keep workflow changes off main while a release for its current source is finishing; see the [release validation record](verification/TEST_VALIDITY_AUDIT.md).

## Development

Use Node.js 22.13+, Python 3, a full JDK 17 and Android Studio / Android SDK 36.
Every native build fetches the pinned FP32 model on the build host, checks its
checksum and bundles it. Subsequent builds verify the cached bundle. The phone
never downloads it:

```sh
npm install
npx expo install --check
npx expo run:android
```

Subsequent JavaScript development uses:

```sh
npm start
```

`android/` is generated and ignored. Native source changes belong in `modules/local-music`, and manifest changes in `app.config.js` / `plugins/withMusic.js`. Regenerate Android after native or config changes:

```sh
npx expo prebuild --platform android --no-install --clean
```

To build a standalone APK locally with a project-local SDK, run `./scripts/bootstrap.sh`. It downloads the SDK tools, requests SDK licence acceptance, installs SDK 36, installs npm dependencies, runs checks, prebuilds Android and builds the release APK. Network access is required for the SDK, npm and Gradle/Maven/NDK dependencies, even if the SDK itself is supplied as an archive.

## Optional Expo EAS builds

`eas.json` includes development, preview APK and production app-bundle profiles. With an Expo account and project configured:

```sh
npx eas-cli build --platform android --profile preview
```

No Expo account or EAS project has been linked, and no EAS build has been started. EAS is optional; GitHub Actions and local prebuild can build without an Expo account.

## Verification

Run `npm run check` with Node and a JDK. It runs library, navigation, preview scheduling, scroll restoration and playback-state tests, plus actual Java signal-processing tests. It does not build an APK.

Run the test-driver regressions separately:

```sh
python scripts/media-session.test.py
python scripts/android-ui-geometry.test.py
python scripts/android-theme-driver.test.py
```

The released v1.2.6 APK passed native compilation, Android Lint, signing/branding/offline checks, 61 interaction assertions and 63 theme assertions on each of API26/31/35. Its formerly failing Sound path also passed three fresh-data repetitions. See [current verification status](verification/STATUS.txt) and [the test validity audit](verification/TEST_VALIDITY_AUDIT.md).

To check an existing APK on a configured emulator, build the independent inspector with `python scripts/build-ui-helper.py`, then run `python scripts/android-ui-checks.py --apk /path/to/app.apk`. For the isolated Sound path, append `--scenario sound --repeat 3`; for the personal-mix path use `--scenario recommendations`. Both focused modes clear app data and are emulator-only. The scripts require Android SDK tools, Java, FFmpeg/FFprobe and Python; theme checks also require Pillow. The API35 interaction fixture is calibrated to a 1080×1920, density-420 emulator. Theme checks use `python scripts/android-theme-checks.py --apk /path/to/app.apk` on API26/31/35. Neither script compiles the application.

Physical-device playback, Bluetooth/headset controls, listening quality and performance measurements remain pending in [the device checklist](verification/DEVICE_CHECKLIST.md). [Verification records](verification/README.md) distinguish current evidence from historical reviews.
