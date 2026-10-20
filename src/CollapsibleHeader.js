import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useMotionAllowed } from './PlaybackMotion';

const h = React.createElement;

export default function CollapsibleHeader({ visible, children }) {
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [height, setHeight] = useState(0);
  const motionAllowed = useMotionAllowed(true);
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: motionAllowed ? 180 : 0,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, motionAllowed, progress]);
  return h(Animated.View, {
    pointerEvents: visible ? 'auto' : 'none',
    accessibilityElementsHidden: !visible,
    importantForAccessibility: visible ? 'auto' : 'no-hide-descendants',
    style: { overflow: 'hidden', flexShrink: 0, opacity: progress, height: height > 0 ? progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) : undefined },
  }, h(View, {
    onLayout: ({ nativeEvent: { layout } }) => setHeight(previous => previous === layout.height ? previous : layout.height),
    style: height > 0 ? { position: 'absolute', top: 0, left: 0, right: 0 } : undefined,
  }, children));
}
