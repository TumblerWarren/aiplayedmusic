import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { alphabet, alphabetTargets, nearestLetter } from './alphabet';
import { rememberScroll, scrollMemory } from './navigation';
import { ScrollEdge } from './ScrollSurface';
const h = React.createElement;
const PRELUDE = { prelude: true };

// A native sticky header translates without resizing this viewport.
export default function IndexedSongList({ data, c, indexed = false, field = 'title', contentContainerStyle, header, prelude, focused = false, sessionKey = '', rowHeight = 0, renderItem, keyExtractor = item => String(item.id), ListEmptyComponent, onScroll, ...props }) {
  const list = useRef(null), rail = useRef(null);
  const bounds = useRef({ top: 0, height: 1 });
  const pending = useRef(null), retries = useRef(0), lastLetter = useRef(null);
  const retryTimer = useRef(null), bubbleTimer = useRef(null), restoreFrame = useRef(null);
  const restoring = useRef({ key: null, pending: true, offset: 0 });
  if (restoring.current.key !== sessionKey) restoring.current = { key: sessionKey, pending: true, offset: scrollMemory.get(sessionKey) || 0 };
  const dimensions = useRef({ content: 0, viewport: 0 });
  const [height, setHeight] = useState(400), [letter, setLetter] = useState(null), [viewportHeight, setViewportHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(header ? null : 0);
  const [preludeHeight, setPreludeHeight] = useState(prelude ? null : 0);
  const [canScroll, setCanScroll] = useState(false);
  const prefix = prelude ? 1 : 0;
  const rows = useMemo(() => prefix ? [PRELUDE, ...data] : data, [data, prefix]);
  const targets = useMemo(() => alphabetTargets(data, field), [data, field]);
  const showIndex = indexed && data.length > 0 && (!viewportHeight || viewportHeight - (headerHeight || 0) >= 160);
  const restore = () => {
    if (!restoring.current.pending) return;
    cancelAnimationFrame(restoreFrame.current);
    const target = restoring.current;
    restoreFrame.current = requestAnimationFrame(() => {
      list.current?.scrollToOffset({ offset: target.offset, animated: false });
      restoreFrame.current = requestAnimationFrame(() => { if (restoring.current === target) target.pending = false; });
    });
  };
  useEffect(() => { restore(); return () => cancelAnimationFrame(restoreFrame.current); }, [sessionKey]);
  useEffect(() => {
    pending.current = null; lastLetter.current = null; clearTimeout(retryTimer.current);
    return () => { clearTimeout(retryTimer.current); clearTimeout(bubbleTimer.current); };
  }, [data]);
  const measure = callback => rail.current?.measureInWindow((x, top, railWidth, railHeight) => { bounds.current = { top, height: railHeight }; callback?.(); });
  const jump = next => {
    if (!next || targets[next] === undefined) return;
    setLetter(next); clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setLetter(null), 700);
    if (lastLetter.current === next) return;
    lastLetter.current = next; pending.current = targets[next] + prefix; retries.current = 0;
    clearTimeout(retryTimer.current);
    list.current?.scrollToIndex({ index: pending.current, animated: false, viewOffset: headerHeight || 0 });
  };
  const touch = pageY => jump(nearestLetter((pageY - bounds.current.top) / Math.max(1, bounds.current.height), targets));
  const recover = info => {
    if (pending.current !== info.index) return;
    list.current?.scrollToOffset({ offset: (headerHeight || 0) + (preludeHeight || 0) + Math.max(1, info.averageItemLength) * Math.max(0, info.index - prefix), animated: false });
    if (retries.current++ < 3) retryTimer.current = setTimeout(() => { if (pending.current === info.index) list.current?.scrollToIndex({ index: info.index, animated: false, viewOffset: headerHeight || 0 }); }, 100);
  };
  const layoutKnown = rowHeight > 0 && (!header || headerHeight !== null) && (!prefix || preludeHeight !== null);
  const getItemLayout = useCallback((items, index) => ({ index, length: prefix && index === 0 ? preludeHeight : rowHeight, offset: (headerHeight || 0) + (prefix && index === 0 ? 0 : (preludeHeight || 0) + (index - prefix) * rowHeight) }), [rowHeight, headerHeight, preludeHeight, prefix]);
  const updateScrollability = () => setCanScroll(dimensions.current.content > dimensions.current.viewport + 1);
  const empty = typeof ListEmptyComponent === 'function' ? h(ListEmptyComponent) : ListEmptyComponent;
  return h(View, { style: { flex: 1, minHeight: 0 } },
    h(FlatList, { ...props, ref: list, data: rows, keyExtractor: (item, index) => item === PRELUDE ? 'library-prelude' : keyExtractor(item, index - prefix),
      renderItem: info => info.item === PRELUDE ? h(View, { onLayout: e => setPreludeHeight(e.nativeEvent.layout.height) }, prelude, !data.length && empty) : renderItem({ ...info, index: info.index - prefix }),
      ListEmptyComponent: prefix ? null : ListEmptyComponent,
      ListHeaderComponent: header ? h(View, { onLayout: e => setHeaderHeight(e.nativeEvent.layout.height), style: { backgroundColor: `${c.bg}F5`, paddingBottom: 8 } }, header, h(ScrollEdge, { color: c.bg, style: { top: undefined, bottom: -22 } })) : null,
      ListHeaderComponentStyle: { marginLeft: -16, marginRight: showIndex ? -42 : -16 }, stickyHeaderIndices: header ? [0] : undefined, stickyHeaderHiddenOnScroll: !!header && !focused && canScroll,
      onLayout: e => { dimensions.current.viewport = e.nativeEvent.layout.height; setViewportHeight(dimensions.current.viewport); updateScrollability(); restore(); },
      onContentSizeChange: (width, content) => { dimensions.current.content = content; updateScrollability(); restore(); },
      onScroll: e => { if (!restoring.current.pending) rememberScroll(sessionKey, e.nativeEvent.contentOffset.y); onScroll?.(e); }, scrollEventThrottle: 16,
      getItemLayout: layoutKnown ? getItemLayout : undefined, onScrollToIndexFailed: recover,
      onScrollBeginDrag: () => { cancelAnimationFrame(restoreFrame.current); restoring.current.pending = false; lastLetter.current = null; pending.current = null; clearTimeout(retryTimer.current); },
      initialNumToRender: 12, maxToRenderPerBatch: 8, windowSize: 9, showsVerticalScrollIndicator: false, keyboardDismissMode: 'on-drag', keyboardShouldPersistTaps: 'handled',
      contentContainerStyle: [contentContainerStyle, showIndex && { paddingRight: 42 }] }),
    showIndex && h(View, { ref: rail, collapsable: false, onLayout: e => { setHeight(e.nativeEvent.layout.height); measure(); }, onStartShouldSetResponder: () => true, onMoveShouldSetResponder: () => true,
      onResponderGrant: e => { const y = e.nativeEvent.pageY; lastLetter.current = null; measure(() => touch(y)); }, onResponderMove: e => touch(e.nativeEvent.pageY), onResponderRelease: () => { lastLetter.current = null; }, onResponderTerminate: () => { lastLetter.current = null; setLetter(null); },
      style: { position: 'absolute', top: (headerHeight || 0) + 4, bottom: 4, right: 2, width: 32, borderRadius: 18, backgroundColor: c.lavender, paddingVertical: 4 } },
      ...alphabet.map(value => h(Pressable, { key: value, onPress: () => { lastLetter.current = null; jump(value); }, accessibilityRole: 'button', accessibilityLabel: `Jump to ${value === '#' ? 'numbers and other titles' : value}`, accessibilityState: { disabled: targets[value] === undefined }, disabled: targets[value] === undefined, style: { flex: 1, alignItems: 'center', justifyContent: 'center' } }, h(Text, { allowFontScaling: false, style: { color: letter === value ? c.onAccent : c.purpleInk, backgroundColor: letter === value ? c.accent : 'transparent', borderRadius: 8, minWidth: 16, textAlign: 'center', fontSize: Math.min(11, Math.max(8, height / 36)), fontWeight: '700', opacity: targets[value] === undefined ? 0.32 : 1 } }, value)))),
    showIndex && letter && h(View, { pointerEvents: 'none', accessible: false, style: { position: 'absolute', right: 48, top: '40%', width: 64, height: 64, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' } }, h(Text, { style: { fontSize: 32, fontWeight: '700', color: c.onAccent } }, letter)));
}
