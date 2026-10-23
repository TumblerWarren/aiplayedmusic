import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useTheme } from './ThemeProvider';
const h = React.createElement;

// Aiplayed's own rounded, two-tone glyphs. Secondary utility arrows use Feather.
export default function Icon({ name, size = 24, color, style, filled = true, ...props }) {
  const c = useTheme();
  color ??= c.accent;
  const cutout = c.dark ? c.onAccent : '#FFFFFF';
  if (name === 'heart') return h(Svg, { width: size, height: size, viewBox: '-2 -2 28 28', style, accessible: false }, h(Path, { d: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z', fill: filled ? color : 'none', stroke: color, strokeWidth: 1.7, strokeLinejoin: 'round' }));
  const unit = size / 24;
  const shape = (key, box, extra = {}) => h(View, { key, style: { position: 'absolute', ...Object.fromEntries(Object.entries(box).map(([k, v]) => [k, v * unit])), ...extra } });
  const line = (key, box, extra = {}) => shape(key, box, { backgroundColor: color, borderRadius: 2 * unit, ...extra });
  let content;
  if (name.startsWith('folder')) content = [
    shape('tab', { left: 2, top: 4, width: 10, height: 6 }, { backgroundColor: color, opacity: 0.55, borderRadius: 3 * unit }),
    shape('body', { left: 1, top: 8, width: 22, height: 13 }, { backgroundColor: color, borderRadius: 4 * unit }),
    line('seam', { left: 5, top: 11, width: 14, height: 1.5 }, { backgroundColor: cutout, opacity: 0.6 }),
    ...(name === 'folder-plus' || name === 'folder-minus' ? [line('minus', { left: 9, top: 16, width: 6, height: 1.5 }, { backgroundColor: cutout }), ...(name === 'folder-plus' ? [line('plus', { left: 11.3, top: 13.8, width: 1.5, height: 6 }, { backgroundColor: cutout })] : [])] : []),
  ];
  else if (name === 'music' || name === 'headphones') content = name === 'music' ? [
    line('stem1', { left: 8, top: 4, width: 2.5, height: 14 }), line('stem2', { left: 19, top: 2, width: 2.5, height: 14 }),
    line('bridge', { left: 8, top: 3, width: 13, height: 5 }, { transform: [{ rotate: '-10deg' }], opacity: 0.6 }),
    shape('note1', { left: 2, top: 15, width: 8, height: 6 }, { borderRadius: 5 * unit, backgroundColor: color }),
    shape('note2', { left: 13, top: 13, width: 8, height: 6 }, { borderRadius: 5 * unit, backgroundColor: color }),
  ] : [shape('arch', { left: 3, top: 2, width: 18, height: 20 }, { borderWidth: 2.5 * unit, borderColor: color, borderRadius: 10 * unit }), shape('mask', { left: 7, top: 12, width: 10, height: 12 }, { backgroundColor: 'transparent' }), line('left', { left: 2, top: 12, width: 5, height: 10 }), line('right', { left: 17, top: 12, width: 5, height: 10 })];
  else if (name === 'sliders' || name === 'bar-chart-2') content = [0, 1, 2].flatMap((i) => [
    line(`track${i}`, { left: 4 + i * 7, top: 2, width: 2.5, height: 20 }, { opacity: 0.3 }),
    line(`knob${i}`, { left: 2 + i * 7, top: [7, 13, 4][i], width: 6.5, height: 5 }),
  ]);
  else if (name === 'list') content = [0, 1, 2].flatMap(i => [line(`dot${i}`, { left: 2, top: 4 + i * 7, width: 3, height: 3 }, { opacity: 0.5 }), line(`row${i}`, { left: 8, top: 4 + i * 7, width: 14 - i * 2, height: 3 })]);
  else if (name === 'play' || name === 'skip-forward' || name === 'skip-back') content = [
    shape('triangle', { left: name === 'skip-back' ? 6 : 7, top: 3, width: 0, height: 0 }, { borderTopWidth: 9 * unit, borderBottomWidth: 9 * unit, borderTopColor: 'transparent', borderBottomColor: 'transparent', ...(name === 'skip-back' ? { borderRightWidth: 13 * unit, borderRightColor: color } : { borderLeftWidth: 13 * unit, borderLeftColor: color }) }),
    ...(name === 'play' ? [] : [line('stop', { left: name === 'skip-back' ? 3 : 20, top: 3, width: 2.5, height: 18 })]),
  ];
  else if (name === 'pause') content = [line('left', { left: 5, top: 3, width: 5, height: 18 }), line('right', { left: 14, top: 3, width: 5, height: 18 })];
  else if (name === 'disc') content = [shape('disc', { left: 1, top: 1, width: 22, height: 22 }, { backgroundColor: color, opacity: 0.25, borderRadius: size / 2 }), shape('ring', { left: 5, top: 5, width: 14, height: 14 }, { borderWidth: 2 * unit, borderColor: color, borderRadius: size / 2 }), shape('hub', { left: 10, top: 10, width: 4, height: 4 }, { backgroundColor: color, borderRadius: size / 2 })];
  else return h(Feather, { name, size, color, style, ...props });
  return h(View, { ...props, accessible: false, style: [{ width: size, height: size, overflow: 'hidden' }, style] }, content);
}

