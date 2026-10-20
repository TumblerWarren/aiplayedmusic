import React, { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

const h = React.createElement;

// A touch-through scrim softens both the viewport and sticky-header edges.
export function ScrollEdge({ color, style }) {
  const gradient = `scroll-edge-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return h(View, { pointerEvents: 'none', accessible: false, importantForAccessibility: 'no-hide-descendants', style: [{ position: 'absolute', top: 0, left: 0, right: 0, height: 22 }, style] },
      h(Svg, { width: '100%', height: 22, accessible: false },
        h(Defs, null, h(LinearGradient, { id: gradient, x1: '0%', y1: '0%', x2: '0%', y2: '100%' },
          h(Stop, { offset: '0%', stopColor: color, stopOpacity: 0.95 }),
          h(Stop, { offset: '45%', stopColor: color, stopOpacity: 0.4 }),
          h(Stop, { offset: '100%', stopColor: color, stopOpacity: 0 }))),
        h(Rect, { width: '100%', height: '100%', fill: `url(#${gradient})` })));
}
export default function ScrollSurface({ color, children }) {
  return h(View, { style: { flex: 1, minHeight: 0 } }, children, h(ScrollEdge, { color }));
}
