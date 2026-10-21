import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Native from './native';
import Icon from './Icons';
import { Pattern } from './Pastel';
import IndexedSongList from './IndexedSongList';
import { compareNames, displayFolder } from './browse';
import { folderChoices, storageRoot } from './folderBrowser';
const h = React.createElement;

export default function FolderPicker({ c, roots, onClose, onSelect }) {
  const [catalog, setCatalog] = useState([]);
  const [path, setPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const folders = JSON.parse(await Native.musicFolders());
      if (mounted.current) setCatalog(folders);
    } catch (e) { if (mounted.current) setError(e?.message || 'Could not read music folders. Check audio access and try again.'); }
    finally { if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, [load]);
  const back = () => path ? setPath(path === storageRoot(path) ? null : path.slice(0, path.lastIndexOf('/'))) : onClose();
  const rows = folderChoices(catalog, path).map(item => ({ ...item, displayName: displayFolder(item.path) })).sort((a, b) => compareNames(a.displayName, b.displayName));
  const selected = roots.includes(path);
  const limit = roots.length >= 10 && !selected;
  const label = (value, style = {}) => h(Text, { style: { color: c.ink, fontSize: 15, ...style } }, value);
  const control = (name, action, title) => h(Pressable, { onPress: action, accessibilityRole: 'button', accessibilityLabel: title, android_ripple: { color: '#7353BB18' }, style: { borderRadius: 24, overflow: 'hidden', width: 48, height: 48, justifyContent: 'center', alignItems: 'center' } }, h(Icon, { name, color: c.accent, size: 24 }));
  const choose = async () => {
    if (!path || saving || limit) return;
    setSaving(true);
    try { const ok = selected || await onSelect(path); if (ok) onClose(); }
    finally { if (mounted.current) setSaving(false); }
  };
  return h(Modal, { visible: true, animationType: 'slide', onRequestClose: onClose },
    h(SafeAreaView, { style: { flex: 1, backgroundColor: c.bg } },
      h(View, { style: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 60 } }, control('arrow-left', back, path ? 'Parent folder' : 'Back'), label('Choose music folder', { fontSize: 22, fontWeight: '700', flex: 1 }), control('x', onClose, 'Close folder browser')),
      h(View, { style: { marginHorizontal: 20, padding: 16, backgroundColor: c.mint, borderRadius: 22, overflow: 'hidden' } }, h(Pattern, { kind: 'checks', color: c.mintInk, size: 80 }), label(path || 'On this device', { color: c.mintInk, fontWeight: '600', lineHeight: 21 }), label('Folders containing local audio. Subfolders are included when you choose a folder.', { color: c.mintInk, fontSize: 12, lineHeight: 18, marginTop: 6 })),
      loading ? h(ActivityIndicator, { style: { margin: 40 }, size: 'large', color: c.accent }) : error ? h(View, { style: { padding: 24, gap: 16 } }, label(error), h(Pressable, { onPress: load, accessibilityRole: 'button', style: { padding: 16, borderRadius: 20, backgroundColor: c.lavender } }, label('Try again', { color: c.accent }))) : h(IndexedSongList, { c, indexed: true, field: 'displayName', sessionKey: `picker:${path || ''}`,
        data: rows, keyExtractor: item => item.path, contentContainerStyle: { padding: 20, gap: 8 },
        renderItem: ({ item }) => h(Pressable, { onPress: () => setPath(item.path), accessibilityRole: 'button', accessibilityLabel: `${item.path}, ${item.count} songs`, android_ripple: { color: '#7353BB18' }, style: { overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14, backgroundColor: c.card, borderRadius: 22, minHeight: 76 } },
          h(View, { android_ripple: { color: '#7353BB18' }, style: { borderRadius: 24, overflow: 'hidden', width: 48, height: 48, borderRadius: 16, backgroundColor: c.mint, alignItems: 'center', justifyContent: 'center' } }, h(Icon, { name: 'folder', color: c.mintInk, size: 28 })),
          h(View, { style: { flex: 1 } }, label(item.displayName, { fontWeight: '600' }), label(`${item.count} songs${roots.includes(item.path) ? ' · Selected' : ''}`, { color: c.muted, fontSize: 12, marginTop: 5 })), h(Icon, { name: 'chevron-right', color: c.muted, size: 20 })),
        ListEmptyComponent: h(View, { style: { padding: 20, gap: 12 } }, label(path ? 'No deeper music folders' : 'No music folders found', { fontWeight: '600' }), label(path ? 'Use the button below to choose this folder.' : 'Music folders appear here once Android has indexed audio on your device.', { color: c.muted, lineHeight: 22 })),
      }),
      h(View, { style: { padding: 20, gap: 10, borderTopWidth: 1, borderColor: c.line } },
        limit && label('You can select up to ten music folders. Remove one in library settings first.', { color: c.muted, fontSize: 12 }),
        h(Pressable, { onPress: choose, disabled: !path || saving || loading || !!error || limit, accessibilityRole: 'button', accessibilityState: { disabled: !path || saving || loading || !!error || limit }, style: { borderRadius: 28, minHeight: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, opacity: !path || saving || loading || !!error || limit ? 0.45 : 1 } }, label(saving ? 'Saving…' : selected ? 'Folder already selected' : 'Use this folder', { color: c.onAccent, fontWeight: '700' })))));
}
