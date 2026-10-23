# Four-iteration audio-engine and preset review

Date: 2026-10-20. Base commit: `ec4e64bd34567a26395b6a5455058b16810f6b3b`.

## Iteration 1 — Research and reproduce

The existing Java DSP, PCM adapter, service settings and Expo controls were inspected. The original full check passed, including the eight Output presets and 721,070 DSP assertions. The PCM path still delegates decoding, time/pitch processing and silence skipping to Media3, then runs the app's EQ, stereo, gain, dynamics and final limiter.

Two additional signal regressions failed against that baseline:

| Reproduction at 48 kHz | Baseline measurement | Cause |
|---|---:|---|
| Constant 0.05 input; +12 dB bass shelf → −12 dB shelf → +6 dB shelf, with the second update 10 frames into a fade; limiter/headroom off | Largest adjacent output-sample change: 0.15276264 full scale | Replacing `oldBank` abandoned a still-audible crossfade. |
| Constant 0.8 input; +12 dB bass shelf → flat, automatic headroom on and limiter off | Peak: 1.09035647, above full scale | A shared gain released compensation while the old boosted filter was still audible. |

Research was checked against these primary sources:

- [W3C Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/): peaking and shelf equations, coefficient normalization and shelf slope. The existing Q=1.4 peaking and S=1 shelf equations agree with those definitions.
- [Giannoulis, Massberg & Reiss, JAES 2012](https://joshreiss.github.io/documents/2012/GiannoulisMassbergReiss-dynamicrangecompression-JAES2012.pdf): compressor curves, soft knee, attack/release and smoothing. The current Gentle/Night curves and time constants were retained and tested, rather than relabeling them as new effects.
- [Android Media3 AudioProcessor contract](https://developer.android.com/reference/androidx/media3/common/audio/AudioProcessor): buffer/lifecycle ownership and the need to consume pending output correctly. The PCM adapter was reviewed; it was not changed or compiled against Android in this review.
- [EBU R128](https://tech.ebu.ch/publications/r128): the distinction between measured loudness/true peak and sample-level limiting. This update does not add LUFS normalization or claim true-peak compliance.

## Iteration 2 — Fix transitions and remeasure

An active 20 ms filter fade now completes before another filter change begins. Only the latest requested filter settings are retained, so rapid input does not create a growing queue. The final request can wait for the current fade and then takes one further fade to complete. Volume/balance/width/dynamics state still updates independently.

Each filter bank now caches its response estimate and headroom multiplier. Old and new bank outputs receive their own compensation before the crossfade. Automatic-headroom enable/disable changes have a smoothed blend. This also removes repeated response-grid scans when only gain, stereo or dynamics controls change.

| Same regression as iteration 1 | Updated measurement |
|---|---:|
| Rapid shelf updates | Maximum adjacent-sample change: 0.00020945 |
| Boosted shelf → flat, limiter off | Peak: 0.80000001 (float rounding of 0.8) |

The new regressions and existing bypass, limiter, headroom, EQ, dynamics and output-preset tests passed. Adding boosted EQ and requesting bypass during a fade were also checked later in iteration 4.

## Iteration 3 — Improve the tone catalog and preset application

The original Flat, Warm, Bass, Vocal, Acoustic and Bright values stay unchanged. Four additional, moderate contours are defined in `TonePresets.java`, in the normal 31/63/125/250/500/1k/2k/4k/8k/16k band order:

| Preset | Gains, dB | Intended starting point |
|---|---|---|
| Rock | 2, 3, 2, 0, −1, −1, 1, 2, 2, 1 | Bass/presence with a gentle mid dip. |
| Jazz | 1, 1, 0, −1, 0, 1, 1, 1, 0, 0 | Light bass/presence lift. |
| Classical | 1, 1, 0, 0, 0, 0, 0, 1, 1, 1 | Subtle low/high lift. Flat remains available. |
| Speech | −6, −4, −2, −1, 0, 1, 3, 2, 0, −1 | Reduce low-frequency weight and emphasize presence. |

[Shure's EQ primer](https://www.shure.com/nl-NL/insights/eq-i-q-a-quick-primer) discusses the clarity region around 2–5 kHz; its [MXA920 guide](https://www.shure.com/en-US/docs/guide/MXA920) discusses reducing rumble and adjusting speech presence. These inform the Speech contour's direction. All exact gains and genre labels are this app's design choices, not Shure settings or universal genre correction.

The native catalog returns copies of its arrays and supplies descriptions to the UI. Tests verify distinct curves, moderate/finite gains, measured response direction and preservation of the original six curves. The UI recognizes complete preset snapshots, handles missing curve metadata, and reports selected/disabled accessibility state.

Built-in EQ selection has its own command, so a saved profile called “Rock” cannot replace the built-in button's behavior. Existing saved profiles remain separate and editable. EQ selection patches bands, EQ enabled, bass and treble; Output selection continues to preserve EQ and personal balance. No new platform audio effects or dependencies were added.

## Iteration 4 — Combined regression and stress validation

`npm run check` passed with:

- UI syntax/local imports for 15 files; seven library tests and five navigation tests.
- Output configuration, command patches, bypass disabling, persistence-value round-trip recognition and preservation of unrelated settings.
- All ten native tone presets exercised through UI selection, descriptions and bypass state, including a saved-profile name collision scenario.
- 721,070 existing DSP/output signal assertions plus 1,461,153 transition/catalog/stress assertions: **2,182,223 Java assertions** in total.
- **800 combinations**: 10 tone presets × 8 Output presets × five sample rates (8/22.05/44.1/48/96 kHz) × mono/stereo. Deterministic random hot input and EOF drain stayed finite and within the limiter's sample-peak ceiling.
- Rapid 2 ms settings changes including EQ, volume, stereo, mono, dynamics and bypass; the final request converged to a fresh reference after release/settling time.
- Flat → boosted EQ, queued bypass, invalid input samples, and exact short-stream/last-sample drain at 8/48/192 kHz.
- Java 17 parse-only syntax verification for nine native Java files, plus whitespace checks.

The final-state test allows the existing 150 ms compressor release to settle; an initial half-second window still measured expected release memory, so the test now compares after two seconds. This is a test correction, not an unverified compressor redesign.

## Remaining verification limits

No APK was built. The actual platform-independent Java DSP and tone catalog were compiled and exercised on the JVM. Java parse checks do not type-check Android/Media3 integration or the Kotlin bridge. Device playback, audible transitions, physical headphones/speakers, background behavior, UI appearance and on-device preset persistence still need device verification. Synthetic sample tests establish the tested numerical behavior, not perceived sound quality on every recording.

The existing 16-bit PCM output, sample-peak limiter, stereo/mono scope and lack of measured headphone calibration, ReplayGain/LUFS normalization and oversampled true-peak limiting remain explicit limits. The research does not justify labeling this implementation as bit-perfect, lossless enhancement, surround synthesis or hearing protection.
