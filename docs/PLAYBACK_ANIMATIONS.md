# Automatic playback artwork

Full-player artwork randomly chooses one of three original designs when the current track changes. The selection lives in MusicApp, so opening and closing the player, pausing, seeking, changing theme and rotating the phone retain the current choice. There is no style picker or saved animation preference.

- **Pulse:** three translucent rings breathe around a softly scaling album cover.
- **Wave:** overlapping ribbons stretch in opposite directions while the album cover floats gently.
- **Orbit:** six small particles travel around a stationary album cover.

These replace the vinyl record, tonearm and spindle. Album art, its offline fallback, artwork swipe gestures and transport controls are retained. Motion is decorative while playback is active; it does not sample the audio signal or require microphone access.

## Research and implementation

The [LottieFiles audio gallery](https://lottiefiles.com/categories/audio) supplied visual references for waveform, pulse and equalizer motifs. The artwork here is drawn from native Views, without importing animations or adding an asset/player dependency.

The [React Native animation guide](https://reactnative.dev/docs/0.85/animations) supports native-driven transforms and opacity, rather than animated layout dimensions. All continuously changing properties use that path, with `isInteraction: false` so loops do not block list rendering. Fixed geometry stays within the available artwork area.

The existing [AccessibilityInfo reduced-motion integration](https://reactnative.dev/docs/0.85/accessibilityinfo) also gates the new designs. Pause, background and reduced-motion changes stop loops; effect cleanup cancels old loops and guards late rotation callbacks. Colours come from the current palette.

## Verification

`npm run check` includes artwork lifecycle regressions. They exercise each design, native animation configuration, pause/resume, background/reduced motion and late callbacks. App interaction tests inject deterministic random samples to verify selection on track changes and stability across theme, layout and navigation updates; Settings tests verify that no animation picker exists.

The Android interaction script now retains the chosen style and checks pause/resume stability. It also uses the new Settings-only subfolder placement and measures folder spacing against Play folder. The released v1.2.6 APK passed all 61 interaction assertions and 63 theme assertions on each of API26/31/35. See [the test validity audit](../verification/TEST_VALIDITY_AUDIT.md). Style IDs and lifecycle tests do not establish frame-by-frame visual correctness; screenshots and recordings remain review evidence.
