/** Pure library selectors shared by the Expo screens and offline tests. */
export function formatTime(ms) {
  const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function selectSongs(songs, state, selection, query = '') {
  let result = songs;
  if (selection?.kind === 'favorites') {
    const ids = new Set(state.favorites || []);
    result = songs.filter(song => ids.has(String(song.id)));
  } else if (selection?.kind === 'recent' || selection?.kind === 'playlist') {
    const ids = selection.kind === 'recent' ? state.recent || [] : state.playlists?.[selection.name] || [];
    const byId = new Map(songs.map(song => [song.id, song]));
    result = ids.map(id => byId.get(id)).filter(Boolean);
  } else if (selection?.kind === 'Albums' || selection?.kind === 'Artists' || selection?.kind === 'Folders') {
    const key = { Albums: 'album', Artists: 'artist', Folders: 'folder' }[selection.kind];
    result = songs.filter(song => song[key] === selection.name);
  }
  const term = query.trim().toLocaleLowerCase();
  return result.filter(song => !term || `${song.title} ${song.artist} ${song.album}`.toLocaleLowerCase().includes(term));
}
export function sortSongs(songs, sort) {
  return [...songs].sort((a, b) => sort === 'Date added' ? b.added - a.added : sort === 'Duration' ? b.duration - a.duration : String(sort === 'Artist' ? a.artist : a.title).localeCompare(sort === 'Artist' ? b.artist : b.title));
}
export function groupsFor(songs, kind, query = '') {
  const key = { Albums: 'album', Artists: 'artist', Folders: 'folder' }[kind];
  if (!key) return [];
  const groups = new Map();
  for (const song of songs) groups.set(song[key], (groups.get(song[key]) || 0) + 1);
  const term = query.toLocaleLowerCase();
  return [...groups].filter(([name]) => name.toLocaleLowerCase().includes(term)).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));
}
