import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import Feather from './Icons';
import { useTheme } from './ThemeProvider';
const h = React.createElement;

export function TabHighlight({ tone }) {
  const c = useTheme();
  const shapes = tone.pattern === 'checks'
    ? Array.from({ length: 24 }, (_, i) => h(Rect, { key: i, x: 48 + (i % 6) * 16, y: Math.floor(i / 6) * 16, width: 16, height: 16, fill: (i + Math.floor(i / 6)) % 2 ? tone.detail : tone.ink, opacity: 0.13 }))
    : tone.pattern === 'dots'
      ? Array.from({ length: 24 }, (_, i) => h(Circle, { key: i, cx: 12 + (i % 6) * 23, cy: 9 + Math.floor(i / 6) * 17, r: 3.6, fill: i % 2 ? tone.detail : tone.ink, opacity: 0.23 }))
      : tone.pattern === 'waves'
        ? [h(Path, { key: 0, d: 'M-10 46Q20 16 56 42T140 32V80H-10Z', fill: tone.detail, opacity: 0.23 }), h(Path, { key: 1, d: 'M-10 58Q22 28 58 54T140 44', fill: 'none', stroke: tone.ink, strokeWidth: 3, opacity: 0.18 })]
        : [28, 43, 58].map(r => h(Circle, { key: r, cx: 112, cy: -3, r, fill: 'none', stroke: tone.detail, strokeWidth: 7, opacity: 0.3 }));
  return h(View, { pointerEvents: 'none', accessible: false, importantForAccessibility: 'no-hide-descendants', style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, overflow: 'hidden' } },
    h(Svg, { width: '100%', height: '100%', viewBox: '0 0 132 64', preserveAspectRatio: 'none', accessible: false }, h(Rect, { width: 132, height: 64, fill: tone.bg }), h(G, { opacity: c.patternStrength }, ...shapes)));
}

// Pure native shapes: no image downloads, extra permissions or rendering dependency.
export function Pattern({ kind = 'arcs', color, size = 112 }) {
  const c = useTheme();
  const parts = kind === 'checks'
    ? Array.from({ length: 16 }, (_, i) => h(View, { key: i, style: { position: 'absolute', width: size / 4, height: size / 4, left: (i % 4) * size / 4, top: Math.floor(i / 4) * size / 4, backgroundColor: (i + Math.floor(i / 4)) % 2 ? color : 'transparent' } }))
    : kind === 'stripes'
      ? Array.from({ length: 7 }, (_, i) => h(View, { key: i, style: { position: 'absolute', width: size * 1.6, height: size / 12, left: -size / 3, top: i * size / 4 - size / 3, backgroundColor: color, transform: [{ rotate: '-40deg' }] } }))
      : [1, 0.76, 0.52, 0.28].map(scale => h(View, { key: scale, style: { position: 'absolute', width: size * scale, height: size * scale, borderRadius: size, borderWidth: size / 18, borderColor: color, right: -size * scale / 2, top: -size * scale / 2 } }));
  return h(View, { pointerEvents: 'none', accessible: false, importantForAccessibility: 'no-hide-descendants', style: { position: 'absolute', right: 0, top: 0, width: size, height: size, overflow: 'hidden', opacity: 0.14 * c.patternStrength } }, ...parts);
}

export function SectionBanner({ title, detail, icon = 'sliders', tone }) {
  return h(View, { style: { padding: 20, borderRadius: 24, backgroundColor: tone.bg, marginBottom: 20, overflow: 'hidden', minHeight: 100 } },
    h(Pattern, { kind: tone.pattern, color: tone.ink }),
    h(Feather, { name: icon, size: 24, color: tone.ink, style: { marginBottom: 12 } }),
    h(Text, { style: { color: tone.ink, fontSize: 22, fontWeight: '700', maxWidth: '85%' } }, title),
    h(Text, { style: { color: tone.ink, fontSize: 13, lineHeight: 20, marginTop: 6, maxWidth: '90%' } }, detail));
}

export function FallbackArt({ size, seed = 0 }) {
  const c = useTheme(), palettes = c.fallbackPalettes;
  const colors = palettes[Math.abs(Math.trunc(Number(seed) || 0)) % palettes.length];
  return h(Svg, { width: size, height: size, viewBox: '0 0 240 240', accessible: false },
    h(Rect, { width: 240, height: 240, fill: colors[0] }),
    h(Circle, { cx: 168, cy: 70, r: 43, fill: colors[2] }),
    h(Path, { d: 'M-20 170Q40 60 115 144T260 142V260H-20Z', fill: colors[1] }),
    h(Path, { d: 'M-20 220Q58 112 136 195T260 185V260H-20Z', fill: colors[3] }),
    h(Path, { d: 'M0 182Q67 140 135 182T260 171M0 198Q67 156 135 198T260 187', fill: 'none', stroke: c.dark ? c.spindle : '#FFFFFF', strokeOpacity: 0.45, strokeWidth: 3 }));
}
