import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, KeyboardAvoidingView, Modal, PanResponder, ScrollView, Text, View, findNodeHandle, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMotionAllowed } from './PlaybackMotion';
import Pressable from './RoundedPressable';
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
export default function Sheet({ visible, title, c, onClose, returnFocus, children, scrollable = true }) {
  const motion = useMotionAllowed(true), { height } = useWindowDimensions();
  const heading = useRef(null), drag = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const [presented, setPresented] = useState(visible);
  const visibleNow = useRef(visible); visibleNow.current = visible;
  // Keep the last menu intact until its exit animation has finished.
  const content = useRef({ title, children, scrollable });
  if (visible) content.current = { title, children, scrollable };
  const latest = useRef({ onClose }); latest.current = { onClose };
  const wasOpen = useRef(false), focusTarget = useRef(null);
  if (visible) focusTarget.current = returnFocus;
  useEffect(() => {
    let animation;
    const closed = () => {
      if (visibleNow.current) return;
      setPresented(false);
      if (wasOpen.current) restoreFocus(focusTarget.current);
      wasOpen.current = false;
    };
    if (visible) {
      setPresented(true); wasOpen.current = true; drag.setValue(0);
      if (motion) {
        animation = Animated.timing(reveal, { toValue: 1, duration: 240, useNativeDriver: true, isInteraction: false });
        animation.start();
      } else reveal.setValue(1);
    } else if (motion && wasOpen.current) {
      animation = Animated.timing(reveal, { toValue: 0, duration: 180, useNativeDriver: true, isInteraction: false });
      animation.start(({ finished }) => { if (finished) closed(); });
    } else { reveal.setValue(0); closed(); }
    return () => animation?.stop();
  }, [visible, drag, reveal, motion]);
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
  return h(Modal, { visible: visible || presented, transparent: true, animationType: 'none', onRequestClose: onClose, onShow: () => { if (visibleNow.current) restoreFocus(heading); } },
    h(KeyboardAvoidingView, { behavior: 'padding', pointerEvents: visible ? 'auto' : 'none', style: { flex: 1, justifyContent: 'flex-end' } },
      h(Animated.View, { testID: 'sheet-backdrop', pointerEvents: 'none', accessible: false, style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.scrim, opacity: reveal } }),
      h(Pressable, { onPress: onClose, accessibilityRole: 'button', accessibilityLabel: 'Close sheet', feedback: false, style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } }),
      h(Animated.View, { testID: 'sheet-panel', style: { maxHeight: height * 0.9, backgroundColor: c.sheet, borderWidth: 1, borderColor: c.controlBorder, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden', transform: [{ translateY: Animated.add(drag, reveal.interpolate({ inputRange: [0, 1], outputRange: [height, 0] })) }] } },
        h(SafeAreaView, { edges: ['bottom'], style: { flexShrink: 1 } },
          h(View, { ...pan.panHandlers, accessibilityLabel: 'Drag down to close', style: { minHeight: 48, backgroundColor: c.mint, justifyContent: 'center', alignItems: 'center' } }, h(View, { style: { width: 40, height: 4, borderRadius: 4, backgroundColor: c.track } })),
          h(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.mint, borderBottomWidth: 1, borderBottomColor: c.headerLine, paddingHorizontal: 20, paddingBottom: 12 } },
            h(Text, { ref: heading, accessibilityRole: 'header', style: { flex: 1, color: c.ink, fontSize: 24, fontWeight: '700' } }, content.current.title),
            h(Pressable, { onPress: onClose, accessibilityRole: 'button', accessibilityLabel: 'Close', style: { minHeight: 48, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 24, overflow: 'hidden', backgroundColor: c.accent, borderWidth: 1, borderColor: c.accent } }, h(Text, { style: { color: c.onAccent, fontWeight: '700', fontSize: 15 } }, 'Close'))),
          content.current.scrollable
            ? h(ScrollView, { style: { flexShrink: 1 }, contentContainerStyle: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }, keyboardShouldPersistTaps: 'handled' }, content.current.children)
            : h(View, { style: { flexShrink: 1, minHeight: 0, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 } }, content.current.children)))));
}
