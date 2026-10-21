import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Artwork from './Artwork';
import Icon from './Icons';
import { PlayingBars } from './PlaybackMotion';
import { formatTime } from './music';
const h = React.createElement;

function SongRow({ song, index, queue, current, playing, c, styles: s, onPlay, onOptions }) {
  return h(Pressable, { style: s.songRow, android_ripple: { color: '#7353BB18' }, onPress: () => onPlay(song, index, queue), onLongPress: () => onOptions(song, index, queue), accessibilityRole: 'button', accessibilityLabel: `${song.title}, ${song.artist}` },
    h(View, null, h(Artwork, { song }), current && playing && h(View, { style: { position: 'absolute', bottom: 2, right: 2, backgroundColor: c.card, borderRadius: 8, padding: 2 } }, h(PlayingBars, { playing: true, color: c.accent, size: 20 }))),
    h(View, { style: s.songLabels }, h(Text, { style: [s.text, s.songTitle, current && { color: c.accent }], numberOfLines: 1 }, song.title), h(Text, { style: [s.text, s.subtitle], numberOfLines: 1 }, `${song.artist} · ${formatTime(song.duration)}`)),
    h(Pressable, { onPress: () => onOptions(song, index, queue), hitSlop: 6, style: s.iconButton, accessibilityRole: 'button', accessibilityLabel: `Options for ${song.title}`, android_ripple: { color: '#7353BB18', borderless: false } }, h(Icon, { name: 'more-vertical', size: 23, color: c.muted })));
}
export default memo(SongRow);
