import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { restoreFocus } from './Sheet';
import { KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RotaryKnob from './RotaryKnob';
import Feather from './Icons';
import ScrollSurface from './ScrollSurface';
import { HeaderOverlay, SectionBanner, TabHighlight } from './Pastel';
import { tones } from './design';
import { musicStore, soundPreview, useMusicSlice } from './useMusic';
import { useAppActive } from './PlaybackMotion';
import { SleepRemaining } from './PlayerProgress';
import { findOutputPreset, outputPresets } from './outputPresets';

import Pressable from './RoundedPressable';
const h = React.createElement;
const frequencies = ['31 Hz', '63 Hz', '125 Hz', '250 Hz', '500 Hz', '1 kHz', '2 kHz', '4 kHz', '8 kHz', '16 kHz'];
const defaults = { eqEnabled: false, bands: Array(10).fill(0), volume: 100, preamp: 0, bass: 0, treble: 0, balance: 0, width: 100, mono: false, limiter: true, autoHeadroom: true, bypass: false, dynamics: 0 };
const db = value => `${value > 0 ? '+' : ''}${Number(value || 0).toFixed(1)} dB`;

export function Fader({ label, value, min, max, step = 1, onCommit, live, onError = () => {}, format = db, c, disabled = false, detail, compact = false }) {
  const [draft, setDraft] = useState(null);
  const editing = useRef(null), gesture = useRef(0), pending = useRef(false), mounted = useRef(true), frame = useRef(null), latest = useRef(value), thumb = useRef(value);
  if (draft === null) thumb.current = value;
  useEffect(() => {
    if (!editing.current?.active() && !pending.current) setDraft(null);
  }, [value, disabled]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cancelAnimationFrame(frame.current); editing.current?.cancel().catch(() => {}); }; }, []);
  const start = next => {
    gesture.current++; pending.current = false;
    editing.current = live?.start(error => { cancelAnimationFrame(frame.current); frame.current = null; if (mounted.current) setDraft(null); onError(error); });
    latest.current = next; setDraft(next);
  };
  const move = next => {
    if (editing.current && !editing.current.active()) return;
    latest.current = next; editing.current?.preview(next);
    if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; if (mounted.current) setDraft(latest.current); });
  };
  const finish = async next => {
    const owner = gesture.current, session = editing.current;
    cancelAnimationFrame(frame.current); frame.current = null; pending.current = true; setDraft(next);
    try { if (session) await session.commit(next); else await onCommit(next); }
    catch (error) { onError(error); }
    finally { if (gesture.current === owner) { pending.current = false; editing.current = null; if (mounted.current) setDraft(null); } }
  };
  const cancel = () => {
    gesture.current++; pending.current = false; cancelAnimationFrame(frame.current); frame.current = null;
    editing.current?.cancel().catch(onError); editing.current = null; setDraft(null);
  };
  return h(View, { style: [{ marginBottom: 16, gap: 8, alignItems: 'center', opacity: disabled ? 0.45 : 1 }, compact ? { flexGrow: 1, flexBasis: 150, minWidth: 150 } : { width: '100%' }] },
    h(Text, { style: { color: c.ink, fontSize: 15, lineHeight: 22, fontWeight: '600', textAlign: 'center' } }, label),
    h(RotaryKnob, { minimumValue: min, maximumValue: max, step, value: thumb.current, disabled, c,
      onSlidingStart: start, onValueChange: move, onSlidingComplete: finish, onCancel: cancel, accessibilityLabel: label,
      accessibilityValue: { min, max, now: draft ?? value, text: format(draft ?? value) } }),
    detail && h(Text, { style: { color: c.muted, fontSize: 12, marginTop: 5, lineHeight: 18, textAlign: 'center' } }, detail));
}
const MemoFader = memo(Fader);
function liveControl(key, action = 'sound') {
  const patch = value => () => {
    if (key.startsWith('band:')) {
      const bands = [...(musicStore.get('main').sound?.bands || defaults.bands)];
      bands[Number(key.slice(5))] = value; return { bands };
    }
    return action === 'sound' ? { [key]: value } : { value };
  };
  return { start(onError) {
    const session = soundPreview.start(onError);
    return { active: session.active, preview: value => session.preview(action === 'sound' ? patch(value) : { [key]: value }), commit: value => session.commit(action, patch(value)), cancel: session.cancel };
  } };
}
function HeadroomDetail({ c }) {
  const status = useMusicSlice('meters');
  return h(Text, { style: { color: c.muted } }, status.active ? `${Number(status.headroomDb || 0).toFixed(1)} dB of compensation` : 'Compensation follows your EQ and tone settings.');
}
function SoundSignal({ c }) {
  const status = useMusicSlice('meters');
  const s = useMemo(() => styles(c), [c]);
  const txt = (value, style) => h(Text, { style: [s.text, style] }, value);
  return h(View, null,
    h(View, { style: s.sectionHead }, txt('Signal', s.heading), txt(status.active ? `${(status.sampleRate / 1000).toFixed(1)} kHz · ${status.channels === 1 ? 'Mono' : 'Stereo'} · ${status.outputBits}-bit processing output` : status.sourceChannels > 2 ? 'Sound effects support mono and stereo. This file has more than two channels.' : 'Start a song to see the processing format and levels.', s.detail)),
    status.active && h(View, { style: s.meters }, ...[['Signal peak', Math.max(-96, status.peakDb ?? -96)], ['Limiter reduction', -(status.limiterReductionDb || 0)], ['Dynamics reduction', -(status.compressionReductionDb || 0)]].map(([label, value]) => h(View, { key: label, style: s.flex }, txt(label, s.detail), txt(db(value), s.meter)))));
}

export default function SoundStudio({ state, command, c, onBack, onTimer, tab: chosenTab, onTab, offsets, report = () => {} }) {
  const [localTab, setLocalTab] = useState('Tone');
  const tab = chosenTab ?? localTab, setTab = onTab || setLocalTab;
  const scroll = useRef(null), offsetMap = useRef(offsets || {}).current, controls = useRef(new Map()).current;
  const active = useAppActive();
  const control = (key, action = 'sound') => { const id = `${action}:${key}`; if (!controls.has(id)) controls.set(id, liveControl(key, action)); return controls.get(id); };
  useEffect(() => { const frame = requestAnimationFrame(() => scroll.current?.scrollTo({ y: offsetMap[tab] || 0, animated: false })); return () => cancelAnimationFrame(frame); }, [tab, offsetMap]);
  useEffect(() => { if (!active) soundPreview.cancel().catch(report); return () => { soundPreview.cancel().catch(() => {}); }; }, [active]);
  const [dialog, setDialog] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false), dialogTrigger = useRef(null);
  const closeDialog = () => { if (!saveLock.current) { setDialog(null); restoreFocus(dialogTrigger.current); } };
  const sound = { ...defaults, ...state.sound };
  const s = useMemo(() => styles(c), [c]);
  const txt = (value, style, props = {}) => h(Text, { style: [s.text, style], ...props }, value);
  const action = (label, glyph, run) => h(Pressable, { onPress: run, style: s.icon, accessibilityRole: 'button', accessibilityLabel: label }, h(Feather, { name: glyph, size: 23, color: c.ink }));
  const update = patch => command('sound', patch);
  const toggle = (title, detail, value, run, disabled = false) => h(View, { style: s.toggle },
    h(View, { style: s.flex }, txt(title, s.label), detail && txt(detail, s.detail)),
    h(Switch, { value: !!value, onValueChange: run, disabled, trackColor: { false: c.track, true: c.mintInk }, thumbColor: value ? c.onAccent : c.muted, accessibilityLabel: title }));
  const title = (value, detail) => h(View, { style: s.sectionHead }, txt(value, s.heading), detail && txt(detail, s.detail));
  const fader = (key, label, min, max, options = {}) => h(MemoFader, { key, label, min, max, c, live: control(key), onError: report, value: sound[key], onCommit: value => update({ [key]: value }), disabled: sound.bypass, ...options });
  const pill = (label, selected, run, props = {}) => {
    const variants = [{ bg: c.lavender, ink: c.purpleInk, detail: c.mintInk, pattern: 'arcs' }, { bg: c.mint, ink: c.mintInk, detail: c.blueInk, pattern: 'checks' }, { bg: c.peach, ink: c.peachInk, detail: c.purpleInk, pattern: 'waves' }, { bg: c.blue, ink: c.blueInk, detail: c.roseInk, pattern: 'dots' }];
    const index = ['Tone', 'Output', 'Playback'].includes(label) ? ['Tone', 'Output', 'Playback'].indexOf(label) : Array.from(label).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
    const tone = variants[index];
    return h(Pressable, { key: label, onPress: run, accessibilityRole: 'button', hitSlop: 2, accessibilityState: { selected, disabled: !!props.disabled }, ...props, style: ({ pressed }) => [s.pill, { borderWidth: 1.5, borderColor: selected ? tone.ink : 'transparent', opacity: props.disabled ? 0.45 : pressed && !c.dark ? 0.8 : 1 }, props.style] },
      h(TabHighlight, { tone }), txt(label, { color: tone.ink, fontSize: 13, fontWeight: '600' }));
  };
  const save = async () => {
    if (!name.trim() || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    try { const result = await command('profileSave', { name: name.trim() }); if (result) { setDialog(null); restoreFocus(dialogTrigger.current); } }
    finally { saveLock.current = false; setSaving(false); }
  };
  const builtins = state.soundPresets || ['Flat', 'Warm', 'Bass', 'Vocal', 'Acoustic', 'Bright', 'Rock', 'Jazz', 'Classical', 'Speech'];
  const profiles = Object.keys(state.soundProfiles || {}).sort();
  const selectedPreset = sound.eqEnabled && !sound.bass && !sound.treble ? builtins.find(value => {
    const bands = state.equalizerPresets?.[value]?.bands;
    return Array.isArray(bands) && bands.length === 10 && sound.bands.length === 10 && bands.every((gain, i) => gain === sound.bands[i]);
  }) : null;
  const selectedOutput = findOutputPreset(sound);
  let body;
  if (tab === 'Tone') body = h(React.Fragment, null,
    title('Headroom', 'Keep EQ boosts from overloading the signal.'),
    toggle('Automatic EQ headroom', h(HeadroomDetail, { c }), sound.autoHeadroom, value => update({ autoHeadroom: value }), sound.bypass),
    fader('preamp', 'Preamp', -24, 0, { step: 0.5 }),
    title('Tone'), h(View, { style: s.knobGrid }, fader('bass', 'Bass', -12, 12, { step: 0.5, compact: true }), fader('treble', 'Treble', -12, 12, { step: 0.5, compact: true })),
    title('Equalizer', 'Rotate a knob to shape each frequency. Use + and − for a precise step.'),
    toggle('Equalizer', 'Ten bands, from sub-bass to air.', sound.eqEnabled, value => update({ eqEnabled: value }), sound.bypass),
    h(View, { style: s.pills }, ...builtins.map(value => pill(value, selectedPreset === value, () => command('equalizerPreset', { name: value }), { disabled: sound.bypass })), sound.eqEnabled && !selectedPreset && pill('Custom', true, () => {})),
    selectedPreset && state.equalizerPresetDetails?.[selectedPreset] && txt(state.equalizerPresetDetails[selectedPreset], s.detail, { accessibilityLiveRegion: 'polite' }),
    h(View, { style: [s.panel, s.knobGrid, { opacity: sound.eqEnabled ? 1 : 0.6 }] }, ...frequencies.map((label, index) => h(MemoFader, {
      key: label, label, min: -12, max: 12, step: 0.5, live: control('band:' + index), onError: report, value: sound.bands[index], c, compact: true, disabled: !sound.eqEnabled || sound.bypass,
      onCommit: value => { const bands = [...sound.bands]; bands[index] = value; return update({ bands }); }
    }))),
    title('Saved sound presets', 'Includes EQ, gain, dynamics and stereo settings. Hold a preset to remove it.'),
    profiles.length ? h(View, { style: s.saved }, ...profiles.map(value => pill(value, false, () => command('profileApply', { name: value }), { onLongPress: () => setDialog({ kind: 'delete', name: value }) }))) : txt('Your saved presets will appear here.', s.detail),
    h(Pressable, { style: s.primary, accessibilityRole: 'button', onPress: e => { dialogTrigger.current = e?.nativeEvent?.target; setName(''); setDialog({ kind: 'save' }); } }, h(TabHighlight, { tone: { bg: c.mint, ink: c.mintInk, detail: c.blueInk, pattern: 'checks' } }), txt('Save sound preset', s.primaryText)));
  else if (tab === 'Output') body = h(React.Fragment, null,
    title('Output presets', 'Choose a starting point, then fine-tune below. EQ and balance stay as set.'),
    h(View, { style: [s.pills, sound.bypass && { opacity: 0.45 }] }, ...outputPresets.map(preset => pill(preset.label, selectedOutput?.id === preset.id, () => update({ ...preset.settings }), { disabled: sound.bypass }))),
    txt(selectedOutput ? selectedOutput.detail : 'Custom output · your manual settings are active.', s.detail, { accessibilityLiveRegion: 'polite' }),
    title('Volume boost', 'Adds gain to the music in this app. Loud recordings may trigger the limiter.'),
    fader('volume', 'Boost', 100, 300, { step: 5, format: v => `${Math.round(v)}%` }),
    toggle('Limiter', 'Reduces clipping from boosted levels. Stereo channels stay linked.', sound.limiter, value => update({ limiter: value }), sound.bypass),
    !sound.limiter && !sound.bypass && txt('Limiter is off. High gain and EQ boosts can distort.', s.notice),
    title('Dynamics', 'Gentle and Night reduce loud passages. Leave Off to preserve the recording’s dynamics.'),
    h(View, { style: s.pills }, ...['Off', 'Gentle', 'Night'].map((value, index) => pill(value, sound.dynamics === index, () => update({ dynamics: index }), { disabled: sound.bypass }))),
    title('Stereo'),
    toggle('Mono audio', 'Combines the left and right channels.', sound.mono, value => update({ mono: value }), sound.bypass),
    fader('balance', 'Balance', -100, 100, { format: v => v === 0 ? 'Centre' : `${v < 0 ? 'Left' : 'Right'} ${Math.abs(Math.round(v))}%` }),
    fader('width', 'Stereo width', 0, 150, { step: 5, disabled: sound.bypass || sound.mono, format: v => `${Math.round(v)}%`, detail: '100% keeps the original stereo image.' }),
    h(SoundSignal, { c }));
  else body = h(React.Fragment, null,
    title('Speed & pitch', 'Change tempo and pitch independently.'),
    h(MemoFader, { label: 'Playback speed', live: control('speed', 'speed'), onError: report, min: 0.5, max: 2, step: 0.05, value: state.speed, c, format: v => `${Number(v).toFixed(2)}×`, onCommit: value => command('speed', { value }) }),
    h(MemoFader, { label: 'Pitch', live: control('pitch', 'pitch'), onError: report, min: -12, max: 12, step: 1, value: state.pitch || 0, c, format: v => `${v > 0 ? '+' : ''}${Math.round(v)} semitones`, onCommit: value => command('pitch', { value }) }),
    h(Pressable, { style: s.secondary, onPress: async () => { await command('speed', { value: 1 }); await command('pitch', { value: 0 }); }, accessibilityRole: 'button' }, txt('Reset speed & pitch', { color: c.accent, fontWeight: '600' })),
    toggle('Skip silence', 'Useful for spoken audio. Can remove intentional pauses in music.', state.skipSilence, value => command('skipSilence', { value })),
    title('Listening'),
    toggle('Pause when disconnected', 'Pause when headphones or Bluetooth disconnect.', state.pauseDisconnect, value => command('pauseDisconnect', { value })),
    h(Pressable, { style: s.toggle, onPress: onTimer, accessibilityRole: 'button' }, h(View, { style: s.flex }, txt('Sleep timer', s.label), h(SleepRemaining, { style: s.detail })), h(Feather, { name: 'chevron-right', size: 22, color: c.muted })),
    toggle('Fade out sleep timer', 'Fade gently during the final 15 seconds.', state.sleepFade, value => command('sleepFade', { value })),
    title('Playback engine'), txt('Gapless queue playback with Android media controls. File format and output-device support depend on your phone.', s.detail));

  return h(View, { style: s.root },
    h(View, { style: s.header }, h(HeaderOverlay), action('Back', 'arrow-left', onBack), txt('Sound studio', s.screenTitle), h(Pressable, { style: s.resetButton, onPress: e => { dialogTrigger.current = e?.nativeEvent?.target; setDialog({ kind: 'reset' }); }, accessibilityRole: 'button' }, txt('Reset', { color: c.accent, fontWeight: '600' }))),
    h(View, { style: s.tabs }, ...['Tone', 'Output', 'Playback'].map(value => pill(value, tab === value, () => { if (value !== tab) { soundPreview.cancel().catch(report); setTab(value); } }, { style: { flex: 1, alignItems: 'center' } }))),
    h(ScrollSurface, { color: c.bg, initialOffset: offsetMap[tab] || 0 }, h(ScrollView, { ref: scroll, onScroll: event => { offsetMap[tab] = Math.max(0, event.nativeEvent.contentOffset.y); }, scrollEventThrottle: 16, contentContainerStyle: s.body, keyboardShouldPersistTaps: 'handled' },
      h(SectionBanner, { title: tab === 'Tone' ? 'Find your colour.' : tab === 'Output' ? 'Make every note yours.' : 'Set your own pace.', detail: tab === 'Tone' ? 'Shape your sound, from the first bass note to the last shimmer.' : tab === 'Output' ? 'Fine-tune volume, dynamics and your stereo balance.' : 'Your speed, your pitch, your listening routine.', icon: tab === 'Tone' ? 'sliders' : tab === 'Output' ? 'volume-2' : 'headphones', tone: tones(c)[tab === 'Tone' ? 0 : tab === 'Output' ? 1 : 2] }),
      toggle('Bypass sound effects', 'Compare with EQ, tone, gain and dynamics bypassed.', sound.bypass, value => update({ bypass: value })),
      sound.bypass && txt('Sound effects are bypassed. Playback speed and pitch remain as set.', s.notice), body)),
    h(Modal, { visible: !!dialog, transparent: true, animationType: 'fade', onRequestClose: closeDialog },
      h(KeyboardAvoidingView, { behavior: 'padding', style: s.overlay }, h(Pressable, { onPress: closeDialog, disabled: saving, accessibilityRole: 'button', accessibilityLabel: 'Close dialog', feedback: false, style: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } }), h(SafeAreaView, { style: s.dialog },
        txt(dialog?.kind === 'save' ? 'Save sound preset' : dialog?.kind === 'delete' ? 'Remove preset?' : 'Reset sound?', s.heading),
        dialog?.kind === 'save' ? h(TextInput, { value: name, onChangeText: setName, placeholder: 'Preset name', placeholderTextColor: c.muted, autoFocus: true, maxLength: 40, style: s.input, accessibilityLabel: 'Preset name', onSubmitEditing: save }) : txt(dialog?.kind === 'delete' ? `Remove “${dialog?.name}”?` : 'Return EQ, tone, gain, stereo and dynamics to their defaults. Saved presets stay available.', s.detail),
        h(View, { style: s.dialogActions }, h(Pressable, { style: s.secondary, onPress: closeDialog, disabled: saving, accessibilityRole: 'button' }, txt('Cancel', { color: c.muted })),
          h(Pressable, { style: [s.primary, { marginTop: 0, opacity: dialog?.kind === 'save' && (!name.trim() || saving) ? 0.5 : 1 }], disabled: saving || (dialog?.kind === 'save' && !name.trim()), accessibilityRole: 'button', onPress: async () => {
            if (dialog.kind === 'save') return save();
            if (saveLock.current) return; saveLock.current = true; setSaving(true);
            try { const result = await command(dialog.kind === 'delete' ? 'profileDelete' : 'soundReset', dialog.kind === 'delete' ? { name: dialog.name } : {}); if (result) { setDialog(null); restoreFocus(dialogTrigger.current); } } finally { saveLock.current = false; setSaving(false); }
          } }, h(TabHighlight, { tone: { bg: c.mint, ink: c.mintInk, detail: c.blueInk, pattern: 'checks' } }), txt(dialog?.kind === 'save' ? (saving ? 'Saving…' : 'Save') : dialog?.kind === 'delete' ? 'Remove' : 'Reset', s.primaryText)))))));
}

function styles(c) {
  return StyleSheet.create({ root: { flex: 1, backgroundColor: c.bg }, flex: { flex: 1 }, text: { color: c.ink, fontSize: 15 }, header: { flexDirection: 'row', alignItems: 'center', minHeight: 66, paddingHorizontal: 10, backgroundColor: c.header, borderBottomWidth: 1, borderBottomColor: c.headerLine, overflow: 'hidden', marginBottom: 12, flexShrink: 0 }, resetButton: { minHeight: 48, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.lavender, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, icon: { overflow: 'hidden', borderRadius: 24, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, screenTitle: { fontSize: 25, fontWeight: '700', flex: 1, paddingLeft: 8 },
    tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 22, paddingBottom: 10 }, body: { paddingHorizontal: 24, paddingBottom: 40 }, heading: { fontSize: 21, fontWeight: '600' }, label: { fontSize: 15, fontWeight: '500' }, detail: { color: c.muted, fontSize: 12, lineHeight: 19, marginTop: 5 }, sectionHead: { marginTop: 25, marginBottom: 15 }, toggle: { overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 15, paddingHorizontal: 14, borderRadius: 20, backgroundColor: c.card, marginBottom: 12 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8 }, pill: { overflow: 'hidden', paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', backgroundColor: c.lavender, borderRadius: 24 }, selected: { backgroundColor: c.accent }, knobGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, panel: { backgroundColor: c.card, borderRadius: 24, padding: 12, borderWidth: 1, borderColor: c.line, marginTop: 12 }, heroValue: { color: c.accent, fontSize: 44, fontWeight: '700', fontVariant: ['tabular-nums'], marginVertical: 8 },
    rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -18, marginBottom: 15 }, notice: { color: c.accent, lineHeight: 20, fontSize: 13, marginVertical: 10 }, saved: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, primary: { overflow: 'hidden', minHeight: 50, paddingHorizontal: 22, paddingVertical: 13, backgroundColor: c.mint, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 22 }, primaryText: { color: c.mintInk, fontWeight: '700', fontSize: 15 }, secondary: { overflow: 'hidden', borderRadius: 28, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
    meters: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16, borderRadius: 22, backgroundColor: c.mint }, meter: { fontSize: 18, fontVariant: ['tabular-nums'], marginTop: 8 }, overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: c.soundScrim }, dialog: { padding: 24, backgroundColor: c.card, borderRadius: 28 }, input: { color: c.ink, fontSize: 16, borderBottomWidth: 1, borderBottomColor: c.track, paddingVertical: 14, marginVertical: 14, minHeight: 48 }, dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 18 }
  });
}


