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


The full-player vinyl artwork has also been replaced by random Pulse, Wave or Orbit animation, with no style preference UI. See [playback animation notes](../docs/PLAYBACK_ANIMATIONS.md) for design references, implementation and lifecycle coverage.


## Folder-row navigation repair after run 39712593924

The APK compiled, passed Lint/package checks, and passed random-artwork and pause/resume checks. The interaction script advanced past Browse but stopped at `Missing UI control: Music`, after a text-coordinate tap on Internal storage. The downloaded screenshot/XML evidence was unavailable in this workspace, so the precise native failure is not claimed as established.

Folder rows now expose the full path on the actionable button, and browser/picker screens have stable destination identifiers. The device test targets the clickable full-path row, waits for the expected folder screen, and re-reads/retries moved rows during scroll restoration. It no longer assumes a text tap opened the folder or that the asynchronous picker catalog is ready immediately. Settings checks scroll within measured content if needed.

A new UI regression scans the same 52-song fixture hierarchy, navigates every ancestor and nested folder, verifies route restoration and checks 52 versus 0 recursive songs after changing the Settings-only toggle. A geometry regression distinguishes folder buttons from headings, similarly named paths and clipped rows. Local validation: all 69 JavaScript tests, 3 media-session checks and 7 geometry/navigation checks passed, as did Python syntax compilation and `git diff --check`. Android validation remains required in the rebuild; no validation gate has been bypassed.


## Clipped rotary-control repair after run 39735488192

The folder hierarchy, compact spacing, Settings-only toggle and picker A–Z checks all passed in this run. The next failure was in `knob_node`: it called the asserting `bounds()` helper on the offscreen Bass control. The log retains the exact inverted rectangle `[126,1718][462,1484]`. A matching accessibility ID does not establish a visible target.

Knob lookup now uses the non-asserting visible-node finder. The driver scrolls within the measured Sound viewport and requires the full dial face before injecting a rotation. Inverted, wholly offscreen and partially clipped rectangles are scrolled into view rather than measured as interactive controls. The offline regression first reproduced the exact assertion from the log, then passed with the fix; it also exercises clipping above the viewport and a positive but cropped rectangle. All existing gesture/value/cancellation and release assertions remain enabled.
