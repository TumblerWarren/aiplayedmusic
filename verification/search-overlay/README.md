# Complete search reveal and hit testing

Current verified source: `345c78b6ee0d993faf5016cecc31ae41874ea3d4`.
[Passing Android comparison](https://github.com/TumblerWarren/aiplayedmusic/actions/runs/40176053556): two fresh-data runs, fifteen checks each. Songs and Folders hide search on downward scrolling, return the complete field on a short upward gesture, retain spacing below it, and expand the A–Z rail. Playback after A–Z navigation, input dismissal, 1.6x text and portrait/landscape changes also passed.

The full search slot is 191 physical pixels high after returning, matching its expanded height. The complete field ends at y=392 and the list viewport begins at y=425: a 33-pixel gap. A partially visible first row below the divider is the list's current scroll position; the complete search field stays above it. Geometry/results are in `full-field/results.json`; `validation.json` identifies the tested source and limits.

## Correction

Search occupies a real layout slot above the list, with its measured height/focus in shared values. The rail follows the list viewport. Dragging/alphabet navigation dismiss editing; row offsets exclude the former search spacer. A gesture settles to a complete open/closed endpoint on release; layout scroll events cannot clip that endpoint again, including after resizing.

Android also changes content offsets when collapsing search moves the viewport under the dragging finger. Native evidence from run 40175201172 showed a downward folder gesture reach y=115.81, then report y=101.33 while viewport height grew from about 425 to 476 dp. Raw offset direction alone reopened search. The handler now compensates with viewport-height change; a host regression replays the captured sequence in both directions. Scrollability is computed from dimensions rather than by reading a shared value immediately after a JS write.

## Test validity and earlier evidence

The original release run [40113472034 attempt 1](https://github.com/TumblerWarren/aiplayedmusic/actions/runs/40113472034/attempts/1) compiled successfully and passed the 46 Android recommendation checks. Its UI failure was real: search remained at `[42,266][1038,392]`, covering the song tap centre `(498,329.5)` and opening the keyboard instead of playback. `observed-overlap.json` records that geometry.

The first correction's run 40165842603 passed separate-boundary checks but its returned field was visibly clipped. Those earlier checks did not require the complete field, so that pass was insufficient. Directories `baseline`, `candidate-1` and `candidate-2` contain historical evidence for that earlier candidate, not the current visual correction.

Focused setup now queries only published MediaStore rows (`is_pending=0`), requires all fourteen expected fixture titles, and refreshes until the app itself displays fourteen songs. This avoids asserting folder collapse on an accidentally partial, fitting three-folder library. The driver retains strict collapse/return tests; it additionally checks full returned height and a minimum twenty physical pixels below the complete field.

## Scope

The diagnostic reused the retained APK's native libraries/resources/model byte-for-byte, replaced JavaScript, and used a debug signature. `apk-comparison.json` records checksums. [Full current screenshots, raw XML, recordings and logs](https://github.com/TumblerWarren/aiplayedmusic/actions/runs/40176053556/artifacts/12592636450) are in the workflow artifact.

This is focused API 35 emulator verification, not a new release APK, a full release gate, or a physical-phone measurement. The temporary comparison workflow and repacking scripts were removed after validation; their source remains in the tested commit's history. The regular interaction driver retains the strengthened checks. Published v1.2.6 assets were not changed.
