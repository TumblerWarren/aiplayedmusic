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
  const commands = [];
  const ui = harness('App.js', ['MusicApp'], { ...navigation, ...browse, createLibraryIndex, formatTime, palette, tones, Native: { command: async (...args) => { commands.push(args); return JSON.stringify(state); } }, musicStore: { accept: x => x }, soundPreview: { perform: fn => fn() },
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

test('UI-thread header and rail share partial collapse geometry, restore scroll and align A-Z jumps', async () => {
  const alphabet = await import('../src/alphabet.js');
  const geometry = await import('../src/scrollGeometry.js');
  const { scrollMemory, rememberScroll } = await import('../src/navigation.js');
  scrollMemory.clear(); rememberScroll('songs', 900);
  let ui;
  const pan = () => { const g = {}; for (const key of ['minDistance', 'maxPointers', 'onBegin', 'onUpdate', 'onFinalize']) g[key] = value => { g[key + 'Value'] = value; return g; }; return g; };
  ui = harness('src/IndexedSongList.js', ['IndexedSongList'], { ...alphabet, ...geometry, rememberScroll, scrollMemory, clearTimeout, setTimeout,
    Animated: { FlatList: 'FlatList', View: 'AnimatedView' }, GestureDetector: 'GestureDetector', Gesture: { Pan: pan },
    useSharedValue: value => ui.context.useRef({ value }).current, useAnimatedRef: () => ui.context.useRef(null),
    useAnimatedStyle: fn => fn(), useAnimatedScrollHandler: handlers => e => handlers.onScroll(e.nativeEvent), runOnJS: fn => fn,
    measure: () => ({ pageY: 104, height: 392 }) });
  const data = [{ id: 1, title: 'Alpha' }, { id: 2, title: 'Zebra' }], calls = [];
  const props = { data, indexed: true, c: { bg: '#ffffff' }, header: h('TextInput'), prelude: h('Actions'), sessionKey: 'songs', rowHeight: 72, renderItem: ({ item }) => h('SongRow', { item }) };
  let tree = ui.render('IndexedSongList', props), list = nodes(tree).find(n => n.type === 'FlatList');
  list.props.ref.current = { scrollToOffset: options => calls.push(['offset', options]), scrollToIndex: options => calls.push(['index', options]) };
  list.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } }); assert.equal(scrollMemory.get('songs'), 900);
  ui.effects(); ui.frames(); ui.frames(); assert.equal(calls[0][1].offset, 900);
  list.props.onLayout({ nativeEvent: { layout: { height: 500 } } }); list.props.onContentSizeChange(300, 400);
  nodes(tree).find(n => n.type === 'AnimatedView' && n.props.onLayout).props.onLayout({ nativeEvent: { layout: { height: 200 } } });
  list.props.renderItem({ item: list.props.data[0], index: 0 }).props.onLayout({ nativeEvent: { layout: { height: 120 } } });
  tree = ui.render('IndexedSongList', props); list = nodes(tree).find(n => n.type === 'FlatList');
  assert.equal(nodes(tree).find(n => n.props.testID === 'alphabet-rail').props.style[1].top, 204, 'short list keeps search visible');
  list.props.onContentSizeChange(300, 10000); list.props.onScrollBeginDrag(); list.props.onScroll({ nativeEvent: { contentOffset: { y: 100 } } });
  tree = ui.render('IndexedSongList', props); list = nodes(tree).find(n => n.type === 'FlatList');
  assert.equal(nodes(tree).find(n => n.props.testID === 'alphabet-rail').props.style[1].top, 104);
  const measuredHeader = nodes(tree).find(n => n.type === 'AnimatedView' && n.props.onLayout && !n.props.testID);
  assert.equal(measuredHeader.props.style[1].transform[0].translateY, -100);
  assert.equal(measuredHeader.props.style[1].height, undefined, 'intrinsic search measurement must not be constrained by its collapsing height');
  assert.equal(tree.props.style.overflow, 'hidden', 'the viewport clips the translated header above the list');
  assert.equal(list.props.getItemLayout(null, 2).offset, 392);
  nodes(tree).find(n => n.props.accessibilityLabel === 'Jump to Z').props.onPress();
  assert.equal(calls.at(-1)[1].index, 2); assert.equal(calls.at(-1)[1].viewOffset, 0);
  tree = ui.render('IndexedSongList', { ...props, focused: true });
  assert.equal(nodes(tree).find(n => n.props.testID === 'alphabet-rail').props.style[1].top, 204);
  list.props.onScroll({ nativeEvent: { contentOffset: { y: 222 } } }); assert.equal(scrollMemory.get('songs'), 222);
  tree = ui.render('IndexedSongList', { ...props, prelude: null, sessionKey: 'filtered-songs' });
  list = nodes(tree).find(n => n.type === 'FlatList');
  assert.equal(list.props.getItemLayout(null, 0).offset, 200, 'removing a folder prelude must remove its measured height from song offsets');
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
