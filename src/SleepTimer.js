import React, { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import Pressable from './RoundedPressable';
import { useMusicSlice } from './useMusic';
const h = React.createElement;

export function timerMinutes(value) {
  if (!/^\d+$/.test(value.trim())) return null;
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440 ? minutes : null;
}

export default function SleepTimer({ c, command, onClose }) {
  const { sleepRemaining } = useMusicSlice('progress');
  const [value, setValue] = useState(String(sleepRemaining ? Math.ceil(sleepRemaining / 60000) : 30));
  const [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const save = async () => {
    if (locked.current) return;
    const minutes = timerMinutes(value);
    if (minutes === null) { setError('Enter a whole number from 1 to 1440 minutes.'); return; }
    locked.current = true; setSaving(true); setError('');
    try {
      const result = await command('sleep', { minutes });
      if (!mounted.current) return;
      if (result) onClose();
      else setError('Couldn’t set the sleep timer. Please try again.');
    } catch { if (mounted.current) setError('Couldn’t set the sleep timer. Please try again.'); }
    finally { locked.current = false; if (mounted.current) setSaving(false); }
  };
  return h(View, { style: { gap: 16, paddingBottom: 8 } },
    h(Text, { style: { color: c.muted, fontSize: 16, lineHeight: 24 } }, 'Pause playback after the number of minutes you choose.'),
    h(TextInput, { value, onChangeText: setValue, keyboardType: 'number-pad', editable: !saving, maxLength: 4, accessibilityLabel: 'Sleep timer minutes', placeholder: 'Minutes (1–1440)', placeholderTextColor: c.muted, onSubmitEditing: save, style: { minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, color: c.ink, backgroundColor: c.card, fontSize: 18 } }),
    error && h(Text, { accessibilityRole: 'alert', style: { color: c.peachInk, fontSize: 15 } }, error),
    h(Pressable, { onPress: save, disabled: saving, accessibilityRole: 'button', accessibilityLabel: 'Set sleep timer', accessibilityState: { disabled: saving }, style: { borderRadius: 28, minHeight: 52, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.mint, opacity: saving ? .5 : 1 } }, h(Text, { style: { color: c.mintInk, fontSize: 16, fontWeight: '700' } }, saving ? 'Saving…' : 'Set sleep timer')));
}
