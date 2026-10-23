# Version 1.2 — review before build

Historical record for the revision described below. Current APK and validation results are in [STATUS.txt](STATUS.txt).

This records the pre-build review. The user subsequently authorized the build; current Android build evidence will be recorded in history/STATUS_1.2.0.txt after verification.

## Review decisions

- Preserve the approved four-screen layout and warm charcoal / ivory / muted copper theme.
- Use Media3 1.11.1 for playback rather than retaining a new MediaPlayer for each song.
- Keep the UI in Expo and processing in the local native module.
- Provide ten EQ bands, tone shelves, EQ headroom and a manual preamp.
- Provide 100–300% gain and an explicitly sample-peak, stereo-linked limiter.
- Keep optional dynamics distinct from EQ and loudness normalization.
- Provide saved presets, bypass comparison, balance, width and mono.
- Provide independent speed/pitch, optional silence skipping and sleep fade.
- Keep nested folders inside their parents and remember selected scan roots.

## Evidence available now

- Seven library-selector tests pass.
- Actual Java DSP tests pass for sample preservation, EOF handling, gain, limiter, frequency response, headroom, mono/balance, dynamics and extreme controls/rates.
- Eight native Java files pass parse-only Java syntax checks.
- App and new component JavaScript passes syntax checks.
- Equations, papers, repositories and limitations are documented in `docs/AUDIO_ENGINE.md`.

## Post-build status

Automated compilation, packaging, Lint, signing and offline checks passed for build 39222538168. See `history/STATUS_1.2.0.txt` for the exact source and artifact. Physical-device checks remain pending.

## Original verification plan

Android/Media3/Kotlin type checking; Expo compatibility/prebuild; release APK build; Android Lint; signature/offline permission verification; and UI/listening/background/headset/gapless testing on Android hardware. Local passing tests do not establish that the new Android integration compiles or sounds better on a particular device.

## Explicitly outside current claims

No R128/LUFS normalization, ReplayGain parsing, crossfade, headphone-specific calibration, bit-perfect high-resolution DAC output or acoustic quality measurement has been implemented. The original Mi Music binary has not been supplied/analyzed through REA, so exact feature parity is not claimed.
