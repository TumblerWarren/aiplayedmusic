const fs = require('node:fs');
const vm = require('node:vm');
const design = {};
vm.runInNewContext(fs.readFileSync('src/design.js', 'utf8').replace(/export const /g, 'const ') + '\nglobalThis.palette = palette;', design);
const lightTheme = design.palette(false);
const h = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(x => x != null && x !== false) });
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...tree.children.flatMap(nodes)] : [];
function harness(file, exports, globals = {}) {
  const slots = []; let cursor = 0; const effects = []; const frames = new Map(); let nextFrame = 0;
  const context = {
    useTheme: () => lightTheme, initialTheme: () => 'System', palette: design.palette,
    React: { createElement: h, Fragment: 'Fragment' }, console, hideNativeSplash() {}, restoreFocus() {},
    useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useRef(value) { const index = cursor++; return slots[index] ||= { current: value }; },
    useMemo(fn, deps) { const index = cursor++; const previous = slots[index]; if (!previous || !deps || deps.some((value, i) => value !== previous.deps?.[i])) slots[index] = { deps, value: fn() }; return slots[index].value; }, useCallback(fn) { cursor++; return fn; }, useDeferredValue: value => value,
    useEffect(fn, deps) { const index = cursor++; const previous = slots[index]; if (!previous || !deps || deps.some((value, i) => value !== previous.deps?.[i])) { effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; }); } },
    memo: fn => fn, requestAnimationFrame(fn) { frames.set(++nextFrame, fn); return nextFrame; }, cancelAnimationFrame: id => frames.delete(id),
    StyleSheet: { create: x => x }, ...globals,
  };
  for (const name of ['KeyboardAvoidingView', 'ActivityIndicator', 'FlatList', 'Image', 'Modal', 'Pressable', 'ScrollView', 'StatusBar', 'Switch', 'Text', 'TextInput', 'View', 'SafeAreaProvider', 'SafeAreaView', 'Slider', 'Feather', 'ThemeProvider', 'MotionProvider', 'PlayingBars', 'PlayingArtwork', 'PlaybackRipple', 'ScrollSurface', 'ScrollEdge', 'Sheet', 'Startup', 'GestureHandlerRootView', 'SwipeSurface', 'IndexedSongList', 'Artwork', 'SongRow', 'RotaryKnob', 'PlayerProgress', 'SleepRemaining', 'FolderPicker', 'SoundStudio', 'LibrarySettings', 'ForYou', 'PersonalMixesSettings', 'Lyrics', 'SleepTimer', 'Pattern', 'TabHighlight', 'FallbackArt', 'SectionBanner']) if (!(name in context)) context[name] = name;
  const source = fs.readFileSync(file, 'utf8').replace(/^import .*;\n/gm, '').replace(/export (?:default )?function/g, 'function').replace(/export const /g, 'const ').replace(/^export default memo\(.*\);$/gm, '');
  vm.createContext(context); vm.runInContext(source + `\nglobalThis.exports = { ${exports.join(',')} };`, context);
  return { context, slots, render(name, props) { cursor = 0; return context.exports[name](props); }, effects() { while (effects.length) effects.shift()(); }, frames() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); } };
}
module.exports = { harness, h, nodes, palette: design.palette };
