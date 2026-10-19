# Required verification — not yet performed

## Build

- Install dependencies and run `npx expo install --check`.
- Generate Android using Expo prebuild; verify the LocalMusic module autolinks.
- Compile `:app:assembleRelease` with SDK 36 and JDK 17+.
- Run `:app:lintRelease` and resolve build/lint errors.
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
- Open Sound from the player and Settings; confirm Tone, Output and Playback use the copper theme.
- Change presets while a song plays, pause, change EQ/speed/pitch, then confirm playback stays paused.
- Save a named sound profile; restart the app and restore it. Verify all settings, rename conflicts and deletion.
- Compare bypass with a level-matched reference; transition from 300% boost to bypass without a clipped transient.
- Play quiet and near-full-scale recordings at 100%, 200% and 300%; confirm limiter reduction and mono/stereo linking.
- Check bass/treble shelves, EQ headroom, manual preamp, balance, mono cancellation and stereo width.
- Check Gentle/Night on loud and quiet passages; Off must remove their compression.
- Confirm speed and pitch are independent, silence skipping is optional, and default music pauses stay intact.
- Set a sleep timer; during its final fade toggle fade off and confirm normal player gain returns.
- Test very short WAV files and the final samples of a song; verify EOF drain and repeated seeking.
- Test gapless album files with correct encoder delay/padding, at normal speed and with pitch/speed changes.
- Test low-rate mono and multichannel files; the processing-format/unsupported-effects status must be accurate.

## Library and interface

- Persist favourites, playlists, queue and playback position across process restart.
- Create, rename and delete playlists; add/remove tracks without deleting files.
- Remove current/last queue entry and move songs around the playing entry.
- Load large libraries, long song titles and embedded album art.
- Test local plain-text/LRC lyrics import and file sharing.
- Test theme changes, rotation, status/navigation insets, font scaling and TalkBack.
- Compare requested Mi Music version screenshots; record remaining parity gaps.
- Choose a Music root using Android's directory picker, restart and confirm persistence.
- Verify Electronic/Ambient and Electronic/House stay inside Electronic; test breadcrumbs and system Back.
- Play a folder with Include subfolders on/off, and exclude/re-include a parent without leaking sibling paths.
- Select internal and SD-card roots, remove one and remove the final restriction; recover from picker cancellation.
