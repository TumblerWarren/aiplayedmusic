import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Feather } from '@expo/vector-icons';
import { formatTime } from './music';

const h = React.createElement;
const frequencies = ['31 Hz', '63 Hz', '125 Hz', '250 Hz', '500 Hz', '1 kHz', '2 kHz', '4 kHz', '8 kHz', '16 kHz'];
const defaults = { eqEnabled: false, bands: Array(10).fill(0), volume: 100, preamp: 0, bass: 0, treble: 0, balance: 0, width: 100, mono: false, limiter: true, autoHeadroom: true, bypass: false, dynamics: 0 };
const db = value => `${value > 0 ? '+' : ''}${Number(value || 0).toFixed(1)} dB`;

export function Fader({ label, value, min, max, step = 1, onCommit, format = db, c, disabled = false, detail }) {
  const [draft, setDraft] = useState(null);
  useEffect(() => setDraft(null), [value]);
  return h(View, { style: { marginBottom: 13, opacity: disabled ? 0.45 : 1 } },
    h(View, { style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } },
      h(Text, { style: { color: c.ink, fontSize: 14, fontWeight: '500' } }, label),
      h(Text, { style: { color: c.accent, fontSize: 14, fontVariant: ['tabular-nums'] }, accessibilityLiveRegion: 'polite' }, format(draft ?? value))),
    detail && h(Text, { style: { color: c.muted, fontSize: 12, marginTop: 5, lineHeight: 18 } }, detail),
    h(Slider, { style: { height: 48, marginHorizontal: -10 }, minimumValue: min, maximumValue: max, step, value: draft ?? value, disabled,
      onValueChange: setDraft, onSlidingComplete: async next => { await onCommit(next); setDraft(null); },
      minimumTrackTintColor: c.accent, maximumTrackTintColor: c.track, thumbTintColor: c.accent, accessibilityLabel: label,
      accessibilityValue: { min, max, now: draft ?? value, text: format(draft ?? value) } }));
}

export default function SoundStudio({ state, command, c, onBack, onTimer }) {
  const [tab, setTab] = useState('Tone');
  const [dialog, setDialog] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const sound = { ...defaults, ...state.sound };
  const status = state.soundStatus || {};
  const s = styles(c);
  const txt = (value, style, props = {}) => h(Text, { style: [s.text, style], ...props }, value);
  const action = (label, glyph, run) => h(Pressable, { onPress: run, style: s.icon, accessibilityRole: 'button', accessibilityLabel: label }, h(Feather, { name: glyph, size: 23, color: c.ink }));
  const update = patch => command('sound', patch);
  const toggle = (title, detail, value, run, disabled = false) => h(View, { style: s.toggle },
    h(View, { style: s.flex }, txt(title, s.label), detail && txt(detail, s.detail)),
    h(Switch, { value: !!value, onValueChange: run, disabled, trackColor: { false: c.track, true: c.accent }, thumbColor: value ? c.onAccent : c.muted, accessibilityLabel: title }));
  const title = (value, detail) => h(View, { style: s.sectionHead }, txt(value, s.heading), detail && txt(detail, s.detail));
  const fader = (key, label, min, max, options = {}) => h(Fader, { key, label, min, max, c, value: sound[key], onCommit: value => update({ [key]: value }), disabled: sound.bypass, ...options });
  const pill = (label, selected, run, props = {}) => h(Pressable, { key: label, onPress: run, accessibilityRole: 'button', accessibilityState: { selected }, ...props, style: [s.pill, selected && s.selected, props.style] }, txt(label, { color: selected ? c.onAccent : c.ink, fontSize: 13, fontWeight: '600' }));
  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try { const result = await command('profileSave', { name: name.trim() }); if (result) setDialog(null); }
    finally { setSaving(false); }
  };
  const builtins = state.soundPresets || ['Flat', 'Warm', 'Bass', 'Vocal', 'Acoustic', 'Bright'];
  const profiles = Object.keys(state.soundProfiles || {}).sort();
  const selectedPreset = sound.eqEnabled && !sound.bass && !sound.treble ? builtins.find(value => state.equalizerPresets?.[value]?.bands.every((gain, i) => gain === sound.bands[i])) : null;
  let body;
  if (tab === 'Tone') body = h(React.Fragment, null,
    toggle('Equalizer', 'Ten bands, from sub-bass to air.', sound.eqEnabled, value => update({ eqEnabled: value }), sound.bypass),
    h(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: s.pills }, ...builtins.map(value => pill(value, selectedPreset === value, () => command('profileApply', { name: value }), { disabled: sound.bypass })), sound.eqEnabled && !selectedPreset && pill('Custom', true, () => {})),
    h(View, { style: [s.panel, { opacity: sound.eqEnabled ? 1 : 0.6 }] }, ...frequencies.map((label, index) => h(Fader, {
      key: label, label, min: -12, max: 12, step: 0.5, value: sound.bands[index], c, disabled: !sound.eqEnabled || sound.bypass,
      onCommit: value => { const bands = [...sound.bands]; bands[index] = value; return update({ bands }); }
    }))),
    title('Headroom', 'Keep EQ boosts from overloading the signal.'),
    toggle('Automatic EQ headroom', status.active ? `${Number(status.headroomDb || 0).toFixed(1)} dB of compensation` : 'Compensation follows your EQ and tone settings.', sound.autoHeadroom, value => update({ autoHeadroom: value }), sound.bypass),
    fader('preamp', 'Preamp', -24, 0, { step: 0.5 }),
    title('Tone'), fader('bass', 'Bass', -12, 12, { step: 0.5 }), fader('treble', 'Treble', -12, 12, { step: 0.5 }),
    title('Saved sound presets', 'Includes EQ, gain, dynamics and stereo settings. Hold a preset to remove it.'),
    profiles.length ? h(View, { style: s.saved }, ...profiles.map(value => pill(value, false, () => command('profileApply', { name: value }), { onLongPress: () => setDialog({ kind: 'delete', name: value }) }))) : txt('Your saved presets will appear here.', s.detail),
    h(Pressable, { style: s.primary, accessibilityRole: 'button', onPress: () => { setName(''); setDialog({ kind: 'save' }); } }, txt('Save sound preset', s.primaryText)));
  else if (tab === 'Output') body = h(React.Fragment, null,
    title('Volume boost', 'Adds gain to the music in this app. Loud recordings may trigger the limiter.'),
    txt(`${Math.round(sound.volume)}%`, s.heroValue),
    fader('volume', 'Boost', 100, 300, { step: 5, format: v => `${Math.round(v)}%` }),
    h(View, { style: s.rangeLabels }, txt('100%', s.detail), txt('200%', s.detail), txt('300%', s.detail)),
    toggle('Limiter', 'Reduces clipping from boosted levels. Stereo channels stay linked.', sound.limiter, value => update({ limiter: value }), sound.bypass),
    !sound.limiter && !sound.bypass && txt('Limiter is off. High gain and EQ boosts can distort.', s.notice),
    title('Dynamics', 'Gentle and Night reduce loud passages. Leave Off to preserve the recording’s dynamics.'),
    h(View, { style: s.pills }, ...['Off', 'Gentle', 'Night'].map((value, index) => pill(value, sound.dynamics === index, () => update({ dynamics: index }), { disabled: sound.bypass }))),
    title('Stereo'),
    toggle('Mono audio', 'Combines the left and right channels.', sound.mono, value => update({ mono: value }), sound.bypass),
    fader('balance', 'Balance', -100, 100, { format: v => v === 0 ? 'Centre' : `${v < 0 ? 'Left' : 'Right'} ${Math.abs(Math.round(v))}%` }),
    fader('width', 'Stereo width', 0, 150, { step: 5, disabled: sound.bypass || sound.mono, format: v => `${Math.round(v)}%`, detail: '100% keeps the original stereo image.' }),
    title('Signal', status.active ? `${(status.sampleRate / 1000).toFixed(1)} kHz · ${status.channels === 1 ? 'Mono' : 'Stereo'} · ${status.outputBits}-bit processing output` : status.sourceChannels > 2 ? 'Sound effects support mono and stereo. This file has more than two channels.' : 'Start a song to see the processing format and levels.'),
    status.active && h(View, { style: s.meters },
      h(View, { style: s.flex }, txt('Signal peak', s.detail), txt(db(Math.max(-96, status.peakDb ?? -96)), s.meter)),
      h(View, { style: s.flex }, txt('Limiter reduction', s.detail), txt(db(-(status.limiterReductionDb || 0)), s.meter)),
      h(View, { style: s.flex }, txt('Dynamics reduction', s.detail), txt(db(-(status.compressionReductionDb || 0)), s.meter))));
  else body = h(React.Fragment, null,
    title('Speed & pitch', 'Change tempo and pitch independently.'),
    h(Fader, { label: 'Playback speed', min: 0.5, max: 2, step: 0.05, value: state.speed, c, format: v => `${Number(v).toFixed(2)}×`, onCommit: value => command('speed', { value }) }),
    h(Fader, { label: 'Pitch', min: -12, max: 12, step: 1, value: state.pitch || 0, c, format: v => `${v > 0 ? '+' : ''}${Math.round(v)} semitones`, onCommit: value => command('pitch', { value }) }),
    h(Pressable, { style: s.secondary, onPress: async () => { await command('speed', { value: 1 }); await command('pitch', { value: 0 }); }, accessibilityRole: 'button' }, txt('Reset speed & pitch', { color: c.accent, fontWeight: '600' })),
    toggle('Skip silence', 'Useful for spoken audio. Can remove intentional pauses in music.', state.skipSilence, value => command('skipSilence', { value })),
    title('Listening'),
    toggle('Pause when disconnected', 'Pause when headphones or Bluetooth disconnect.', state.pauseDisconnect, value => command('pauseDisconnect', { value })),
    h(Pressable, { style: s.toggle, onPress: onTimer, accessibilityRole: 'button' }, h(View, { style: s.flex }, txt('Sleep timer', s.label), txt(state.sleepRemaining ? `${formatTime(state.sleepRemaining)} remaining` : 'Off', s.detail)), h(Feather, { name: 'chevron-right', size: 22, color: c.muted })),
    toggle('Fade out sleep timer', 'Fade gently during the final 15 seconds.', state.sleepFade, value => command('sleepFade', { value })),
    title('Playback engine'), txt('Gapless queue playback with Android media controls. File format and output-device support depend on your phone.', s.detail));

  return h(View, { style: s.root },
    h(View, { style: s.header }, action('Back', 'arrow-left', onBack), txt('Sound', s.screenTitle), h(Pressable, { style: s.icon, onPress: () => setDialog({ kind: 'reset' }), accessibilityRole: 'button' }, txt('Reset', { color: c.accent, fontWeight: '600' }))),
    h(View, { style: s.tabs }, ...['Tone', 'Output', 'Playback'].map(value => pill(value, tab === value, () => setTab(value), { style: { flex: 1, alignItems: 'center' } }))),
    h(ScrollView, { contentContainerStyle: s.body, keyboardShouldPersistTaps: 'handled' },
      toggle('Bypass sound effects', 'Compare with EQ, tone, gain and dynamics bypassed.', sound.bypass, value => update({ bypass: value })),
      sound.bypass && txt('Sound effects are bypassed. Playback speed and pitch remain as set.', s.notice), body),
    h(Modal, { visible: !!dialog, transparent: true, animationType: 'fade', onRequestClose: () => setDialog(null) },
      h(View, { style: s.overlay }, h(SafeAreaView, { style: s.dialog },
        txt(dialog?.kind === 'save' ? 'Save sound preset' : dialog?.kind === 'delete' ? 'Remove preset?' : 'Reset sound?', s.heading),
        dialog?.kind === 'save' ? h(TextInput, { value: name, onChangeText: setName, placeholder: 'Preset name', placeholderTextColor: c.muted, autoFocus: true, maxLength: 40, style: s.input, accessibilityLabel: 'Preset name', onSubmitEditing: save }) : txt(dialog?.kind === 'delete' ? `Remove “${dialog?.name}”?` : 'Return EQ, tone, gain, stereo and dynamics to their defaults. Saved presets stay available.', s.detail),
        h(View, { style: s.dialogActions }, h(Pressable, { style: s.secondary, onPress: () => setDialog(null), accessibilityRole: 'button' }, txt('Cancel', { color: c.muted })),
          h(Pressable, { style: [s.primary, { marginTop: 0, opacity: dialog?.kind === 'save' && (!name.trim() || saving) ? 0.5 : 1 }], disabled: saving || (dialog?.kind === 'save' && !name.trim()), accessibilityRole: 'button', onPress: async () => {
            if (dialog.kind === 'save') return save();
            await command(dialog.kind === 'delete' ? 'profileDelete' : 'soundReset', dialog.kind === 'delete' ? { name: dialog.name } : {}); setDialog(null);
          } }, txt(dialog?.kind === 'save' ? (saving ? 'Saving…' : 'Save') : dialog?.kind === 'delete' ? 'Remove' : 'Reset', s.primaryText)))))));
}

function styles(c) {
  return StyleSheet.create({ root: { flex: 1, backgroundColor: c.bg }, flex: { flex: 1 }, text: { color: c.ink, fontSize: 15 }, header: { flexDirection: 'row', alignItems: 'center', minHeight: 66, paddingHorizontal: 10 }, icon: { minWidth: 56, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, screenTitle: { fontSize: 28, fontWeight: '700', flex: 1, paddingLeft: 8 },
    tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, paddingBottom: 10 }, body: { paddingHorizontal: 24, paddingBottom: 40 }, heading: { fontSize: 21, fontWeight: '600' }, label: { fontSize: 15, fontWeight: '500' }, detail: { color: c.muted, fontSize: 12, lineHeight: 19, marginTop: 5 }, sectionHead: { marginTop: 25, marginBottom: 15 }, toggle: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 15 },
    pills: { flexDirection: 'row', gap: 8, paddingVertical: 8 }, pill: { paddingHorizontal: 17, minHeight: 44, justifyContent: 'center', backgroundColor: c.card, borderRadius: 12 }, selected: { backgroundColor: c.accent }, panel: { backgroundColor: c.card, borderRadius: 16, padding: 18, marginTop: 12 }, heroValue: { color: c.accent, fontSize: 44, fontWeight: '700', fontVariant: ['tabular-nums'], marginVertical: 8 },
    rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -18, marginBottom: 15 }, notice: { color: c.accent, lineHeight: 20, fontSize: 13, marginVertical: 10 }, saved: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, primary: { minHeight: 50, paddingHorizontal: 22, paddingVertical: 13, backgroundColor: c.accent, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 22 }, primaryText: { color: c.onAccent, fontWeight: '700', fontSize: 15 }, secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
    meters: { flexDirection: 'row', gap: 12, paddingVertical: 12 }, meter: { fontSize: 18, fontVariant: ['tabular-nums'], marginTop: 8 }, overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0009' }, dialog: { padding: 24, backgroundColor: c.card, borderRadius: 18 }, input: { color: c.ink, fontSize: 16, borderBottomWidth: 1, borderBottomColor: c.track, paddingVertical: 14, marginVertical: 14, minHeight: 48 }, dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 18 }
  });
}
