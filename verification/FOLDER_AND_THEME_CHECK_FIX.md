# Folder spacing and theme-test corrections

The nested folder screenshot showed excessive separation between the fading search area and folder playback controls. The folder header now contains only search. Sort and play-folder controls share a compact prelude in normal list flow, without stacked header/row margins. Include subfolders is available only under Settings → Library; removing its folder-browser row leaves no placeholder. Search, alphabetical indexing and session restoration remain available.

Run 39605146635 passed native compilation, Lint, package/signature checks and the existing interaction suite. Publication was correctly blocked by the three theme matrix failures:

- API26 failed its initial screenshot colour assertion. Record the applied OS UI mode separately from the requested setting and wait for the rendered palette to settle; System follows the actual OS configuration. API29+ also require requested and applied modes to agree.
- API31 could not reach Theme. The swipe started at y=1450, below the ScrollView's bottom at y=1421 and on the mini-player. Derive gesture bounds from the visible scrollable node and reject clipped/offscreen controls.
- API35 attempted notification playback while Library contained zero songs. The fixture scan was asynchronous. Use a MediaScannerConnection completion callback in the independent CI inspector, verify the MediaStore metadata, then wait for the song and an active media session before checking notification playback.

The failed run's PNG/XML/logcat evidence was inspected for all three APIs. Offline geometry/parser checks reproduce the recorded ScrollView bounds and missing-fixture state. The six appearance combinations, playback checks and publication gate remain enabled. A new candidate run must establish the actual Android results for these corrections.


## Latest interaction failure and Settings change

Run [39625723632](https://github.com/TumblerWarren/aiplayedmusic/actions/runs/39625723632) built the standalone APK and passed the local regressions, native compilation, Lint, signature, branding and offline-permission checks. The interaction script then raised `Missing UI control: Folders` at line 270, immediately after its font-scale/rotation checks. The release gate correctly saw `android_ui.outcome == failure`; the action's apparent successful step conclusion did not mean the script passed. Theme matrix validation and publication were skipped.

The interaction script used fixed Browse swipe coordinates `(540,1000) → (540,1600)` and `(540,1650) → (540,850)`. These do not follow a sheet whose bounds change with orientation, font scale and scroll position. Browse scrolling now derives both endpoints from the active window's visible ScrollView, rejects offscreen/empty bounds, and waits for sheet opening and dismissal. This addresses a concrete test-driver weakness at the failure point; an emulator rerun is still required to establish the final cause and result.

Include subfolders now appears once in Settings, retains the existing persisted native preference, and continues to control recursive folder playback. Folder roots and nested folders contain no copy of the toggle and no reserved row. The folder-spacing device assertion now measures from Folders and songs to Play folder.

Validation: `npm run check`, `python scripts/media-session.test.py` (3 checks), `python scripts/android-ui-geometry.test.py` (5 checks), Python syntax compilation and `git diff --check` passed locally. The UI regression exercises both toggle values and verifies their native command payload. No Android SDK/emulator is installed in this workspace, so Android interaction and API26/31/35 theme validation remain pending. No APK was built or published for this change.
