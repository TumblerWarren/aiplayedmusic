import React, { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, ScrollView, Text, View, useColorScheme } from 'react-native';
import { useMotionAllowed } from './PlaybackMotion';
const h = React.createElement;
export function BrandMark({ size = 120 }) {
  return h(Image, { source: require('../assets/aiplayed-icon.png'), style: { width: size, height: size }, resizeMode: 'contain', accessible: false });
}
export default function Startup({ c, error, onRetry, onLayout }) {
  const motion = useMotionAllowed(!error), phase = useRef(new Animated.Value(0)).current;
  const backgroundColor = useColorScheme() === 'dark' ? '#1D1B26' : '#F2ECFF';
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(phase, { toValue: 1, duration: 1000, useNativeDriver: true, isInteraction: false }),
      Animated.timing(phase, { toValue: 0, duration: 1000, useNativeDriver: true, isInteraction: false }),
    ]));
    if (motion) loop.start(); else phase.setValue(0);
    return () => loop.stop();
  }, [motion, phase]);
  const title = h(Text, { accessibilityRole: 'header', style: { color: c.ink, fontWeight: '700', fontSize: 28 } }, 'Aiplayed');
  const detail = h(Text, { accessibilityLiveRegion: 'polite', style: { color: c.muted, fontSize: 16, textAlign: 'center' } }, error || 'Opening your music…');
  return h(View, { onLayout, style: { flex: 1, backgroundColor, alignItems: 'center', justifyContent: 'center' } },
    error ? h(ScrollView, { style: { alignSelf: 'stretch' }, contentContainerStyle: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 } },
      h(BrandMark, { size: 180 }), title, detail,
      h(Pressable, { onPress: onRetry, accessibilityRole: 'button', android_ripple: { color: '#7353BB18' }, style: { minHeight: 48, padding: 16, borderRadius: 24, overflow: 'hidden', backgroundColor: c.lavender } }, h(Text, { style: { color: c.accent, fontWeight: '600', fontSize: 16 } }, 'Try again')))
      : h(React.Fragment, null,
        // Match native splash image, size and center; the text cannot shift the logo.
        h(Animated.View, { style: { transform: [{ scale: phase.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }], opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) } }, h(BrandMark, { size: 180 })),
        h(View, { style: { position: 'absolute', top: '50%', marginTop: 110, left: 28, right: 28, alignItems: 'center', gap: 18 } }, title, detail)));
}
