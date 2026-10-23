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
0.999999997 across 29 inputs. An independent native core run passed twenty
SQLite/content-URI/runtime checks. Physical-phone measurements remain pending.

Only after all model gates pass may a new model be uploaded to a versioned
`model-assets` GitHub release with `make_latest=false`. Application builds must
fetch the immutable artifact, check its SHA-256, then bundle it. There is no
runtime model download and no production INTERNET permission.

## Product contract after the gate

- Browse → For You; preserve all four bottom navigation destinations.
- Explicit opt-in explaining that audio analysis and listening signals stay local.
- One resumable WorkManager job while charging and battery-not-low, plus foreground
  manual analysis. Pause on playback or elevated thermal conditions.
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
