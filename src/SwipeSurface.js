import React, { useMemo, useRef } from 'react';
import { PanResponder, View } from 'react-native';
import { isHorizontalSwipe, swipeAction } from './swipe';
const h = React.createElement;

export default function SwipeSurface({ enabled, onAction, children, ...props }) {
  const latest = useRef({ enabled, onAction });
  latest.current = { enabled, onAction };
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => latest.current.enabled && isHorizontalSwipe(gesture),
    onPanResponderRelease: (_, gesture) => {
      const action = swipeAction(gesture);
      if (latest.current.enabled && action) latest.current.onAction(action);
    },
    // A cancelled or interrupted gesture must never change the track.
    onPanResponderTerminationRequest: () => true,
  }), []);
  return h(View, { ...props, ...responder.panHandlers }, children);
}
