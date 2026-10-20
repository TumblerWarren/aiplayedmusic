export function activeDestination(page, tab, selection) {
  if (page === 'sound') return 'Sound';
  if (page === 'settings' || page === 'filters') return 'Settings';
  if (selection?.kind === 'playlist' || (page === 'library' && tab === 'Playlists')) return 'Playlists';
  return 'Library';
}
export function canOpenSound(page) { return page !== 'sound'; }
export function routeKey(page, tab, selection, query = '') { return JSON.stringify([page, tab, selection?.kind, selection?.name, query]); }
export const scrollMemory = new Map();
export function rememberScroll(key, offset) {
  scrollMemory.delete(key);
  scrollMemory.set(key, Math.max(0, offset));
  if (scrollMemory.size > 80) scrollMemory.delete(scrollMemory.keys().next().value);
}
