import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useMotionAllowed } from './PlaybackMotion';
const h = React.createElement;
export function BrandMark({ size = 120 }) {
  return h(Svg, { width: size, height: size, viewBox: '0 0 108 108', accessible: false },
    h(Circle, { cx: 54, cy: 54, r: 33, fill: '#7353BB' }),
    ...[29, 25, 21, 14].map(r => h(Circle, { key: r, cx: 54, cy: 54, r, fill: 'none', stroke: '#C9B4EF', strokeWidth: r === 14 ? 0.9 : 0.5 })),
    h(Path, { d: 'M50 48Q50 47 51 47.6L61 53.2Q62 54 61 54.8L51 60.4Q50 61 50 60Z', fill: '#FFFFFF' }));
}
export default function Startup({ c, error, onRetry, onLayout }) {
  const motion = useMotionAllowed(!error), phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(phase, { toValue: 1, duration: 1000, useNativeDriver: true, isInteraction: false }),
      Animated.timing(phase, { toValue: 0, duration: 1000, useNativeDriver: true, isInteraction: false }),
    ]));
    if (motion) loop.start(); else phase.setValue(0);
    return () => loop.stop();
  }, [motion, phase]);
  return h(View, { onLayout, style: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 } },
    h(Animated.View, { style: { transform: [{ scale: phase.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }], opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) } }, h(BrandMark, { size: 180 })),
    h(Text, { accessibilityRole: 'header', style: { color: c.ink, fontWeight: '700', fontSize: 28 } }, 'Aiplayed'),
    h(Text, { accessibilityLiveRegion: 'polite', style: { color: c.muted, fontSize: 16, textAlign: 'center' } }, error || 'Opening your music…'),
    error && h(Pressable, { onPress: onRetry, accessibilityRole: 'button', android_ripple: { color: '#7353BB18' }, style: { minHeight: 48, padding: 16, borderRadius: 24, overflow: 'hidden', backgroundColor: c.lavender } }, h(Text, { style: { color: c.accent, fontWeight: '600', fontSize: 16 } }, 'Try again')));
}
