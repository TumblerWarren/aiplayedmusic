# Soft charcoal appearance

Settings → Theme offers System, Light and Dark. New installs and missing/invalid values resolve to System. Valid saved choices retain their existing meaning. The synchronous native getter seeds the store before React's first render, independently of playback initialization and permissions.

`ThemeProvider` resolves the preference and live configuration into one memoized semantic palette. Context subscriptions recolour memoized placeholders, icons and press feedback. Screen state, list keys, search, scroll offsets, loaded album images and DSP state stay in place. Original album art is never tinted. Patterns, rotary arcs, playback artwork and the dedicated startup illustration have charcoal variants. Light colours and launcher assets remain unchanged.

Native `ThemePreferences` owns the existing `music/theme` preference. The config plugin restores it before MainActivity creation, retains `uiMode` configuration handling, and colours the window after `super.onCreate`. AppCompat drives native appearance on API26+, and Android31+ application night mode informs subsequent OS launch windows. System clears the application override. Window updates run on the main thread without playback commands; API35 uses the existing edge-to-edge underlay.

The native splash uses distinct dark turntable artwork and a charcoal background. React renders the same geometry and palette, retaining Reduce Motion, real initialization progress, error recovery and handoff. Android creates the OS launch window before application code runs: the first launch after upgrading an older installation can still use the previous OS splash preference until bootstrap applies the saved choice. Verify this transition on device; there is no artificial delay.

Sheets retain a stationary fading scrim and independently sliding panel. Their colours update while open, preserving focus return and dismissal. Dark text is checked at 4.5:1 and essential control edges at 3:1. Patterned controls retain full text opacity during dark-mode presses and use a clipped translucent overlay.

The notification-panel music card requests native MediaStyle colourization with a soft lavender surface in Light and a charcoal-lavender surface in Dark. System follows the phone. Preference and configuration changes refresh the card without changing playback or seeking. Android and the phone manufacturer's notification panel control the final opacity and may adjust the supplied colour; custom transparency is not supported by the native media-card API. Candidate theme checks retain notification-shade screenshots and recordings for all six appearance/phone combinations.

## Local verification

Run `npm run check` and `python scripts/media-session.test.py`. Coverage includes six preference/phone combinations, defaults, palette propagation without playback calls, loaded-cover preservation, press clipping, contrast, bootstrap order and splash assets. The production Java helper compiles against recording Android fixtures for API26/31/35 preference and system-bar branches. These fixtures do not replace an Android SDK build or emulator run.

Regenerate artwork with `node scripts/render-branding.cjs`, then rasterize `assets/startup-turntable-dark.svg` to a 512×512 transparent PNG using Inkscape. Light SVG and launcher resources must remain byte-for-byte unchanged.

## Candidate APK verification

The authorized v1.2.6/code9 release is built from merged main. Native compilation, Lint, signature, branding, offline-permission and interaction gates run before publication. The reusable theme workflow then checks API26,31,35; publication depends on every matrix job passing.

The reusable/manual **Check candidate APK themes** workflow takes a candidate build run ID. Its source SHA must equal the workflow revision. It downloads the candidate and installs it on API26,31,35, without building or publishing the application. The independent CI inspector is compiled separately. Screenshots, accessibility trees, startup recordings, logcat and results are retained for 30 days.

Checks cover fresh-install System, all six preference/phone combinations, saved-selection cold starts, seven Browse destinations, search retention, Sound tabs, player, lyrics, playlist/reset dialogs, folder picker, font scaling, rotation and continued playback. The released v1.2.6 APK passed 63 assertions on each of API26/31/35, including applied phone-mode prerequisites and open-sheet palette/font/rotation assertions. [The audit](../verification/TEST_VALIDITY_AUDIT.md) records the exact source, APK checksum and evidence. Dialog/notification/startup screenshots remain review evidence, not complete visual assertions. Run the existing interaction suite too for expanding rails, swipe conflicts, dial rotation/cancellation and clipped press feedback.

For visual review, inspect videos for bright launch frames, scrim translation and press shapes. Check native system bars, notifications and document picker; background/foreground System changes; explicit choices ignoring phone changes; upgrade launches; initialization failure/retry; and Reduce Motion during loading. Confirm a partly scrolled filtered list, queue and custom sound values survive appearance changes.

Expo SDK56 SystemUI is patched by `scripts/fix-expo-system-ui.cjs` to use phone night mode rather than the battery-based automatic fallback. `package.json` forces expo-system-ui to build from source; the native compile gate explicitly compiles that module. Do not remove the patch or source-build setting while this SDK needs it.
