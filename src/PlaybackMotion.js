import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, View } from 'react-native';
const h = React.createElement;

function useMotionAllowed(playing) {
  // Stay still until the accessibility preference has been read.
  const [reduced, setReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const app = AppState.addEventListener('change', value => setActive(value === 'active'));
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);
  return playing && active && !reduced;
}

export function PlayingBars({ playing, color, size = 24 }) {
  const allowed = useMotionAllowed(playing);
  const values = useRef(Array.from({ length: 4 }, () => new Animated.Value(0.25))).current;
  useEffect(() => {
    const loops = values.map((value, i) => Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: [0.7, 1, 0.85, 0.6][i], duration: 280 + i * 70, useNativeDriver: true, isInteraction: false }),
      Animated.timing(value, { toValue: 0.2, duration: 330 + (3 - i) * 60, useNativeDriver: true, isInteraction: false }),
    ])));
    if (allowed) loops.forEach(loop => loop.start());
    else values.forEach((value, i) => value.setValue(playing ? [0.45, 0.8, 1, 0.6][i] : 0.25));
    return () => loops.forEach(loop => loop.stop());
  }, [allowed, playing, values]);
  return h(View, { accessible: false, pointerEvents: 'none', style: { width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' } },
    ...values.map((value, i) => h(Animated.View, { key: i, style: { width: Math.max(2, size / 8), height: size * 0.85, borderRadius: 3, backgroundColor: color, transform: [{ scaleY: value }] } })));
}

export function PlayingArtwork({ playing, color, children, size }) {
  const allowed = useMotionAllowed(playing);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 1600, useNativeDriver: true, isInteraction: false }),
      Animated.timing(progress, { toValue: 0, duration: 1600, useNativeDriver: true, isInteraction: false }),
    ]));
    if (allowed) loop.start();
    else progress.setValue(0);
    return () => loop.stop();
  }, [allowed, progress]);
  return h(View, { style: { width: size, height: size, alignItems: 'center', justifyContent: 'center' } },
    playing && h(Animated.View, { pointerEvents: 'none', style: { position: 'absolute', width: size, height: size, borderRadius: 44, backgroundColor: color, opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.28] }), transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1.02, 1.08] }) }] } }),
    h(Animated.View, { style: { transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) }] } }, children));
}
