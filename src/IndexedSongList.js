import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { cancelAnimation, measure, runOnJS, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { alphabet, alphabetTargets, nearestLetter } from './alphabet';
import { rememberScroll, scrollMemory } from './navigation';
import { headerRemaining, nextHeaderHidden, railFraction } from './scrollGeometry';
const h = React.createElement;
const PRELUDE = { prelude: true };

export default function IndexedSongList({ data, c, indexed = false, field = 'title', contentContainerStyle, header, prelude, focused = false, sessionKey = '', rowHeight = 0, renderItem, keyExtractor = item => String(item.id), ListEmptyComponent, onDismissSearch, ...props }) {
  const list = useRef(null);
  const y = useSharedValue(scrollMemory.get(sessionKey) || 0);
  const hidden = useSharedValue(0);
  const measuredHeader = useSharedValue(0);
  const inputFocused = useSharedValue(focused);
  const forcedHidden = useSharedValue(-1);
  const settledTarget = useSharedValue(-1);
  const direction = useSharedValue(0);
  const lastViewport = useSharedValue(0);
  const maxOffset = useSharedValue(0);
  const scrollable = useSharedValue(false);
  const dimensions = useRef({ content: 0, viewport: 0, available: 0 });
  const pending = useRef(null), retries = useRef(0), lastLetter = useRef(null);
  const retryTimer = useRef(null), bubbleTimer = useRef(null), restoreFrame = useRef(null);
  const restoring = useRef({ key: null, pending: true, offset: 0 });
  if (restoring.current.key !== sessionKey) restoring.current = { key: sessionKey, pending: true, offset: scrollMemory.get(sessionKey) || 0 };
  const [letter, setLetter] = useState(null), [viewportHeight, setViewportHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0), [preludeHeight, setPreludeHeight] = useState(prelude ? null : 0);
  const prefix = prelude ? 1 : 0;
  const rows = useMemo(() => prefix ? [PRELUDE, ...data] : data, [data, prefix]);
  const targets = useMemo(() => alphabetTargets(data, field), [data, field]);
  const showIndex = indexed && data.length > 0 && viewportHeight >= 100 && (!header || headerHeight > 0);
  const restore = () => {
    if (!restoring.current.pending) return;
    cancelAnimationFrame(restoreFrame.current);
    const target = restoring.current;
    restoreFrame.current = requestAnimationFrame(() => {
      y.value = target.offset;
      const targetHidden = target.offset > 0 ? measuredHeader.value : 0;
      hidden.value = targetHidden; settledTarget.value = targetHidden;
      forcedHidden.value = targetHidden;
      list.current?.scrollToOffset({ offset: target.offset, animated: false });
      restoreFrame.current = requestAnimationFrame(() => { if (restoring.current === target) target.pending = false; });
    });
  };
  useEffect(() => { const targetHidden = (scrollMemory.get(sessionKey) || 0) > 0 ? measuredHeader.value : 0; hidden.value = targetHidden; settledTarget.value = targetHidden; direction.value = 0; y.value = scrollMemory.get(sessionKey) || 0; restore(); return () => cancelAnimationFrame(restoreFrame.current); }, [sessionKey]);
  useEffect(() => {
    pending.current = null; lastLetter.current = null; clearTimeout(retryTimer.current);
    return () => { clearTimeout(retryTimer.current); clearTimeout(bubbleTimer.current); };
  }, [data]);
  useEffect(() => { inputFocused.value = focused; if (focused) { settledTarget.value = 0; hidden.value = 0; } }, [focused]);
  const saveScroll = useCallback(offset => { if (!restoring.current.pending) rememberScroll(sessionKey, offset); }, [sessionKey]);
  const beginDrag = useCallback(() => {
    cancelAnimationFrame(restoreFrame.current); restoring.current.pending = false;
    lastLetter.current = null; pending.current = null; clearTimeout(retryTimer.current);
    onDismissSearch?.();
  }, [onDismissSearch]);
  const settleSearch = () => {
    'worklet';
    if (settledTarget.value >= 0) return;
    const target = !scrollable.value || inputFocused.value || direction.value < 0 || (direction.value === 0 && hidden.value < measuredHeader.value / 2) ? 0 : measuredHeader.value;
    settledTarget.value = target;
    hidden.value = withTiming(target, { duration: 160 });
  };
  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: () => { cancelAnimation(hidden); settledTarget.value = -1; direction.value = 0; lastViewport.value = 0; forcedHidden.value = -1; inputFocused.value = false; if (y.value <= 0) hidden.value = 0; runOnJS(beginDrag)(); },
    onScroll: event => {
      const maximum = event.contentSize && event.layoutMeasurement ? Math.max(0, event.contentSize.height - event.layoutMeasurement.height) : maxOffset.value;
      const next = Math.max(0, Math.min(maximum, event.contentOffset.y));
      const viewport = event.layoutMeasurement?.height || 0;
      // Shrinking search moves the viewport under the finger. Android reports
      // that movement in contentOffset too; remove it from gesture direction.
      const viewportDelta = lastViewport.value > 0 && viewport > 0 ? viewport - lastViewport.value : 0;
      lastViewport.value = viewport;
      const delta = next - Math.min(y.value, maximum) + viewportDelta;
      if (settledTarget.value < 0 && Math.abs(delta) > 0.5) direction.value = delta < 0 ? -1 : 1;
      if (settledTarget.value < 0) hidden.value = !scrollable.value || inputFocused.value ? 0 : forcedHidden.value >= 0 ? forcedHidden.value : nextHeaderHidden(hidden.value, Math.min(y.value, maximum), next, measuredHeader.value, inputFocused.value, scrollable.value, viewportDelta);
      forcedHidden.value = -1; y.value = next; runOnJS(saveScroll)(next);
    },
    onEndDrag: settleSearch,
    onMomentumEnd: settleSearch,
  });
  // Keep the measured size in a shared value: the first worklet is installed
  // before Yoga has measured search, and must never capture a permanent zero.
  const headerStyle = useAnimatedStyle(() => ({ height: headerRemaining(hidden.value, measuredHeader.value, inputFocused.value, scrollable.value) }));
  const measureHeader = event => {
    const height = event.nativeEvent.layout.height;
    measuredHeader.value = height; setHeaderHeight(height); updateScrollability();
    if (restoring.current.pending) { hidden.value = restoring.current.offset > 0 ? height : 0; restore(); }
    else if (settledTarget.value >= 0) { const target = settledTarget.value > 0 ? height : 0; settledTarget.value = target; hidden.value = target; }
  };
  const jump = next => {
    if (!next || targets[next] === undefined) return;
    setLetter(next); clearTimeout(bubbleTimer.current); bubbleTimer.current = setTimeout(() => setLetter(null), 700);
    if (lastLetter.current === next) return;
    lastLetter.current = next; restoring.current.pending = false;
    pending.current = targets[next] + prefix; retries.current = 0; clearTimeout(retryTimer.current);
    // Programmatic A-Z jumps hide search; upward drag reveals it again.
    onDismissSearch?.(); inputFocused.value = false;
    hidden.value = measuredHeader.value; forcedHidden.value = measuredHeader.value; settledTarget.value = measuredHeader.value;
    list.current?.scrollToIndex({ index: pending.current, animated: false, viewOffset: 0 });
  };
  const touchFraction = fraction => jump(nearestLetter(fraction, targets));
  const endTouch = () => { lastLetter.current = null; };
  const recover = info => {
    if (pending.current !== info.index) return;
    list.current?.scrollToOffset({ offset: (prefix ? preludeHeight || 0 : 0) + Math.max(1, info.averageItemLength) * Math.max(0, info.index - prefix), animated: false });
    if (retries.current++ < 4) retryTimer.current = setTimeout(() => { if (pending.current === info.index) list.current?.scrollToIndex({ index: info.index, animated: false, viewOffset: 0 }); }, 100);
  };
  const layoutKnown = rowHeight > 0 && (!header || headerHeight > 0) && (!prefix || preludeHeight !== null);
  const getItemLayout = useCallback((items, index) => ({ index, length: prefix && index === 0 ? preludeHeight : rowHeight, offset: (prefix && index > 0 ? preludeHeight || 0 : 0) + Math.max(0, index - prefix) * rowHeight }), [rowHeight, headerHeight, preludeHeight, prefix]);
  const updateScrollability = () => {
    maxOffset.value = Math.max(0, dimensions.current.content - dimensions.current.viewport);
    // Decide whether search may hide against the viewport with search visible.
    // Otherwise expanding the list can make a short list "unscrollable" and
    // immediately reopen search, producing a layout/collapse feedback loop.
    const visibleViewport = dimensions.current.available ? dimensions.current.available - measuredHeader.value : dimensions.current.viewport;
    scrollable.value = dimensions.current.content > visibleViewport + 1;
    if (!scrollable.value) { hidden.value = 0; settledTarget.value = 0; forcedHidden.value = -1; }
  };
  const empty = typeof ListEmptyComponent === 'function' ? h(ListEmptyComponent) : ListEmptyComponent;
  return h(View, { testID: 'indexed-list-surface', onLayout: event => { dimensions.current.available = event.nativeEvent.layout.height; updateScrollability(); }, style: { flex: 1, minHeight: 0 } },
    header && h(Animated.View, { testID: 'search-layout-slot', style: [{ flexShrink: 0, overflow: 'hidden' }, headerStyle] },
      h(View, { testID: 'search-intrinsic-content', onLayout: measureHeader, style: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 12, paddingBottom: 12, backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.headerLine } }, header)),
    h(View, { testID: 'indexed-list-viewport', style: { flex: 1, minHeight: 0, overflow: 'hidden' } },
    h(Animated.FlatList, { ...props, ref: list, data: rows, keyExtractor: (item, index) => item === PRELUDE ? 'library-prelude' : keyExtractor(item, index - prefix),
      renderItem: info => info.item === PRELUDE ? h(View, { onLayout: e => setPreludeHeight(e.nativeEvent.layout.height) }, prelude, !data.length && empty) : renderItem({ ...info, index: info.index - prefix }),
      ListEmptyComponent: prefix ? null : ListEmptyComponent,
      onLayout: e => { dimensions.current.viewport = e.nativeEvent.layout.height; setViewportHeight(dimensions.current.viewport); updateScrollability(); restore(); },
      onContentSizeChange: (width, content) => { dimensions.current.content = content; updateScrollability(); restore(); },
      onScroll: scrollHandler, scrollEventThrottle: 16, getItemLayout: layoutKnown ? getItemLayout : undefined, onScrollToIndexFailed: recover,

      initialNumToRender: 12, maxToRenderPerBatch: 8, windowSize: 9, showsVerticalScrollIndicator: false, keyboardDismissMode: 'on-drag', keyboardShouldPersistTaps: 'handled',
      contentContainerStyle: [contentContainerStyle, showIndex && { paddingRight: 48 }] }),
    showIndex && h(AlphabetRail, { c, targets, letter,
      onFraction: touchFraction, onEnd: endTouch, onJump: next => { lastLetter.current = null; jump(next); } }),
    showIndex && letter && h(View, { pointerEvents: 'none', accessible: false, style: { position: 'absolute', right: 50, top: '40%', width: 64, height: 64, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' } }, h(Text, { style: { fontSize: 32, fontWeight: '700', color: c.onAccent } }, letter))));
}

// The rail is inside the list viewport. Its native bounds follow layout, not
// a second animated top offset that can diverge from the search hit rectangle.
function AlphabetRail({ c, targets, letter, onFraction, onEnd, onJump }) {
  const rail = useAnimatedRef();
  const [height, setHeight] = useState(400);
  const pan = Gesture.Pan().minDistance(0).maxPointers(1).onBegin(event => {
    const box = measure(rail); if (box) runOnJS(onFraction)(railFraction(event.absoluteY, box.pageY, box.height));
  }).onUpdate(event => {
    const box = measure(rail); if (box) runOnJS(onFraction)(railFraction(event.absoluteY, box.pageY, box.height));
  }).onFinalize(() => { runOnJS(onEnd)(); });
  return h(GestureDetector, { gesture: pan }, h(Animated.View, { ref: rail, collapsable: false, onLayout: e => setHeight(e.nativeEvent.layout.height), testID: 'alphabet-rail', style: [{ position: 'absolute', top: 4, bottom: 4, right: 2, width: 40, minHeight: 40, borderRadius: 20, backgroundColor: c.lavender, paddingVertical: 4 }] },
    ...alphabet.map(value => h(Pressable, { key: value, onPress: () => onJump(value), accessibilityRole: 'button', accessibilityLabel: `Jump to ${value === '#' ? 'numbers and other titles' : value}`, accessibilityState: { disabled: targets[value] === undefined }, disabled: targets[value] === undefined, style: { flex: 1, alignItems: 'center', justifyContent: 'center' } }, h(Text, { allowFontScaling: false, style: { color: letter === value ? c.onAccent : c.purpleInk, backgroundColor: letter === value ? c.accent : 'transparent', borderRadius: 8, minWidth: 16, textAlign: 'center', fontSize: Math.min(12, Math.max(7, (height - 8) / 34)), fontWeight: '700', opacity: targets[value] === undefined ? 0.32 : 1 } }, value)))));
}
