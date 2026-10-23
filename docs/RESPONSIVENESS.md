# Responsiveness and navigation

The Sound page keeps the mini-player and four navigation destinations visible. Selecting Sound again preserves its return destination. Each Sound section keeps its own scroll offset; navigating back restores the original screen, collection and search. Mini-player transport controls are independent of the area that opens Now Playing.

## Implementation

- Main state, playback progress and DSP meters have independent subscriptions. Native snapshots use monotonic sequence numbers; stale command/status responses cannot roll back newer state. Queue/settings objects retain identity when unchanged.
- Full snapshots run on initialization, state broadcasts, commands and foreground restoration. There is no periodic full-snapshot timer. Player progress uses a lightweight 250 ms request; Sound Tone/Output meters use 500 ms; Sound Playback uses 1 s only while its sleep timer is active. Polls never overlap and stop in the background. Other pages rely on state events.
- Library sorting, normalized search strings, ID lookup, grouping and folder trees are cached for the current scan. Search text updates immediately while React can defer expensive result updates. Song rows and artwork are memoized; progress and meters update their own leaf components.
- Search/categories use React Native's sticky list header with `stickyHeaderHiddenOnScroll`. Native scrolling translates the header without changing the list viewport on every frame. Focus pins search; short lists retain the header. A transparent surface and gradient soften the sticky header and viewport edges. A–Z jumps include measured header/shortcut offsets and font-scaled row height. The rail stays clear of header controls and hides when there is insufficient vertical space. List offsets are remembered per route and search (bounded to 80 entries).
- One provider owns app visibility/reduced-motion listeners. Bars, artwork glow/orbit and play ripple retain native-driver animations and pause when inactive or reduced motion is requested.
- Live Sound gestures coalesce temporary patches to at most 20 per second with one bridge request in flight. The rotary indicator moves on the UI thread; labels update at animation-frame cadence. Release commits the exact final value once. Pending EQ patches resolve against the preceding committed bands. Navigation, backgrounding, preset/reset commands and errors cancel previews. Serialized cancellation prevents late requests from undoing subsequent gestures. Temporary previews do not save preferences, publish full snapshots or rebuild notifications.
- The native five-second checkpoint stores only position/index. Queue JSON is saved on replacement, enqueue, remove or reorder; existing preference keys and saved settings remain compatible.

## Validation

`npm run check` runs pure state/selector and preview scheduling tests, a lightweight VM harness for actual UI callbacks, and the existing Java DSP suites. The UI harness exercises real component functions without pretending to be an Android renderer. It covers Sound footer/reselection/return paths, search/section retention, independent mini-player transport, control preview/commit keys, native sticky-header configuration, scroll restoration and A–Z offsets. The active cached selectors are checked against explicit fixture scopes and ordering using 10,000 tracks.

GitHub additionally installs the actual Expo/RN dependencies, checks SDK compatibility, generates Android, compiles Kotlin/Java, builds the release APK, runs Android Lint and verifies its signature, version, launcher/name and offline permission policy.

These checks do not measure phone frame timing or establish audible quality. The released APK passed emulator behavior checks, but physical-device performance measurements remain pending; the targets below are acceptance criteria, not reported results.

## Device comparison to complete

Compare the current release and a retained baseline on the same phone, refresh rate, settings and media library. Use both the reported 930-track library and a 10,000-track library. Test release builds after scanning finishes, then repeat during scanning. Perform three runs per scenario after a warm-up:

1. Scroll down/up through Songs, Albums, Artists and nested SD-card folders. Type and clear searches, use A–Z at normal and large font sizes, and exercise short/empty results with keyboard focus.
2. Switch Library → Sound → Output → Library repeatedly while playing. Verify footer selection, mini-player actions, restored query/list position and section offsets. From Now Playing open Sound and use both Back controls.
3. Rotate every EQ, gain, balance, width, speed and pitch dial for ten seconds; release, switch sections mid-gesture, choose a preset/reset, background the app and return. Confirm the last committed settings after a process restart. Listen for transitions and check media controls/sleep timer.
4. Record a Perfetto trace with FrameTimeline, app main/RenderThread scheduling and CPU activity. Use React DevTools profiling in a development build to confirm progress ticks do not commit the library/Sound screen tree. Avoid using development FPS as the release performance result.
5. Reset and capture `adb shell dumpsys gfxinfo app.localmusic.player reset`, perform a scenario, then save `adb shell dumpsys gfxinfo app.localmusic.player framestats`. Use Perfetto for refresh-rate-aware frame deadlines and tap-to-feedback latency. Capture Android Studio CPU/memory traces to compare allocation during polling and long dial gestures. Check that no polling or decorative motion continues in the background.

Targets: visible control feedback below 100 ms and at least 95% of frames meeting the phone's refresh deadline. Record measured p50/p95 latency, missed deadlines, allocations and any audible faults for both versions. If a target fails, retain the trace and fix the measured bottleneck before claiming it resolved.

## Primary references

- [React Native performance](https://reactnative.dev/docs/performance), [FlatList tuning](https://reactnative.dev/docs/optimizing-flatlist-configuration), [ScrollView sticky headers](https://reactnative.dev/docs/scrollview#stickyheaderhiddenonscroll)
- [React useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore), [useDeferredValue](https://react.dev/reference/react/useDeferredValue)
- [Native slider behavior](https://github.com/callstack/react-native-slider#properties)
- [Android slow rendering and FrameTimeline](https://developer.android.com/topic/performance/vitals/render)
- [Media3 threading](https://developer.android.com/media/media3/exoplayer/hello-world#a-note-on-threading)
