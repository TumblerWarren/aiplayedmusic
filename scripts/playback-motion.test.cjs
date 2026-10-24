const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, nodes, h, palette } = require('./ui-harness.cjs');

function setup(delayed = false) {
  const motion = { active: true, reduced: false }, loops = [], timings = [], callbacks = [], animations = [], values = [];
  let dark = false;
  class Value {
    constructor(value) { this.value = value; values.push(this); }
    setValue(value) { this.value = value; }
    interpolate(config) { return { value: this, ...config }; }
    stopAnimation(callback) { if (callback) delayed ? callbacks.push(() => callback(this.value)) : callback(this.value); }
  }
  const ui = harness('src/PlaybackMotion.js', ['PlayingArtwork'], {
    createContext: () => ({}), useContext: () => motion, useTheme: () => palette(dark),
    Svg: 'Svg', Path: 'Path', Easing: { linear: 'linear' },
    Animated: { Value, add: (a, b) => ({ get value() { return a.value + b.value; } }), modulo: (a, b) => ({ get value() { return a.value % b; }, interpolate(config) { return { value: this, ...config }; } }), View: 'AnimatedView', timing(value, config) {
        timings.push(config);
        const animation = { value, config, running: false, start(callback) { this.running = true; this.callback = callback; }, stop() { this.running = false; },
          finish() { this.running = false; value.setValue(config.toValue); this.callback?.({ finished: true }); } };
        animations.push(animation); return animation;
      }, sequence: steps => ({ steps }),
      loop(animation) { const loop = { animation, running: false, start() { this.running = true; }, stop() { this.running = false; } }; loops.push(loop); return loop; } },
  });
  return { ui, motion, loops, timings, callbacks, animations, values, theme: value => { dark = value; }, running: () => [...animations, ...loops].filter(loop => loop.running) };
}
const cover = h('Artwork', { song: { id: 'track' } });
const props = { playing: true, color: '#7353BB', size: 300, children: cover };

test('five artwork styles retain the cover and run without owning transport controls', () => {
  const { ui, theme, running, timings } = setup();
  for (const variant of ['Pulse', 'Wave', 'Orbit', 'Equalizer', 'Disc']) {
    const selected = { ...props, variant };
    let tree = ui.render('PlayingArtwork', selected); ui.effects();
    assert.equal(tree.props.testID, 'artwork-animation-' + variant.toLowerCase());
    assert(nodes(tree).includes(cover), 'every style preserves the supplied album artwork');
    assert.equal(running().length, 1);
    if (variant === 'Disc') {
      const disc = nodes(tree).find(n => n.props.testID === 'rotating-vinyl-disc');
      assert(disc.props.style.transform.some(t => t.rotate), 'the actual vinyl disc rotates');
      const label = nodes(disc).find(n => n.props.testID === 'circular-album-label');
      assert.equal(label.props.style.overflow, 'hidden');
      assert(nodes(label).includes(cover), 'album artwork rotates inside the circular record label');
    } else assert(!nodes(tree).find(n => n.props.testID === 'stationary-album-cover').props.style.transform, 'non-disc covers stay steady');
    const loops = running();
    theme(true);
    tree = ui.render('PlayingArtwork', { ...selected, color: '#BDA4F4', size: 240 }); ui.effects();
    assert.deepEqual(running(), loops, 'theme/layout updates do not restart the native animation');
    assert(!nodes(tree).some(n => n.props.onPress || n.props.onAction), 'artwork effects do not own transport commands');
  }
  assert(timings.every(config => config.useNativeDriver === true && config.isInteraction === false));
});

test('each artwork style stops on pause, reduced motion or background and resumes the same style', () => {
  for (const variant of ['Pulse', 'Wave', 'Orbit', 'Equalizer', 'Disc']) {
    const selected = { ...props, variant };
    const { ui, motion, running } = setup();
    let tree = ui.render('PlayingArtwork', selected); ui.effects();
    const style = tree.props.testID;
    assert(running().length > 0);
    for (const reason of ['pause', 'reduced', 'background']) {
      motion.reduced = reason === 'reduced'; motion.active = reason !== 'background';
      tree = ui.render('PlayingArtwork', { ...selected, playing: reason !== 'pause' }); ui.effects();
      assert.equal(running().length, 0, reason + ' stops all loops');
      assert.equal(tree.props.testID, style);
      motion.reduced = false; motion.active = true;
      tree = ui.render('PlayingArtwork', selected); ui.effects();
      assert(running().length > 0);
      assert.equal(tree.props.testID, style, 'resume keeps the selected style');
    }
  }
});

test('a late native stop callback cannot restart rotation after playback pauses', () => {
  const { ui, callbacks, running } = setup(true);
  const selected = { ...props, variant: 'Orbit' };
  ui.render('PlayingArtwork', selected); ui.effects();
  ui.render('PlayingArtwork', { ...selected, playing: false }); ui.effects();
  callbacks.splice(0).forEach(fn => fn());
  assert.equal(running().length, 0);
});


function visiblePhase(tree) {
  let phase;
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (value.inputRange) { phase = value.value.value; return; }
    for (const child of Object.values(value)) visit(child);
  };
  for (const node of nodes(tree)) visit(node.props.style);
  return phase;
}

test('native loops start immediately, preserve phase across repeated pauses and need no JS completion handoff', () => {
  for (const variant of ['Pulse', 'Wave', 'Orbit', 'Equalizer', 'Disc']) {
    const { ui, animations, values, running, loops } = setup();
    const selected = { ...props, variant };
    ui.render('PlayingArtwork', selected); ui.effects();
    assert.equal(loops.length, 1, 'the first cycle is already a native loop');
    assert.equal(animations[0].callback, undefined, 'no JavaScript callback is required at a cycle boundary');
    const duration = animations[0].config.duration;
    for (const [advance, expected] of [[.4, .4], [.35, .75], [.6, .35]]) {
      values[0].setValue(advance); // Native clock advances from its current origin.
      assert(Math.abs(visiblePhase(ui.render('PlayingArtwork', selected)) - expected) < 1e-9);
      ui.render('PlayingArtwork', { ...selected, playing: false }); ui.effects();
      assert.equal(running().length, 0);
      assert(Math.abs(visiblePhase(ui.render('PlayingArtwork', { ...selected, playing: false })) - expected) < 1e-9);
      ui.render('PlayingArtwork', selected); ui.effects();
      assert(Math.abs(visiblePhase(ui.render('PlayingArtwork', selected)) - expected) < 1e-9, 'resume preserves the visible phase');
      assert.equal(animations.at(-1).config.duration, duration, 'resume keeps constant speed');
      assert.equal(running().length, 1);
    }
    // A native loop reset is visually identical even with a nonzero pause origin.
    values[0].setValue(1); const before = visiblePhase(ui.render('PlayingArtwork', selected));
    values[0].setValue(0); const after = visiblePhase(ui.render('PlayingArtwork', selected));
    assert(Math.abs(before - after) < 1e-9, 'no jump at the loop seam');
  }
});

test('periodic decorations have matching values at both ends of the native loop', () => {
  for (const variant of ['Pulse', 'Wave', 'Equalizer']) {
    const { ui } = setup();
    const tree = ui.render('PlayingArtwork', { ...props, variant });
    const inspect = value => {
      if (!value || typeof value !== 'object') return;
      if (value.inputRange) {
        assert(Math.abs(Number(value.outputRange[0]) - Number(value.outputRange.at(-1))) < 1e-9 || value.outputRange[0] === value.outputRange.at(-1), variant + ' loops without a visible discontinuity');
        return;
      }
      for (const child of Object.values(value)) inspect(child);
    };
    // Expanding rings wrap scale only while opacity is zero. Other properties are periodic.
    for (const node of nodes(tree)) {
      if (variant === 'Pulse') inspect(node.props.style?.opacity);
      else inspect(node.props.style);
    }
  }
});
