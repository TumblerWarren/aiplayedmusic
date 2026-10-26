import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Feather from './Icons';
import Pressable from './RoundedPressable';
const h = React.createElement;

export default function SettingsDetails({ kind, version, c, onClose, onClearHistory, onOpenSettings }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const text = (value, style = {}) => h(Text, { style: { color: c.ink, fontSize: 16, lineHeight: 25, ...style } }, value);
  const card = (icon, title, detail, bg, ink) => h(View, { style: { borderRadius: 22, padding: 18, gap: 10, backgroundColor: bg } },
    h(Feather, { name: icon, size: 26, color: ink }), text(title, { color: ink, fontSize: 19, fontWeight: '700' }), text(detail, { color: ink }));
  const run = async action => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const result = await action();
      if (result === false || kind === 'history' && !result) throw new Error('Please try again.');
      if (mounted.current) onClose();
    } catch { if (mounted.current) setError(kind === 'history' ? 'Couldn’t clear listening history. Please try again.' : 'Couldn’t open Android settings. Please try again.'); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  const button = (label, action, primary) => h(Pressable, { accessibilityRole: 'button', accessibilityLabel: label, disabled: busy, accessibilityState: { disabled: busy, busy }, onPress: action,
    style: { minHeight: 52, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 26, borderWidth: 1, borderColor: primary ? c.accent : c.controlBorder, backgroundColor: primary ? c.accent : c.card, alignItems: 'center', justifyContent: 'center', opacity: busy ? .5 : 1 } }, text(label, { color: primary ? c.onAccent : c.ink, fontWeight: '700' }));
  return h(View, { testID: 'settings-details-' + kind, style: { gap: 16 } },
    kind === 'about' ? h(React.Fragment, null,
      card('music', 'Your music, offline.', 'Aiplayed plays audio stored on your phone. Organise folders and playlists, shape your sound, and discover personal mixes from your own library.', c.lavender, c.purpleInk),
      card('shield', 'Private by design', 'Music analysis and listening information stay on your device. No accounts, ads or streaming.', c.mint, c.mintInk),
      text('Version ' + version, { color: c.muted, fontSize: 14 }))
    : kind === 'permissions' ? h(React.Fragment, null,
      card('folder', 'Music and audio', 'Audio access lets Aiplayed find and play files on your phone. Selected folders and audio filters determine what appears in your library.', c.mint, c.mintInk),
      card('bell', 'Playback notifications', 'Notifications provide playback controls outside the app. Android manages these permissions in system settings.', c.lavender, c.purpleInk),
      button('Open Android settings', () => run(onOpenSettings), true))
    : h(React.Fragment, null,
      card('clock', 'Start with a fresh history', 'Clears recently played songs, recommendation listening signals and taste profiles.', c.peach, c.peachInk),
      text('Your music files, favourites, playlists and saved audio analysis are kept.'),
      button(busy ? 'Clearing…' : 'Clear history', () => run(onClearHistory), true), button('Cancel', onClose, false)),
    error && h(Text, { accessibilityRole: 'alert', style: { color: c.peachInk, fontSize: 15, lineHeight: 23 } }, error));
}
