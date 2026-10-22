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


## Theme-matrix repairs after run 39740576422

The native build, package validation and full interaction suite passed. The API26/31/35 theme matrix exposed three separate problems. Saved artifacts were inspected in diagnostic run 39749953273; the existing APK was independently probed on API26 in run 39750665589.

- **API26 application bug:** both `am get-config` and ActivityManager's activity configuration reported `night`, yet the screenshot contained 1,462,688 exact light-background pixels and no dark-background pixels. Expo SDK56's SystemUI listener maps `automatic` to `MODE_NIGHT_AUTO_BATTERY` below API28, overriding our pre-create restoration during `super.onCreate`. A post-create hook now restores the saved/System preference after Expo's listener and then applies the window palette. Pre-create restoration remains in place for the launch window. Production Java tests simulate the overwrite and verify recovery for all preferences on API26/31/35; plugin tests cover ordering, idempotence and migration of older generated projects.
- **API35 test-driver bug:** the saved failure XML was the full player. Prefix matching allowed `Theme` to match the fixture `Theme Song` when Settings navigation had not completed. Settings and menu buttons now have explicit labels; the theme driver uses exact, app-scoped matches for controls, prefers clickable parents and confirms the Settings screen before opening Theme. Browse and Settings scrolling use live bounds, and notification/menu dismissal is awaited.
- **API31 recording transport:** playback and palette checks passed before the adb screenrecord process timed out. Recorder shutdown now signals the actual remote PID, escalates with bounded waits and reaps a hung local adb process. Startup videos use bounded size/bitrate and must still pass ffprobe with positive duration; recordings and colour assertions are not skipped.

Phone-mode diagnostics now retain ActivityManager's applied resource configuration alongside UiModeManager state. Exact screenshot-colour assertions, all six preference/phone combinations, cold starts, saved selections, playback checks and publication gates remain enabled. Offline regressions cover selector collisions, selected parent buttons, navigation sequencing and recorder shutdown paths. The temporary evidence-inspection workflow is removed once these repairs are committed.

Upstream source confirming the SDK56 override: https://github.com/expo/expo/blob/sdk-56/packages/expo-system-ui/android/src/main/java/expo/modules/systemui/singletons/SystemUI.kt

## Prevent the API26 startup override before it occurs

Run 39751660475 passed compilation, Lint, signature/branding/offline checks and the full interaction suite. API26 still failed the fresh-install dark assertion. Inspection of the compiled DEX in diagnostic run 39758122592 confirmed that both bootstrap calls were present in the correct order, while the saved screenshot still contained 1,462,631 light-background pixels. Restoring FOLLOW_SYSTEM after Expo's battery-mode change was insufficient.

The installation hook now changes only Expo SDK56's API26/27 automatic fallback from AUTO_BATTERY to FOLLOW_SYSTEM before native compilation. This prevents the conflicting mode from being applied in the first place. Explicit Light/Dark logic is unchanged. The hook is idempotent and rejects an unexpected upstream implementation instead of silently applying an unreviewed patch. Tests use the upstream SDK56 source fixture and CI also checks the installed dependency before packaging. The post-create bootstrap remains necessary to restore explicit saved choices after Expo's automatic listener.

The isolated API26 diagnostic run 39758883015 (after repairing a missing FFmpeg dependency in probe 39758405371) changes the same single constant in the existing APK and executes the complete theme suite. This diagnostic APK is signed only for testing and cannot be published as a release. The full production rebuild recompiles the patched dependency with the regular signing key and retains every release gate. At commit time, the diagnostic device suite and production rebuild still require completion.

API31/35 in run 39751660475 passed the previously failing startup-video and saved-selection checks. Their jobs were cancelled by the subsequent diagnostic push before the entire matrix completed; they are not claimed as passed overall. Local validation with the dependency patch: 73 JavaScript tests, UI syntax/import checks, native helper/DSP checks and git diff whitespace checks passed.

The isolated API26 probe 39758883015 verified the fresh-install fix, all six preference/phone combinations, startup recordings, saved selections, search, every Browse destination and Sound tabs. It then found a separate driver error: tapping the center of the full-window "Close dialog" scrim hit the playlist dialog covering that point, leaving Settings inaccessible. The driver now uses the visible Cancel button and awaits dialog dismissal. An offline regression reproduces the covered-center tap and verifies the explicit-button path. Diagnostic/no-build pushes now use their own concurrency group so they cannot cancel an active APK build.
