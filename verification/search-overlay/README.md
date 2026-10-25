> Visual correction pending revalidation: the first candidate screenshots revealed a clipped search field after a short upward gesture. The earlier pass established separate layout bounds, not a complete search field. The new correction settles search fully open/closed after release and adds full-height and bottom-gap assertions. Earlier results below describe the previous candidate only.

# Search hit-testing regression

Original run: https://github.com/TumblerWarren/aiplayedmusic/actions/runs/40113472034/attempts/1
Source: `2ccbeb8d65c28be8c1cf984ba5b7599d6847a663`.

The native APK compiled and the 46 Android recommendation checks passed. The interaction gate failed because search did not hide on downward scrolling and the alphabet rail did not gain the released space. Search remained at `[42,266][1038,392]`. After an A-Z jump, A00's actionable row was `[42,235][954,424]`; its centre `(498,329.5)` falls inside search. The test tapped that centre and the actual failure screenshot shows the keyboard instead of playback.

These are valid behavior/hit-testing failures. The later "Missing UI control: Pause" is downstream; it is not evidence of an audio decoder failure. Source-level worklet/geometry mocks did not establish native behavior and were insufficient to catch this defect.

The candidate moves search into a real layout slot above the list, stores measured height/focus in shared values and makes the rail follow its viewport's native layout. It also dismisses input focus on drag/alphabet navigation and removes the obsolete search spacer from item offsets. The driver now asserts that a song's tap centre is uncovered before waiting for playback.

Isolated comparison: https://github.com/TumblerWarren/aiplayedmusic/actions/runs/40165842603

This diagnostic reuses the retained APK's native libraries/resources/model with byte-for-byte entry comparisons, replacing only the JavaScript and signing the comparison APKs with a debug key. It does not produce or publish a release. Production source does not contain diagnostic logging. The baseline failed the target collapse/rail checks. Both fresh-data candidate runs passed all eleven checks, including actual song playback, Songs/Folders collapse and return, input dismissal, 1.6x text and portrait/landscape changes. This verifies the focused UI behavior on an API 35 emulator; it is not a full release build or a physical-phone measurement.

The first isolated run (40119276318) was not a valid candidate verification: its screenshot showed an empty library, and emulator-runner stopped at the first nonzero baseline command before reaching the candidate. The driver now requires visible indexed fixtures before scrolling; a single bash script handles the expected baseline failure and then runs the candidate. An empty library or an unrelated baseline error must fail setup instead of being reported as a reproduced collapse regression.

Local validation: the complete `npm run check` suite passes, as do 16 Android UI geometry tests and 11 theme-driver tests. These checks complement native verification; they do not replace it.

The next setup run (40165299618) correctly stopped before UI assertions: a cold MediaProvider mount scan took 86,140 ms, and the app had cached only six fixture tracks while Z was still unavailable. The search scenario now queries MediaStore and requires all fourteen expected titles before launching the app, with a bounded 180-second deadline and the raw query saved as `fixture-index.txt`. This wait is a setup prerequisite, not a relaxation of collapse/hit-testing checks.

Native probe detail: the baseline worklet reported `scrollable=false` and `hidden=0` even with a positive 112.38 dp scroll range. Its measured header was 72.76 dp, so the probe does **not** establish a zero-height header as the cause. The old JS code derived scrollability by reading a shared value immediately after writing it; the fix computes eligibility directly from measured dimensions, and a host regression now exercises asynchronous JS-to-UI shared writes. Search also occupies an actual layout slot, preventing a stale transform/opacity overlay from intercepting row taps.

The baseline UI displayed six tracks during cold publication; the candidates displayed fourteen. These are not identical steady-state library sizes. The baseline still had a positive scroll range and reproduced the actual behavior failure; candidate output is independently verified twice. The saved geometry shows search ending exactly where the list viewport begins after upward scrolling. No performance comparison is claimed.

Full native evidence (screenshots, recordings, raw XML and logs): https://github.com/TumblerWarren/aiplayedmusic/actions/runs/40165842603/artifacts/12588258164 . Compact results, geometry, probes and APK checksums are stored alongside this document. The temporary APK comparison workflow/scripts were removed after validation; their historical source is preserved in commit `b7f013bfd8612d5124a8878ec9d06ba0a476edce`. The regular APK interaction gate retains its strict scroll and hit-testing checks.
