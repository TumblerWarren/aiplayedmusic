const { test } = require('node:test');
const assert = require('node:assert/strict');
const api = import('../src/music.js');
const indexApi = import('../src/libraryIndex.js');
const songs = [
  { id: 1, title: 'Zebra', artist: 'One', album: 'A', folder: '/Music/A', duration: 30000, added: 10 },
  { id: 2, title: 'Alpha', artist: 'Two', album: 'B', folder: '/Music/B', duration: 90000, added: 30 },
  { id: 3, title: 'Beta', artist: 'One', album: 'A', folder: '/Music/A', duration: 60000, added: 20 }
];
test('playlist order survives missing files and search', async () => {
  const { createLibraryIndex } = await indexApi;
  const select = createLibraryIndex(songs).select;
  const state = { playlists: { Mix: [3, 99, 1, 2] } };
  assert.deepEqual(select(state, { kind: 'playlist', name: 'Mix' }).map(s => s.id), [3, 1, 2]);
  assert.deepEqual(select(state, { kind: 'playlist', name: 'Mix' }, 'ONE').map(s => s.id), [3, 1]);
});
test('favourites match persisted string IDs and collection scope', async () => {
  const { createLibraryIndex } = await indexApi;
  const select = createLibraryIndex(songs).select;
  assert.deepEqual(select({ favorites: ['2'] }, { kind: 'favorites' }).map(s => s.id), [2]);
  assert.deepEqual(select({}, { kind: 'Folders', name: '/Music/A' }).map(s => s.id), [3, 1]);
});
test('sorts do not mutate the scanner result', async () => {
  const { sortSongs } = await api;
  assert.deepEqual(sortSongs(songs, 'Title').map(s => s.id), [2, 3, 1]);
  assert.deepEqual(sortSongs(songs, 'Date added').map(s => s.id), [2, 3, 1]);
  assert.deepEqual(sortSongs(songs, 'Duration').map(s => s.id), [2, 3, 1]);
  assert.deepEqual(songs.map(s => s.id), [1, 2, 3]);
});
test('recently played keeps newest-first order', async () => {
  const { createLibraryIndex } = await indexApi;
  const select = createLibraryIndex(songs).select;
  assert.deepEqual(select({ recent: [2, 3, 1] }, { kind: 'recent' }).map(s => s.id), [2, 3, 1]);
});
test('album grouping counts tracks and filters names', async () => {
  const { groupsFor } = await api;
  assert.deepEqual(groupsFor(songs, 'Albums'), [{ name: 'A', count: 2 }, { name: 'B', count: 1 }]);
  assert.deepEqual(groupsFor(songs, 'Artists', 'two'), [{ name: 'Two', count: 1 }]);
});
test('durations remain valid for long songs and invalid values', async () => {
  const { formatTime } = await api;
  assert.equal(formatTime(3661000), '61:01');
  assert.equal(formatTime(-100), '0:00');
  assert.equal(formatTime(undefined), '0:00');
});
test('folder browsing shows immediate children, not flattened descendants', async () => {
  const { folderChildren, folderRoots } = await api;
  const { createLibraryIndex } = await indexApi;
  const nested = [
    { id: 1, folder: '/storage/emulated/0/Music/Electronic/Ambient', title: 'One' },
    { id: 2, folder: '/storage/emulated/0/Music/Electronic/House', title: 'Two' },
    { id: 3, folder: '/storage/emulated/0/Music/Jazz', title: 'Three' },
    { id: 4, folder: '/storage/emulated/0/Music', title: 'Four' },
    { id: 5, folder: '/storage/emulated/0/Musicals', title: 'Five' }
  ];
  assert.deepEqual(folderChildren(nested, '/storage/emulated/0/Music').map(g => [g.name.split('/').pop(), g.count]), [['Electronic', 2], ['Jazz', 1]]);
  assert.deepEqual(folderChildren(nested, '/storage/emulated/0/Music/Electronic').map(g => g.name.split('/').pop()), ['Ambient', 'House']);
  const select = createLibraryIndex(nested).select;
  assert.deepEqual(select({}, { kind: 'Folders', name: '/storage/emulated/0/Music' }).map(s => s.id), [4]);
  assert.deepEqual(select({}, { kind: 'Folders', name: '/storage/emulated/0/Music', recursive: true }).map(s => s.id), [4, 1, 3, 2]);
  assert.deepEqual(folderRoots(nested), [{ name: '/storage/emulated/0', count: 5 }]);
  assert.deepEqual(folderRoots(nested, ['/storage/emulated/0/Music', '/storage/SD/Music']).map(g => g.count), [4, 0]);
});
