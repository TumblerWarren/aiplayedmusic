import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Path } from 'react-native-svg';
import { clampKnob, rotationDelta, steppedKnob } from './rotaryGeometry';
const h = React.createElement;
const SIZE = 128, CENTER = SIZE / 2, SWEEP = Math.PI * 1.5;
const point = (angle, r = 57) => ({ x: CENTER + Math.sin(angle) * r, y: CENTER - Math.cos(angle) * r });
const arc = (start, end) => { const a = point(start), b = point(end); return `M${a.x} ${a.y}A57 57 0 ${end - start > Math.PI ? 1 : 0} 1 ${b.x} ${b.y}`; };

export default function RotaryKnob({ value, minimumValue: min, maximumValue: max, step = 1, disabled = false, onSlidingStart, onValueChange, onSlidingComplete, onCancel, accessibilityLabel: label, accessibilityValue, c }) {
  const ratio = useSharedValue((value - min) / (max - min)), initial = useSharedValue(0), last = useSharedValue(0), angleValid = useSharedValue(false), dragging = useSharedValue(false), cancelled = useSharedValue(false), rounded = useSharedValue(value);
  const callbacks = useRef(null); callbacks.current = { onSlidingStart, onValueChange, onSlidingComplete, onCancel };
  const begin = useCallback(v => callbacks.current.onSlidingStart?.(v), []);
  const move = useCallback(v => callbacks.current.onValueChange?.(v), []);
  const finish = useCallback(v => callbacks.current.onSlidingComplete?.(v), []);
  const cancel = useCallback(() => callbacks.current.onCancel?.(), []);
  useEffect(() => { if (!dragging.value) { ratio.value = clampKnob((value - min) / (max - min), 0, 1); rounded.value = value; } }, [value, min, max]);
  const gesture = useMemo(() => Gesture.Pan().enabled(!disabled).minDistance(3).maxPointers(1)
    .onTouchesDown((event, manager) => { if (event.numberOfTouches > 1) { cancelled.value = true; manager.fail(); } })
    .onBegin(event => {
      cancelled.value = false; initial.value = ratio.value;
      last.value = Math.atan2(event.y - CENTER, event.x - CENTER);
      angleValid.value = Math.hypot(event.x - CENTER, event.y - CENTER) >= 18;
    })
    .onStart(() => { dragging.value = true; runOnJS(begin)(rounded.value); })
    .onTouchesMove((event, manager) => { if (event.numberOfTouches > 1) { cancelled.value = true; manager.fail(); } })
    .onUpdate(event => {
      if (cancelled.value) return;
      const nextAngle = Math.atan2(event.y - CENTER, event.x - CENTER);
      if (Math.hypot(event.x - CENTER, event.y - CENTER) < 18) { angleValid.value = false; return; }
      if (!angleValid.value) { last.value = nextAngle; angleValid.value = true; return; }
      ratio.value = clampKnob(ratio.value + rotationDelta(nextAngle, last.value) / SWEEP, 0, 1); last.value = nextAngle;
      const next = steppedKnob(min + ratio.value * (max - min), min, max, step);
      if (next !== rounded.value) { rounded.value = next; runOnJS(move)(next); }
    })
    .onFinalize((event, success) => {
      if (!dragging.value) return;
      dragging.value = false;
      if (success && !cancelled.value) { ratio.value = (rounded.value - min) / (max - min); runOnJS(finish)(rounded.value); }
      else { ratio.value = initial.value; rounded.value = steppedKnob(min + initial.value * (max - min), min, max, step); runOnJS(cancel)(); }
    }), [disabled, min, max, step, begin, move, finish, cancel]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ rotate: `${-135 + ratio.value * 270}deg` }] }));
  const adjust = direction => {
    if (disabled) return;
    const before = rounded.value, next = steppedKnob(before + direction * step, min, max, step);
    if (next === before) return;
    rounded.value = next; ratio.value = (next - min) / (max - min);
    begin(before); move(next); finish(next);
  };
  const action = (direction, glyph) => h(Pressable, { onPress: () => adjust(direction), disabled, accessibilityRole: 'button', accessibilityLabel: `${direction > 0 ? 'Increase' : 'Decrease'} ${label}`, style: ({ pressed }) => ({ minWidth: 48, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? direction > 0 ? c.mint : c.peach : c.card, alignItems: 'center', justifyContent: 'center' }) }, h(Text, { style: { color: c.ink, fontSize: 25, lineHeight: 30 } }, glyph));
  return h(View, { style: { alignItems: 'center', gap: 6 } },
    h(GestureDetector, { gesture }, h(Animated.View, { testID: `knob-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, accessible: true, accessibilityRole: 'adjustable', accessibilityLabel: label, accessibilityValue, accessibilityState: { disabled }, accessibilityHint: 'Rotate clockwise to increase or anticlockwise to decrease.', accessibilityActions: [{ name: 'increment' }, { name: 'decrement' }], onAccessibilityAction: e => adjust(e.nativeEvent.actionName === 'increment' ? 1 : -1), style: { width: SIZE, height: SIZE } },
      h(Svg, { width: SIZE, height: SIZE, viewBox: `0 0 ${SIZE} ${SIZE}`, accessible: false },
        h(Path, { d: arc(-Math.PI * 0.75, Math.PI * 0.75), fill: 'none', stroke: c.line, strokeWidth: 7, strokeLinecap: 'round' }),
        ...['#BCA5E6', '#8ECDB7', '#F2B09D'].map((color, i) => h(Path, { key: color, d: arc(-Math.PI * 0.75 + i * Math.PI / 2 + 0.04, -Math.PI * 0.75 + (i + 1) * Math.PI / 2 - 0.04), fill: 'none', stroke: color, strokeWidth: 7, strokeLinecap: 'round' })),
        ...Array.from({ length: 11 }, (_, i) => { const p = point(-Math.PI * 0.75 + i * SWEEP / 10, 49); return h(Circle, { key: i, cx: p.x, cy: p.y, r: 1.5, fill: c.track }); }),
        h(Circle, { cx: CENTER, cy: CENTER + 2, r: 42, fill: c.track, opacity: 0.25 }),
        h(Circle, { cx: CENTER, cy: CENTER, r: 42, fill: c.card, stroke: c.line, strokeWidth: 1.5 })),
      h(Animated.View, { pointerEvents: 'none', style: [{ position: 'absolute', width: SIZE, height: SIZE, alignItems: 'center' }, indicator] }, h(View, { style: { marginTop: 26, width: 4, height: 19, borderRadius: 2, backgroundColor: c.ink } })))),
    h(Text, { style: { maxWidth: 140, minHeight: 22, textAlign: 'center', color: c.ink, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] } }, accessibilityValue.text),
    h(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 16 } }, action(-1, '−'), action(1, '+')));
}
