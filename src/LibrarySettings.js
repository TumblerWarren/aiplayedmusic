import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Feather from './Icons';
import { SectionBanner } from './Pastel';
import { tones } from './design';
import { Fader } from './SoundStudio';
const h = React.createElement;

export default function LibrarySettings({ state, command, c, scan, onBack, chooseFolder }) {
  const text = (value, style = {}) => h(Text, { style: { color: c.ink, fontSize: 15, ...style } }, value);
  const action = (title, detail, glyph, onPress) => h(Pressable, { key: title, accessibilityRole: 'button', onPress, style: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, padding: 14, borderRadius: 22, backgroundColor: c.card, marginVertical: 6 } },
    h(Feather, { name: glyph, size: 22, color: c.accent }), h(View, { style: { flex: 1 } }, text(title, { fontWeight: '600' }), detail && text(detail, { fontSize: 12, lineHeight: 19, color: c.muted, marginTop: 5 })), h(Feather, { name: 'chevron-right', size: 20, color: c.muted }));
  const section = title => text(title, { fontSize: 21, fontWeight: '600', marginTop: 25, marginBottom: 14 });
  const changeFilter = async patch => { await command('filters', patch); await scan(); };
  return h(View, { style: { flex: 1 } },
    h(View, { style: { flexDirection: 'row', alignItems: 'center', minHeight: 66, paddingHorizontal: 12 } }, h(Pressable, { accessibilityLabel: 'Back', accessibilityRole: 'button', onPress: onBack, style: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' } }, h(Feather, { name: 'arrow-left', size: 23, color: c.ink })), text('Music library', { fontSize: 26, fontWeight: '700' })),
    h(ScrollView, { contentContainerStyle: { padding: 24, paddingTop: 0, paddingBottom: 40 } },
      h(SectionBanner, { title: 'A home for every song.', detail: 'Keep your collection close. Choose the folders you love.', icon: 'folder', tone: tones(c)[1] }),
      section('Music folders'), text(state.musicRoots?.length ? 'Only selected folders and their subfolders are scanned.' : 'Scanning all audio indexed on this phone. Choose folders to narrow your library.', { color: c.muted, lineHeight: 22 }),
      action('Add music folder', 'Choose a folder on your phone or SD card.', 'folder-plus', chooseFolder),
      ...(state.musicRoots || []).map(path => action(path.split('/').pop(), `${path}\nTap to remove this scan restriction.`, 'minus-circle', async () => { await command('removeRoot', { path }); await scan(); })),
      section('Audio filters'),
      h(Fader, { label: 'Minimum duration', min: 0, max: 120, value: state.minDuration || 0, c, format: v => `${Math.round(v)} seconds`, onCommit: minDuration => changeFilter({ minDuration }) }),
      h(Fader, { label: 'Minimum file size', min: 0, max: 2048, step: 64, value: state.minSize || 0, c, format: v => `${Math.round(v)} KB`, onCommit: minSize => changeFilter({ minSize }) }),
      section('Excluded folders'), text('Hold a folder in the browser to exclude it and its subfolders. Tap an excluded folder here to include it again.', { color: c.muted, lineHeight: 22 }),
      ...(state.excluded || []).map(path => action(path.split('/').pop(), path, 'folder', async () => { await command('excludeFolder', { path, value: false }); await scan(); })),
      !state.excluded?.length && text('No folders excluded.', { color: c.muted, marginTop: 18 })));
}

