# Documentation and unused-code cleanup

Reviewed after v1.2.6 publication, 2026-10-23. Baseline main: `f75a3b1b7797bcb34808c56d86add5149f919211`.

- Updated the README, verification status and active UI/theme/motion/performance guides to match v1.2.6. Kept physical-device and listening/performance checks pending. Archived the original 1.2.0 build status and indexed historical records.
- Refreshed the branch audit: all 32 non-main branch tips are ancestors of the recorded main revision.
- Removed the completed one-time v1.2.4 cleanup workflow. Its old asset guards and deletion rules no longer describe the retained releases.
- Removed the unused browser-only animated SVG and unused ActivityIndicator, StyleSheet and FlatList imports. Current startup artwork and all three playback animations remain active.
- Removed the old `selectSongs` implementation: the app uses `createLibraryIndex`. Library tests now exercise that live selector, including its title sorting; the 10,000-track regression uses explicit fixture scopes instead of a duplicate production selector.
- Removed uncalled `Library.favorite`, `playlistNames`, `playlistIds` and `byIds` helpers left behind by the retired native UI. Existing bridge commands, preference keys, playlist mutations and queue persistence remain in use.
- Removed build push triggers for already merged design/version branches. Release naming and evidence paths now derive from the package version. Publication preserves an existing release/tag and requires matching release notes for a new version; all build, Lint, package, interaction and theme gates remain required.

Verification: the full `npm run check` suite, 28 Python driver regressions, native Java 17 syntax parsing, workflow YAML/shell validation, local documentation links and whitespace checks. A mocked publisher exercises a new package version and an already-published version without calling GitHub. No APK build, release replacement or new emulator run is part of this cleanup; published v1.2.6 evidence remains tied to its original source/checksum.
