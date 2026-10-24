const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const api = import('../src/outputPresets.js');

test('output presets round-trip and manual output changes become Custom', async () => {
  const { outputPresets, findOutputPreset } = await api;
  assert.equal(new Set(outputPresets.map(p => p.id)).size, outputPresets.length);
  assert.equal(new Set(outputPresets.map(p => JSON.stringify(p.settings))).size, outputPresets.length);
  for (const preset of outputPresets) {
    const sound = JSON.parse(JSON.stringify(preset.settings));
    assert.equal(findOutputPreset(sound)?.id, preset.id);
    assert.equal(findOutputPreset({ ...sound, volume: 175 }), null);
    assert.equal(findOutputPreset({ ...sound, limiter: false }), null);
    assert.equal(preset.settings.limiter, true);
    assert(preset.settings.volume >= 100 && preset.settings.volume <= 150);
  }
});

test('presets preserve personal balance, tone and playback controls', async () => {
  const { outputPresets, findOutputPreset } = await api;
  const personal = { bands: [1, 2, 3], bass: 2, treble: -1, preamp: -6, autoHeadroom: false, balance: -30, eqEnabled: true, bypass: true, speed: 1.2, pitch: -2 };
  for (const preset of outputPresets) {
    const combined = { ...personal, ...preset.settings };
    for (const [key, value] of Object.entries(personal)) assert.deepEqual(combined[key], value);
    assert.equal(findOutputPreset(combined)?.id, preset.id);
  }
});

test('Output buttons apply one complete patch and are disabled during bypass', async () => {
  const { outputPresets, findOutputPreset } = await api;
  const source = fs.readFileSync('src/SoundStudio.js', 'utf8').replace(/^import .*;\n/gm, '').replace(/export (?:default )?function/g, 'function');
  const h = (type, props, ...children) => ({ type, props: props || {}, children: children.flat().filter(x => x != null && x !== false) });
  const nodes = tree => typeof tree === 'object' ? [tree, ...tree.children.flatMap(nodes)] : [];
  for (const bypass of [false, true]) {
    const calls = [];
    const ctx = { React: { createElement: h, Fragment: 'Fragment' }, useState: initial => [initial === 'Tone' ? 'Output' : initial, () => {}], useEffect: () => {}, memo: x => x, useMemo: fn => fn(), useRef: value => ({ current: value }), useAppActive: () => true, StyleSheet: { create: x => x }, outputPresets, findOutputPreset, tones: () => [], formatTime: () => '', console };
    for (const name of ['KeyboardAvoidingView', 'Modal', 'Pressable', 'ScrollView', 'Switch', 'Text', 'TextInput', 'View', 'SafeAreaView', 'RotaryKnob', 'TabHighlight', 'Slider', 'Feather', 'HeaderOverlay', 'SectionBanner', 'ScrollSurface', 'SleepRemaining']) ctx[name] = name;
    vm.createContext(ctx); vm.runInContext(source + '\nglobalThis.render = SoundStudio;', ctx);
    const tree = ctx.render({ state: { sound: { bypass } }, command: (...args) => calls.push(args), c: {}, onBack() {}, onTimer() {} });
    const buttons = nodes(tree).filter(node => node.type === 'Pressable');
    for (const preset of outputPresets) {
      const button = buttons.find(node => nodes(node).some(child => child.type === 'Text' && child.children.includes(preset.label)));
      assert(button, preset.label);
      assert.equal(button.props.disabled, bypass);
      button.props.onPress();
      const [action, patch] = calls.at(-1);
      assert.equal(action, 'sound');
      assert.deepEqual({ ...patch }, { ...preset.settings });
    }
  }
});

test('actual Java DSP verifies output preset gain, compression, stereo and limiting', async () => {
  const { outputPresets } = await api;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiplayed-output-presets-'));
  try {
    const fixture = path.join(dir, 'presets.tsv');
    const catalogPath = path.join(dir, 'tone-presets.json');
    fs.writeFileSync(fixture, outputPresets.map(({ id, settings: s }) => [id, s.volume, s.dynamics, s.width, s.mono, s.limiter].join('\t')).join('\n'));
    const result = spawnSync('java', ['scripts/RunAudioTests.java', fixture, catalogPath], { encoding: 'utf8', timeout: 120000 });
    assert.equal(result.status, 0, `${result.error || ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Output preset signals verified/);
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const source = fs.readFileSync('src/SoundStudio.js', 'utf8').replace(/^import .*;\n/gm, '').replace(/export (?:default )?function/g, 'function');
    const h = (type, props, ...children) => ({ type, props: props || {}, children: children.flat().filter(x => x != null && x !== false) });
    const nodes = tree => typeof tree === 'object' ? [tree, ...tree.children.flatMap(nodes)] : [];
    const { findOutputPreset } = await api;
    const ctx = { React: { createElement: h, Fragment: 'Fragment' }, useState: initial => [initial, () => {}], useEffect: () => {}, memo: x => x, useMemo: fn => fn(), useRef: value => ({ current: value }), useAppActive: () => true, StyleSheet: { create: x => x }, outputPresets, findOutputPreset, tones: () => [], formatTime: () => '' };
    for (const name of ['KeyboardAvoidingView', 'Modal', 'Pressable', 'ScrollView', 'Switch', 'Text', 'TextInput', 'View', 'SafeAreaView', 'RotaryKnob', 'TabHighlight', 'Slider', 'Feather', 'HeaderOverlay', 'SectionBanner', 'ScrollSurface', 'SleepRemaining']) ctx[name] = name;
    vm.createContext(ctx); vm.runInContext(source + '\nglobalThis.render = SoundStudio;', ctx);
    for (const selected of catalog.soundPresets) for (const bypass of [false, true]) {
      const calls = [];
      const state = { ...catalog, sound: { eqEnabled: true, bands: catalog.equalizerPresets[selected].bands, bypass }, soundProfiles: { Rock: {} } };
      const tree = ctx.render({ state, command: (...args) => calls.push(args), c: {}, onBack() {}, onTimer() {} });
      const buttons = nodes(tree).filter(node => node.type === 'Pressable');
      for (const preset of catalog.soundPresets) {
        const button = buttons.find(node => nodes(node).some(child => child.type === 'Text' && child.children.includes(preset)));
        assert(button, preset); assert.equal(button.props.accessibilityState.selected, preset === selected);
        assert.equal(button.props.disabled, bypass); assert.equal(button.props.accessibilityState.disabled, bypass);
        button.props.onPress(); assert.equal(calls.at(-1)[0], 'equalizerPreset'); assert.equal(calls.at(-1)[1].name, preset);
      }
      assert(nodes(tree).some(node => node.type === 'Text' && node.children.includes(catalog.equalizerPresetDetails[selected])));
    }
    // A partial/old snapshot must not crash preset recognition or hide the Custom state.
    const malformed = ctx.render({ state: { sound: { eqEnabled: true }, equalizerPresets: { Flat: {} } }, command() {}, c: {}, onBack() {}, onTimer() {} });
    assert(nodes(malformed).some(node => node.type === 'Text' && node.children.includes('Custom')));
    console.log('Native tone catalog and UI selection/bypass checks passed for every preset.');
    console.log(result.stdout.trim());
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
