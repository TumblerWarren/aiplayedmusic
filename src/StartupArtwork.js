import React from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { palette } from './design';
const h = React.createElement;

// A dedicated turntable illustration. The launcher icon is never used here.
export default function StartupArtwork({ size, rotation, c = palette(false) }) {
  const a = c.startup;
  return h(View, { testID: 'startup-turntable', accessible: false, pointerEvents: 'none', style: { width: size, height: size } },
    h(Svg, { width: size, height: size, viewBox: '0 0 400 400' },
      h(Rect, { x: 24, y: 60, width: 352, height: 312, rx: 46, fill: a.shadow, opacity: 0.08 }),
      h(Rect, { x: 20, y: 48, width: 360, height: 312, rx: 46, fill: a.base, stroke: a.rim, strokeWidth: 3 }),
      h(Circle, { cx: 160, cy: 200, r: 130, fill: a.platter }),
      h(Circle, { cx: 64, cy: 326, r: 5, fill: a.led }),
      h(Path, { d: 'M80 326H126', stroke: a.slot, strokeWidth: 5, strokeLinecap: 'round' }),
      h(Rect, { x: 285, y: 290, width: 52, height: 9, rx: 4.5, fill: a.slider }),
      h(Circle, { cx: 313, cy: 294, r: 9, fill: a.cap })),
    h(Animated.View, { style: { position: 'absolute', left: size * 0.09, top: size * 0.19, width: size * 0.62, height: size * 0.62, transform: [{ rotate: rotation }] } },
      h(Svg, { width: '100%', height: '100%', viewBox: '0 0 248 248' },
        h(Circle, { cx: 124, cy: 124, r: 124, fill: a.record }),
        ...[113, 102, 91, 80].map(r => h(Circle, { key: r, cx: 124, cy: 124, r, fill: 'none', stroke: a.groove, strokeWidth: 1.3 })),
        h(Circle, { cx: 124, cy: 124, r: 61, fill: a.label }),
        h(Path, { d: 'M124 63A61 61 0 0 1 185 124C160 153 130 87 94 76A61 61 0 0 1 124 63Z', fill: a.lavender }),
        h(Path, { d: 'M63 124C89 94 126 157 158 174A61 61 0 0 1 63 124Z', fill: a.peach }),
        h(Circle, { cx: 124, cy: 124, r: 8, fill: a.spindle, stroke: a.record, strokeWidth: 3 }))),
    h(Svg, { width: size, height: size, viewBox: '0 0 400 400', style: { position: 'absolute' } },
      h(Circle, { cx: 316, cy: 112, r: 21, fill: a.pivot }),
      h(Circle, { cx: 316, cy: 112, r: 10, fill: c.accent }),
      h(Path, { d: 'M316 112L341 137L287 243', fill: 'none', stroke: a.arm, strokeWidth: 15, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      h(Path, { d: 'M282 232L296 239L282 264L268 257Z', fill: a.needle })));
}

export function StartupBackdrop({ dark, c = palette(dark) }) {
  const a = c.startup;
  return h(Svg, { width: '100%', height: '100%', viewBox: '0 0 400 900', preserveAspectRatio: 'xMidYMid slice', accessible: false, style: { position: 'absolute', top: 0, left: 0 } },
    h(Circle, { cx: 350, cy: 155, r: 245, fill: a.backdrop }),
    h(Path, { d: 'M-80 720C70 560 260 890 470 670V950H-80Z', fill: a.wave }),
    h(Path, { d: 'M-30 754C120 625 260 917 450 740', fill: 'none', stroke: a.waveLine, strokeWidth: 2 }),
    h(Circle, { cx: 65, cy: 235, r: 9, fill: a.dot }),
    h(Circle, { cx: 346, cy: 610, r: 5, fill: a.blue }),
    h(Path, { d: 'M315 286V306M305 296H325', stroke: a.cross, strokeWidth: 3, strokeLinecap: 'round' }));
}
