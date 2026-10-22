import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, View } from 'react-native';
import { useTheme } from './ThemeProvider';
const h = React.createElement;

const MotionContext = createContext({ active: false, reduced: true });
export function MotionProvider({ children }) {
  const [reduced, setReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const app = AppState.addEventListener('change', value => setActive(value === 'active'));
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);
  const value = useMemo(() => ({ active, reduced }), [active, reduced]);
  return h(MotionContext.Provider, { value }, children);
}
export function useAppActive() { return useContext(MotionContext).active; }
export function useMotionAllowed(playing) {
  const { active, reduced } = useContext(MotionContext);
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

export function PlayingArtwork({ playing, color, children, size, variant = 'Pulse' }) {
  const c = useTheme();
  const style = ['Pulse', 'Wave', 'Orbit'].includes(variant) ? variant : 'Pulse';
  const allowed = useMotionAllowed(playing);
  const rotating = allowed && style === 'Orbit';
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
  }, [allowed, style, glow]);
  useEffect(() => {
    let cancelled = false, loop;
    turn.stopAnimation(value => {
      if (!rotating || cancelled) return;
      // One complete revolution has the same visual orientation at the loop seam.
      loop = Animated.loop(Animated.timing(turn, { toValue: value + 1, duration: 14000, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
      loop.start();
    });
    return () => { cancelled = true; loop?.stop(); turn.stopAnimation(); };
  }, [rotating, style, turn]);
  const circle = { position: 'absolute', width: size * .9, height: size * .9, borderRadius: size / 2 };
  const breathing = glow.interpolate({ inputRange: [0, 1], outputRange: [.94, 1.04] });
  return h(View, { testID: `artwork-animation-${style.toLowerCase()}`, collapsable: false, style: { width: size, height: size, alignItems: 'center', justifyContent: 'center' } },
    style === 'Pulse' && [1, .84, .68].map((scale, i) => h(Animated.View, { key: i, pointerEvents: 'none', accessible: false, style: { ...circle, width: size * .9 * scale, height: size * .9 * scale, borderWidth: 2, borderColor: color, opacity: allowed ? glow.interpolate({ inputRange: [0, 1], outputRange: [.3 - i * .05, .08] }) : .12, transform: [{ scale: breathing }] } })),
    style === 'Wave' && [-1, 0, 1].map((wave, i) => h(Animated.View, { key: i, pointerEvents: 'none', accessible: false, style: { ...circle, width: size * .8, height: size * (.38 + i * .1), backgroundColor: color, opacity: .08 + i * .04, transform: [{ rotate: `${wave * 24}deg` }, { scaleX: glow.interpolate({ inputRange: [0, 1], outputRange: [i % 2 ? .86 : 1, i % 2 ? 1 : .86] }) }, { translateY: glow.interpolate({ inputRange: [0, 1], outputRange: [-size * .025 * wave, size * .025 * wave] }) }] } })),
    style === 'Orbit' && h(Animated.View, { pointerEvents: 'none', accessible: false, style: { ...circle, borderWidth: 1, borderColor: color, transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] } },
      ...Array.from({ length: 6 }, (_, i) => {
        const angle = i * Math.PI / 3, dot = size * (i % 2 ? .025 : .04);
        return h(View, { key: i, style: { position: 'absolute', left: size * .45 * (1 + Math.cos(angle)) - dot / 2, top: size * .45 * (1 + Math.sin(angle)) - dot / 2, width: dot, height: dot, borderRadius: dot, backgroundColor: color } });
      })),
    h(Animated.View, { style: { width: size * .68, height: size * .68, borderRadius: size * .22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, transform: style === 'Wave' ? [{ translateY: glow.interpolate({ inputRange: [0, 1], outputRange: [0, -size * .025] }) }] : [{ scale: !allowed ? 1 : breathing }] } }, children));
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

