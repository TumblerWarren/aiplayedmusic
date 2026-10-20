import React, { memo, useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { FallbackArt } from './Pastel';
const h = React.createElement;

function Artwork({ song, size = 52, round = false }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setFailed(false); setLoaded(false); }, [song?.albumId]);
  const seed = Math.abs(Number(song?.albumId || 0));
  return h(View, { style: { width: size, height: size, borderRadius: round ? size / 2 : size > 100 ? 16 : 10, backgroundColor: '#EDE5FC', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, accessible: false },
    (!loaded || failed) && h(View, { style: { position: 'absolute', width: size, height: size }, pointerEvents: 'none' }, h(FallbackArt, { size, seed })),
    song && !failed && h(Image, { resizeMethod: 'resize', source: { uri: `content://media/external/audio/albumart/${song.albumId}` }, style: { position: 'absolute', width: size, height: size, opacity: loaded ? 1 : 0 }, onLoad: () => setLoaded(true), onError: () => { setFailed(true); setLoaded(false); } }));
}
export default memo(Artwork, (a, b) => a.song?.albumId === b.song?.albumId && a.size === b.size && a.round === b.round);
