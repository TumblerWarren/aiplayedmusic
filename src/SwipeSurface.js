import React, { useMemo, useRef } from 'react';
import { PanResponder, View } from 'react-native';
import { isHorizontalSwipe, swipeAction } from './swipe';
const h = React.createElement;

export default function SwipeSurface({ enabled, onAction, children, ...props }) {
  const latest = useRef({ enabled, onAction }); latest.current = { enabled, onAction };
  const invalid = useRef(false);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: e => { invalid.current = e.nativeEvent.touches.length !== 1; return false; },
    onMoveShouldSetPanResponderCapture: (e, g) => {
      if (e.nativeEvent.touches.length > 1 || g.numberActiveTouches > 1) invalid.current = true;
      return latest.current.enabled && !invalid.current && isHorizontalSwipe(g);
    },
    onPanResponderMove: (e, g) => { if (e.nativeEvent.touches.length > 1 || g.numberActiveTouches > 1) invalid.current = true; },
    onPanResponderRelease: (_, g) => { const action = swipeAction(g); if (latest.current.enabled && !invalid.current && action) latest.current.onAction(action); },
    onPanResponderTerminate: () => { invalid.current = true; },
    onPanResponderTerminationRequest: () => true,
  }), []);
  return h(View, { ...props, ...responder.panHandlers }, children);
}
