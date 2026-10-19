# AI Played Music — Expo Android app

A local music player inspired by Mi Music, built with **Expo SDK 56 and React Native**. Android 8.0+; application ID `app.localmusic.player`.

**Version 1.2: build authorized, verification in progress.** The review hold has been lifted by the user. Local library tests, actual Java DSP signal tests, Java syntax checks and JavaScript syntax checks pass; Android/Media3 type checking, Lint, UI and physical-device validation are pending. Review the [sound engineering design and sources](docs/AUDIO_ENGINE.md).

**Previous build: version 1.1.** The earlier Expo APK compiled successfully on [GitHub Actions](https://github.com/TumblerWarren/aiplayedmusic/actions/runs/39201321430). [Download that older APK ZIP](https://github.com/TumblerWarren/aiplayedmusic/actions/runs/39201321430/artifacts/12163963175). It does **not** include the new theme or sound engine. It is a development-signed sideload build; physical-device playback and exact Mi Music parity remain unverified.

Local SDK/dependency installation is still blocked because the managed command sandbox rejects network sockets with `EPERM`. SDK installation into the workspace is supported once scoped network access is available. The successful APK was built on GitHub, not in the managed workspace.

## Architecture and features

- `App.js`: Expo / React Native library, search, albums/artists/folders, favourites, playlists, queue, now-playing screen, themes and common settings.
- `modules/local-music/`: an autolinked local Expo module, using Kotlin to bridge the Android playback service and MediaStore library scanner.
- The 1.2 draft uses Media3 playlists and native PCM processing, with 10-band EQ, automatic EQ headroom, preamp, bass/treble, 100–300% gain, a stereo-linked sample-peak limiter, optional dynamics, balance/width/mono, saved sound profiles, independent speed/pitch, silence skipping and sleep fade. These controls have custom Expo screens. See [implementation details and limits](docs/AUDIO_ENGINE.md).
- Library filters and selected music roots have custom Expo controls. The Android system directory picker chooses roots; the browser keeps descendant folders under their parents. It scans audio indexed by MediaStore, not arbitrary unindexed or cloud-provider files. Local text/LRC lyrics still use the retained native screen.
- No advertising, streaming, accounts, analytics SDK or microphone access. Offline release builds remove internet/network-state permissions; development builds retain network access for Metro.

This needs a **development build or standalone APK**, not Expo Go, because the custom playback module must be compiled into the app. It is Android-only; no iOS or web player is included.

## Build an APK with GitHub Actions

The `Build Expo Android APK` workflow runs on pushes to `main`, or manually from Actions. It installs the compatible Expo dependencies, runs the selector tests and Expo compatibility checks, generates Android with Expo prebuild, and runs Gradle compilation and Android Lint.

After a successful run, download the `aiplayedmusic-apk` artifact. The GitHub phone APK includes 32-bit and 64-bit ARM; local development builds can also target x86 Android emulators. The standalone release-mode APK bundles JavaScript and runs without Metro. Expo's generated Android template uses the development signing configuration unless private release signing is added; this artifact is for sideloading and testing, not a production store release. A failed build is not an installable artifact; inspect the uploaded diagnostics.

## Development

Use Node.js 22.13+ and a full JDK 17, plus Android Studio / Android SDK 36:

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

Run `npm run check` with Node and a JDK. It runs the library selectors (including hierarchical folders) and actual Java signal-processing tests. It does not build an APK.

JavaScript, native Java, JSON and Android XML were also checked offline. The successful GitHub build additionally verified native module autolinking, Kotlin/Java compilation, Android Lint, APK signing and removal of internet permission. Physical-device playback, background behaviour, headset controls and UI still require the checks in `verification/DEVICE_CHECKLIST.md`.

The supplied Play Store listing was inspected. REA was not installed, and no original binary/settings screenshots were available, so this is an independent implementation rather than a verified exact replica.
