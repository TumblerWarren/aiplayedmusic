import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { alphabet, alphabetTargets, nearestLetter } from './alphabet';
const h = React.createElement;

export default function IndexedSongList({ data, c, indexed = true, field = 'title', contentContainerStyle, ...props }) {
  const list = useRef(null);
  const rail = useRef(null);
  const bounds = useRef({ top: 0, height: 1 });
  const pending = useRef(null);
  const retries = useRef(0);
  const retryTimer = useRef(null);
  const bubbleTimer = useRef(null);
  const lastLetter = useRef(null);
  const [height, setHeight] = useState(400);
  const [letter, setLetter] = useState(null);
  const targets = useMemo(() => alphabetTargets(data, field), [data, field]);
  const showIndex = indexed && data.length > 0;
  useEffect(() => {
    pending.current = null; lastLetter.current = null;
    clearTimeout(retryTimer.current);
    return () => { clearTimeout(retryTimer.current); clearTimeout(bubbleTimer.current); };
  }, [data]);
  const jump = next => {
    if (!next || targets[next] === undefined) return;
    setLetter(next);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setLetter(null), 700);
    if (lastLetter.current === next) return;
    lastLetter.current = next;
    pending.current = targets[next]; retries.current = 0;
    clearTimeout(retryTimer.current);
    list.current?.scrollToIndex({ index: targets[next], animated: false, viewPosition: 0 });
  };
  const touch = pageY => {
    const { top, height: railHeight } = bounds.current;
    jump(nearestLetter((pageY - top) / Math.max(1, railHeight), targets));
  };
  const measure = callback => rail.current?.measureInWindow((x, top, width, railHeight) => {
    bounds.current = { top, height: railHeight }; callback?.();
  });
  const recover = info => {
    if (pending.current !== info.index) return;
    list.current?.scrollToOffset({ offset: Math.max(1, info.averageItemLength) * info.index, animated: false });
    if (retries.current++ < 3) retryTimer.current = setTimeout(() => {
      if (pending.current === info.index) list.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0 });
    }, 100);
  };
  return h(View, { style: { flex: 1, minHeight: 0 } },
    h(FlatList, { ...props, ref: list, data, keyExtractor: item => String(item.id), onScrollToIndexFailed: recover, onScrollBeginDrag: () => { lastLetter.current = null; pending.current = null; clearTimeout(retryTimer.current); }, showsVerticalScrollIndicator: false, keyboardShouldPersistTaps: 'handled', contentContainerStyle: [contentContainerStyle, showIndex && { paddingRight: 42 }] }),
    showIndex && h(View, {
      ref: rail, collapsable: false,
      onLayout: event => { setHeight(event.nativeEvent.layout.height); measure(); },
      onStartShouldSetResponder: () => true,
      onMoveShouldSetResponder: () => true,
      onResponderGrant: event => { const pageY = event.nativeEvent.pageY; lastLetter.current = null; measure(() => touch(pageY)); },
      onResponderMove: event => touch(event.nativeEvent.pageY),
      onResponderRelease: () => { lastLetter.current = null; },
      onResponderTerminate: () => { lastLetter.current = null; setLetter(null); },
      style: { position: 'absolute', top: 4, bottom: 4, right: 2, width: 32, borderRadius: 18, backgroundColor: c.lavender, paddingVertical: 4 },
    }, ...alphabet.map(value => h(Pressable, { key: value, onPress: () => { lastLetter.current = null; jump(value); }, accessibilityRole: 'button', accessibilityLabel: `Jump to ${value === '#' ? 'numbers and other titles' : value}`, accessibilityState: { disabled: targets[value] === undefined }, disabled: targets[value] === undefined, style: { flex: 1, alignItems: 'center', justifyContent: 'center' } }, h(Text, { allowFontScaling: false, style: { color: letter === value ? c.onAccent : c.purpleInk, backgroundColor: letter === value ? c.accent : 'transparent', borderRadius: 8, minWidth: 16, textAlign: 'center', fontSize: Math.min(11, Math.max(8, height / 36)), fontWeight: '700', opacity: targets[value] === undefined ? 0.32 : 1 } }, value)))),
    showIndex && letter && h(View, { pointerEvents: 'none', accessible: false, style: { position: 'absolute', right: 48, top: '40%', width: 64, height: 64, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' } }, h(Text, { style: { fontSize: 32, fontWeight: '700', color: c.onAccent } }, letter)));
}
