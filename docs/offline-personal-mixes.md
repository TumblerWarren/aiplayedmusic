# Offline personal mixes — v1.3.0 implementation

Status: model gate passed; v1.3.0 integration is under validation on
`feat/offline-personal-mixes`. The source targets version code 10.
The published v1.2.6 APK must be preserved.

## Immutable model inputs

| Input | Pin |
| --- | --- |
| Upstream source | `MedAliAdlouni/ssondo@231d260cc1be2eb93b060accc8bfa218feff3a74` |
| Checkpoint repository | `mohammedali2501/ssondo` |
| Checkpoint revision | `afc946ee816eb2287b62c7cadadd59e507996b23` |
| Checkpoint file | `matpac_mobilenetv3.ckpt` |
| Checkpoint SHA-256 | `87cff558a9a442e97d630a79f391bce8663d31a3adcbbf0b0a8cc41cb41854fc` |
| Checkpoint size | 109,818,404 bytes (training checkpoint, not the shipped model) |
| Backbone | 2,971,664 parameters; 960-dimensional embeddings |
| Licence | MIT, copyright 2025 Mohammed Ali El Adlouni |
| Exporter | `litert-torch==0.10.0`, `litert-converter==0.5.0` |
| Runtime | Standalone LiteRT CPU Interpreter `2.3.0` |

`scripts/recommendations/export_model.py` checks the checkpoint SHA-256 before
loading it, exports only `reference.backbone`, and generates a manifest with
exact preprocessing parameters, artifact checksums and measured model size.
The converter must produce FP32 inputs, outputs and floating point weights;
FP16 tensors and quantisation scales are rejected. The exported file must be
at most 20,000,000 bytes. A training checkpoint over that limit is expected and
is not itself a model-size gate failure.

The upstream loader expects mono 32 kHz audio and ten-second slices. Its default
`SliceAudio(add_last=False)` does **not** pad short audio. The Android adapter
therefore needs an explicit right-zero-padding step before calling the exact
reference log-mel transform. This is an adapter policy, not an existing upstream
padding guarantee. Record it in the preprocessing version and test it explicitly.
No playback EQ, gain, pitch or speed enters this pipeline.

## Validation before application integration

The `Validate recommendation model` workflow first exports and checks Python /
LiteRT agreement, then runs an independent Android application using the same
model and golden inputs. Its Java log-mel implementation uses the FP32 Hann
window and Slaney filter tables produced by the pinned reference transform.
Require embedding cosine similarity >= 0.999 for both runtime-only and native
preprocessing plus runtime paths. Retrieval comparisons exclude candidate pairs
separated by less than 0.01 cosine similarity. This tolerance excludes near ties;
it is not a recommendation-quality metric.

The music fixtures in `scripts/recommendations/fixtures.json` come from
[librosa's example audio collection](https://librosa.org/doc/latest/recordings.html).
Audio and per-recording TOML attribution/licence files have pinned SHA-256 hashes.
The gate retains those licence files with its evidence. These recordings are
validation inputs only and must not be bundled in the production APK. The set
covers orchestral music, jazz, drum and bass, vocals and short instrumental clips;
it does not establish regional/devotional recommendation relevance.

Keep Python export results, Android parity results, full dependency freeze,
upstream licence, model manifest and golden input provenance together. A passing
numerical gate does not establish real-phone indexing cost or listening relevance.
Report emulator, hosted CPU and physical-phone results separately.

The approved model is published at
https://github.com/TumblerWarren/aiplayedmusic/releases/tag/model-assets-ssondo-fp32-v1
as a prerelease with latest disabled. The bundle SHA-256 is
`d182eab57b78249da4529448d7aac29717c22b6c4930a8906ed064abab84753b`.
Its exported FP32 model is **11,979,512 bytes**. Python/export minimum cosine was
0.99999988; Android native preprocessing/runtime minimum cosine exceeded
0.999999997 across 29 inputs. An independent Android 35 native run passed 44 checks covering SQLite,
content-URI inference, real playback-service sessions, automatic analysis while unplugged and playing music,
cancellation, battery-temperature recovery and
concurrent history/analysis reset. Cache deletion and snapshot removal share
the mix-generation lock, so an older in-flight calculation cannot restore
profiles after a reset completes. The Java behavior
suite passed 107 checks, and the real Expo Kotlin/Java bridge compiled with
LiteRT 2.3.0 isolated in a Java library to avoid incompatible Kotlin metadata. Physical-phone measurements remain pending.

Only after all model gates pass may a new model be uploaded to a versioned
`model-assets` GitHub release with `make_latest=false`. Application builds must
fetch the immutable artifact, check its SHA-256, then bundle it. There is no
runtime model download and no production INTERNET permission.

## Product contract after the gate

- Browse → For You; preserve all four bottom navigation destinations.
- Enabled by default, with a local-only explanation and Settings controls to disable analysis or delete its data.
- Automatic analysis is enabled by default and starts after library scans and app opens, including while unplugged or playing music. A unique immediate WorkManager request handles pending work, with a periodic reconciliation request as fallback. One analysis lock prevents concurrent decoding/inference. Automatic work retains the battery-not-low constraint; both modes pause for heat or explicit user pause. Manual analysis stays foreground-only.
- Up to three distinct ten-second sections per eligible file, private SQLite FP32
  segment and pooled embeddings, and versioned file-identity invalidation.
- Partial mixes after ten analysed tracks, or the whole eligible library if smaller.
- Up to three separate weighted taste profiles, artist subtitles, maximum thirty-song
  fixed snapshots, daily caching, explicit refresh, ordinary saved playlists.
- Actual played-duration sessions; deliberate early next is weak negative evidence.
  Seeking, buffering, focus loss, headphone disconnection and failures are not dislike.
- History retention: 180 days or 20,000 sessions, whichever is reached first.
- Clear listening history also clears recommendation sessions/profiles, retaining
  favourites, playlists and embeddings. Delete analysis data is separately available.
- Async native APIs and a separate throttled progress event; never bridge embeddings.
- Prepare Android version 1.3.0 / code 10 only after the integration gate passes;
  freeze final candidate source throughout full validation and publication.

## Retrieval and indexing evaluation

The twelve-recording evaluation includes Bengali, Hindi and Assamese devotional
music and a 21-minute kirtana/medley. Pinned source URLs, licences, file hashes,
nearest neighbors and measured host CPU timings are recorded in
`verification/recommendations/retrieval-and-cost.json`. Ten-second segments took
roughly 20–53 ms for decoding, preprocessing and inference on the hosted CPU.
These timings do not describe phone performance.

Two devotional pairs retrieved each other, and seeded favorites formed distinct
taste profiles. Some cross-genre matches remained, including instrumental music
matched to a long recording containing speech. This smoke evaluation establishes
working retrieval and bounded sampling, not human-rated recommendation quality.
Physical-phone relevance, heat, battery and indexing measurements remain pending.

## Runtime and privacy boundaries

The production LiteRT dependency is contained in
`modules/local-music/android/recommendation-runtime`, a Java library exposing only
FP32 arrays to the Expo module. Android preprocessing and inference use this same
module in the independent validation harness. No runtime Kotlin version checks
are suppressed, and the shipped inference runtime remains pinned to 2.3.0.

Embeddings remain in private native SQLite. React receives status and fixed mix
metadata only. Paused selections with zero played duration carry no negative or
recency signal. Open sessions can affect recency only after actual playback;
positive contributions require a closed session with sustained listening.

Charging and playback do not gate analysis. Existing charging-constrained periodic requests migrate with UPDATE; an immediate unique request prevents waiting for the next periodic window. Explicitly disabled preferences remain disabled. Foreground manual analysis rechecks battery-temperature pauses every ten seconds; it does not depend on a thermal callback. Analysis threads run at Android background priority so playback can retain CPU priority without stopping indexing.
Every native Gradle build runs the pinned artifact fetch/verification task,
including direct Expo/EAS builds. This task runs only on the build host.

## APK footprint

The initial universal v1.3.0 candidate packaged at 102,706,569 bytes, an increase
of 31,170,951 bytes over the published 71,535,618-byte v1.2.6 APK. The FP32 model
accounts for 11,979,512 bytes. Standalone LiteRT native libraries account for
18,431,900 bytes across ARMv7, ARM64 and x86_64 together; runtime Java APIs,
WorkManager and other code/resources account for the remaining increase. These
are uncompressed APK entries. See
`verification/recommendations/apk-size-initial-candidate.json`; the final build
produces its own exact size report. The 20 MB ceiling applies to the model file,
not to the complete application or all runtime ABIs combined.

## Folder-header test scope

At the user's request, the native UI test no longer requires the alphabet rail to
start below expanded search or grow when search collapses. Search disappearing
on scroll is intentional. The focused `folders` scenario existed only for those
assertions and has been removed.

Folder navigation, compact control spacing, the Settings-only subfolder toggle,
search collapse in the general library flow and For You interactions retain their
existing checks. This test-only change does not alter the interface or claim that
the previous rail layout attempts fixed the historical failure. Historical
screenshots and diagnostics remain in
`verification/recommendations/header-layout.json` and their retained artifacts.

## Header/search revision awaiting review

The header uses a muted teal surface, a solid accent Browse button and a contrasting bottom divider. Search lives in its own inset row, independently of counts/sort/folder actions. It hides by scroll delta on downward movement and returns on upward movement at any list depth. A-Z jumps explicitly collapse it; focused search and non-scrolling lists keep it visible. Header and rail share the same UI-thread collapse value, with clamped overscroll. UI tests cover the new behavior; old charging and playback pause requirements have been replaced. No APK build should run for this revision until the user reviews it.
