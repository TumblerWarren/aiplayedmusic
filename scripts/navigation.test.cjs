const { test } = require('node:test');
const assert = require('node:assert/strict');
const letters = import('../src/alphabet.js');
const folders = import('../src/folderBrowser.js');

test('alphabet index handles accented, numeric, blank and non-Latin titles', async () => {
  const { indexLetter, alphabetTargets } = await letters;
  assert.deepEqual(['Éclair', 'Ångström', '  zebra', '42', '', '東京'].map(indexLetter), ['E', 'A', 'Z', '#', '#', '#']);
  const items = [{ title: 'Alpha' }, { title: 'Another' }, { title: 'Éclair' }, { title: 'Zebra' }];
  assert.deepEqual(alphabetTargets(items), { A: 0, E: 2, Z: 3 });
  assert.deepEqual(alphabetTargets([{ artist: 'Björk' }, { artist: 'ZZ Top' }], 'artist'), { B: 0, Z: 1 });
});
test('dragging clamps to the rail and finds populated sections', async () => {
  const { nearestLetter } = await letters;
  assert.equal(nearestLetter(-10, { A: 0, Z: 10 }), 'A');
  assert.equal(nearestLetter(10, { A: 0, Z: 10 }), 'Z');
  assert.equal(nearestLetter(0.5, { A: 0, Z: 10 }), 'A');
  assert.equal(nearestLetter(0.5, {}), null);
});
test('alphabet targets remain correct for a large filtered library', async () => {
  const { alphabetTargets } = await letters;
  const data = Array.from({ length: 4000 }, (_, i) => ({ title: i < 2000 ? `Alpha ${i}` : `Zebra ${i}` }));
  assert.deepEqual(alphabetTargets(data), { A: 0, Z: 2000 });
  assert.deepEqual(alphabetTargets(data.filter(x => x.title.startsWith('Z'))), { Z: 0 });
});
test('folder picker keeps internal storage and SD card trees separate', async () => {
  const { folderChoices } = await folders;
  const catalog = [{ folder: '/storage/emulated/0/Music/Rock', count: 3 }, { folder: '/storage/emulated/0/Music/Jazz', count: 2 }, { folder: '/storage/ABCD-1234/Music', count: 8 }];
  assert.deepEqual(folderChoices(catalog), [{ path: '/storage/ABCD-1234', count: 8 }, { path: '/storage/emulated/0', count: 5 }]);
  assert.deepEqual(folderChoices(catalog, '/storage/emulated/0'), [{ path: '/storage/emulated/0/Music', count: 5 }]);
  assert.deepEqual(folderChoices(catalog, '/storage/emulated/0/Music'), [{ path: '/storage/emulated/0/Music/Jazz', count: 2 }, { path: '/storage/emulated/0/Music/Rock', count: 3 }]);
  assert.deepEqual(folderChoices(catalog, '/storage/emulated/0/Music/Rock'), []);
});
test('picker counts direct and nested audio without mixing sibling prefixes', async () => {
  const { folderChoices } = await folders;
  const catalog = [{ folder: '/storage/emulated/0/Music', count: 1 }, { folder: '/storage/emulated/0/Music/Rock', count: 5 }, { folder: '/storage/emulated/0/Music2', count: 7 }, { folder: 'Other', count: 4 }];
  assert.deepEqual(folderChoices(catalog, '/storage/emulated/0/Music'), [{ path: '/storage/emulated/0/Music/Rock', count: 5 }]);
  assert.deepEqual(folderChoices(catalog), [{ path: '/storage/emulated/0', count: 13 }]);
});
