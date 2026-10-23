# Playback and sound engineering

## What is implemented

Expo owns the custom Sound screens. The local Android module owns playback and signal processing, so playback does not depend on a JavaScript timer. AndroidX Media3 ExoPlayer **1.11.1** replaces the original one-file-at-a-time MediaPlayer implementation. Its playlist handles transitions, shuffle traversal, repeat, decoding, speed/pitch and audio focus. A platform media session connects lock-screen and notification transport controls.

The signal path is:

`decode → Media3 silence skipping / Sonic speed & pitch → EQ / tone → stereo → gain → optional compressor → look-ahead sample-peak limiter → PCM output`

The custom processor is placed **after** Media3's time/pitch processors. A final limiter before a time-stretcher would not measure the signal actually sent out of that stretcher. Offload is explicitly disabled and encoded passthrough is refused, so common local formats are decoded through PCM rather than silently bypassing the controls.

### Tone and presets

- Ten peaking bands: 31, 63, 125, 250, 500, 1k, 2k, 4k, 8k and 16k Hz; ±12 dB; Q 1.4.
- Separate 80 Hz low shelf and 8 kHz high shelf; ±12 dB; shelf slope S=1.
- Flat, Warm, Bass, Vocal, Acoustic, Bright, Rock, Jazz, Classical and Speech presets, with descriptions supplied by the native catalog. The original six curves are preserved. These are taste presets, not measured headphone calibration.
- Automatic headroom estimates the combined filter response on a logarithmic grid and adds 0.5 dB margin when positive gain is present. This complements the limiter; it is not a proof of a worst-case bound between grid points.
- Manual preamp attenuation: 0 to −24 dB. Filter-bank changes crossfade over 20 ms. Rapid changes coalesce to the latest request after the current fade finishes, rather than replacing a partially audible bank. Headroom is cached per bank and applied before blending, so adding/removing boosted EQ does not expose uncompensated filters. Gain, balance, width and automatic-headroom enable/disable changes are smoothed.
- Up to 20 named local profiles store the complete EQ/tone/gain/stereo/dynamics configuration. Applying a built-in EQ preset changes its EQ/tone settings without unexpectedly resetting the volume boost.
- Built-in EQ and saved profiles use separate application commands. Existing saved profiles that share one of the newly added names remain accessible and can be overwritten; built-in buttons always apply the built-in curve.

### Output and dynamics

- Output now includes eight presets in wrapping rows. Selecting one sends a single partial `sound` command, which the service validates, persists in `soundV2` and applies to the existing processor. Manual edits update the selected preset from the actual settings; unmatched combinations display Custom. Saved sound profiles already include these controls.

| Output preset | Volume | Dynamics | Stereo width | Mono |
|---|---:|---|---:|---|
| Balanced | 100% | Off | 100% | Off |
| Gentle | 100% | Gentle | 100% | Off |
| Night | 100% | Night | 100% | Off |
| Boost 125% | 125% | Off | 100% | Off |
| Boost 150% | 150% | Off | 100% | Off |
| Mono | 100% | Off | 100% (ignored in mono) | On |
| Narrow stereo | 100% | Off | 60% | Off |
| Wide stereo | 100% | Off | 125% | Off |

All presets enable the limiter. They preserve EQ bands/enabled state, bass, treble, preamp, automatic headroom, personal L/R balance and playback speed/pitch. They preserve bypass and cannot be selected while bypass is on. Balanced resets only the preset-managed output controls; it does not bypass tone processing. The percentage values are app-specific starting points, not measured device calibration or a claim of superior sound. They do not normalize track loudness, add surround processing or manufacture stereo from mono.

Research behind the choices:

- [Giannoulis, Massberg & Reiss, JAES 2012](https://joshreiss.github.io/documents/2012/GiannoulisMassbergReiss-dynamicrangecompression-JAES2012.pdf) explains threshold/ratio, soft knees and attack/release. Gentle and Night use the app's existing compressor curves; they reduce loud passages without make-up gain, so quiet passages are not automatically amplified.
- [Android LoudnessEnhancer documentation](https://developer.android.com/reference/android/media/audiofx/LoudnessEnhancer) distinguishes target amplification from the compression needed when amplified samples exceed range. This supports keeping peak protection with boost presets; this app continues using its existing DSP rather than stacking a platform LoudnessEnhancer on it.
- [Ableton's Utility reference](https://www.ableton.com/en/live-manual/12/live-audio-effect-reference/#utility) documents mono and stereo-width controls; [Audacity's mono conversion documentation](https://manual.audacityteam.org/man/faq_editing.html#How_do_I_convert_a_stereo_track_to_mono.2C_or_mono_to_stereo.3F) describes averaging L/R. The app uses its existing mid/side scaling and mono average. Its exact width values are our design choices; widening does not create differences between identical L/R channels.

- 100–300% boost is a **linear amplitude multiplier**; 300% corresponds to approximately +9.54 dB before headroom/compression/limiting. It does not promise three times perceived loudness.
- Stereo-linked limiter: 5 ms look-ahead, immediate protective gain reduction and 80 ms one-pole recovery, with a −1 dBFS sample-peak ceiling. The FIFO withholds frames at the start and drains the same number at EOF; it does not append leading/trailing silence or discard the end of a short file.
- This is a **sample-peak limiter, not an oversampled true-peak meter/limiter**, and no EBU R128 compliance is claimed. Android's mixer, device processing and Bluetooth codec can change the signal after the app.
- Optional Gentle dynamics: −12 dB threshold, 1.5:1 ratio. Night: −18 dB, 2:1. Both use a 6 dB soft knee, 10 ms gain attack and 150 ms release. No hidden make-up gain. Off preserves the source dynamics except any active limiter reduction.
- Stereo balance, 0–150% mid/side width and mono summing. The dynamics detector and limiter link L/R to preserve the stereo image.
- Bypass compares against EQ, tone, gain, stereo and dynamics bypassed. Speed and pitch remain separate playback controls. Transitions settle smoothly rather than deliberately producing clicks.
- Double-precision filter math and floating-point intermediate processing; the compatible Media3 processor path outputs 16-bit PCM. It is **not bit-perfect high-resolution or exclusive USB/DAC output**. Mono/stereo PCM at 8 kHz or above is supported; bands above the usable Nyquist range are omitted. Multichannel PCM remains playable without these effects, and the UI identifies that limitation.
- Signal peak, limiter reduction, compressor reduction, processing sample rate and channel count come from the processing path. They do not measure sound pressure, DAC output or acoustic quality.

### Playback controls

- Speed 0.5–2× with pitch independent; pitch ±12 semitones through Media3 Sonic.
- Optional silence skipping, disabled by default; it can remove intentional music pauses.
- Sleep timer with an optional final 15-second fade, running in the service.
- Headset/Bluetooth disconnect pause, audio-focus handling, background queue, seeking, favourites and playlists.
- Gapless sequencing is delegated to Media3; actual continuity depends on encoder delay/padding metadata, formats and the device. Crossfade is not implemented.

## Papers, specifications and open-source references

| Reference | How it is used |
|---|---|
| [Robert Bristow-Johnson, Audio EQ Cookbook (W3C publication)](https://www.w3.org/TR/audio-eq-cookbook/) | Peaking/shelf biquad coefficient equations, normalized by a0. `DspCore.Biquad` is an original implementation of these equations. |
| [Giannoulis, Massberg & Reiss, Digital Dynamic Range Compressor Design—A Tutorial and Analysis, JAES 60(6), 2012](https://joshreiss.github.io/documents/2012/GiannoulisMassbergReiss-dynamicrangecompression-JAES2012.pdf) | Soft-knee gain computer (Eq. 4) and one-pole attack/release time constants (Eqs. 5–7). Our chosen controls, look-ahead limiter and tests are engineering choices; we do not claim to reproduce a specific analog compressor or the paper's entire system. |
| [AndroidX Media3 source, tag 1.11.1](https://github.com/androidx/media/tree/1.11.1) — Apache 2.0 | Actual dependency: decoding, playlist, gapless support, Sonic, silence skipping and sink/processor APIs. |
| [Media3 audio processor chain](https://github.com/androidx/media/blob/1.11.1/libraries/common/src/main/java/androidx/media3/common/audio/AudioProcessorChain.java) | Duration and skipped-frame mapping remain delegated to Media3 while our DSP follows its processors. |
| [EBU R128](https://tech.ebu.ch/publications/r128) | Establishes the distinction between measured programme loudness, peaks and gain. Broadcast normalization targets are not imposed on a music player's user volume. |
| [libebur128](https://github.com/jiixyj/libebur128) — MIT | Evaluated as a future measured-loudness analyzer; **not integrated**. There is no fake LUFS normalization toggle. |
| [Auxio](https://github.com/OxygenCobalt/Auxio) — GPL 3.0 | Behavioral reference for a local Media3-based player, folder organization and gapless/ReplayGain expectations. No Auxio source was copied. ReplayGain/tag analysis is not yet implemented here. |

## Verification and limits

The [four-iteration audio review](AUDIO_REVIEW.md) records reproduced failures, fixes, preset choices, research sources and the final stress-test matrix.

`npm run check` runs library selectors and **the actual Java DSP core**, compiled with the JDK and tested without Android. Signal tests cover exact bypass samples and EOF drain, short streams, 3× gain below limiting, impulse ceilings at multiple sample rates, stereo linking, a measured +6 dB center-frequency response, EQ headroom, mono cancellation, balance, compressor curve/knee, extreme controls and changes during playback.

Output preset tests generate a fixture from the actual JavaScript preset definitions, then feed those settings through the Java DSP. They verify low-level amplitude gain, preservation of centred audio, side-only width scaling/mono cancellation, Gentle versus Night gain reduction and finite output within the sample-peak ceiling for mono/stereo at 44.1/48 kHz. UI tests also check atomic command patches, bypass disabling, persisted-value recognition and preservation of unrelated controls. Native Android persistence and physical-device listening still require device verification.

The Android build and Lint check the actual Media3 integration and Expo bridge. Neither compilation nor the DSP tests substitute for listening/physical-device tests. Verify UI, gapless playback with real album files, seeking, focus interruptions, wired/Bluetooth output, background playback and route changes using `verification/DEVICE_CHECKLIST.md`. Audio quality enhancement is listener- and device-dependent; no restoration of missing source detail or measured perceptual superiority is claimed.

## Files

- `DspCore.java`: platform-independent filters, gain, stereo, compressor, look-ahead limiter.
- `MusicAudioProcessor.java`: PCM adapter, exact EOF handling and chain ordering.
- `SoundSettings.java`: validation, defaults and built-in presets.
- `TonePresets.java`: canonical tone curves and descriptions, with copied arrays at its public boundary.
- `PlaybackService.java`: playlist/session lifecycle and persistent profiles.
- `src/SoundStudio.js`: custom Tone, Output and Playback screens.

The copper/ivory theme follows the user-approved preview and the role-based guidance in [Impeccable colorize](https://github.com/pbakaus/impeccable/blob/main/skill/reference/colorize.md). The selected text/control token pairs were calculated for contrast; screenshots on actual Android hardware still need review.
