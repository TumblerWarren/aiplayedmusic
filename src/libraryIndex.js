import { folderChildren, folderRoots, groupsFor, sortSongs } from './music.js';

export function createLibraryIndex(songs) {
  const byId = new Map(songs.map(song => [song.id, song]));
  const ids = new Set(byId.keys());
  const text = new Map(songs.map(song => [song.id, `${song.title} ${song.artist} ${song.album}`.toLocaleLowerCase()]));
  const ordered = new Map(), grouped = new Map(), folders = new Map();
  const sorted = sort => {
    if (!ordered.has(sort)) ordered.set(sort, sortSongs(songs, sort));
    return ordered.get(sort);
  };
  return {
    ids,
    select(state, selection, query = '') {
      const term = query.trim().toLocaleLowerCase();
      const match = song => !term || text.get(song.id).includes(term);
      if (selection?.kind === 'recent' || selection?.kind === 'playlist') {
        const selectedIds = selection.kind === 'recent' ? state.recent || [] : state.playlists?.[selection.name] || [];
        return selectedIds.map(id => byId.get(id)).filter(song => song && match(song));
      }
      const favorites = selection?.kind === 'favorites' ? new Set(state.favorites || []) : null;
      const key = { Albums: 'album', Artists: 'artist', Folders: 'folder' }[selection?.kind];
      return sorted(state.sort).filter(song => (!favorites || favorites.has(String(song.id))) && (!key || song[key] === selection.name || (selection.kind === 'Folders' && selection.recursive && song.folder.startsWith(`${selection.name}/`))) && match(song));
    },
    groups(kind, query = '') {
      if (!grouped.has(kind)) grouped.set(kind, groupsFor(songs, kind));
      const term = query.toLocaleLowerCase();
      return grouped.get(kind).filter(item => item.name.toLocaleLowerCase().includes(term));
    },
    folders(path, query = '') {
      if (!folders.has(path)) folders.set(path, folderChildren(songs, path));
      const term = query.toLocaleLowerCase();
      return folders.get(path).filter(item => item.name.slice(path.length + 1).toLocaleLowerCase().includes(term));
    },
    roots: chosen => folderRoots(songs, chosen),
  };
}
