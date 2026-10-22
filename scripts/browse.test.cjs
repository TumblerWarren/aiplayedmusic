const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, nodes } = require('./ui-harness.cjs');

test('all seven Browse destinations select, dismiss and independently restore search/scroll without playback commands', async () => {
  const browse = await import('../src/browse.js'), navigation = await import('../src/navigation.js');
  const { createLibraryIndex } = await import('../src/libraryIndex.js');
  const { formatTime } = await import('../src/music.js');
  const { palette, tones } = await import('../src/design.js');
  const commands = [], state = { theme: 'Light', queue: [], favorites: [], recent: [], playlists: {}, sort: 'Title', current: { id: 1, title: 'Playing', artist: 'Artist' }, sound: {} };
  const ui = harness('App.js', ['MusicApp'], { ...browse, ...navigation, createLibraryIndex, formatTime, palette, tones,
    Native: { command: async (action, raw) => { commands.push({ action, data: JSON.parse(raw) }); return JSON.stringify(state); } }, musicStore: { accept: x => x }, soundPreview: { perform: fn => fn() }, useMusicSlice: () => state, useAppActive: () => true, useStatusPolling() {}, useStableCallback: fn => fn, useColorScheme: () => 'light', useWindowDimensions: () => ({ width: 393, height: 852, fontScale: 1 }), Platform: { OS: 'android', Version: 36 }, PermissionsAndroid: { PERMISSIONS: {} }, Alert: { alert() {} } });
  let tree = ui.render('MusicApp');
  const permission = ui.slots.indexOf(false), ready = ui.slots.indexOf(false, permission + 1); ui.slots[permission] = ui.slots[ready] = true;
  const render = () => tree = ui.render('MusicApp'); render();
  const button = label => nodes(tree).find(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
  const list = () => nodes(tree).find(n => n.type === 'IndexedSongList');
  const input = () => nodes(list().props.header).find(n => n.type === 'TextInput');
  const open = () => { button('+ Browse').props.onPress(); render(); return nodes(tree).find(n => n.type === 'Sheet' && n.props.visible); };
  const choose = title => { const sheet = open(); nodes(sheet).find(n => n.props.accessibilityLabel === title).props.onPress(); render(); };
  const sessions = {};
  for (const [i, [title]] of browse.destinations.entries()) {
    choose(title); assert(!nodes(tree).find(n => n.type === 'Sheet').props.visible);
    input().props.onChangeText('query-' + i); render();
    sessions[title] = list().props.sessionKey; navigation.rememberScroll(sessions[title], 200 + i * 72);
    const sheet = open(), options = nodes(sheet).filter(n => n.props.accessibilityState?.selected !== undefined);
    assert.equal(options.length, 7); assert.equal(options.filter(n => n.props.accessibilityState.selected).length, 1);
    assert.equal(options.find(n => n.props.accessibilityState.selected).props.accessibilityLabel, title);
    options.find(n => n.props.accessibilityLabel === title).props.onPress(); render();
    assert.equal(list().props.sessionKey, sessions[title]);
    const again = open(); again.props.onClose(); render(); assert.equal(list().props.sessionKey, sessions[title]);
    assert(button('+ Browse'), 'trigger stays outside the collapsing list header');
    assert(nodes(tree).some(n => n.props.accessibilityLabel === 'Open now playing'));
    assert.equal(nodes(tree).filter(n => n.props.accessibilityRole === 'tab').length, 4, 'only the bottom navbar remains');
  }
  for (const [i, [title]] of browse.destinations.entries()) {
    choose(title); assert.equal(input().props.value, 'query-' + i); assert.equal(list().props.sessionKey, sessions[title]);
    assert.equal(navigation.scrollMemory.get(sessions[title]), 200 + i * 72);
  }
  assert.deepEqual(commands, []);
  choose('Playlists'); input().props.onChangeText(''); render();
  const creates = () => [list().props.header, list().props.data.length ? list().props.prelude : list().props.ListEmptyComponent].flatMap(nodes).filter(n => n.type==='Pressable' && nodes(n).some(x=>x.type==='Text' && x.children.includes('New playlist')));
  assert.equal(creates().length,1,'empty playlists expose one central create action');
  state.playlists={Example:[]};render();assert.equal(list().props.data.length,1);assert.equal(creates().length,1,'populated playlists still expose exactly one create action');
  const tabs=nodes(tree).filter(n=>n.props.accessibilityRole==='tab'),patterns=[],colours=[];
  for(const tab of tabs){
    assert.equal(tab.props.android_ripple,undefined,'device-specific ripple masks cannot create rectangular navbar feedback');
    const pressed=tab.children[0]({pressed:true}),highlight=nodes(pressed).find(n=>n.type==='TabHighlight');
    patterns.push(highlight.props.tone.pattern);colours.push(highlight.props.tone.bg);
    assert(tab.props.style({pressed:true})[0].borderRadius>=28);
  }
  assert.equal(new Set(patterns).size,4);assert.equal(new Set(colours).size,4);
  choose('Folders'); input().props.onChangeText(''); render();
  const hasChooseFolder = content => nodes(content).some(n => n.children.includes('Choose folder'));
  assert(!hasChooseFolder(list().props.prelude), 'folder roots have no selection shortcut');
  assert(!nodes(list().props.prelude).some(n => n.type === 'Switch'), 'folder roots have no subfolder toggle');
  assert.equal(list().props.header.type, 'TextInput', 'only search occupies the collapsing header');
  assert(nodes(list().props.prelude).some(n => n.props.accessibilityLabel === 'Sort by name'), 'folder controls stay in normal list flow');
  assert(!hasChooseFolder(list().props.ListEmptyComponent), 'empty folders direct users to Settings');
  state.musicRoots = ['/storage/emulated/0/Music']; render();
  const folderRow = list().props.renderItem({ item: list().props.data[0] });
  folderRow.props.onPress(); render();
  assert(!hasChooseFolder(list().props.prelude), 'nested folders keep playback controls without a picker shortcut');
  assert(!nodes(list().props.prelude).some(n => n.type === 'Switch'), 'nested folders have no subfolder toggle or empty row');
  assert(nodes(list().props.prelude).some(n => n.children.includes('Play folder · 0 songs')), 'folder playback remains available');
  assert.equal(list().props.header.type, 'TextInput', 'nested folders do not reserve header space for playback controls');
  nodes(tree).find(n => n.props.accessibilityRole === 'tab' && n.props.key === 'Settings').props.onPress(); render();
  button('Choose folder').props.onPress(); render();
  const picker = nodes(tree).find(n => n.type === 'FolderPicker');
  assert(picker, 'Settings retains folder selection');
  picker.props.onClose(); render();
  assert(button('Choose folder'), 'closing the picker returns to Settings');
  assert.deepEqual(commands, [], 'opening or dismissing folder selection leaves playback unchanged');
  const subfolderSwitch = () => nodes(tree).filter(n => n.type === 'Switch' && n.props.accessibilityLabel === 'Include subfolders when playing');
  assert.equal(subfolderSwitch().length, 1, 'Settings contains the only subfolder toggle');
  for (const value of [true, false]) {
    state.includeSubfolders = !value; render();
    assert.equal(subfolderSwitch()[0].props.value, !value);
    await subfolderSwitch()[0].props.onValueChange(value);
    assert.deepEqual(commands.at(-1), { action: 'includeSubfolders', data: { value } });
    state.includeSubfolders = value; render();
    assert.equal(subfolderSwitch()[0].props.value, value);
  }
});

test('displayed names and normalized A-Z sections use the same order, including folders', async () => {
  const { compareNames, displayFolder } = await import('../src/browse.js');
  const { alphabetTargets } = await import('../src/alphabet.js');
  const data = ['Zebra', 'Élan', '7 track', 'apple', 'Álbum'].sort(compareNames).map(title => ({ title }));
  assert.deepEqual(data.map(x => x.title), ['7 track', 'Álbum', 'apple', 'Élan', 'Zebra']);
  assert.deepEqual(alphabetTargets(data), { '#': 0, A: 1, E: 3, Z: 4 });
  assert.equal(displayFolder('/storage/emulated/0'), 'Internal storage');
  assert.equal(displayFolder('/storage/0123/Music/Álbum'), 'Álbum');
});

test('rail geometry stays synchronized at partial collapse, padding, rotation, focus and large header sizes', async () => {
  const { headerRemaining, railFraction } = await import('../src/scrollGeometry.js');
  for (const header of [88, 160, 260]) for (const viewport of [300, 740]) for (const offset of [0, 20, 70, 400]) {
    const top = headerRemaining(offset, header) + 4, height = viewport - top - 4;
    assert.equal(headerRemaining(offset, header), Math.max(0, header - offset));
    assert.equal(railFraction(top + 4, top, height), 0);
    assert(railFraction(top + height - 4, top, height) > 0.99);
    assert.equal(headerRemaining(offset, header, true), header);
    assert.equal(headerRemaining(offset, header, false, false), header);
  }
});

test('multitouch and cancellation remain invalid until a new swipe begins; transport buttons are outside the surface', async () => {
  const swipe = await import('../src/swipe.js');
  const ui = harness('src/SwipeSurface.js', ['SwipeSurface'], { ...swipe, PanResponder: { create: handlers => ({ panHandlers: handlers }) } });
  const calls = [], tree = ui.render('SwipeSurface', { enabled: true, onAction: value => calls.push(value) }), g = tree.props;
  const event = count => ({ nativeEvent: { touches: Array(count).fill({}) } });
  g.onStartShouldSetPanResponderCapture(event(1));
  assert.equal(g.onMoveShouldSetPanResponderCapture(event(2), { dx: -80, dy: 0, numberActiveTouches: 2 }), false);
  assert.equal(g.onMoveShouldSetPanResponderCapture(event(1), { dx: -80, dy: 0, numberActiveTouches: 1 }), false);
  g.onPanResponderRelease(event(0), { dx: -90, dy: 0, numberActiveTouches: 0 }); assert.deepEqual(calls, []);
  g.onStartShouldSetPanResponderCapture(event(1)); g.onPanResponderTerminate(); g.onPanResponderRelease(event(0), { dx: -90, dy: 0 }); assert.deepEqual(calls, []);
  g.onStartShouldSetPanResponderCapture(event(1)); g.onPanResponderRelease(event(0), { dx: -90, dy: 0 }); assert.deepEqual(calls, ['next']);
});

test('Browse sheet exposes Close, outside and Android Back dismissal; its handle ignores cancelled and multitouch drags', () => {
  class Value { setValue(value) { this.value=value; } interpolate(config) { return { value: this, config }; } }
  const closed=[];
  const ui=harness('src/Sheet.js',['Sheet'],{
    Animated:{ Value, View:'AnimatedView', add:(a,b)=>({a,b}), spring:()=>({start(){}}) },
    PanResponder:{ create:handlers=>({panHandlers:handlers}) }, useMotionAllowed:()=>false,
    useWindowDimensions:()=>({height:800}), setTimeout, clearTimeout,
  });
  const content={type:'Pressable',props:{onPress:()=>{}},children:[]};
  const tree=ui.render('Sheet',{visible:true,title:'Browse',c:{},onClose:()=>closed.push(true),children:content});
  nodes(tree).find(n=>n.type==='Modal').props.onRequestClose();
  nodes(tree).find(n=>n.props.accessibilityLabel==='Close').props.onPress();
  nodes(tree).find(n=>n.props.accessibilityLabel==='Close sheet').props.onPress();
  const handle=nodes(tree).find(n=>n.props.accessibilityLabel==='Drag down to close').props;
  assert.equal(handle.onStartShouldSetPanResponder(null,{numberActiveTouches:1}),true);
  handle.onPanResponderGrant(null,{numberActiveTouches:2});handle.onPanResponderRelease(null,{dy:90,dx:0});assert.equal(closed.length,3);
  assert.equal(handle.onMoveShouldSetPanResponder(null,{dy:20,dx:0,numberActiveTouches:1}),true);
  assert.equal(handle.onMoveShouldSetPanResponder(null,{dy:20,dx:40,numberActiveTouches:1}),false);
  handle.onPanResponderGrant();handle.onPanResponderMove(null,{dy:80,numberActiveTouches:2});handle.onPanResponderRelease(null,{dy:90,dx:0});
  assert.equal(closed.length,3);
  handle.onPanResponderGrant();handle.onPanResponderTerminate();handle.onPanResponderRelease(null,{dy:90,dx:0});assert.equal(closed.length,3);
  handle.onPanResponderGrant();handle.onPanResponderRelease(null,{dy:90,dx:0});assert.equal(closed.length,4);
  content.props.onPress();assert.equal(closed.length,4,'row content is not wrapped in a dismiss handler');
});

test('Android folder picker mounts a gesture root inside its native Modal', () => {
  const ui=harness('src/FolderPicker.js',['FolderPicker'],{folderChoices:()=>[], storageRoot:()=>null, Icon:'Icon'});
  const root=ui.render('FolderPicker',{c:{},roots:[],onClose(){},onSelect(){}});
  assert.equal(root.type,'Modal'); assert.equal(root.children[0].type,'GestureHandlerRootView');
});
