import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
const h = React.createElement;

// Pure native shapes: no image downloads, extra permissions or rendering dependency.
export function Pattern({ kind = 'arcs', color, size = 112 }) {
  const parts = kind === 'checks'
    ? Array.from({ length: 16 }, (_, i) => h(View, { key: i, style: { position: 'absolute', width: size / 4, height: size / 4, left: (i % 4) * size / 4, top: Math.floor(i / 4) * size / 4, backgroundColor: (i + Math.floor(i / 4)) % 2 ? color : 'transparent' } }))
    : kind === 'stripes'
      ? Array.from({ length: 7 }, (_, i) => h(View, { key: i, style: { position: 'absolute', width: size * 1.6, height: size / 12, left: -size / 3, top: i * size / 4 - size / 3, backgroundColor: color, transform: [{ rotate: '-40deg' }] } }))
      : [1, 0.76, 0.52, 0.28].map(scale => h(View, { key: scale, style: { position: 'absolute', width: size * scale, height: size * scale, borderRadius: size, borderWidth: size / 18, borderColor: color, right: -size * scale / 2, top: -size * scale / 2 } }));
  return h(View, { pointerEvents: 'none', accessible: false, importantForAccessibility: 'no-hide-descendants', style: { position: 'absolute', right: 0, top: 0, width: size, height: size, overflow: 'hidden', opacity: 0.14 } }, ...parts);
}

export function SectionBanner({ title, detail, icon = 'sliders', tone }) {
  return h(View, { style: { padding: 20, borderRadius: 24, backgroundColor: tone.bg, marginBottom: 20, overflow: 'hidden', minHeight: 100 } },
    h(Pattern, { kind: tone.pattern, color: tone.ink }),
    h(Feather, { name: icon, size: 24, color: tone.ink, style: { marginBottom: 12 } }),
    h(Text, { style: { color: tone.ink, fontSize: 22, fontWeight: '700', maxWidth: '85%' } }, title),
    h(Text, { style: { color: tone.ink, fontSize: 13, lineHeight: 20, marginTop: 6, maxWidth: '90%' } }, detail));
}

export function FallbackArt({ size, seed = 0 }) {
  const palettes = [['#E9DFFC', '#A895D8', '#F5BCAC', '#83BAAA'], ['#DDF2E7', '#74AD9A', '#B6CEF0', '#F2CB83'], ['#FFE1D7', '#D797A8', '#C6B5EB', '#F0C56F']];
  const colors = palettes[Math.abs(seed) % palettes.length];
  return h(View, { style: [StyleSheet.absoluteFillObject, { backgroundColor: colors[0], overflow: 'hidden' }], accessible: false },
    h(View, { style: { position: 'absolute', width: size * 0.48, height: size * 0.48, borderRadius: size, backgroundColor: colors[2], top: size * 0.12, right: size * 0.08 } }),
    h(View, { style: { position: 'absolute', width: size * 1.1, height: size * 0.8, borderRadius: size * 0.3, backgroundColor: colors[1], top: size * 0.48, left: -size * 0.3, transform: [{ rotate: '-30deg' }] } }),
    h(View, { style: { position: 'absolute', width: size, height: size * 0.7, borderRadius: size * 0.3, backgroundColor: colors[3], top: size * 0.7, right: -size * 0.26, transform: [{ rotate: '32deg' }] } }),
    h(Pattern, { kind: 'stripes', color: '#FFFFFF', size: size * 0.6 }));
}
