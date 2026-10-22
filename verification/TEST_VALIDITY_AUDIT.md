# Test validity audit — run 71

The latest red build did **not** establish a broken Bass control. Run 39809400056 compiled its APK and passed Lint, signing/branding/offline checks and 58 interaction checks. The driver then timed out locating `Increase Bass`; no explicit behavior assertion had failed. Its saved UI tree contains a visible dial at `[126,1106][462,1442]` inside viewport `[0,378][1080,1484]`, while the button is clipped at `[315,1531][441,1484]`. Evidence was inspected in run 39817696292.

## Findings and corrections

| Finding | What it could get wrong | Correction |
| --- | --- | --- |
| The driver revealed the dial but assumed the separate precision button was visible. | False application failure when the button was below the fold. | Reveal and fully contain the actual button in the measured viewport before tapping; keep swipes outside the dial and mini-player. Regression uses the recorded failure geometry and failed before the fix. |
| Main UI lookup chose the first matching label without package/button priority. | Tapping a heading or another package instead of the app's action. | Exact app-scoped lookup with actionable-node priority. A regression first reproduced the wrong selection. |
| Sound readback used fixed delays and required the dial to remain onscreen after scrolling to its buttons. | Reading before a native commit completed, or failing a semantic read because the hit target moved. | Bounded waits for the actual expected value; read the mounted accessibility value independently of input geometry. A wrong full-dB step still fails. The captured fractional dB label takes priority over Android's rounded range field. |
| “Advances exactly one track” only checked that the title changed. | A double skip could pass. | Require the known fresh fixture sequence A00 → A01 → B00. |
| The Android 8 theme prerequisite could accept an unapplied night-mode request. | A test labelled dark could actually exercise light mode. | Require the applied Android resource mode to match the requested case on every API. A regression first reproduced the silent API26 fallback. |
| Some open-sheet, font and rotation cases only saved screenshots. | Evidence collection was stronger in the report than in the assertions. | Assert the sheet palette, continued menu presence and open/close behavior; retain the screenshots as evidence. |
| Startup/artwork smoke-test names implied more visual verification than they performed. | Confusing a rendered style or successful launch with proof of animation frames or branded artwork. | Name the native checks for supported style rendering and reaching Library. JS tests separately verify animation lifecycle and selection. |
| Main audio fixtures lasted five minutes. | Slow navigation could let a fixture finish during transport assertions. | Use fifteen-minute fixtures; keep deterministic titles and explicit transport assertions. |
| UI checks were coupled to the local build-output path. | Every driver repair led to another APK compile before its failing path could be tested. | Import-safe functions and `--apk PATH --scenario sound --repeat 3`; the same built APK can receive focused and full validation. Fresh-data repeats are emulator-only. |

## What remains meaningful

Native compilation, Lint, certificate/version/launcher/offline-permission checks are real package gates. Native playback checks inspect this app's active Android media session, not unrelated system audio. Dial changes, cancellation, exact precision steps and persistence assert observable values. Background/sheet palette checks assert a defined solid colour over a meaningful screen area, with bounded rendering waits; they do not prove every component's contrast or appearance. Pixel-size layout assertions apply to the explicitly configured 1080×1920, density-420 emulator.

Press-pattern, startup-frame and notification screenshots/recordings remain review evidence. A playable recording alone does not prove its visual content is correct. Native style IDs prove which artwork is rendered; JS lifecycle tests prove scheduling and pause/background/Reduce Motion handling, while frame-by-frame visual motion is not asserted by the device test.

## Verification plan

The new regressions reproduced the failures before correction. Fourteen geometry/driver checks, eleven theme-driver checks and three media-session checks pass locally. Device verification must reuse the existing run-71 APK: establish its original source, APK checksum, compiler/package and Lint evidence; run the isolated Sound path repeatedly; then run the full interaction suite and API26/31/35 theme matrix. Do not compile a new APK for these test-only corrections or publish before those checks pass.
