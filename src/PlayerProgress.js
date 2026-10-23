import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useMusicSlice } from './useMusic';
import { formatTime } from './music';
const h = React.createElement;

export function SleepRemaining({ style, prefix = '' }) {
  const { sleepRemaining } = useMusicSlice('progress');
  return h(Text, { style, maxFontSizeMultiplier: 1.3 }, sleepRemaining ? `${prefix}${formatTime(sleepRemaining)}` : 'Off');
}
export default function PlayerProgress({ c, styles: s, landscape, command }) {
  const progress = useMusicSlice('progress');
  const [draft, setDraft] = useState(null);
  const thumb = useRef(progress.position);
  if (draft === null) thumb.current = progress.position;
  const time = value => h(Text, { style: [s.text, s.subtitle], maxFontSizeMultiplier: 1.3 }, formatTime(value));
  return h(View, null,
    h(View, { style: landscape && { flexDirection: 'row', alignItems: 'center' } },
      landscape && time(draft ?? progress.position),
      h(Slider, { style: [s.slider, landscape && { flex: 1, width: undefined }], minimumValue: 0, maximumValue: Math.max(1, progress.duration), value: thumb.current, onSlidingStart: setDraft, onValueChange: setDraft, onSlidingComplete: async position => { setDraft(position); await command('seek', { position: Math.round(position) }); setDraft(null); }, minimumTrackTintColor: c.accent, maximumTrackTintColor: c.dark ? c.track : c.line, thumbTintColor: c.accent, accessibilityLabel: 'Playback position' }),
      landscape && time(progress.duration)),
    !landscape && h(View, { style: s.times }, time(draft ?? progress.position), time(progress.duration)));
}
