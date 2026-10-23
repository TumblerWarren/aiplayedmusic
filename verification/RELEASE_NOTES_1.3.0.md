Aiplayed v1.3.0 (Android version code 10)

Offline personal mixes use S-SONDO MobileNetV3, with the original FP32 weights
and FP32 CPU inference. The 11,979,512-byte embedding model is bundled in the APK;
no account, model download or internet permission is needed on the phone.

Browse → For You offers local-only opt-in, analysis progress, fixed mixes of up
to thirty songs, preview, refresh and saving as ordinary playlists. Existing
repeat controls apply to the fixed queue. Refresh never changes playing music.

Automatic analysis runs while charging with enough battery. Manual analysis is
available while the app is open. Both give priority to playback and pause while
the phone is hot. Partial mixes appear after ten analysed songs, or the whole
library if smaller. Unreadable files have an explicit retry action.

Personal mixes settings control opt-in, analysis and deletion. Clear listening
history also resets recommendation listening signals and taste profiles while
retaining favourites, playlists and audio embeddings.

The embedding-only FP32 model passed the 20 MB ceiling and Python / LiteRT /
Android parity checks on 29 inputs. Model-assets provenance and reports:
https://github.com/TumblerWarren/aiplayedmusic/releases/tag/model-assets-ssondo-fp32-v1

Candidate validation is in progress. Physical-phone relevance, heat, memory,
battery and indexing measurements are not established by the emulator results.
The published v1.2.6 APK is preserved.
