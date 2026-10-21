# One application interface

The retired Android activity was a second complete player with its own Library, queue, settings, artwork renderer and dialogs. Lyrics was its remaining React entry point. Lyrics now uses the current rounded sheet and existing per-song preferences.

Removed: NativeMusicActivity.java, Ui.java, their manifest declaration, openNative bridge function, legacy light/dark themes and the unused ic_app drawable.

Current feature locations:

- Library, Browse, collections, search, playlists, favourites and queue: App.js and current list/sheet components.
- Player, artwork, mini-player and seek controls: App.js, PlaybackMotion and PlayerProgress.
- EQ, tone, output, presets, speed/pitch and sleep fade: SoundStudio.
- Scan filters, roots and exclusions: LibrarySettings and FolderPicker.
- Appearance, disconnect behavior, permissions, About and history: current Settings.
- Lyrics import, replacement, removal and LRC highlighting: Lyrics.
- Audio sharing: current song-options sheet, using Android's standard share chooser with a read-only content URI grant.
- Custom sleep minutes: SleepTimer, accepting whole minutes from 1 to 1440.

Alphabetical Browse ordering follows the Library redesign; queue, history and manually arranged playlist order remain separate. The playback service, DSP, MediaStore scanner and saved preferences remain native. Notification taps open the package launcher, which loads App.js. Document selection, permission/settings screens, share chooser, notifications and standard alerts are Android platform UI.

Regression checks reject the retired activity, bridge and themes in source, generated manifests and packaged resources. Timer validation/save races and current sharing/navigation are covered locally. Native Android and emulator validation await an authorized APK build.

This migration is included in v1.2.5 (code 8), from PR #23. The v1.2.4 first stable release remains available.
