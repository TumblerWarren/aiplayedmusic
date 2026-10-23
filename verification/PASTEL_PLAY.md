# Pastel Play interaction update

Historical record for the revision described below. Current APK and validation results are in [STATUS.txt](STATUS.txt).

Implemented on `design/multicolor-ui`:

- Custom two-tone folder, music, playlist, sound, heart, disc and transport icons; utility arrows retain Feather.
- Decorative playback-state animations in the active song row, mini-player and player artwork. These are not measured audio-spectrum or beat visualizations. They stop while paused/backgrounded and respect the device Reduce Motion preference.
- A themed in-app folder picker backed by an unfiltered MediaStore folder catalog, including internal storage and SD cards. It adds scan roots through the bridge without opening Android's directory picker. Only folders with indexed, accessible audio are shown; it does not browse arbitrary files or cloud providers. Excluded-folder and minimum-size/duration filters still apply to the resulting music library.
- A shorter fixed header, with the shortcut cards moved inside the scrollable songs list.
- Tap/drag `#` and A–Z navigation for title/artist sorted song lists, with an active-letter bubble and virtualized-list jump recovery. Recent history and playlists keep their original order; date/duration sorts have no alphabet rail. Accented Latin titles share their base letter; numbers and other scripts use `#`.
- Light is the default for new installations. Saved theme preferences are preserved.

## Automated validation

`npm run check` includes JavaScript syntax/import checks, the existing library tests, new navigation/folder hierarchy tests and Java DSP signal tests. The Android workflow now builds pushes to the design branch as well as main; it compiles Kotlin/Java, packages the APK, runs Android Lint and verifies offline permissions/signing.

## Device checks still required

- Play/pause, change tracks, background/foreground, enable Reduce Motion and verify animations stop/restart correctly.
- Tap and drag to the end of a large library, test filtered results, accented titles, artist sorting and increased system text size.
- Check short-screen/landscape layouts and TalkBack letter actions.
- Open the themed folder picker from every entry point; navigate internal/SD storage, select a parent, add a second root outside the first, handle empty/no-permission catalogs and enforce the ten-folder limit.
- Check playlist/history order, queue controls and folder exclusions after selecting roots.

A passing Android build does not establish that the new interactions have been tested on physical hardware.
