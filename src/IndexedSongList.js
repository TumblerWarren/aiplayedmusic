import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { measure, runOnJS, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { alphabet, alphabetTargets, nearestLetter } from './alphabet';
import { rememberScroll, scrollMemory } from './navigation';
import { headerRemaining, railFraction } from './scrollGeometry';
const h = React.createElement;
const PRELUDE = { prelude: true };

export default function IndexedSongList({ data, c, indexed = false, field = 'title', contentContainerStyle, header, prelude, focused = false, sessionKey = '', rowHeight = 0, renderItem, keyExtractor = item => String(item.id), ListEmptyComponent, ...props }) {
  const list = useRef(null), rail = useAnimatedRef();
  const y = useSharedValue(scrollMemory.get(sessionKey) || 0);
  const headerSize = useSharedValue(0), scrollable = useSharedValue(false);
  const dimensions = useRef({ content: 0, viewport: 0 });
  const pending = useRef(null), retries = useRef(0), lastLetter = useRef(null);
  const retryTimer = useRef(null), bubbleTimer = useRef(null), restoreFrame = useRef(null);
  const restoring = useRef({ key: null, pending: true, offset: 0 });
  if (restoring.current.key !== sessionKey) restoring.current = { key: sessionKey, pending: true, offset: scrollMemory.get(sessionKey) || 0 };
  const [height, setHeight] = useState(400), [letter, setLetter] = useState(null), [viewportHeight, setViewportHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0), [preludeHeight, setPreludeHeight] = useState(prelude ? null : 0);
  const prefix = prelude ? 1 : 0;
  const rows = useMemo(() => prefix ? [PRELUDE, ...data] : data, [data, prefix]);
  const targets = useMemo(() => alphabetTargets(data, field), [data, field]);
  const showIndex = indexed && data.length > 0 && viewportHeight >= 100;
  const restore = () => {
    if (!restoring.current.pending) return;
    cancelAnimationFrame(restoreFrame.current);
    const target = restoring.current;
    restoreFrame.current = requestAnimationFrame(() => {
      y.value = target.offset;
      list.current?.scrollToOffset({ offset: target.offset, animated: false });
      restoreFrame.current = requestAnimationFrame(() => { if (restoring.current === target) target.pending = false; });
    });
  };
  useEffect(() => { y.value = scrollMemory.get(sessionKey) || 0; restore(); return () => cancelAnimationFrame(restoreFrame.current); }, [sessionKey]);
  useEffect(() => {
    pending.current = null; lastLetter.current = null; clearTimeout(retryTimer.current);
    return () => { clearTimeout(retryTimer.current); clearTimeout(bubbleTimer.current); };
  }, [data]);
  const saveScroll = useCallback(offset => { if (!restoring.current.pending) rememberScroll(sessionKey, offset); }, [sessionKey]);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: event => { y.value = Math.max(0, event.contentOffset.y); runOnJS(saveScroll)(y.value); } });
  const headerStyle = useAnimatedStyle(() => {
    const remaining = headerRemaining(y.value, headerSize.value, focused, scrollable.value);
    // Measure intrinsic content before moving it. Giving this measuring container
    // an animated height (initially zero) constrains Yoga and hides the search.
    return { transform: [{ translateY: remaining - headerSize.value }], opacity: headerSize.value ? remaining / headerSize.value : 1 };
  }, [focused]);
  const railStyle = useAnimatedStyle(() => ({ top: headerRemaining(y.value, headerSize.value, focused, scrollable.value) + 4 }), [focused]);
  const jump = next => {
    if (!next || targets[next] === undefined) return;
    setLetter(next); clearTimeout(bubbleTimer.current); bubbleTimer.current = setTimeout(() => setLetter(null), 700);
    if (lastLetter.current === next) return;
    lastLetter.current = next; restoring.current.pending = false;
    pending.current = targets[next] + prefix; retries.current = 0; clearTimeout(retryTimer.current);
    // Align at the viewport top; the same scroll event collapses the header and expands the rail.
    list.current?.scrollToIndex({ index: pending.current, animated: false, viewOffset: focused ? headerHeight : 0 });
  };
  const touchFraction = fraction => jump(nearestLetter(fraction, targets));
  const endTouch = () => { lastLetter.current = null; };
  const pan = Gesture.Pan().minDistance(0).maxPointers(1).onBegin(event => {
    const box = measure(rail); if (box) runOnJS(touchFraction)(railFraction(event.absoluteY, box.pageY, box.height));
  }).onUpdate(event => {
    const box = measure(rail); if (box) runOnJS(touchFraction)(railFraction(event.absoluteY, box.pageY, box.height));
  }).onFinalize(() => { runOnJS(endTouch)(); });
  const recover = info => {
    if (pending.current !== info.index) return;
    list.current?.scrollToOffset({ offset: headerHeight + (prefix ? preludeHeight || 0 : 0) + Math.max(1, info.averageItemLength) * Math.max(0, info.index - prefix), animated: false });
    if (retries.current++ < 4) retryTimer.current = setTimeout(() => { if (pending.current === info.index) list.current?.scrollToIndex({ index: info.index, animated: false, viewOffset: focused ? headerHeight : 0 }); }, 100);
  };
  const layoutKnown = rowHeight > 0 && (!header || headerHeight > 0) && (!prefix || preludeHeight !== null);
  const getItemLayout = useCallback((items, index) => ({ index, length: prefix && index === 0 ? preludeHeight : rowHeight, offset: headerHeight + (prefix && index > 0 ? preludeHeight || 0 : 0) + Math.max(0, index - prefix) * rowHeight }), [rowHeight, headerHeight, preludeHeight, prefix]);
  const updateScrollability = () => { scrollable.value = dimensions.current.content > dimensions.current.viewport + 1; };
  const empty = typeof ListEmptyComponent === 'function' ? h(ListEmptyComponent) : ListEmptyComponent;
  return h(View, { style: { flex: 1, minHeight: 0, overflow: 'hidden' } },
    h(Animated.FlatList, { ...props, ref: list, data: rows, keyExtractor: (item, index) => item === PRELUDE ? 'library-prelude' : keyExtractor(item, index - prefix),
      renderItem: info => info.item === PRELUDE ? h(View, { onLayout: e => setPreludeHeight(e.nativeEvent.layout.height) }, prelude, !data.length && empty) : renderItem({ ...info, index: info.index - prefix }),
      ListEmptyComponent: prefix ? null : ListEmptyComponent, ListHeaderComponent: header ? h(View, { style: { height: headerHeight } }) : null,
      onLayout: e => { dimensions.current.viewport = e.nativeEvent.layout.height; setViewportHeight(dimensions.current.viewport); updateScrollability(); restore(); },
      onContentSizeChange: (width, content) => { dimensions.current.content = content; updateScrollability(); restore(); },
      onScroll: scrollHandler, scrollEventThrottle: 16, getItemLayout: layoutKnown ? getItemLayout : undefined, onScrollToIndexFailed: recover,
      onScrollBeginDrag: () => { cancelAnimationFrame(restoreFrame.current); restoring.current.pending = false; lastLetter.current = null; pending.current = null; clearTimeout(retryTimer.current); },
      initialNumToRender: 12, maxToRenderPerBatch: 8, windowSize: 9, showsVerticalScrollIndicator: false, keyboardDismissMode: 'on-drag', keyboardShouldPersistTaps: 'handled',
      contentContainerStyle: [contentContainerStyle, showIndex && { paddingRight: 48 }] }),
    header && h(Animated.View, { onLayout: e => { headerSize.value = e.nativeEvent.layout.height; setHeaderHeight(e.nativeEvent.layout.height); }, style: [{ position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: 8, backgroundColor: c.bg }, headerStyle] }, header),
    showIndex && h(GestureDetector, { gesture: pan }, h(Animated.View, { ref: rail, collapsable: false, onLayout: e => setHeight(e.nativeEvent.layout.height), testID: 'alphabet-rail', style: [{ position: 'absolute', bottom: 4, right: 2, width: 40, minHeight: 40, borderRadius: 20, backgroundColor: c.lavender, paddingVertical: 4 }, railStyle] },
      ...alphabet.map(value => h(Pressable, { key: value, onPress: () => { lastLetter.current = null; jump(value); }, accessibilityRole: 'button', accessibilityLabel: `Jump to ${value === '#' ? 'numbers and other titles' : value}`, accessibilityState: { disabled: targets[value] === undefined }, disabled: targets[value] === undefined, style: { flex: 1, alignItems: 'center', justifyContent: 'center' } }, h(Text, { allowFontScaling: false, style: { color: letter === value ? c.onAccent : c.purpleInk, backgroundColor: letter === value ? c.accent : 'transparent', borderRadius: 8, minWidth: 16, textAlign: 'center', fontSize: Math.min(12, Math.max(7, (height - 8) / 34)), fontWeight: '700', opacity: targets[value] === undefined ? 0.32 : 1 } }, value))))),
    showIndex && letter && h(View, { pointerEvents: 'none', accessible: false, style: { position: 'absolute', right: 50, top: '40%', width: 64, height: 64, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' } }, h(Text, { style: { fontSize: 32, fontWeight: '700', color: c.onAccent } }, letter)));
}
