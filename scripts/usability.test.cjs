const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, nodes, h } = require('./ui-harness.cjs');
const flush = () => new Promise(resolve => setImmediate(resolve));
const findText = (tree, text) => nodes(tree).find(n => n.type === 'Pressable' && nodes(n).some(child => child.type === 'Text' && child.children.includes(text)));

test('Sound retains navbar/mini-player, ignores reselect, and restores searched library and Sound section', async () => {
  const navigation = await import('../src/navigation.js');
  const browse = await import('../src/browse.js');
  const { createLibraryIndex } = await import('../src/libraryIndex.js');
  const { formatTime } = await import('../src/music.js');
  const { palette, tones } = await import('../src/design.js');
  const state = { theme: 'Light', queue: [], favorites: [], recent: [], playlists: {}, sort: 'Title', current: { id: 1, title: 'Track', artist: 'Infra' }, sound: {} };
  let darkTheme = false, artDraws = 0;
  const artSamples = [0, .25, .45, .65, .99];
  const commands = [], shared = [];
  const ui = harness('App.js', ['MusicApp'], { useTheme: () => palette(darkTheme), Math: Object.assign(Object.create(Math), { random: () => artSamples[artDraws++] }), ...navigation, ...browse, createLibraryIndex, formatTime, palette, tones, Native: { command: async (...args) => { commands.push(args); return JSON.stringify(state); }, shareSong: async raw => shared.push(JSON.parse(raw)) }, musicStore: { accept: x => x }, soundPreview: { perform: fn => fn() },
    useMusicSlice: () => state, useAppActive: () => true, useStatusPolling() {}, useStableCallback: fn => fn,
    useColorScheme: () => 'light', useWindowDimensions: () => ({ width: 393, height: 852, fontScale: 1 }), Platform: { OS: 'android', Version: 36 }, PermissionsAndroid: { PERMISSIONS: {} }, Alert: { alert() {} } });
  let tree = ui.render('MusicApp');
  // Complete the app's permission/initialization gates without invoking a fake Android service.
  // Indices are found from values, leaving unrelated internal hooks opaque.
  const permission = ui.slots.indexOf(false), ready = ui.slots.indexOf(false, permission + 1);
  ui.slots[permission] = true; ui.slots[ready] = true;
  tree = ui.render('MusicApp');
  const list = () => nodes(tree).find(n => n.type === 'IndexedSongList');
  assert(list());
  const input = nodes(list().props.header).find(n => n.type === 'TextInput'); input.props.onChangeText('infra'); tree = ui.render('MusicApp');
  const before = list().props.sessionKey;
  const navbar = title => nodes(tree).find(n => n.type === 'Pressable' && n.props.accessibilityRole === 'tab' && n.props.key === title);
  navbar('Sound').props.onPress(); tree = ui.render('MusicApp');
  let studio = nodes(tree).find(n => n.type === 'SoundStudio'); assert(studio);
  assert.equal(nodes(tree).filter(n => n.props.accessibilityRole === 'tab').length, 4);
  assert(navbar('Sound').props.accessibilityState.selected);
  assert(nodes(tree).some(n => n.props.accessibilityLabel === 'Open now playing'));
  studio.props.onTab('Output'); studio.props.offsets.Output = 240;
  darkTheme = true; tree = ui.render('MusicApp');
  studio = nodes(tree).find(n => n.type === 'SoundStudio');
  assert.equal(studio.props.tab, 'Output'); assert.equal(studio.props.offsets.Output, 240);
  assert.equal(studio.props.c.bg, '#17191E'); assert.equal(commands.length, 0);
  tree = ui.render('MusicApp'); navbar('Sound').props.onPress(); tree = ui.render('MusicApp');
  studio = nodes(tree).find(n => n.type === 'SoundStudio'); studio.props.onBack(); tree = ui.render('MusicApp');
  assert.equal(list().props.sessionKey, before);
  assert.equal(nodes(list().props.header).find(n => n.type === 'TextInput').props.value, 'infra');
  navbar('Sound').props.onPress(); tree = ui.render('MusicApp'); studio = nodes(tree).find(n => n.type === 'SoundStudio');
  assert.equal(studio.props.tab, 'Output'); assert.equal(studio.props.offsets.Output, 240);
  const pause = nodes(tree).find(n => n.props.accessibilityLabel === 'Play'); await pause.props.onPress();
  assert(nodes(ui.render('MusicApp')).some(n => n.type === 'SoundStudio'), 'transport press must not open the player');
  nodes(tree).find(n => n.props.accessibilityLabel === 'Open now playing').props.onPress(); tree = ui.render('MusicApp');
  assert(!nodes(tree).some(n => n.props.accessibilityRole === 'tab'), 'full player stays immersive');
  nodes(tree).find(n => n.props.testID === 'player-artwork-space').props.onLayout({ nativeEvent: { layout: { width: 300, height: 300 } } });
  tree = ui.render('MusicApp');
  assert.equal(nodes(tree).find(n => n.type === 'PlayingArtwork').props.variant, 'Pulse');
  assert.equal(artDraws, 1, 'navigation, theme and layout changes retain the track animation');
  const previousSong = state.current, previousCommands = commands.length;
  state.current = { ...previousSong, id: 2 }; tree = ui.render('MusicApp');
  assert.equal(nodes(tree).find(n => n.type === 'PlayingArtwork').props.variant, 'Wave', 'a new track randomly selects an animation');
  assert.equal(artDraws, 2);
  assert.equal(commands.length, previousCommands, 'artwork rendering does not issue playback commands');
  state.current = previousSong; tree = ui.render('MusicApp');
  assert.equal(nodes(tree).find(n => n.type === 'PlayingArtwork').props.variant, 'Orbit');
  assert.equal(artDraws, 3);
  state.current = { ...previousSong, id: 3 }; tree = ui.render('MusicApp');
  assert.equal(nodes(tree).find(n => n.type === 'PlayingArtwork').props.variant, 'Equalizer');
  assert.equal(artDraws, 4);
  state.current = { ...previousSong, id: 4 }; tree = ui.render('MusicApp');
  assert.equal(nodes(tree).find(n => n.type === 'PlayingArtwork').props.variant, 'Disc');
  assert.equal(artDraws, 5);
  const beforeLyrics = commands.length;
  nodes(tree).find(n => n.props.accessibilityLabel === 'Lyrics').props.onPress(); tree = ui.render('MusicApp');
  const lyricsSheet = nodes(tree).find(n => n.type === 'Sheet');
  assert(lyricsSheet.props.visible); assert.equal(lyricsSheet.props.title, 'Lyrics');
  assert.equal(lyricsSheet.props.scrollable, false, 'lyrics own a virtualized list instead of nested scrolling');
  assert.equal(nodes(lyricsSheet).find(n => n.type === 'Lyrics').props.song.id, state.current.id);
  assert.equal(nodes(lyricsSheet).find(n => n.type === 'Lyrics').props.key, state.current.id);
  assert.equal(commands.length, beforeLyrics, 'opening lyrics never changes playback');
  darkTheme = false; tree = ui.render('MusicApp');
  const recolouredLyrics = nodes(tree).find(n => n.type === 'Sheet');
  assert.equal(recolouredLyrics.props.visible, true);
  assert.equal(recolouredLyrics.props.c.bg, '#FFFBF6');
  assert.equal(nodes(recolouredLyrics).find(n => n.type === 'Lyrics').props.song.id, state.current.id);
  assert.equal(commands.length, beforeLyrics);
  lyricsSheet.props.onClose(); tree = ui.render('MusicApp');
  assert(nodes(tree).some(n => n.type === 'PlayerProgress'), 'lyrics dismissal preserves the full player');
  nodes(tree).find(n => n.props.accessibilityLabel === 'more-vertical').props.onPress(); tree = ui.render('MusicApp');
  findText(tree, 'Share audio file').props.onPress(); tree = ui.render('MusicApp'); await flush();
  assert.equal(shared.length, 1); assert.equal(shared[0].id, state.current.id);
  assert.equal(commands.length, beforeLyrics, 'sharing never changes playback');
  nodes(tree).find(n => n.props.accessibilityLabel === 'Sleep timer').props.onPress(); tree = ui.render('MusicApp');
  findText(tree, 'Custom minutes').props.onPress(); tree = ui.render('MusicApp');
  assert(nodes(tree).some(n => n.type === 'SleepTimer'), 'custom minutes use the current sheet');
  nodes(tree).find(n => n.type === 'Sheet').props.onClose(); tree = ui.render('MusicApp');
  findText(tree, 'Sound').props.onPress(); tree = ui.render('MusicApp');
  nodes(tree).find(n => n.type === 'SoundStudio').props.onBack(); tree = ui.render('MusicApp');
  assert(nodes(tree).some(n => n.type === 'PlayerProgress'), 'Sound Back restores the originating full player');
});

test('rotary controls keep their UI-thread position free, update the label, preview speed/pitch with correct keys and commit once', async () => {
  const { createSoundPreviewController } = await import('../src/soundPreview.js');
  const events = [];
  const soundPreview = createSoundPreviewController({ cancel: async () => {}, preview: async value => events.push(['preview', value]), commit: async (...args) => events.push(['commit', ...args]) });
  const ui = harness('src/SoundStudio.js', ['Fader', 'liveControl'], { soundPreview, musicStore: { get: () => ({ sound: { bands: Array(10).fill(0) } }) } });
  for (const key of ['speed', 'pitch']) {
    events.length = 0;
    const props = { label: key, value: 1, min: 0, max: 2, c: {}, live: ui.context.exports.liveControl(key, key) };
    let tree = ui.render('Fader', props); ui.effects();
    let slider = nodes(tree).find(n => n.type === 'RotaryKnob');
    slider.props.onSlidingStart(1); slider.props.onValueChange(1.5); await flush(); ui.frames();
    tree = ui.render('Fader', props); slider = nodes(tree).find(n => n.type === 'RotaryKnob');
    assert.equal(slider.props.value, 1, 'React must not reposition the native knob during rotation');
    assert.equal(slider.props.accessibilityValue.now, 1.5);
    assert.deepEqual(JSON.parse(JSON.stringify(events)), [['preview', { [key]: 1.5 }]]);
    await slider.props.onSlidingComplete(1.7);
    assert.deepEqual(JSON.parse(JSON.stringify(events.at(-1))), ['commit', key, { value: 1.7 }]);
  }
});

test('measured search occupies layout space, returns on upward drag and cannot cover A-Z targets', async () => {
  const alphabet = await import('../src/alphabet.js'), geometry = await import('../src/scrollGeometry.js');
  const { scrollMemory, rememberScroll } = await import('../src/navigation.js');
  scrollMemory.clear(); rememberScroll('songs', 900);
  const calls = []; let dismissed = 0, ui;
  ui = harness('src/IndexedSongList.js', ['IndexedSongList'], { ...alphabet, ...geometry, rememberScroll, scrollMemory, clearTimeout, setTimeout,
    Animated: { FlatList: 'FlatList', View: 'AnimatedView' },
    useSharedValue: value => ui.context.useRef({ value }).current,
    // Capture the first UI worklet; reading shared measurements must work even before React rerenders.
    useAnimatedStyle: fn => ({ updater: fn }), useAnimatedScrollHandler: handlers => handlers, runOnJS: fn => fn,
  });
  const props = { data: [{ id: 1, title: 'Alpha' }, { id: 2, title: 'Zebra' }], indexed: true, c: {}, header: h('TextInput'), prelude: h('Actions'), sessionKey: 'songs', rowHeight: 72, onDismissSearch: () => dismissed++, renderItem: ({ item }) => h('SongRow', { item }) };
  let tree = ui.render('IndexedSongList', props);
  const slot = () => nodes(tree).find(n => n.props.testID === 'search-layout-slot');
  const viewport = () => nodes(tree).find(n => n.props.testID === 'indexed-list-viewport');
  const list = () => nodes(tree).find(n => n.type === 'FlatList');
  list().props.ref.current = { scrollToOffset: value => calls.push(['offset', value]), scrollToIndex: value => calls.push(['index', value]) };
  assert(tree.children.indexOf(slot()) < tree.children.indexOf(viewport()), 'search is a layout sibling above the list');
  assert.equal(slot().props.style[0].position, undefined, 'the outer hit rectangle is never an absolute overlay');
  assert.equal(list().props.ListHeaderComponent, undefined, 'no obsolete search spacer remains inside the list');
  const firstWorklet = slot().props.style[1].updater;
  nodes(tree).find(n => n.props.testID === 'search-intrinsic-content').props.onLayout({ nativeEvent: { layout: { height: 200 } } });
  assert.equal(firstWorklet().height, 200, 'a worklet installed before measurement sees the shared height without rerender');
  ui.effects(); ui.frames(); ui.frames();
  tree = ui.render('IndexedSongList', props);
  list().props.onLayout({ nativeEvent: { layout: { height: 500 } } }); list().props.onContentSizeChange(300, 400);
  assert.equal(firstWorklet().height, 200, 'non-scrolling lists keep search visible');
  list().props.onScroll.onScroll({ contentOffset: { y: 0 } });
  list().props.onContentSizeChange(300, 10000); list().props.onScroll.onBeginDrag();
  list().props.onScroll.onScroll({ contentOffset: { y: 100 } });
  assert.equal(firstWorklet().height, 100);
  list().props.onScroll.onScroll({ contentOffset: { y: 1600 } }); assert.equal(firstWorklet().height, 0);
  list().props.onScroll.onScroll({ contentOffset: { y: 1550 } }); assert.equal(firstWorklet().height, 50, 'upward movement reveals search at depth');
  list().props.onScroll.onScroll({ contentOffset: { y: 1300 } }); assert.equal(firstWorklet().height, 200);
  list().props.renderItem({ item: list().props.data[0], index: 0 }).props.onLayout({ nativeEvent: { layout: { height: 120 } } });
  tree = ui.render('IndexedSongList', props);
  assert.equal(list().props.getItemLayout(null, 2).offset, 192, 'row offsets exclude the external search panel');
  const rail = nodes(tree).find(n => typeof n.type === 'function' && n.type.name === 'AlphabetRail');
  rail.props.onJump('A'); assert.equal(firstWorklet().height, 0, 'A-Z jumps hide the search immediately even if no scroll event fires');
  assert.equal(calls.at(-1)[1].viewOffset, 0); assert(dismissed >= 2, 'drag and alphabet jump dismiss editing');
  tree = ui.render('IndexedSongList', { ...props, focused: true }); ui.effects(); assert.equal(firstWorklet().height, 200);
  list().props.onScroll.onBeginDrag(); list().props.onScroll.onScroll({ contentOffset: { y: 1400 } });
  assert.equal(firstWorklet().height, 100, 'drag dismisses a focused input and can hide it');
});

test('polling is screen-scoped, stops in background and never overlaps bridge requests', async () => {
  const { createMusicStore } = await import('../src/stateStore.js');
  const { createSoundPreviewController } = await import('../src/soundPreview.js');
  let resolve, calls = 0; const timers = new Map(); let next = 0;
  const Native = { playbackStatus: () => { calls++; return new Promise(done => { resolve = done; }); } };
  const ui = harness('src/useMusic.js', ['useStatusPolling', 'musicStore'], { Native, createMusicStore, createSoundPreviewController,
    setTimeout: (fn, ms) => { timers.set(++next, { fn, ms }); return next; }, clearTimeout: id => timers.delete(id) });
  const props = { ready: true, active: true, page: 'library', soundTab: 'Tone', timerActive: false };
  ui.render('useStatusPolling', props); ui.effects(); assert.equal(calls, 0);
  ui.render('useStatusPolling', { ...props, page: 'player' }); ui.effects(); assert.equal(calls, 1); assert.equal(timers.size, 0);
  resolve(JSON.stringify({ position: 250, duration: 1000 })); await flush();
  assert.equal(ui.context.exports.musicStore.get('progress').position, 250); assert.equal([...timers.values()][0].ms, 250);
  const task = [...timers.values()][0]; timers.clear(); task.fn(); assert.equal(calls, 2);
  ui.render('useStatusPolling', { ...props, page: 'player', active: false }); ui.effects();
  resolve(JSON.stringify({ position: 500, duration: 1000 })); await flush();
  assert.equal(timers.size, 0); assert.equal(ui.context.exports.musicStore.get('progress').position, 250);
  ui.render('useStatusPolling', { ...props, page: 'sound', soundTab: 'Playback' }); ui.effects(); assert.equal(calls, 2);
  ui.render('useStatusPolling', { ...props, page: 'sound', soundTab: 'Output' }); ui.effects(); assert.equal(calls, 3);
  resolve(JSON.stringify({ position: 750, soundStatus: { peakDb: -12 } })); await flush(); assert.equal([...timers.values()][0].ms, 500);
  ui.render('useStatusPolling', { ...props, page: 'library' }); ui.effects(); assert.equal(timers.size, 0);
});

test('finishing an older slider commit cannot clear a newly started gesture label', async () => {
  let resolve;
  const live = { start: () => ({ active: () => true, preview() {}, cancel: async () => {}, commit: () => new Promise(done => { resolve = done; }) }) };
  const ui = harness('src/SoundStudio.js', ['Fader']); const props = { label: 'Bass', value: 0, min: -12, max: 12, c: {}, live };
  let slider = nodes(ui.render('Fader', props)).find(n => n.type === 'RotaryKnob'); ui.effects();
  slider.props.onSlidingStart(0); const committing = slider.props.onSlidingComplete(1);
  slider.props.onSlidingStart(1); slider.props.onValueChange(2); ui.frames(); resolve(); await committing;
  slider = nodes(ui.render('Fader', props)).find(n => n.type === 'RotaryKnob');
  assert.equal(slider.props.accessibilityValue.now, 2);
});
