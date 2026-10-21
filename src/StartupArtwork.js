import React from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
const h = React.createElement;

// A dedicated turntable illustration. The launcher icon is never used here.
export default function StartupArtwork({ size, rotation }) {
  return h(View, { testID: 'startup-turntable', accessible: false, pointerEvents: 'none', style: { width: size, height: size } },
    h(Svg, { width: size, height: size, viewBox: '0 0 400 400' },
      h(Rect, { x: 24, y: 60, width: 352, height: 312, rx: 46, fill: '#382847', opacity: 0.08 }),
      h(Rect, { x: 20, y: 48, width: 360, height: 312, rx: 46, fill: '#F4CABB', stroke: '#FFF5ED', strokeWidth: 3 }),
      h(Circle, { cx: 160, cy: 200, r: 130, fill: '#D8AEA3' }),
      h(Circle, { cx: 64, cy: 326, r: 5, fill: '#438D7C' }),
      h(Path, { d: 'M80 326H126', stroke: '#BA8E88', strokeWidth: 5, strokeLinecap: 'round' }),
      h(Rect, { x: 285, y: 290, width: 52, height: 9, rx: 4.5, fill: '#D4AAA4' }),
      h(Circle, { cx: 313, cy: 294, r: 9, fill: '#FFFBF6' })),
    h(Animated.View, { style: { position: 'absolute', left: size * 0.09, top: size * 0.19, width: size * 0.62, height: size * 0.62, transform: [{ rotate: rotation }] } },
      h(Svg, { width: '100%', height: '100%', viewBox: '0 0 248 248' },
        h(Circle, { cx: 124, cy: 124, r: 124, fill: '#30243F' }),
        ...[113, 102, 91, 80].map(r => h(Circle, { key: r, cx: 124, cy: 124, r, fill: 'none', stroke: '#6B557D', strokeWidth: 1.3 })),
        h(Circle, { cx: 124, cy: 124, r: 61, fill: '#A7D8C7' }),
        h(Path, { d: 'M124 63A61 61 0 0 1 185 124C160 153 130 87 94 76A61 61 0 0 1 124 63Z', fill: '#BCA5E6' }),
        h(Path, { d: 'M63 124C89 94 126 157 158 174A61 61 0 0 1 63 124Z', fill: '#F2B09D' }),
        h(Circle, { cx: 124, cy: 124, r: 8, fill: '#FFF8ED', stroke: '#30243F', strokeWidth: 3 }))),
    h(Svg, { width: size, height: size, viewBox: '0 0 400 400', style: { position: 'absolute' } },
      h(Circle, { cx: 316, cy: 112, r: 21, fill: '#B397DC' }),
      h(Circle, { cx: 316, cy: 112, r: 10, fill: '#7353BB' }),
      h(Path, { d: 'M316 112L341 137L287 243', fill: 'none', stroke: '#FFFBF6', strokeWidth: 15, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      h(Path, { d: 'M282 232L296 239L282 264L268 257Z', fill: '#79B5A3' })));
}

export function StartupBackdrop({ dark }) {
  return h(Svg, { width: '100%', height: '100%', viewBox: '0 0 400 900', preserveAspectRatio: 'xMidYMid slice', accessible: false, style: { position: 'absolute', top: 0, left: 0 } },
    h(Circle, { cx: 350, cy: 155, r: 245, fill: dark ? '#382B4D' : '#EEE5FC' }),
    h(Path, { d: 'M-80 720C70 560 260 890 470 670V950H-80Z', fill: dark ? '#203F39' : '#DDF2E7' }),
    h(Path, { d: 'M-30 754C120 625 260 917 450 740', fill: 'none', stroke: dark ? '#365C52' : '#BBDDD0', strokeWidth: 2 }),
    h(Circle, { cx: 65, cy: 235, r: 9, fill: '#F2B09D' }),
    h(Circle, { cx: 346, cy: 610, r: 5, fill: '#9EB4DF' }),
    h(Path, { d: 'M315 286V306M305 296H325', stroke: '#AB93D2', strokeWidth: 3, strokeLinecap: 'round' }));
}
