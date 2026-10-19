# Required verification — not yet performed

## Build

- Compile `:app:assembleDebug` with SDK 35 and JDK 17+.
- Run `:app:lintDebug` and resolve build/lint errors.
- Verify APK signature and install on physical Android devices.

## Permissions and discovery

- Android 8–12: deny/grant storage permission and recover through Settings.
- Android 13–15+: deny/grant music and notification permission separately.
- Index actual MP3, AAC/M4A, FLAC, OGG and WAV samples; verify SD card media where supported.
- Verify the empty state, search, sort, rescan, size/duration filters and folder exclusions.
- Verify unsupported/missing files fail visibly without an infinite skip loop.

## Playback and audio

- Play, pause, seek, skip, shuffle and each repeat mode; test queue end and empty queue.
- Leave the app and lock the phone; test notification and Bluetooth/headset transport controls.
- Disconnect headphones; interrupt with another audio app/call and check focus recovery.
- Pause during initial file loading; audio must remain paused when preparation finishes.
- Change playback speed while paused; it must stay paused.
- Test sleep timer expiry with screen off, background playback, and equalizer availability.
- Change songs while the equalizer dialog is open and verify no stale session errors.

## Library and interface

- Persist favourites, playlists, queue and playback position across process restart.
- Create, rename and delete playlists; add/remove tracks without deleting files.
- Remove current/last queue entry and move songs around the playing entry.
- Load large libraries, long song titles and embedded album art.
- Test local plain-text/LRC lyrics import and file sharing.
- Test theme changes, rotation, status/navigation insets, font scaling and TalkBack.
- Compare requested Mi Music version screenshots; record remaining parity gaps.
