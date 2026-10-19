# AI Played Music — Expo Android app

A local music player inspired by Mi Music, built with **Expo SDK 56 and React Native**. Android 8.0+; application ID `app.localmusic.player`.

**Status:** migration source is written; offline selector tests and syntax/XML checks pass. Dependencies have not been installed in the managed environment because its command sandbox rejects outbound socket connections with `EPERM` (Operation not permitted), including connections to the configured HTTP proxy. SDK installation into this workspace is supported once scoped network access is available. No Expo APK or device playback has been verified yet. The original Mi Music settings and visual parity are also unverified.

## Architecture and features

- `App.js`: Expo / React Native library, search, albums/artists/folders, favourites, playlists, queue, now-playing screen, themes and common settings.
- `modules/local-music/`: an autolinked local Expo module, using Kotlin to bridge the Android playback service and MediaStore library scanner.
- The native engine retains background playback, media-session/notification and headset controls, audio focus, equalizer, sleep timer and playback speed. These features do not depend on JavaScript timers to keep playing.
- Advanced filters, excluded folders, equalizer controls, file sharing and local text/LRC lyrics remain available through retained native screens. The main player and library use React Native; this is not a complete rewrite of the audio engine in JavaScript.
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

Run dependency-free library logic tests with `npm run check`. The tests cover playlist order with unavailable files, favourites, collection filtering, immutable sorting, listening history, album counts and durations.

Java files were parsed with Java 17 syntax; JavaScript, JSON and Android XML were checked offline. These checks do **not** validate Expo autolinking, Kotlin types, Android compilation, playback or device UI. See `verification/DEVICE_CHECKLIST.md` before calling the app ready.

The supplied Play Store listing was inspected. REA was not installed, and no original binary/settings screenshots were available, so this is an independent implementation rather than a verified exact replica.
