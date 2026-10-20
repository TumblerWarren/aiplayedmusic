import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, View } from 'react-native';
const h = React.createElement;

export function useMotionAllowed(playing) {
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
  const turn = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(glow, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    if (allowed) loop.start();
    else glow.setValue(0);
    return () => loop.stop();
  }, [allowed, glow]);
  useEffect(() => {
    let cancelled = false, loop;
    turn.stopAnimation(value => {
      if (!allowed || cancelled) return;
      // One complete revolution has the same visual orientation at the loop seam.
      loop = Animated.loop(Animated.timing(turn, { toValue: value + 1, duration: 14000, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
      loop.start();
    });
    return () => { cancelled = true; loop?.stop(); turn.stopAnimation(); };
  }, [allowed, turn]);
  const disc = size * 0.9;
  return h(View, { style: { width: size, height: size, alignItems: 'center', justifyContent: 'center' } },
    h(Animated.View, { pointerEvents: 'none', accessible: false, style: { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.07, 0.18] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] } }),
    h(Animated.View, { style: { width: disc, height: disc, borderRadius: disc / 2, backgroundColor: '#30263F', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] } },
      ...[0.92, 0.84, 0.76, 0.68].map(scale => h(View, { key: scale, style: { position: 'absolute', width: disc * scale, height: disc * scale, borderRadius: disc, borderWidth: 1.2, borderColor: '#665473' } })),
      h(View, { style: { width: size * 0.52, height: size * 0.52, borderRadius: size, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' } }, children),
      h(View, { pointerEvents: 'none', style: { position: 'absolute', width: size * 0.055, height: size * 0.055, borderRadius: size, backgroundColor: '#FFFBF6', borderWidth: 2, borderColor: '#30263F' } })),
    h(Animated.View, { pointerEvents: 'none', accessible: false, style: { position: 'absolute', width: size * 0.96, height: size * 0.96, opacity: playing ? 0.75 : 0, transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] }) }] } },
      ...[{ left: '27%', top: '3%', scale: 1 }, { right: '13%', bottom: '14%', scale: 0.65 }].map(({ scale, ...position }, i) => h(View, { key: i, style: { position: 'absolute', ...position, width: Math.max(3, size * 0.025 * scale), height: Math.max(3, size * 0.025 * scale), borderRadius: size, backgroundColor: color } }))),
    h(View, { pointerEvents: 'none', style: { position: 'absolute', right: size * 0.03, top: size * 0.03, width: size * 0.08, height: size * 0.38, borderRadius: 8, backgroundColor: '#C9B4EF', transform: [{ rotate: '25deg' }] } }),
    h(View, { pointerEvents: 'none', style: { position: 'absolute', right: size * 0.045, top: size * 0.025, width: size * 0.09, height: size * 0.09, borderRadius: size, backgroundColor: color } }));
}

export function PlaybackRipple({ playing, color, children, maxScale = 1.4 }) {
  const allowed = useMotionAllowed(playing);
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(phase, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false }));
    if (allowed) loop.start();
    else phase.setValue(0);
    return () => loop.stop();
  }, [allowed, phase]);
  return h(View, { style: { alignItems: 'center', justifyContent: 'center' } },
    h(Animated.View, { pointerEvents: 'none', accessible: false, style: { position: 'absolute', width: '100%', height: '100%', borderRadius: 100, borderWidth: 1.5, borderColor: color, opacity: allowed ? phase.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.28, 0] }) : 0, transform: [{ scale: phase.interpolate({ inputRange: [0, 1], outputRange: [1, maxScale] }) }] } }),
    children);
}

