import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View, useWindowDimensions } from 'react-native';
import Pressable from './RoundedPressable';
import Native from './native';
import { useMusicSlice } from './useMusic';
import { useMotionAllowed } from './PlaybackMotion';
import { currentLyric, parseLyrics } from './lyrics';
const h = React.createElement;

// Key this component by song ID so a pending file import cannot change another song's view.
export default function Lyrics({ song, c }) {
  const [source, setSource] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [follow, setFollow] = useState(true);
  const mounted = useRef(false), pending = useRef(false), list = useRef(null);
  const { height } = useWindowDimensions(), progress = useMusicSlice('progress'), motion = useMotionAllowed(true);
  const parsed = useMemo(() => parseLyrics(source || ''), [source]);
  const active = parsed.timed && String(progress.currentId) === String(song?.id) ? currentLyric(parsed.lines, progress.position) : -1;
  const load = async () => {
    if (!song || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { const text = await Native.getLyrics(String(song.id)); if (mounted.current) setSource(text); }
    catch { if (mounted.current) setError('Couldn’t load lyrics. Please try again.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (active >= 0 && follow) list.current?.scrollToIndex({ index: active, viewPosition: .35, animated: motion });
  }, [active, follow, motion]);
  const edit = async remove => {
    if (!song || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const text = remove ? await Native.removeLyrics(String(song.id)) : await Native.chooseLyrics(String(song.id));
      if (mounted.current && text !== null) { setSource(text); setFollow(true); }
    } catch (e) { if (mounted.current) setError(e?.message || 'Couldn’t read lyrics. Choose a UTF-8 .lrc or .txt file under 512 KB.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const text = (value, style = {}, props = {}) => h(Text, { style: { color: c.ink, fontSize: 16, ...style }, ...props }, value);
  const action = (label, run) => h(Pressable, { onPress: run, disabled: busy, accessibilityRole: 'button', accessibilityLabel: label, accessibilityState: { disabled: busy }, style: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 24, backgroundColor: c.lavender, opacity: busy ? .5 : 1, justifyContent: 'center' } }, text(label, { color: c.purpleInk, fontWeight: '600' }));
  return h(View, { style: { height: height * .62, flexShrink: 1, minHeight: 0, gap: 12 } },
    text(song?.title || 'Choose a song first', { fontSize: 22, fontWeight: '700' }), song && text(song.artist, { color: c.muted }),
    error && text(error, { color: c.peachInk }, { accessibilityRole: 'alert' }),
    source === null && busy ? h(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 } }, h(ActivityIndicator, { color: c.accent }), text('Loading lyrics…'))
      : source ? h(FlatList, { ref: list, data: parsed.lines, style: { flex: 1, minHeight: 0 }, initialNumToRender: 20, maxToRenderPerBatch: 20, windowSize: 5, extraData: active,
        keyExtractor: (_, index) => String(index), onScrollBeginDrag: () => setFollow(false),
        onScrollToIndexFailed: info => list.current?.scrollToOffset({ offset: Math.max(0, info.averageItemLength * info.index - height * .15), animated: false }),
        renderItem: ({ item, index }) => text(item.text || ' ', { textAlign: 'center', fontSize: 20, lineHeight: 32, paddingVertical: 8, color: parsed.timed && index !== active ? c.muted : c.ink, ...(index === active && { color: c.accent, fontWeight: '700' }) }, { accessibilityState: { selected: index === active } }),
      }) : h(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 } }, text(song ? 'Add a .lrc or .txt file from your phone. Lyrics stay on this device.' : 'Start a song to view or add its lyrics.', { color: c.muted, textAlign: 'center', lineHeight: 26 })),
    h(View, { style: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } },
      song && (source === null && error ? action('Try again', load) : action(source ? 'Replace lyrics file' : 'Choose lyrics file', () => edit(false))),
      source && action('Remove lyrics', () => edit(true)), parsed.timed && !follow && action('Follow current line', () => setFollow(true))));
}
