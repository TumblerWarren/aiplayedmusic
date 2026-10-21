import React from 'react';
import { Pressable as NativePressable, StyleSheet, View } from 'react-native';
const h = React.createElement;

// Draw feedback ourselves: Android/OEM RippleDrawable masks can remain rectangular
// even when the React Native view has a radius and overflow: hidden.
export default function RoundedPressable({ style, children, feedback = true, feedbackColor = '#7353BB18', ...props }) {
  const resolve = state => typeof style === 'function' ? style(state) : style;
  const shape = state => {
    const resolved = StyleSheet.flatten(resolve(state)) || {};
    return Object.fromEntries(Object.entries(resolved).filter(([key]) => /^border.*Radius$/.test(key)));
  };
  return h(NativePressable, {
    ...props,
    android_ripple: undefined,
    style: state => [{ borderRadius: feedback ? 24 : 0 }, resolve(state), { overflow: 'hidden' }],
  }, state => h(React.Fragment, null,
    typeof children === 'function' ? children(state) : children,
    feedback && state.pressed && !props.disabled && h(View, {
      pointerEvents: 'none', accessible: false, importantForAccessibility: 'no-hide-descendants',
      style: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 24, ...shape(state), backgroundColor: feedbackColor },
    })));
}
