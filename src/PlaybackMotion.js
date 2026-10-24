import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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

// Periodic samples keep every decoration continuous at the native loop seam.
// Only transforms and opacity change; layout stays still.
function cycle(phase, offset, low, high) {
  const inputRange = Array.from({ length: 33 }, (_, i) => i / 32);
  return phase.interpolate({ inputRange, outputRange: inputRange.map(t => low + (high - low) * (1 - Math.cos((t + offset) * Math.PI * 2)) / 2) });
}

export function PlayingArtwork({ playing, color, children, size, variant = 'Pulse' }) {
  const c = useTheme();
  const style = ['Pulse', 'Wave', 'Orbit', 'Equalizer', 'Disc'].includes(variant) ? variant : 'Pulse';
  const allowed = useMotionAllowed(playing);
  const clock = useRef(new Animated.Value(0)).current;
  const offset = useRef(new Animated.Value(0)).current;
  const origin = useRef(0);
  const phase = useMemo(() => Animated.modulo(Animated.add(clock, offset), 1), [clock, offset]);
  useEffect(() => {
    let cancelled = false, loop;
    const duration = style === 'Disc' ? 14000 : style === 'Orbit' ? 10000 : style === 'Wave' ? 5400 : style === 'Equalizer' ? 1800 : 3200;
    clock.stopAnimation(value => {
      if (cancelled) return;
      // Preserve orientation through pause/resume. Modulo makes the native clock
      // reset visually identical, including when resumed partway through a turn.
      origin.current = (origin.current + value) % 1;
      offset.setValue(origin.current);
      clock.setValue(0);
      if (!allowed) return;
      loop = Animated.loop(Animated.timing(clock, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
      loop.start();
    });
    return () => { cancelled = true; loop?.stop(); clock.stopAnimation(); };
  }, [allowed, style, clock, offset]);
  const decoration = { pointerEvents: 'none', accessible: false, importantForAccessibility: 'no-hide-descendants' };
  const circle = { position: 'absolute', width: size * .92, height: size * .92, borderRadius: size / 2 };
  const rotation = phase.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const disc = size * 0.9;
  if (style === 'Disc')
  return h(View, { testID: 'artwork-animation-disc', collapsable: false, style: { width: size, height: size, alignItems: 'center', justifyContent: 'center' } },
    h(Animated.View, { pointerEvents: 'none', accessible: false, style: { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: cycle(phase, 0, .07, .18), transform: [{ scale: cycle(phase, 0, .94, 1) }] } }),
    h(Animated.View, { testID: 'rotating-vinyl-disc', style: { width: disc, height: disc, borderRadius: disc / 2, backgroundColor: c.vinyl, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: phase.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] } },
      ...[0.92, 0.84, 0.76, 0.68].map(scale => h(View, { key: scale, style: { position: 'absolute', width: disc * scale, height: disc * scale, borderRadius: disc, borderWidth: 1.2, borderColor: c.groove } })),
      h(View, { testID: 'circular-album-label', style: { width: size * 0.52, height: size * 0.52, borderRadius: size, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' } }, children),
      h(View, { pointerEvents: 'none', style: { position: 'absolute', width: size * 0.055, height: size * 0.055, borderRadius: size, backgroundColor: c.spindle, borderWidth: 2, borderColor: c.vinyl } })),
    h(Animated.View, { pointerEvents: 'none', accessible: false, style: { position: 'absolute', width: size * 0.96, height: size * 0.96, opacity: playing ? 0.75 : 0, transform: [{ rotate: phase.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] }) }] } },
      ...[{ left: '27%', top: '3%', scale: 1 }, { right: '13%', bottom: '14%', scale: 0.65 }].map(({ scale, ...position }, i) => h(View, { key: i, style: { position: 'absolute', ...position, width: Math.max(3, size * 0.025 * scale), height: Math.max(3, size * 0.025 * scale), borderRadius: size, backgroundColor: color } }))),
    h(View, { pointerEvents: 'none', style: { position: 'absolute', right: size * 0.03, top: size * 0.03, width: size * 0.08, height: size * 0.38, borderRadius: 8, backgroundColor: c.tonearm, transform: [{ rotate: '25deg' }] } }),
    h(View, { pointerEvents: 'none', style: { position: 'absolute', right: size * 0.045, top: size * 0.025, width: size * 0.09, height: size * 0.09, borderRadius: size, backgroundColor: color } }));
  return h(View, { testID: `artwork-animation-${style.toLowerCase()}`, collapsable: false, style: { width: size, height: size, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } },
    style === 'Pulse' && [0, 1 / 3, 2 / 3].map((offset, i) => {
      // Wrap only while invisible, so the expanding wave never snaps on screen.
      const points = Array.from({ length: 49 }, (_, j) => j / 48);
      const age = t => (t + offset) % 1;
      return h(Animated.View, { key: i, ...decoration, style: { ...circle, borderWidth: i === 1 ? 2.5 : 1.5, borderColor: i === 1 ? c.mintInk : color,
        opacity: phase.interpolate({ inputRange: points, outputRange: points.map(t => Math.sin(age(t) * Math.PI) ** 2 * .66) }),
        transform: [{ scale: phase.interpolate({ inputRange: points, outputRange: points.map(t => .78 + .28 * age(t)) }) }] } });
    }),
    style === 'Wave' && [0, 1, 2].map(i => h(Animated.View, { key: i, ...decoration, style: { position: 'absolute', width: size, height: size, opacity: .5 - i * .1,
      transform: [{ translateX: cycle(phase, i / 3, -size * .045, size * .045) }, { translateY: cycle(phase, i / 3 + .25, -size * .065, size * .065) }, { rotate: phase.interpolate({ inputRange: [0, .25, .5, .75, 1], outputRange: ['-4deg', '0deg', '4deg', '0deg', '-4deg'] }) }] } },
      h(Svg, { width: size, height: size, viewBox: '0 0 300 300' }, h(Path, { d: `M12 ${155 + i * 10} C32 6 114 12 156 142 S260 290 288 ${135 - i * 10} C260 254 206 224 146 154 S48 36 12 ${155 + i * 10}Z`, fill: i === 1 ? c.mintInk : color })))),
    style === 'Orbit' && h(Animated.View, { ...decoration, style: { ...circle, borderWidth: 1, borderColor: c.line, transform: [{ rotate: rotation }] } },
      ...Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, trail) => {
        const angle = i * Math.PI * 2 / 5 - trail * .065, dot = size * (trail ? .022 - trail * .003 : .038);
        return h(View, { key: `${i}:${trail}`, style: { position: 'absolute', left: size * .46 * (1 + Math.cos(angle)) - dot / 2, top: size * .46 * (1 + Math.sin(angle)) - dot / 2, width: dot, height: dot, borderRadius: dot, backgroundColor: i % 2 ? c.mintInk : color, opacity: trail ? .5 - trail * .09 : .95 } });
      }))),
    style === 'Equalizer' && h(View, { ...decoration, style: { position: 'absolute', bottom: size * .005, width: size * .68, height: size * .15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } },
      ...Array.from({ length: 11 }, (_, i) => h(Animated.View, { key: i, style: { width: size * .033, height: size * .15, borderRadius: size * .017, backgroundColor: i % 3 === 0 ? c.mintInk : color, transform: [{ scaleY: phase.interpolate({ inputRange: Array.from({ length: 49 }, (_, j) => j / 48), outputRange: Array.from({ length: 49 }, (_, j) => .16 + .84 * ((1 + Math.sin(j / 48 * Math.PI * 4 + i * 1.7)) / 2) * (.6 + .4 * (1 + Math.cos(j / 48 * Math.PI * 6 - i * .8)) / 2)) }) }] } }))),
    h(View, { testID: 'stationary-album-cover', style: { width: size * .64, height: size * .64, borderRadius: size * .055, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line } }, children));
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

