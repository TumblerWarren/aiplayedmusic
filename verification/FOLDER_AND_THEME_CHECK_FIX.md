# Folder spacing and theme-test corrections

The nested folder screenshot showed excessive separation between the fading search area and folder playback controls. The folder header now contains only search. Sort, include-subfolders and play-folder controls share a compact prelude in normal list flow, without stacked header/row margins. Search, alphabetical indexing and session restoration remain available.

Run 39605146635 passed native compilation, Lint, package/signature checks and the existing interaction suite. Publication was correctly blocked by the three theme matrix failures:

- API26 failed its initial screenshot colour assertion. Record the applied OS UI mode separately from the requested setting and wait for the rendered palette to settle; System follows the actual OS configuration. API29+ also require requested and applied modes to agree.
- API31 could not reach Theme. The swipe started at y=1450, below the ScrollView's bottom at y=1421 and on the mini-player. Derive gesture bounds from the visible scrollable node and reject clipped/offscreen controls.
- API35 attempted notification playback while Library contained zero songs. The fixture scan was asynchronous. Use a MediaScannerConnection completion callback in the independent CI inspector, verify the MediaStore metadata, then wait for the song and an active media session before checking notification playback.

The failed run's PNG/XML/logcat evidence was inspected for all three APIs. Offline geometry/parser checks reproduce the recorded ScrollView bounds and missing-fixture state. The six appearance combinations, playback checks and publication gate remain enabled. A new candidate run must establish the actual Android results for these corrections.
