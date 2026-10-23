const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, nodes, h, palette } = require('./ui-harness.cjs');

function setup(delayed = false) {
  const motion = { active: true, reduced: false }, loops = [], timings = [], callbacks = [];
  let dark = false;
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    interpolate(config) { return { value: this, ...config }; }
    stopAnimation(callback) { if (callback) delayed ? callbacks.push(() => callback(this.value)) : callback(this.value); }
  }
  const ui = harness('src/PlaybackMotion.js', ['PlayingArtwork'], {
    createContext: () => ({}), useContext: () => motion, useTheme: () => palette(dark),
    Easing: { inOut: x => x, sin: 'sin', linear: 'linear' },
    Animated: { Value, View: 'AnimatedView', timing(value, config) { timings.push(config); return { value, config }; }, sequence: steps => ({ steps }),
      loop(animation) { const loop = { animation, running: false, start() { this.running = true; }, stop() { this.running = false; } }; loops.push(loop); return loop; } },
  });
  return { ui, motion, loops, timings, callbacks, theme: value => { dark = value; }, running: () => loops.filter(loop => loop.running) };
}
const cover = h('Artwork', { song: { id: 'track' } });
const props = { playing: true, color: '#7353BB', size: 300, children: cover };

test('three non-disc artwork styles retain the cover and run without owning transport controls', () => {
  const { ui, theme, running, timings } = setup();
  for (const variant of ['Pulse', 'Wave', 'Orbit']) {
    const selected = { ...props, variant };
    let tree = ui.render('PlayingArtwork', selected); ui.effects();
    assert.equal(tree.props.testID, 'artwork-animation-' + variant.toLowerCase());
    assert(nodes(tree).includes(cover), 'every style preserves the supplied album artwork');
    assert.equal(running().length, variant === 'Orbit' ? 2 : 1);
    const loops = running();
    theme(true);
    tree = ui.render('PlayingArtwork', { ...selected, color: '#BDA4F4', size: 240 }); ui.effects();
    assert.deepEqual(running(), loops, 'theme/layout updates do not restart the native animation');
    assert(!nodes(tree).some(n => n.props.onPress || n.props.onAction), 'artwork effects do not own transport commands');
  }
  assert(timings.every(config => config.useNativeDriver === true && config.isInteraction === false));
});

test('each artwork style stops on pause, reduced motion or background and resumes the same style', () => {
  for (const variant of ['Pulse', 'Wave', 'Orbit']) {
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
