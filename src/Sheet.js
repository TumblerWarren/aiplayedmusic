import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Modal, PanResponder, Pressable, ScrollView, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMotionAllowed } from './PlaybackMotion';
const h = React.createElement;

export function restoreFocus(target) {
  requestAnimationFrame(() => {
    const view = target && typeof target === 'object' && 'current' in target ? target.current : target;
    if (!view) return;
    const node = typeof view === 'number' ? view : findNodeHandle(view);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
    target?.current?.focus?.();
  });
}
export default function Sheet({ visible, title, c, onClose, returnFocus, children }) {
  const motion = useMotionAllowed(true), { height } = useWindowDimensions();
  const heading = useRef(null), drag = useRef(new Animated.Value(0)).current;
  const latest = useRef({ onClose }); latest.current = { onClose };
  const wasOpen = useRef(false), focusTarget = useRef(null);
  if (visible) focusTarget.current = returnFocus;
  useEffect(() => {
    if (visible) drag.setValue(0);
    else if (wasOpen.current) { const timer = setTimeout(() => restoreFocus(focusTarget.current), motion ? 320 : 0); wasOpen.current = false; return () => clearTimeout(timer); }
    wasOpen.current = visible;
  }, [visible, drag, motion]);
  const pan = useMemo(() => {
    let cancelled = false;
    return PanResponder.create({
      // Only the handle owns this responder, so claim its touch before Android
      // hands a moving pointer to the sheet's scrollable native content.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.numberActiveTouches === 1 && g.dy > 8 && g.dy > Math.abs(g.dx) * 1.5,
      onPanResponderGrant: (_, g) => { cancelled = g?.numberActiveTouches > 1; },
      onPanResponderMove: (_, g) => { if (g.numberActiveTouches > 1) cancelled = true; if (!cancelled) drag.setValue(Math.max(0, g.dy)); },
      onPanResponderRelease: (_, g) => {
        if (!cancelled && g.dy > 64 && g.dy > Math.abs(g.dx) * 1.5) latest.current.onClose();
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => { cancelled = true; drag.setValue(0); }, onPanResponderTerminationRequest: () => false,
    });
  }, [drag]);
  return h(Modal, { visible, transparent: true, animationType: motion ? 'slide' : 'none', onRequestClose: onClose, onShow: () => restoreFocus(heading) },
    h(View, { style: { flex: 1, justifyContent: 'flex-end' } },
      h(Pressable, { onPress: onClose, accessibilityRole: 'button', accessibilityLabel: 'Close sheet', style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0007' } }),
      h(Animated.View, { style: { maxHeight: height * 0.9, backgroundColor: c.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden', transform: [{ translateY: drag }] } },
        h(SafeAreaView, { edges: ['bottom'], style: { flexShrink: 1 } },
          h(View, { ...pan.panHandlers, accessibilityLabel: 'Drag down to close', style: { minHeight: 48, justifyContent: 'center', alignItems: 'center' } }, h(View, { style: { width: 40, height: 4, borderRadius: 4, backgroundColor: c.track } })),
          h(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 } },
            h(Text, { ref: heading, accessibilityRole: 'header', style: { flex: 1, color: c.ink, fontSize: 24, fontWeight: '700' } }, title),
            h(Pressable, { onPress: onClose, accessibilityRole: 'button', accessibilityLabel: 'Close', android_ripple: { color: '#7353BB18' }, style: { minHeight: 48, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 24, overflow: 'hidden', backgroundColor: c.lavender } }, h(Text, { style: { color: c.accent, fontWeight: '600', fontSize: 15 } }, 'Close'))),
          h(ScrollView, { style: { flexShrink: 1 }, contentContainerStyle: { paddingHorizontal: 20, paddingBottom: 16 }, keyboardShouldPersistTaps: 'handled' }, children)))));
}
