# Automatic playback artwork

Full-player artwork randomly chooses one of five designs when the current track changes. The selection lives in MusicApp, so opening and closing the player, pausing, seeking, changing theme and rotating the phone retain the current choice. There is no style picker or saved animation preference.

- **Disc:** the original rotating vinyl record with grooves, a circular album-art label, spindle and tonearm.
- **Pulse:** three more visible staggered ripples expand and fade around a steady album cover.
- **Wave:** three filled SVG ribbons flow around a steady album cover.
- **Orbit:** five lights with short fading trails travel along a fine ring around a stationary album cover.
- **Equalizer:** eleven taller softly rounded bars animate at independent multi-peak rhythms beneath a stationary album cover.

The original vinyl record is retained alongside the four additional designs. Album art, its offline fallback, artwork swipe gestures and transport controls are retained. Motion is decorative while playback is active; it does not sample the audio signal or require microphone access.

## Research and implementation

The [LottieFiles audio gallery](https://lottiefiles.com/categories/audio) supplied visual references for waveform, pulse and equalizer motifs. The artwork here is drawn from native Views and the existing SVG library, without downloaded assets or an additional animation player.

The [React Native animation guide](https://reactnative.dev/docs/0.85/animations) supports native-driven transforms and opacity, rather than animated layout dimensions. A single native-driven phase controls each style. A modulo phase combines a repeating native clock with a preserved pause offset. This avoids a JavaScript completion handoff at cycle boundaries and maintains constant speed across repeated pause/resume cycles; non-disc covers never scale or bob; the Disc label rotates with the record. All continuously changing properties use that path, with `isInteraction: false` so loops do not block list rendering. Fixed geometry stays within the available artwork area.

The existing [AccessibilityInfo reduced-motion integration](https://reactnative.dev/docs/0.85/accessibilityinfo) also gates the new designs. Pause, background and reduced-motion changes stop loops; effect cleanup cancels old loops and guards late native stop callbacks. Colours come from the current palette.

## Verification

`npm run check` includes artwork lifecycle regressions. They exercise each design, native animation configuration, pause/resume, background/reduced motion and late callbacks. App interaction tests inject deterministic random samples to verify selection on track changes and stability across theme, layout and navigation updates; Settings tests verify that no animation picker exists.

The Android interaction script accepts all five designs, retains the chosen style and checks pause/resume stability. It also uses the new Settings-only subfolder placement and measures folder spacing against Play folder. The released v1.2.6 APK passed all 61 interaction assertions and 63 theme assertions on each of API26/31/35. See [the test validity audit](../verification/TEST_VALIDITY_AUDIT.md). Style IDs and lifecycle tests do not establish frame-by-frame visual correctness; screenshots and recordings remain review evidence.

## Header treatment

Browse and page headers use a separate lavender surface in both themes, with a low-opacity mint wash and accent arcs behind the controls. The decorative overlay ignores touches and accessibility focus. Headers leave 12 dp before search or content; the compact player uses 4 dp to preserve transport space. Search remains part of the collapsible list header.

The updated JavaScript lifecycle, interaction and theme checks cover these changes. Android recordings and physical-device frame pacing for this revision still require APK validation; prior release results above do not validate the new design.

### Moving design preview

Run `node scripts/preview-playback-motion.cjs /tmp/aiplayed-motion-preview.html` and open the resulting HTML. It renders geometry and interpolation samples from the actual `PlayingArtwork` component, with its actual per-style durations, in both themes. The preview includes a pause control. Browser motion review verifies that every style visibly moves; it does not measure the React Native renderer or prove Android frame pacing.

The revised native clock is covered by repeated pause/resume and loop-seam regression checks. APK recordings on Android remain required before treating motion smoothness as verified.
