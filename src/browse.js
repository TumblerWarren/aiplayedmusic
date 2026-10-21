import { indexLetter } from './alphabet.js';
export const destinations = [
  ['Songs', 'music'], ['Albums', 'disc'], ['Artists', 'user'], ['Folders', 'folder'],
  ['Playlists', 'list'], ['Favourites', 'heart'], ['Recently played', 'clock'],
];
export function browseDestination(tab, selection) {
  return ({ favorites: 'Favourites', recent: 'Recently played', playlist: 'Playlists' })[selection?.kind] || selection?.kind || tab;
}
export function browseRoute(title) {
  const kind = { Favourites: 'favorites', 'Recently played': 'recent' }[title];
  return { page: kind ? 'collection' : 'library', tab: kind ? 'Songs' : title, selection: kind ? { kind, name: title } : null, query: '' };
}
// Group by the same normalized initial used by the rail, including # first.
export function compareNames(a, b) {
  return indexLetter(a).localeCompare(indexLetter(b)) || String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base', numeric: true });
}
export function displayFolder(path) {
  return path === '/storage/emulated/0' ? 'Internal storage' : path.split('/').filter(Boolean).pop() || path;
}
