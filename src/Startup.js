import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StatusBar, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMotionAllowed } from './PlaybackMotion';
import StartupArtwork, { StartupBackdrop } from './StartupArtwork';
const h = React.createElement;

export default function Startup({ c, dark: chosenDark, error, onRetry, onLayout }) {
  const motion = useMotionAllowed(!error), spin = useRef(new Animated.Value(0)).current, pulse = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets(), { width, height } = useWindowDimensions(), systemDark = useColorScheme() === 'dark', dark = chosenDark ?? systemDark;
  const compact = width > height, size = Math.min(compact ? width * 0.43 : width - 32, compact ? height - 48 : height * 0.44, 370);
  useEffect(() => {
    if (!motion) { spin.setValue(0); pulse.setValue(0); return; }
    const turn = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    const breathe = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 850, useNativeDriver: true, isInteraction: false }),
    ]));
    turn.start(); breathe.start();
    return () => { turn.stop(); breathe.stop(); };
  }, [motion, spin, pulse]);
  const brand = h(View, { style: { gap: 8, alignSelf: 'stretch' } },
    h(Text, { style: { color: c.purpleInk, fontSize: 10, fontWeight: '700', letterSpacing: 2.2 } }, 'YOUR MUSIC. YOUR MOMENT.'),
    h(Text, { accessibilityRole: 'header', style: { color: c.ink, fontSize: compact ? 36 : 44, fontWeight: '800', letterSpacing: -1.8 } }, 'Aiplayed'));
  const status = h(View, { style: { alignItems: 'flex-start', gap: 14, paddingBottom: 8 } },
    h(Text, { accessibilityLiveRegion: 'polite', style: { color: c.ink, fontSize: 20, fontWeight: '600' } }, error ? 'Let’s try that again' : 'Finding your rhythm'),
    h(Text, { style: { color: c.muted, fontSize: 15, lineHeight: 23, maxWidth: 340 } }, error || 'Opening your music library…'),
    error ? h(Pressable, { onPress: onRetry, accessibilityRole: 'button', style: ({ pressed }) => ({ minHeight: 48, paddingVertical: 14, paddingHorizontal: 26, borderRadius: 999, backgroundColor: pressed ? c.purpleInk : c.accent }) }, h(Text, { style: { color: c.onAccent, fontSize: 16, fontWeight: '700' } }, 'Try again'))
      : h(View, { accessibilityRole: 'progressbar', accessibilityLabel: 'Opening your music library', accessibilityState: { busy: true }, style: { flexDirection: 'row', gap: 8, paddingVertical: 6 } },
        ...[c.accent, c.startup.needle, c.startup.peach].map((color, i) => h(Animated.View, { key: color, accessible: false, style: { width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: motion ? pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: i === 1 ? [0.4, 1, 0.4] : i === 0 ? [1, 0.7, 0.4] : [0.4, 0.7, 1] }) : 1 } }))));
  const art = h(View, { style: { flex: 1, minHeight: size + 16, alignItems: 'center', justifyContent: 'center' } }, h(StartupArtwork, { c, size, rotation: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }));
  return h(View, { onLayout, testID: 'startup-screen', style: { flex: 1, backgroundColor: c.bg } },
    h(StatusBar, { barStyle: dark ? 'light-content' : 'dark-content', backgroundColor: c.bg }),
    h(StartupBackdrop, { dark, c }),
    h(ScrollView, { showsVerticalScrollIndicator: false, contentContainerStyle: { flexGrow: 1, minHeight: height, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24, paddingHorizontal: 28, gap: compact ? 18 : 12, flexDirection: compact ? 'row' : 'column' } },
      compact ? h(React.Fragment, null, h(View, { style: { flex: 1, justifyContent: 'space-between', gap: 24 } }, brand, status), art) : h(React.Fragment, null, brand, art, status)));
}
