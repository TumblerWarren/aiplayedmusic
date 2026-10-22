Aiplayed v1.2.6 (Android version code 9)

- Add soft charcoal dark mode across Library, Now Playing, Sound, dialogs, sheets, artwork and rounded press feedback.
- Follow the phone on new installs; preserve saved System, Light and Dark choices and restore native appearance before React initialization.
- Add dedicated dark startup turntable artwork, retaining Reduce Motion and initialization recovery.
- Give the native notification-panel music card a soft theme-matched tint, refreshing it when appearance changes without interrupting playback. Android controls final card opacity.
- Replace the icon's play symbol with a beamed music note in standard, adaptive and monochrome launcher assets.
- Keep Choose folder and Include subfolders in Settings; remove their rows and leftover spacing from Library folder lists while retaining recursive playback.
- Replace full-player disc rotation with a random Pulse, Wave or Orbit animation per track, respecting pause, background and Reduce Motion.
- Correct Expo's battery-based automatic appearance on Android 8 so System follows the phone's night mode.

Built from merged main. Publication requires behavior/DSP tests, native compilation, Android Lint, signature/branding/offline-permission checks, existing interaction checks and theme verification on Android API26,31,35. Screenshots, startup recordings and diagnostics are retained in GitHub Actions artifacts.

Offline standalone APK, using the same signing certificate as v1.2.5 for installation as an update. A SHA-256 checksum is attached.
