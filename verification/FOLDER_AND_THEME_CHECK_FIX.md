# Folder spacing and theme-test corrections

Historical investigation log. For the published APK and final results, start with [STATUS.txt](STATUS.txt) and [the test validity audit](TEST_VALIDITY_AUDIT.md).

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

Diagnostic run 39760591923 passed the remaining API26 flow with the corrected Cancel path: search/Browse/Sound, dialog dismissal, Settings folder picker, Now Playing, Lyrics across phone-theme changes, and large-text/rotation screenshots. The prior probe had already verified all six preference/phone combinations and their startup videos/selections. These isolated diagnostics establish both repairs on a device; the production rebuild still must pass the complete API26/31/35 matrix and normal signing/publication checks. The temporary probe workflow is removed in the rebuild commit. All seven local theme-driver regressions pass.

## Compile the patched module instead of Expo's prebuilt AAR

Run 39762160393 passed the complete build/interaction job, but API26 still rendered light. Its build log shows the source patch ran successfully and the installed-source regression passed, while Expo marked expo-system-ui as a prebuilt package and never ran its Kotlin compilation task. The source change therefore did not reach the packaged APK. This explains why the isolated APK bytecode correction worked but the production build did not.

Expo autolinking now opts only expo-system-ui into Android buildFromSource. The installation hook and regression require this configuration, and the native compilation gate explicitly runs :expo-system-ui:compileReleaseKotlin before APK assembly. A prebuilt-only module cannot satisfy that task. Other modules retain their existing configuration. The build concurrency namespace changes to android-apk so the preceding API31/35 validation can finish while this corrected build compiles.

## API31 fixture navigation with bundled emulator ringtones

The same run's API31 screenshot/XML showed 13 songs, with Calm/Music Box/Nudge/Piggyback/Shrink Ray occupying the visible first page and the T alphabet target enabled. MediaStore still contained Theme Song. The driver incorrectly waited for a virtualized offscreen row without navigating to it, then shuffled the entire library when it happened to be visible. Bundled short ringtones made that playback choice unreliable.

Fixture startup now uses the visible T alphabet target when needed and taps the row's full title/artist label. A mini-player title cannot satisfy that label. The fixture is 15 minutes long so it cannot naturally end during slower navigation checks, and the search header is scrolled back into view after alphabet navigation when needed. Offline regressions exercise the actual driver with the recorded first-page/T-target geometry, both visible and offscreen fixtures, and a misleading mini-player title. All nine theme-driver tests pass. All six theme/phone combinations and existing playback assertions remain required. Native compilation output is now cached immediately after APK assembly so a later driver-only repair does not discard a completed C++ build.

The API35 job passed all six theme/phone combinations, recordings, saved selections, every Browse destination, Sound and the player colour check. Fixture playback started at 11:15:10 and the Lyrics playback assertion ran at 11:20:20, exceeding the original 300-second file duration. The 900-second fixture addresses this finite test-input limit while retaining the playback assertion. In the concurrent source-build run 39768462608, the explicit expo-system-ui Kotlin compilation gate passed, proving the patched source is now used instead of the prebuilt-only configuration.

## Confirm the player return before the final API31 appearance checks

Run 39770122788 passed the full build/interaction job and the complete API26 and API35 theme jobs. API31 also passed all six combinations, videos, saved selections, fixture playback, search, every Browse destination, Sound, player colours and playback across Lyrics/phone changes. The final System-theme step then failed to find Settings after a hardware Back injection. Saved XML inspected in run 39778031578 showed the full player still visible, with the actionable chevron-down at [32,79][158,205] and active playback. The driver had assumed a route change that did not occur.

The theme driver now awaits Lyrics dismissal, taps that visible player return control and waits for the Library's Browse destination before accessing Settings. The separate interaction suite retains its hardware Back coverage. The offline regression exercises the actual driver against delayed modal dismissal, the recorded return-button bounds and delayed Library navigation; all ten theme-driver regressions pass. No application code or validation assertion is removed for this correction.

The focused API31 final-path diagnostic 39779592279 passed Lyrics/phone playback, the Library return, System appearance and all large-text/rotation screenshots using the existing source-built APK.

## Keep Settings scrolling toward Choose folder

Run 39778544244 passed compilation, Lint and package checks. Its interaction script passed folder navigation, compact spacing, the Settings-only switch and large-text/rotation checks, then failed to find Choose folder after reaching the lower Include subfolders row. The Settings search scrolled upward once and then changed to downward swipes for every remaining attempt. A target above multiple rows could never become visible.

Choose folder now keeps its upward scroll direction until the row appears. The regression exercises the actual interaction-driver wait function with a clipped row that requires three upward gestures; it first reproduced Missing UI control: Choose folder on the old driver, then passed after the correction. Other Browse/Settings navigation and all validation assertions remain in place.

## Complete Android 12 verification before the full rebuild

At the user's request, the full pipeline for run 39783516772 was deliberately paused after successful APK assembly, Lint and package validation. Isolated run 39786995174 then tested that exact revision's retained APK on API31 with the complete, unmodified theme suite. It passed all 53 logged assertions, including all six theme/phone combinations, playable startup recordings, saved choices, search, every Browse destination, Sound, player colours and playback across Lyrics/phone changes. The final player return, System preference, open-sheet phone changes and large-text/rotation flow also completed successfully. Both sets of ten driver regressions passed before the device suite.

This verifies the previously failing Android 12 job independently before starting another full production rebuild. The new production run still requires the complete interaction suite, API26/31/35 theme matrix and publication gates; the isolated success does not replace any release check.

## Allow slow verification-tool installation without truncating the device suite

Production run 39791701435 passed the full build job and all 61 interaction assertions, including compact folder spacing, the Settings-only subfolder toggle and stable random artwork. API26 and API31 each passed all 53 theme assertions. API35 spent 18 minutes 45 seconds downloading FFmpeg packages from the Ubuntu mirror, then reached 51 passing assertions before its 35-minute job timeout interrupted the final player/Lyrics flow. The log contains cancellation rather than an assertion failure.

Only the API35 job is retried against the same compiled candidate; the successful build and API26/31 results are retained. Future theme jobs allow 55 minutes to cover slow tool downloads plus the complete device suite. Evidence artifact names include the attempt number so a focused retry can retain its evidence without conflicting with the previous attempt. These workflow changes leave the application, theme assertions and release gates unchanged.

## Earlier device results and historical-tag permission failure

The focused API35 retry (job 119911211061, production run 39791701435 attempt 2) passed all 53 assertions and completed its final player/Lyrics, System-theme and large-text/rotation checks. The build/interaction job and all API26/31/35 theme jobs are successful. That attempt used source commit 8dd974083e20e51f24c45b91a11830a0e54472e0. Its APK artifact 12434211945 was subsequently deleted at the user’s request to retain only stable v1.2.5 and the newer run-71 candidate.

Only release publication failed: job 119922855884 received HTTP 403 from GitHub despite its `contents: write` permission. The exact-source tag diagnostic 39807592957 independently verified all four successful validation jobs, then GitHub explicitly rejected pushing v1.2.6 because creating the historical tag would update `.github/workflows/theme-compatibility.yml` without `workflows` permission. No tag was moved to a different source and no validation gate was bypassed. The earlier diagnosis treated this as a general publisher-permission blocker. Comparison with the successful v1.2.5 release identified the triggering condition: a workflow change reached main while the older candidate was finishing, so tagging its historical workflow revision required the additional permission. The newer run-71 source is kept at main HEAD throughout validation/publication; no broader token access is assumed or granted. See [the test-validity audit](TEST_VALIDITY_AUDIT.md) for its independent APK identity and device results.


## Audited candidate verification and successful publication

The next candidate, run 39809400056, passed native/package gates but hit a further test-navigation error: the Bass dial was visible while its precision button was below the viewport. The recorded geometry reproduced that failure independently. The driver now reveals the actual button, waits for exact value changes, and has stronger next-track and theme-prerequisite assertions. See [the complete test-validity audit](TEST_VALIDITY_AUDIT.md) for corrected assumptions and verification limits.

Validation-only run 39822236303 reused that exact APK, checked its checksum and original compilation/Lint evidence, and passed three fresh-data Sound repetitions, all 61 interaction assertions and 63 theme assertions on each of API26,31,35. It published [v1.2.6](https://github.com/TumblerWarren/aiplayedmusic/releases/tag/v1.2.6) at source f9c7d92ab29b7bb9c007ca89723c30a8949c3283 while main remained at that revision. No extra token scope or new application build was required. The published APK checksum matches the validated candidate.
