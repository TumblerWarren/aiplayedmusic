const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { harness, nodes, palette } = require('./ui-harness.cjs');
const json = value => JSON.parse(JSON.stringify(value));

test('About cards open themed panels, show the current version and do not invoke Android alerts', async () => {
  const browse = await import('../src/browse.js'), navigation = await import('../src/navigation.js');
  const { createLibraryIndex } = await import('../src/libraryIndex.js');
  const { formatTime } = await import('../src/music.js');
  const { tones } = await import('../src/design.js');
  for (const dark of [false, true]) {
    const c = palette(dark), commands = [], alerts = [], opened = [];
    const state = { theme: dark ? 'Dark' : 'Light', queue: [], favorites: [], recent: [], playlists: {}, sort: 'Title', speed: 1, sound: {} };
    const ui = harness('App.js', ['MusicApp'], { ...browse, ...navigation, createLibraryIndex, formatTime, palette, tones,
      useTheme: () => c, Native: { clearListeningHistory: async () => commands.push('clear'), snapshot: async () => JSON.stringify(state) },
      musicStore: { accept: x => x }, soundPreview: { perform: fn => fn() }, useMusicSlice: () => state,
      useAppActive: () => true, useStatusPolling() {}, useStableCallback: fn => fn,
      useWindowDimensions: () => ({ width: 393, height: 852, fontScale: 1.6 }), Platform: { OS: 'android', Version: 35 },
      PermissionsAndroid: { PERMISSIONS: {} }, Alert: { alert: (...args) => alerts.push(args) }, Linking: { openSettings: async () => opened.push(true) } });
    let tree = ui.render('MusicApp');
    const permission = ui.slots.indexOf(false), ready = ui.slots.indexOf(false, permission + 1);
    ui.slots[permission] = ui.slots[ready] = true;
    const render = () => tree = ui.render('MusicApp'); render();
    const button = title => nodes(tree).find(n => n.type === 'Pressable' && n.props.accessibilityLabel === title) || nodes(tree).find(n => n.type === 'Pressable' && nodes(n).some(child => child.type === 'Text' && child.children.includes(title)));
    button('Settings').props.onPress(); render();
    for (const [label, kind] of [['Aiplayed', 'about'], ['App permissions', 'permissions'], ['Clear listening history', 'history']]) {
      button(label).props.onPress(); render();
      const panel = nodes(tree).find(n => n.type === 'SettingsDetails');
      assert.equal(panel.props.kind, kind); assert.equal(panel.props.c, c);
      assert.equal(panel.props.version, require('../package.json').version);
      assert.deepEqual(commands, [], 'opening history is not confirmation');
      if (kind === 'permissions') { assert.equal(opened.length, 0); await panel.props.onOpenSettings(); assert.equal(opened.length, 1); }
      panel.props.onClose(); render();
      assert.equal(nodes(tree).find(n => n.type === 'Sheet').props.visible, false);
    }
    assert.deepEqual(alerts, []);
    button('Clear listening history').props.onPress(); render();
    const oldHistory = nodes(tree).find(n => n.type === 'SettingsDetails');
    await oldHistory.props.onClearHistory(); assert.deepEqual(commands, ['clear']);
    oldHistory.props.onClose(); render();
    button('Aiplayed').props.onPress(); render();
    oldHistory.props.onClose(); render();
    assert.equal(nodes(tree).find(n => n.type === 'SettingsDetails').props.kind, 'about', 'a late close cannot dismiss a different panel');
    nodes(tree).find(n => n.type === 'SettingsDetails').props.onClose(); render();
    button('Sleep timer').props.onPress(); render();
    const off = button('Off');
    assert.equal(off.props.accessibilityState.selected, true);
    assert.equal(off.props.style[1].backgroundColor, c.accent);
    assert.equal(nodes(off).find(n => n.type === 'Text').props.style[1][1].color, c.onAccent);
    assert.equal(button('15 minutes').props.style[1].backgroundColor, c.mint);
  }
});

test('history confirmation is explicit, single-flight, retryable and cannot close a replacement after unmount', async () => {
  const c = palette(true);
  let finish, calls = 0, closed = 0;
  const ui = harness('src/SettingsDetails.js', ['SettingsDetails']);
  const props = { kind: 'history', c, onClose: () => closed++, onClearHistory: () => { calls++; return new Promise(resolve => { finish = resolve; }); } };
  let tree = ui.render('SettingsDetails', props); ui.effects();
  const button = title => nodes(tree).find(n => n.props.accessibilityLabel === title);
  button('Cancel').props.onPress(); assert.equal(calls, 0); assert.equal(closed, 1);
  const first = button('Clear history').props.onPress(); button('Clear history').props.onPress(); assert.equal(calls, 1);
  finish(undefined); await first; tree = ui.render('SettingsDetails', props);
  assert(nodes(tree).some(n => n.props.accessibilityRole === 'alert')); assert.equal(closed, 1);
  const second = button('Clear history').props.onPress(); finish({}); await second;
  assert.equal(calls, 2); assert.equal(closed, 2);
  const late = button('Clear history').props.onPress(); ui.slots.forEach(slot => slot?.cleanup?.()); finish({}); await late;
  assert.equal(closed, 2);
});

test('About copy is factual and permissions remain an explicit system-settings action', async () => {
  for (const dark of [false, true]) {
    const c = palette(dark), ui = harness('src/SettingsDetails.js', ['SettingsDetails']);
    const about = ui.render('SettingsDetails', { kind: 'about', version: '9.8.7', c });
    const copy = nodes(about).filter(n => n.type === 'Text').flatMap(n => n.children).join(' ');
    assert.match(copy, /Version 9.8.7/); assert.match(copy, /audio stored on your phone/); assert.doesNotMatch(copy, /Mi Music|Xiaomi/);
    let calls = 0;
    const permissions = ui.render('SettingsDetails', { kind: 'permissions', c, onClose() {}, onOpenSettings: async () => { calls++; } });
    const open = nodes(permissions).find(n => n.props.accessibilityLabel === 'Open Android settings');
    assert.equal(calls, 0); assert.equal(open.props.style.backgroundColor, c.accent);
    await open.props.onPress(); assert.equal(calls, 1);
  }
});

test('all appearance/phone combinations, missing and existing preferences resolve before initialization', async () => {
  const { themePreference, themeIsDark, initialTheme } = await import('../src/theme.js');
  for (const system of ['light', 'dark']) for (const preference of ['System', 'Light', 'Dark']) {
    assert.equal(themeIsDark(preference, system), preference === 'Dark' || (preference === 'System' && system === 'dark'));
    assert.equal(initialTheme({ getThemePreference: () => preference }), preference);
  }
  for (const invalid of [undefined, null, '', 'DARK', 3]) {
    assert.equal(themePreference(invalid), 'System');
    assert.equal(initialTheme({ getThemePreference: () => invalid }), 'System');
    assert.equal(themeIsDark(invalid, 'dark'), true);
  }
  assert.equal(initialTheme(null), 'System');
  assert.equal(initialTheme({ getThemePreference() { throw Error('not connected'); } }), 'System');
});

test('provider changes colours in place and only updates window appearance, with no playback commands', async () => {
  const theme = await import('../src/theme.js');
  let preference = 'System', system = 'dark'; const calls = [];
  const ui = harness('src/ThemeProvider.js', ['ThemeProvider'], {
    ...theme, createContext: value => ({ Provider: 'ThemeContext', value }),
    useMusicSlice: () => ({ theme: preference }), useColorScheme: () => system,
    SystemUI: { setBackgroundColorAsync: async color => calls.push(['background', color]) },
    Native: { setWindowAppearance: async dark => calls.push(['window', dark]), command() { throw Error('theme issued a playback command'); } },
  });
  const child = { type: 'stable-player', children: [], props: {} };
  let tree = ui.render('ThemeProvider', { children: child }); ui.effects();
  assert.equal(tree.props.value.bg, '#17191E'); assert.equal(tree.children[0], child);
  const darkColours = tree.props.value;
  tree = ui.render('ThemeProvider', { children: child }); ui.effects();
  assert.equal(tree.props.value, darkColours, 'unrelated playback updates reuse the palette');
  assert.equal(calls.length, 2);
  system = 'light'; tree = ui.render('ThemeProvider', { children: child }); ui.effects();
  assert.equal(tree.props.value.bg, '#FFFBF6');
  preference = 'Dark'; tree = ui.render('ThemeProvider', { children: child }); ui.effects();
  assert.equal(tree.props.value.bg, '#17191E'); assert.equal(tree.children[0], child);
  preference = 'Light'; system = 'dark'; tree = ui.render('ThemeProvider', { children: child }); ui.effects();
  assert.equal(tree.props.value.bg, '#FFFBF6');
  ui.context.Native = null; preference = 'System'; ui.render('ThemeProvider', { children: child }); ui.effects();
  await Promise.resolve();
});

test('memoized album artwork recolours its placeholder without resetting the loaded original cover', () => {
  let c = palette(false);
  const ui = harness('src/Artwork.js', ['Artwork'], { useTheme: () => c });
  const props = { song: { id: 1, albumId: 73 }, size: 140 };
  let tree = ui.render('Artwork', props); ui.effects();
  nodes(tree).find(n => n.type === 'Image').props.onLoad();
  tree = ui.render('Artwork', props);
  assert(!nodes(tree).some(n => n.type === 'FallbackArt'));
  c = palette(true); tree = ui.render('Artwork', props); ui.effects(); tree = ui.render('Artwork', props);
  const image = nodes(tree).find(n => n.type === 'Image');
  assert.equal(tree.props.style.backgroundColor, c.lavender);
  assert.equal(image.props.source.uri, 'content://media/external/audio/albumart/73');
  assert.equal(image.props.style.opacity, 1); assert.equal(image.props.style.tintColor, undefined);
  image.props.onError(); tree = ui.render('Artwork', props);
  assert(nodes(tree).some(n => n.type === 'FallbackArt'));
  c = palette(false); tree = ui.render('Artwork', props); ui.effects();
  assert(!nodes(tree).some(n => n.type === 'Image'), 'a colour change must not retry a failed cover');
});

test('dark round press feedback and decorative artwork share the current palette', () => {
  let c = palette(true);
  const flatten = style => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};
  const press = harness('src/RoundedPressable.js', ['RoundedPressable'], { useTheme: () => c, NativePressable: 'NativePressable', StyleSheet: { flatten } });
  const props = { style: { width: 72, height: 72, borderRadius: 36 }, hitSlop: 8 };
  let tree = press.render('RoundedPressable', props);
  assert.equal(tree.props.hitSlop, 8); assert.equal(flatten(tree.props.style({ pressed: true })).overflow, 'hidden');
  let overlay = nodes(tree.children[0]({ pressed: true })).find(n => n.type === 'View');
  assert.equal(overlay.props.style.backgroundColor, c.press); assert.equal(overlay.props.style.borderRadius, 36);
  c = palette(false); tree = press.render('RoundedPressable', props);
  overlay = nodes(tree.children[0]({ pressed: true })).find(n => n.type === 'View');
  assert.equal(overlay.props.style.backgroundColor, '#7353BB18');
  const art = harness('src/Pastel.js', ['FallbackArt', 'TabHighlight'], { useTheme: () => c, Svg: 'Svg', G: 'G', Rect: 'Rect', Path: 'Path', Circle: 'Circle' });
  const light = json(art.render('FallbackArt', { size: 52, seed: 1 }));
  c = palette(true); const dark = json(art.render('FallbackArt', { size: 52, seed: 1 }));
  assert.notEqual(light.children[0].props.fill, dark.children[0].props.fill);
  assert.equal(dark.children[0].props.fill, c.fallbackPalettes[1][0]);
  tree = art.render('TabHighlight', { tone: { bg: c.mint, ink: c.mintInk, detail: c.peachInk, pattern: 'waves' } });
  assert.equal(nodes(tree).find(n => n.type === 'G').props.opacity, .4);
  assert.equal(nodes(tree).filter(n => n.type === 'Path').length, 2);
});

const rgb = hex => hex.slice(1, 7).match(/../g).map(x => parseInt(x, 16));
const luminance = hex => rgb(hex).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
const mix = (front, back, alpha) => '#' + rgb(front).map((v, i) => Math.round(v * alpha + rgb(back)[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('');
test('charcoal text meets 4.5:1 and essential controls meet 3:1, including patterned pressed states', () => {
  const c = palette(true);
  for (const bg of [c.bg, c.header, c.card, c.sheet, c.lavender, c.mint, c.peach, c.blue, c.lemon, c.rose]) {
    for (const fg of [c.ink, c.muted]) assert(contrast(fg, bg) >= 4.5, `${fg}/${bg}`);
    for (const fg of [c.accent, c.track, c.controlBorder]) assert(contrast(fg, bg) >= 3, `${fg}/${bg}`);
  }
  for (const name of ['purple', 'mint', 'peach', 'blue', 'lemon', 'rose']) {
    const bg = c[name === 'purple' ? 'lavender' : name], ink = c[name + 'Ink'];
    assert(contrast(ink, bg) >= 4.5);
    // Worst decorative arc overlap, then the translucent white press overlay.
    const patterned = mix(ink, bg, .3 * c.patternStrength);
    assert(contrast(ink, patterned) >= 4.5, name + ' pattern');
    assert(contrast(ink, mix('#FFFFFF', patterned, 8 / 255)) >= 4.5, name + ' pressed pattern');
  }
  assert(contrast(c.onAccent, c.accent) >= 4.5);
});

test('header overlays preserve readable text in both themes and cannot intercept controls', () => {
  for (const dark of [false, true]) {
    const c = palette(dark);
    const ui = harness('src/Pastel.js', ['HeaderOverlay'], { useTheme: () => c });
    const tree = ui.render('HeaderOverlay');
    assert.equal(tree.props.pointerEvents, 'none');
    assert.equal(tree.props.importantForAccessibility, 'no-hide-descendants');
    assert(contrast(c.headerLine, c.header) >= 3, 'header boundary remains visible');
    assert(contrast(c.onAccent, c.accent) >= 4.5, 'solid Browse text remains readable');
    const wash = mix(c.mintInk, c.header, .09);
    const overlap = mix(c.mintInk, wash, .12);
    for (const bg of [c.header, wash, overlap]) {
      assert(contrast(c.ink, bg) >= 4.5, `header text ${c.ink}/${bg}`);
      assert(contrast(c.accent, bg) >= 3, 'header controls remain visible');
    }
  }
});

test('theme bootstrap preserves activity configuration and Expo splash order and is idempotent', () => {
  let activityMod, manifestMod;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync('plugins/withThemeBootstrap.js', 'utf8'), { module, require: () => ({
    withMainActivity: (config, fn) => { activityMod = fn; return config; },
    withAndroidManifest: (config, fn) => { manifestMod = fn; return config; },
  }) });
  module.exports({});
  const source = 'override fun onCreate(savedInstanceState: Bundle?) {\n setTheme(R.style.AppTheme)\n SplashScreenManager.registerOnActivity(this)\n super.onCreate(null)\n}';
  const mod = { modResults: { language: 'kt', contents: source } };
  activityMod(mod); const patched = mod.modResults.contents; activityMod(mod);
  assert.equal(mod.modResults.contents, patched);
  assert(patched.indexOf('restoreBeforeCreate(this)') < patched.indexOf('setTheme('));
  assert(patched.indexOf('restoreBeforeCreate(this)') < patched.indexOf('SplashScreenManager.register'));
  assert(patched.indexOf('restoreAfterCreate(this)') > patched.indexOf('super.onCreate(null)'));
  const legacy = patched.replace('restoreAfterCreate(this)', 'applyWindow(this)');
  assert.equal(module.exports.patchActivity(legacy), patched, 'existing generated projects migrate the old post-create hook');
  const activity = { $: { 'android:name': '.MainActivity', 'android:configChanges': 'orientation|screenSize' } };
  manifestMod({ modResults: { manifest: { application: [{ activity: [activity] }] } } });
  manifestMod({ modResults: { manifest: { application: [{ activity: [activity] }] } } });
  assert.equal(activity.$['android:configChanges'], 'orientation|screenSize|uiMode');
  assert.throws(() => module.exports.patchActivity('unknown template'), /Cannot install/);
});

test('native splash has distinct dark artwork and matches the React launch palette without changing launcher assets', () => {
  const config = require('../app.config').expo;
  const splash = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')[1];
  const c = palette(true);
  assert.equal(config.userInterfaceStyle, 'automatic');
  assert.equal(splash.dark.backgroundColor, c.bg);
  assert.notEqual(splash.image, splash.dark.image);
  const png = fs.readFileSync(splash.dark.image);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 512); assert.equal(png.readUInt32BE(20), 512);
  assert(fs.readFileSync('assets/startup-turntable-dark.svg', 'utf8').includes(c.startup.base));
  assert.equal(config.icon, './assets/aiplayed-icon.png');
});

test('Settings exposes exact theme buttons and saved selection without issuing playback commands', async () => {
  const browse = await import('../src/browse.js'), navigation = await import('../src/navigation.js');
  const { createLibraryIndex } = await import('../src/libraryIndex.js');
  const { formatTime } = await import('../src/music.js');
  const { tones } = await import('../src/design.js');
  const commands = [], state = { theme: 'System', playing: true, queue: [], favorites: [], recent: [], playlists: {}, sort: 'Title', sound: {}, current: { id: 1, title: 'Theme Song' } };
  const ui = harness('App.js', ['MusicApp'], { ...browse, ...navigation, createLibraryIndex, formatTime, palette, tones,
    Native: { command: async (action, raw) => { const data = JSON.parse(raw); commands.push({ action, data }); if (action === 'theme') state.theme = data.value; return JSON.stringify(state); } },
    musicStore: { accept: x => x }, soundPreview: { perform: fn => fn() }, useMusicSlice: () => state,
    useAppActive: () => true, useStatusPolling() {}, useStableCallback: fn => fn,
    useWindowDimensions: () => ({ width: 393, height: 852, fontScale: 1 }), Platform: { OS: 'android', Version: 36 },
    PermissionsAndroid: { PERMISSIONS: {} }, Alert: { alert() {} } });
  let tree = ui.render('MusicApp');
  const permission = ui.slots.indexOf(false), ready = ui.slots.indexOf(false, permission + 1);
  ui.slots[permission] = ui.slots[ready] = true;
  const render = () => tree = ui.render('MusicApp'); render();
  const button = label => nodes(tree).find(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
  button('Settings').props.onPress(); render();
  assert(nodes(tree).some(n => n.props.testID === 'settings-screen'));
  for (const value of ['Light', 'Dark', 'System']) {
    button('Theme').props.onPress(); render();
    assert(nodes(tree).find(n => n.type === 'Sheet').props.visible);
    for (const option of ['System', 'Light', 'Dark']) {
      assert(button(option));
      assert.equal(button(option).props.accessibilityState.selected, option === state.theme);
    }
    button(value).props.onPress(); await new Promise(resolve => setImmediate(resolve)); render();
    assert.equal(state.theme, value);
    assert.equal(state.playing, true);
    assert.equal(nodes(tree).find(n => n.type === 'Sheet').props.visible, false);
  }
  assert.deepEqual(commands, ['Light', 'Dark', 'System'].map(value => ({ action: 'theme', data: { value } })));
});
