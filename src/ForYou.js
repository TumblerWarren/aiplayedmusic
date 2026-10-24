import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Pressable from './RoundedPressable';
import { SectionBanner } from './Pastel';
import { tones } from './design';
import { analysisMessage } from './recommendations';
import { useRecommendations } from './useRecommendations';
const h = React.createElement;
const privacy = 'Your music is analysed on this phone. Audio, listening information and personal mixes stay local. No account or internet connection is needed.';

function Action({ title, onPress, c, disabled = false }) {
  return h(Pressable, { accessibilityRole: 'button', accessibilityLabel: title, accessibilityState: { disabled }, disabled, onPress, style: { minHeight: 48, padding: 14, paddingHorizontal: 20, borderRadius: 24, backgroundColor: c.lavender, alignItems: 'center', justifyContent: 'center', opacity: disabled ? .45 : 1 } }, h(Text, { style: { color: c.purpleInk, fontSize: 15, fontWeight: '700', textAlign: 'center' } }, title));
}
export function AnalysisPanel({ value, actions, c }) {
  const { status, busy, error } = value;
  const text = (label, extra = {}) => h(Text, { style: { color: c.muted, fontSize: 14, lineHeight: 22, ...extra } }, label);
  return h(View, { testID: 'recommendation-analysis', style: { gap: 12 } },
    text(analysisMessage(status), { color: c.ink, fontSize: 17, fontWeight: '600' }),
    text(`${status.analysed || 0} of ${status.eligible || 0} songs analysed`),
    status.failed > 0 && text(`${status.failed} ${status.failed === 1 ? 'file could' : 'files could'} not be read.`),
    error && text(error, { color: c.ink }),
    status.enabled && h(View, { style: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } },
      h(Action, { title: status.state === 'paused_user' ? 'Resume analysis' : 'Analyse now', onPress: () => actions.analyse(false), disabled: busy || status.running, c }),
      !['paused_user', 'ready', 'empty'].includes(status.state) && h(Action, { title: 'Pause analysis', onPress: actions.pause, disabled: busy, c }),
      status.failed > 0 && h(Action, { title: 'Retry failed files', onPress: () => actions.analyse(true), disabled: busy || status.running, c })),
    text('Automatic analysis runs while charging with enough battery. Music playback takes priority.'));
}

export default function ForYou({ c, onSaved }) {
  const [value, actions] = useRecommendations();
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(null);
  const [name, setName] = useState('');
  const text = (label, extra = {}) => h(Text, { style: { color: c.ink, fontSize: 15, lineHeight: 23, ...extra } }, label);
  const save = async () => { if (await actions.save(saving.id, name)) { setSaving(null); await onSaved?.(); } };
  const cards = value.mixes.map(mix => {
    const controls = h(View, { style: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } },
      h(Action, { title: `Play ${mix.title.toLowerCase()}`, onPress: () => actions.play(mix.id), disabled: value.busy, c }),
      h(Action, { title: preview === mix.id ? 'Hide songs' : `Preview ${mix.title.toLowerCase()}`, onPress: () => setPreview(preview === mix.id ? null : mix.id), c }),
      h(Action, { title: 'Save as playlist', onPress: () => { setName(mix.title); setSaving(mix); }, disabled: value.busy, c }));
    const songs = preview === mix.id && h(View, { testID: 'mix-preview', style: { gap: 14 } },
      ...mix.tracks.map((song, index) => h(View, { key: song.id }, text(`${index + 1}. ${song.title}`), text(song.artist, { fontSize: 13, color: c.muted }))));
    return h(View, { key: mix.id, testID: 'personal-mix', style: { padding: 18, gap: 12, backgroundColor: c.card, borderRadius: 26 } },
      text(mix.title, { fontSize: 22, fontWeight: '700' }), text(mix.subtitle, { color: c.muted }),
      text(`${mix.tracks.length} songs · Fixed mix`, { color: c.muted, fontSize: 13 }), controls, songs);
  });
  const dialogContent = h(View, { accessibilityViewIsModal: true, style: { backgroundColor: c.card, borderRadius: 26, padding: 22, gap: 16 } },
    text('Save as playlist', { fontSize: 22, fontWeight: '700' }),
    h(TextInput, { value: name, onChangeText: setName, maxLength: 100, autoFocus: true, accessibilityLabel: 'Playlist name', style: { color: c.ink, backgroundColor: c.bg, borderRadius: 16, minHeight: 52, padding: 14, fontSize: 16 } }),
    value.error && text(value.error), h(Action, { title: 'Save playlist', onPress: save, disabled: value.busy || !name.trim(), c }),
    h(Action, { title: 'Cancel', onPress: () => setSaving(null), disabled: value.busy, c }));
  const dialog = h(Modal, { visible: !!saving, transparent: true, animationType: 'fade', onRequestClose: () => { if (!value.busy) setSaving(null); } },
    h(GestureHandlerRootView, { style: { flex: 1 } },
      h(KeyboardAvoidingView, { behavior: Platform.OS === 'ios' ? 'padding' : undefined, style: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center' } },
        h(ScrollView, { contentContainerStyle: { flexGrow: 1, justifyContent: 'center', padding: 24 }, keyboardShouldPersistTaps: 'handled' }, dialogContent))));
  const body = !value.status.enabled
    ? h(View, { style: { gap: 16 } }, text(privacy), h(Action, { title: 'Enable personal mixes', onPress: () => actions.enable(true), disabled: value.busy || !value.loaded, c }), value.error && text(value.error))
    : h(React.Fragment, null, h(AnalysisPanel, { value, actions, c }),
      !value.status.mixesAvailable && text(value.status.eligible === 0 ? 'Add music to your library or adjust your folder and audio filters.' : 'Mixes appear after ten songs are analysed, or after your whole library if it has fewer than ten.', { color: c.muted }),
      value.mixes.length > 0 && h(Action, { title: 'Refresh suggestions', onPress: actions.refresh, disabled: value.busy, c }), ...cards);
  return h(View, { testID: 'for-you-screen', style: { flex: 1 } },
    h(ScrollView, { contentContainerStyle: { padding: 22, paddingTop: 4, paddingBottom: 36, gap: 18 } },
      h(SectionBanner, { title: 'Your music, rediscovered.', detail: 'Personal mixes from the songs already on your phone.', icon: 'star', tone: tones(c)[0] }),
      !value.loaded && text('Checking personal mixes…'), body), dialog);
}

export function PersonalMixesSettings({ c }) {
  const [value, actions] = useRecommendations();
  const enable = enabled => enabled ? Alert.alert('Enable personal mixes?', privacy, [{ text: 'Cancel' }, { text: 'Enable', onPress: () => actions.enable(true) }]) : actions.enable(false);
  return h(ScrollView, { testID: 'personal-mixes-settings', contentContainerStyle: { padding: 24, gap: 20, paddingBottom: 40 } },
    h(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 12 } }, h(Text, { style: { flex: 1, color: c.ink, fontSize: 19, fontWeight: '600' } }, 'Personal mixes'), h(Switch, { value: value.status.enabled, onValueChange: enable, disabled: value.busy || !value.loaded, trackColor: { true: c.accent, false: c.track }, accessibilityLabel: 'Enable personal mixes' })),
    h(Text, { style: { color: c.muted, fontSize: 15, lineHeight: 23 } }, privacy),
    h(AnalysisPanel, { value, actions, c }),
    h(Action, { title: 'Delete audio analysis', disabled: value.busy, c, onPress: () => Alert.alert('Delete audio analysis?', 'This removes audio embeddings and personal mixes, and turns personal mixes off. Your songs, favourites, playlists and listening history stay.', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: actions.deleteAnalysis }]) }),
    h(Text, { style: { color: c.muted, fontSize: 13, lineHeight: 20 } }, 'Clear listening history in Settings also resets listening signals and taste profiles. It keeps favourites, playlists and audio analysis.'));
}
