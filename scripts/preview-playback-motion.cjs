// Export the actual PlayingArtwork geometry/interpolations for motion review.
// Browser playback validates design and seams; it does not validate Android frame pacing.
const fs = require('node:fs');
const path = require('node:path');
const { harness, h, palette } = require('./ui-harness.cjs');
const variants = ['Disc', 'Pulse', 'Wave', 'Orbit', 'Equalizer'];
let sample = 0, rules = [], nextId = 0;
const derived = get => ({ get value() { return get(); }, interpolate(config) { return { interpolation: true, source: this, ...config }; } });
function resolve(value) {
  if (!value?.interpolation) return value;
  const t = value.source.value, xs = value.inputRange, ys = value.outputRange;
  let i = xs.findIndex(x => x >= t); if (i <= 0) return ys[0];
  const fraction = (t - xs[i - 1]) / (xs[i] - xs[i - 1]);
  const number = parseFloat(ys[i - 1]) + (parseFloat(ys[i]) - parseFloat(ys[i - 1])) * fraction;
  return typeof ys[i] === 'number' ? number : `${number}${String(ys[i]).replace(/[\d.\-]/g, '')}`;
}
const unitless = new Set(['opacity', 'flex', 'flexShrink', 'flexGrow', 'zIndex', 'fontWeight']);
function css(style) {
  return Object.entries(style).map(([key, raw]) => {
    if (key === 'transform') return 'transform:' + raw.map(item => {
      const [name, value] = Object.entries(item)[0], result = resolve(value);
      return `${name}(${result}${name.startsWith('translate') && typeof result === 'number' ? 'px' : ''})`;
    }).join(' ') + ';';
    const value = resolve(raw);
    return `${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}:${value}${typeof value === 'number' && !unitless.has(key) ? 'px' : ''};`;
  }).join('');
}
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
function render(node, duration) {
  if (typeof node !== 'object') return escape(node);
  const { style = {}, ...props } = node.props;
  const svg = ['svg', 'path', 'rect', 'circle'].includes(node.type), tag = svg ? node.type : 'div';
  const animated = Object.values(style).some(v => v?.interpolation) || style.transform?.some(item => Object.values(item).some(v => v?.interpolation));
  const id = 'motion-' + nextId++;
  sample = 0;
  let inline = (svg ? '' : 'display:flex;flex-direction:column;flex-shrink:0;position:relative;box-sizing:border-box;border-style:solid;border-width:0;') + css(style);
  if (animated) {
    const frames = Array.from({ length: 193 }, (_, i) => { sample = Math.min(i / 192, 1 - Number.EPSILON); return `${sample * 100}%{${css(style)}}`; });
    rules.push(`@keyframes ${id}{${frames.join('')}}`);
    inline += `animation:${id} ${duration}ms linear infinite;`;
  }
  const attributes = Object.entries(props).filter(([key, value]) => !['key', 'testID', 'accessible', 'collapsable', 'pointerEvents', 'importantForAccessibility'].includes(key) && typeof value !== 'function').map(([key, value]) => `${key.replace('strokeWidth', 'stroke-width').replace('strokeLinecap', 'stroke-linecap').replace('strokeOpacity', 'stroke-opacity')}="${escape(value)}"`).join(' ');
  return `<${tag} ${attributes} style="${inline}">${node.children.map(child => render(child, duration)).join('')}</${tag}>`;
}
let sections = '';
for (const dark of [false, true]) {
  const c = palette(dark), cards = [];
  for (const variant of variants) {
    let duration, count = 0;
    class Value {
      constructor(value) { this.initial = value; this.clock = count++ === 0; }
      get value() { return this.clock ? sample : this.initial; }
      setValue(value) { this.initial = value; }
      stopAnimation(callback) { callback?.(0); }
      interpolate(config) { return { interpolation: true, source: this, ...config }; }
    }
    const ui = harness('src/PlaybackMotion.js', ['PlayingArtwork'], {
      createContext: () => ({}), useContext: () => ({ active: true, reduced: false }), useTheme: () => c,
      Svg: 'svg', Path: 'path', Easing: { linear: 'linear' },
      Animated: { Value, View: 'View', add: (a, b) => derived(() => a.value + b.value), modulo: (a, b) => derived(() => a.value % b),
        timing: (_value, config) => { duration = config.duration; return {}; }, loop: () => ({ start() {}, stop() {} }) },
    });
    const size = 240, coverSize = size * (variant === 'Disc' ? .52 : .62);
    const art = harness('src/Pastel.js', ['FallbackArt'], { useTheme: () => c, Svg: 'svg', Rect: 'rect', Path: 'path', Circle: 'circle' });
    const cover = h('View', { style: { width: coverSize, height: coverSize, borderRadius: variant === 'Disc' ? coverSize / 2 : 16, overflow: 'hidden' } }, art.render('FallbackArt', { size: coverSize, seed: 0 }));
    sample = 0;
    const tree = ui.render('PlayingArtwork', { playing: true, color: c.accent, size, variant, children: cover }); ui.effects();
    cards.push(`<article>${render(tree, duration)}<p>${variant}</p></article>`);
  }
  sections += `<section style="background:${c.bg};color:${c.ink}">${cards.join('')}</section>`;
}
const html = `<!doctype html><meta charset="utf-8"><title>Now Playing motion preview</title><style>
body{margin:0;font:15px system-ui;background:#17191e}section{display:flex;justify-content:center;gap:12px;padding:24px}article{text-align:center}article p{margin:16px 0 0}header{padding:16px 24px;background:#29253a;color:#f4f2f7}button{margin-left:16px;padding:8px 14px;border:0;border-radius:20px;cursor:pointer}.paused *{animation-play-state:paused!important}@media(prefers-reduced-motion:reduce){*{animation-play-state:paused!important}}${rules.join('\n')}</style><header>Actual artwork geometry · browser motion preview · Android validation pending<button id="toggle">Pause</button></header>${sections}<script>document.querySelector('#toggle').onclick=()=>{const paused=document.body.classList.toggle('paused');document.querySelector('#toggle').textContent=paused?'Play':'Pause';};</script>`;
const target = path.resolve(process.argv[2] || '/tmp/aiplayed-motion-preview.html');
fs.writeFileSync(target, html);
console.log(target);
