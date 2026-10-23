/** Pure library selectors shared by the Expo screens and offline tests. */
export function formatTime(ms) {
  const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function folderRoots(songs, chosen = []) {
  if (chosen.length) return chosen.map(name => ({ name, count: songs.filter(s => s.folder === name || s.folder.startsWith(`${name}/`)).length }));
  const roots = new Map();
  for (const song of songs) {
    const parts = song.folder.split('/').filter(Boolean);
    const root = parts[0] === 'storage' ? `/${parts.slice(0, parts[1] === 'emulated' ? 3 : 2).join('/')}` : song.folder.startsWith('/') ? '/' : song.folder;
    roots.set(root, (roots.get(root) || 0) + 1);
  }
  return [...roots].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));
}

/** Immediate children only; descendants remain inside their real parent directory. */
export function folderChildren(songs, path, query = '') {
  const children = new Map(), prefix = path.endsWith('/') ? path : `${path}/`;
  for (const song of songs) {
    if (!song.folder.startsWith(prefix)) continue;
    const part = song.folder.slice(prefix.length).split('/')[0];
    if (!part) continue;
    const child = `${prefix}${part}`;
    children.set(child, (children.get(child) || 0) + 1);
  }
  return [...children].filter(([name]) => name.slice(prefix.length).toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));
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
