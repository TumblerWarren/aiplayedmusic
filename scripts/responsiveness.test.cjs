const { test } = require('node:test');
const assert = require('node:assert/strict');
const flush = () => new Promise(resolve => setImmediate(resolve));
const song = (id, title, folder = '/storage/emulated/0/Music') => ({ id, title, artist: id % 2 ? 'Infra' : 'Artist', album: 'Album', folder, duration: id * 1000, added: id });

test('playback ticks notify only progress/meters and retain queue, settings and song identities', async () => {
  const { createMusicStore } = await import('../src/stateStore.js');
  const store = createMusicStore();
  const queue = Array.from({ length: 930 }, (_, i) => song(i, `Song ${i}`));
  const snapshot = { sequence: 1, current: queue[0], queue, playing: true, position: 1000, duration: 100000, sleepRemaining: 50000, sound: { bands: Array(10).fill(0) }, soundStatus: { peakDb: -10 } };
  store.accept(JSON.stringify(snapshot));
  const main = store.get('main'); let mainChanges = 0, progressChanges = 0, meterChanges = 0;
  store.subscribe('main', () => mainChanges++);
  store.subscribe('progress', () => progressChanges++);
  store.subscribe('meters', () => meterChanges++);
  for (let i = 2; i < 102; i++) store.telemetry({ sequence: i, currentId: 0, position: i * 1000, duration: 100000, sleepRemaining: 50000 - i, soundStatus: { peakDb: -i } });
  assert.equal(mainChanges, 0); assert.equal(progressChanges, 100); assert.equal(meterChanges, 100);
  assert.strictEqual(store.get('main'), main);
  store.accept(JSON.stringify({ ...snapshot, sequence: 102, position: 103000, playing: false }));
  assert.equal(mainChanges, 1);
  assert.strictEqual(store.get('main').queue, main.queue);
  assert.strictEqual(store.get('main').current, main.current);
  assert.strictEqual(store.get('main').sound, main.sound);
  store.accept(JSON.stringify({ ...snapshot, sequence: 103, position: 104000, playing: false, sleepRemaining: 49000 }));
  assert.equal(mainChanges, 1, 'countdown changes must not rebuild screens');
  store.accept({ ...snapshot, sequence: 104, playing: false, sleepRemaining: 0 });
  assert.equal(mainChanges, 2, 'timer expiration changes screen activity');
});

test('late status and mismatched tracks cannot roll back a newer native state', async () => {
  const { createMusicStore } = await import('../src/stateStore.js');
  const store = createMusicStore();
  store.accept({ sequence: 10, current: song(2, 'New'), playing: true, position: 3000 });
  store.telemetry({ sequence: 9, currentId: 2, position: 1000 });
  store.accept({ sequence: 8, current: song(1, 'Old'), position: 0 });
  assert.equal(store.get('progress').position, 3000);
  store.telemetry({ sequence: 12, currentId: 3, position: 20 });
  assert.equal(store.get('progress').position, 3000);
  store.accept({ sequence: 11, current: song(3, 'Next'), position: 10 });
  assert.equal(store.get('main').current.id, 3, 'skipped mismatched telemetry must not swallow the track-change event');
  store.telemetry({ sequence: 13, currentId: 3, position: 50 });
  assert.equal(store.get('progress').position, 50);
});

function clock() {
  let time = 0, id = 0; const tasks = new Map();
  return { now: () => time, schedule(fn, ms) { tasks.set(++id, { fn, at: time + ms }); return id; }, unschedule(key) { tasks.delete(key); },
    async advance(ms) { time += ms; for (const [key, task] of [...tasks]) if (task.at <= time) { tasks.delete(key); task.fn(); } await flush(); } };
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

test('live previews coalesce to 20 Hz, allow one native request, then commit the exact release once', async () => {
  const { createSoundPreviewController } = await import('../src/soundPreview.js');
  const time = clock(), previews = [], commits = []; let inFlight = 0, maxInFlight = 0, gate;
  const controller = createSoundPreviewController({ ...time, cancel: async () => {}, preview: async value => { inFlight++; maxInFlight = Math.max(inFlight, maxInFlight); previews.push([time.now(), value]); if (gate) await gate.promise; inFlight--; }, commit: async (...value) => commits.push(value) });
  const session = controller.start(); session.preview({ volume: 105 }); await flush();
  assert.deepEqual(previews, [[0, { volume: 105 }]]);
  for (let volume = 110; volume <= 200; volume += 5) session.preview({ volume });
  await time.advance(49); assert.equal(previews.length, 1);
  gate = deferred(); await time.advance(1);
  assert.deepEqual(previews[1], [50, { volume: 200 }]);
  session.preview({ volume: 250 }); await time.advance(100);
  assert.equal(previews.length, 2, 'a slow bridge cannot accumulate concurrent previews');
  const commit = session.commit('sound', { volume: 245 });
  assert.equal(commits.length, 0);
  gate.resolve(); await commit;
  await session.commit('sound', { volume: 300 }); await time.advance(100);
  assert.equal(maxInFlight, 1); assert.equal(previews.length, 2);
  assert.deepEqual(commits, [['sound', { volume: 245 }]]);
});

test('navigation, preset/reset commands and failed previews cannot leave temporary audio active', async () => {
  const { createSoundPreviewController } = await import('../src/soundPreview.js');
  const events = []; const gate = deferred(); let failure = false;
  const controller = createSoundPreviewController({ cancel: async () => events.push('cancel'), preview: async patch => { events.push(patch); if (failure) throw new Error('bridge'); await gate.promise; }, commit: async () => events.push('commit') });
  const session = controller.start(); session.preview({ bass: 1 }); await flush();
  const cancelled = controller.cancel(); session.preview({ bass: 9 }); gate.resolve(); await cancelled;
  assert.equal(events.at(-1), 'cancel'); assert.equal(events.filter(x => typeof x === 'object').length, 1);
  const stale = controller.start(); stale.preview({ bass: 6 });
  await controller.perform(async () => events.push('preset'));
  await stale.commit('sound', { bass: 6 });
  assert.equal(events.at(-1), 'preset'); assert(!events.includes('commit'));
  failure = true; let error;
  controller.start(e => { error = e; }).preview({ bass: 2 }); await flush();
  assert.equal(error.message, 'bridge'); assert.equal(events.at(-1), 'cancel');
  failure = false; await controller.start().commit('sound', { bass: 0 });
  assert.equal(events.at(-1), 'commit', 'a failed bridge request must not poison subsequent controls');
});

test('rapid adjacent EQ releases merge against the previous completed commit', async () => {
  const { createSoundPreviewController } = await import('../src/soundPreview.js');
  let saved = [0, 0], previews = []; const gate = deferred(); let commits = 0;
  const controller = createSoundPreviewController({ cancel: async () => {}, preview: async patch => previews.push(patch), commit: async (action, patch) => { if (!commits++) await gate.promise; saved = patch.bands; } });
  const first = controller.start(); const a = first.commit('sound', () => ({ bands: [5, saved[1]] })); await flush();
  const second = controller.start(); second.preview(() => ({ bands: [saved[0], 3] }));
  gate.resolve(); await a; await flush();
  await second.commit('sound', () => ({ bands: [saved[0], 4] }));
  assert.deepEqual(previews, [{ bands: [5, 3] }]); assert.deepEqual(saved, [5, 4]);
});

test('a rejected old commit cannot cancel the next gesture', async () => {
  const { createSoundPreviewController } = await import('../src/soundPreview.js');
  const gate = deferred(); const events = [];
  const controller = createSoundPreviewController({ cancel: async () => events.push('cancel'), preview: async patch => events.push(patch), commit: async () => gate.promise });
  const first = controller.start(); const rejected = first.commit('sound', { bass: 1 }).catch(() => {}); await flush();
  const second = controller.start(); second.preview({ bass: 2 });
  gate.reject(new Error('failed commit')); await rejected; await flush();
  assert.deepEqual(events.at(-1), { bass: 2 }); assert(second.active());
});

test('cached selectors preserve playlist/recent ordering, sorting, search and folder boundaries at 10k tracks', async () => {
  const { createLibraryIndex } = await import('../src/libraryIndex.js');
  const { selectSongs, sortSongs, groupsFor, folderChildren } = await import('../src/music.js');
  const songs = Array.from({ length: 10000 }, (_, id) => song(id, `${id % 2 ? 'Alpha' : 'Zebra'} ${id}`, `/storage/emulated/0/Music${id % 3 ? '/Rock' : '2'}`));
  const index = createLibraryIndex(songs);
  const state = { favorites: ['1', '2'], recent: [2, 99999, 1], playlists: { Mix: [8, 99999, 3, 1] } };
  for (const sort of ['Title', 'Artist', 'Duration', 'Date added']) for (const selection of [null, { kind: 'favorites' }, { kind: 'recent' }, { kind: 'playlist', name: 'Mix' }, { kind: 'Folders', name: '/storage/emulated/0/Music', recursive: true }]) for (const query of ['', 'infra', 'alpha']) {
    const expected = selectSongs(songs, state, selection, query);
    assert.deepEqual(index.select({ ...state, sort }, selection, query), ['recent', 'playlist'].includes(selection?.kind) ? expected : sortSongs(expected, sort));
  }
  assert.deepEqual(index.groups('Artists', 'infra'), groupsFor(songs, 'Artists', 'infra'));
  assert.deepEqual(index.folders('/storage/emulated/0/Music'), folderChildren(songs, '/storage/emulated/0/Music'));
});
