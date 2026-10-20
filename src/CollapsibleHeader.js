import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useMotionAllowed } from './PlaybackMotion';

const h = React.createElement;

export default function CollapsibleHeader({ visible, children }) {
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [height, setHeight] = useState(0);
  const motionAllowed = useMotionAllowed(true);
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: motionAllowed ? 240 : 0,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, motionAllowed, progress]);
  return h(Animated.View, {
    pointerEvents: visible ? 'auto' : 'none',
    accessibilityElementsHidden: !visible,
    importantForAccessibility: visible ? 'auto' : 'no-hide-descendants',
    // Let the content fade over the list instead of clipping it as this space shrinks.
    style: { overflow: 'visible', zIndex: 2, flexShrink: 0, height: height > 0 ? progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) : undefined },
  }, h(Animated.View, {
    onLayout: ({ nativeEvent: { layout } }) => setHeight(previous => previous === layout.height ? previous : layout.height),
    style: [height > 0 && { position: 'absolute', top: 0, left: 0, right: 0 }, {
      opacity: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
    }],
  }, children));
}
