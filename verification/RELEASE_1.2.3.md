# Aiplayed 1.2.3 / Android version code 6

Historical record for the revision described below. Current APK and validation results are in [STATUS.txt](STATUS.txt).

The preparatory merge is `71b3f30d365ad6032c668adf2d2db9813f7e1e98`, with parents `6ccd1296532034b62ae5ae19d5ac04c7167fb64b` and `b9e74d61e38082747d0a18621b7e998b2e1cc0ab`. GitHub comparisons verified that all eight pre-existing feature branch tips are ancestors of main after this merge. The existing behavior and DSP suite passed before release implementation. Audio engine source is unchanged by this release.

Library uses a persistent current-view title and + Browse trigger. Seven destinations have selected state, independent session queries and scroll offsets. The sheet supports a visible Close control, backdrop, Android Back and downward handle gestures. Focus returns after dismissal. Contextual playlist/folder controls stay on their relevant screens; Sound preset choices stay on Sound.

Browse lists sort normalized displayed names A–Z or Z–A, with rail targets built from those same names. Queue order, recent-history order and manually arranged playlist contents are preserved. Reanimated 4.3.1, Worklets 0.8.3 and gesture-handler 2.31.1 match Expo SDK 56's bundled version catalog. Header clipping, fading and rail geometry share one UI-thread scroll value. Rail gestures measure the rendered animated bounds, account for padding and use virtualized list offsets, including the header and optional prelude.

The lavender vinyl/play artwork was generated for this release. PNG is the standard Expo icon and native splash source; mask-safe Android vectors provide adaptive foreground, legacy launcher and Android 13 monochrome resources. React initialization uses a subtle native-driver logo pulse; Reduce Motion disables it. Native splash waits for the first branded React layout, with no startup timer. Failed initialization offers Try again.

Local verification: `npm run check` covers JavaScript syntax/imports, library selectors, Browse sessions, shared rail geometry, gesture cancellation, dismissal, playback state and native Java DSP. Native compilation, Android Lint, signing, packaged icon/splash/offline permissions and Android emulator checks run in `.github/workflows/android.yml`.

Emulator script: `scripts/android-ui-checks.py`. It seeds MediaStore fixtures with A–Z song/album/artist names and nested folders, exercises Browse, rails, dismissals, playlist saves, uninterrupted playback and artwork gestures, and captures press feedback, cold startup, rotation and large text. GitHub retains screenshots, accessibility trees, recordings and logs as `android-interaction-evidence-v1.2.3`. CI results must be checked before treating this release as verified.

The Expo-generated API 33 splash behavior is moved into a complete `values-v33` theme, preserving Android 8 support and keeping Android Lint enabled. Independent validation stages collect diagnostics and emulator evidence even if another check fails; an explicit final gate requires every validation outcome to pass before the installable artifact or release is published. Unverified candidate APKs are labelled separately for diagnosis.
