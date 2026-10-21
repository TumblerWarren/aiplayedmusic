const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { harness, nodes } = require('./ui-harness.cjs');

const flatten = style => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};
const setup = () => harness('src/RoundedPressable.js', ['RoundedPressable'], {
  NativePressable: 'NativePressable', StyleSheet: { flatten },
});

test('player play/pause feedback stays circular at full, compact and landscape sizes', () => {
  const ui = setup();
  for (const size of [72, 56, 48]) {
    const ref = { current: null }, presses = [], longPresses = [];
    const tree = ui.render('RoundedPressable', {
      ref, accessibilityLabel: 'Pause', accessibilityRole: 'button', hitSlop: 6,
      style: [{ width: 48, height: 48, borderRadius: 24 }, [{ width: size, height: size, borderRadius: 36, backgroundColor: '#7353BB' }]],
      onPress: () => presses.push(true), onLongPress: () => longPresses.push(true), children: 'Pause glyph',
    });
    assert.equal(tree.props.android_ripple, undefined);
    assert.equal(tree.props.ref, ref);
    assert.equal(tree.props.hitSlop, 6);
    assert.equal(tree.props.accessibilityLabel, 'Pause');
    assert.equal(nodes(tree.children[0]({ pressed: false })).filter(n => n.type === 'View').length, 0);
    const pressed = { pressed: true }, surface = flatten(tree.props.style(pressed));
    assert.equal(surface.width, size); assert.equal(surface.height, size);
    assert.equal(surface.overflow, 'hidden'); assert(surface.borderRadius >= size / 2);
    const overlay = nodes(tree.children[0](pressed)).find(n => n.type === 'View');
    assert.equal(overlay.props.style.borderRadius, surface.borderRadius);
    assert.equal(overlay.props.style.backgroundColor, '#7353BB18');
    assert.equal(overlay.props.pointerEvents, 'none'); assert.equal(overlay.props.accessible, false);
    assert.equal(overlay.props.importantForAccessibility, 'no-hide-descendants');
    tree.props.onPress(); tree.props.onLongPress();
    assert.equal(presses.length, 1); assert.equal(longPresses.length, 1);
  }
});

test('rounded rows and pills retain their corners, render props, disabled state and dismissal behavior', () => {
  const ui = setup();
  for (const radius of [18, 22, 28, 999]) {
    const tree = ui.render('RoundedPressable', {
      style: ({ pressed }) => [{ borderRadius: radius }, { opacity: pressed ? .8 : 1 }],
      children: ({ pressed }) => pressed ? 'Pressed content' : 'Resting content',
    });
    const pressed = tree.children[0]({ pressed: true });
    assert(pressed.children.includes('Pressed content'));
    assert.equal(nodes(pressed).find(n => n.type === 'View').props.style.borderRadius, radius);
    assert.equal(flatten(tree.props.style({ pressed: true })).borderRadius, radius);
  }
  const corner = ui.render('RoundedPressable', { style: { borderTopLeftRadius: 30, borderBottomRightRadius: 12 } });
  const shape = nodes(corner.children[0]({ pressed: true })).find(n => n.type === 'View').props.style;
  assert.equal(shape.borderTopLeftRadius, 30); assert.equal(shape.borderBottomRightRadius, 12);
  for (const props of [{ disabled: true }, { feedback: false }]) {
    const tree = ui.render('RoundedPressable', props);
    assert.equal(nodes(tree.children[0]({ pressed: true })).filter(n => n.type === 'View').length, 0);
  }
});

test('all remaining ripple call sites use the shared feedback instead of an OEM drawable', () => {
  for (const file of ['App.js', ...fs.readdirSync('src').filter(x => x.endsWith('.js')).map(x => 'src/' + x)]) {
    if (file.endsWith('RoundedPressable.js')) continue;
    assert(!/android_ripple\s*:/.test(fs.readFileSync(file, 'utf8')), file + ' reintroduces native ripple masking');
  }
  for (const file of ['App.js', 'src/SongRow.js', 'src/SoundStudio.js', 'src/FolderPicker.js', 'src/Sheet.js'])
    assert(fs.readFileSync(file, 'utf8').includes("/RoundedPressable'"), file + ' needs the shared feedback');
});

test('menu scrim fades in place; only the panel slides, and exit stays mounted until the fade completes', () => {
  const animations = [];
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    interpolate(config) { return { source: this, ...config }; }
  }
  const ui = harness('src/Sheet.js', ['Sheet'], {
    Animated: {
      Value, View: 'AnimatedView', add: (a, b) => ({ add: [a, b] }),
      timing: (value, config) => {
        const animation = { value, config, start(done) { this.done = done; }, stop() { this.stopped = true; this.done?.({ finished: false }); } };
        animations.push(animation); return animation;
      },
    },
    PanResponder: { create: () => ({ panHandlers: {} }) },
    useMotionAllowed: () => true, useWindowDimensions: () => ({ height: 800 }),
  });
  const props = { visible: true, title: 'Browse', c: {}, onClose() {}, children: 'Menu choices' };
  const render = next => ui.render('Sheet', { ...props, ...next });
  let tree = render(); ui.effects();
  assert.equal(tree.props.animationType, 'none', 'the native Modal cannot slide the scrim');
  const scrim = nodes(tree).find(n => n.props.testID === 'sheet-backdrop');
  const panel = nodes(tree).find(n => n.props.testID === 'sheet-panel');
  assert.equal(scrim.props.style.transform, undefined);
  assert.equal(scrim.props.style.top, 0); assert.equal(scrim.props.style.bottom, 0);
  assert.equal(animations[0].value, scrim.props.style.opacity);
  assert.equal(animations[0].config.toValue, 1); assert.equal(animations[0].config.useNativeDriver, true);
  const translation = panel.props.style.transform[0].translateY.add[1];
  assert.equal(translation.source, scrim.props.style.opacity);
  assert.deepEqual(Array.from(translation.outputRange), [800, 0]);
  tree = render({ visible: false, title: undefined, children: undefined }); ui.effects();
  assert.equal(tree.props.visible, true, 'keep the Modal visible through the exit fade');
  assert(nodes(tree).some(n => n.children.includes('Browse')));
  assert(nodes(tree).some(n => n.children.includes('Menu choices')));
  assert.equal(animations.at(-1).config.toValue, 0);
  animations.at(-1).done({ finished: true });
  tree = render({ visible: false }); assert.equal(tree.props.visible, false);

  render({ visible: true }); ui.effects();
  render({ visible: false }); ui.effects(); const closing = animations.at(-1);
  tree = render({ visible: true }); ui.effects();
  assert(closing.stopped); closing.done({ finished: true });
  assert.equal(render({ visible: true }).props.visible, true, 'stale exit callbacks must not hide a reopened menu');
});

test('Reduce Motion opens and closes the menu immediately without movement or a stuck Modal', () => {
  class Value {
    setValue(value) { this.value = value; }
    interpolate(config) { return { source: this, ...config }; }
  }
  const ui = harness('src/Sheet.js', ['Sheet'], {
    Animated: { Value, View: 'AnimatedView', add: (a, b) => ({ a, b }), timing() { throw Error('Reduce Motion must not animate'); } },
    PanResponder: { create: () => ({ panHandlers: {} }) }, useMotionAllowed: () => false, useWindowDimensions: () => ({ height: 800 }),
  });
  const props = { visible: true, title: 'Menu', c: {}, onClose() {} };
  let tree = ui.render('Sheet', props); ui.effects();
  assert.equal(nodes(tree).find(n => n.props.testID === 'sheet-backdrop').props.style.opacity.value, 1);
  ui.render('Sheet', { ...props, visible: false }); ui.effects();
  tree = ui.render('Sheet', { ...props, visible: false }); assert.equal(tree.props.visible, false);
});
