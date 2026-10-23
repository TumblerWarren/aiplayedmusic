const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, nodes, palette } = require('./ui-harness.cjs');
const flush = () => new Promise(resolve => setImmediate(resolve));

test('local recommendation state stays separate and refresh never starts playback', async () => {
  const { createRecommendationStore, analysisMessage } = await import('../src/recommendations.js');
  let listener, plays = 0, refreshes = 0;
  let status = { enabled: false, state: 'disabled', analysed: 0, eligible: 12, failed: 0 };
  const mix = { id: 'fixed-snapshot', title: 'Your mix 1', subtitle: 'Real artist', tracks: [{ id: 1 }] };
  const api = {
    addListener(name, callback) { assert.equal(name, 'onRecommendationProgress'); listener = callback; return { remove() {} }; },
    recommendationStatus: async () => JSON.stringify(status),
    recommendationEnable: async enabled => JSON.stringify(status = { ...status, enabled }),
    recommendationMixes: async refresh => { if (refresh) refreshes++; return JSON.stringify([mix]); },
    recommendationPlay: async id => { assert.equal(id, mix.id); plays++; },
    recommendationSave: async (id, name) => { assert.equal(id, mix.id); assert.equal(name, 'Saved mix'); },
    recommendationDeleteAnalysis: async () => JSON.stringify({ enabled: false, analysed: 0, eligible: 0, failed: 0 }),
  };
  const store = createRecommendationStore(api), stop = store.start(); await flush();
  assert.equal(store.getSnapshot().status.enabled, false);
  await store.enable(true); assert.equal(store.getSnapshot().status.enabled, true);
  listener({ json: JSON.stringify({ enabled: true, state: 'analysing', analysed: 9, eligible: 12, mixesAvailable: false }) });
  assert.equal(store.getSnapshot().mixes.length, 0, 'nine of twelve tracks is not ready');
  listener({ json: JSON.stringify({ enabled: true, state: 'analysing', analysed: 10, eligible: 12, mixesAvailable: true }) }); await flush();
  assert.equal(store.getSnapshot().mixes[0].id, mix.id, 'partial indexing exposes available mixes');
  await store.refresh(); assert.equal(refreshes, 1); assert.equal(plays, 0);
  await store.save(mix.id, 'Saved mix'); assert.equal(plays, 0, 'saving does not replace the queue');
  await store.play(mix.id); assert.equal(plays, 1, 'only explicit Play starts the fixed snapshot');
  await store.deleteAnalysis(); assert.equal(store.getSnapshot().mixes.length, 0); assert.equal(store.getSnapshot().status.enabled, false);
  assert.equal(analysisMessage({ state: 'paused_playback' }), 'Paused while music plays');
  assert.equal(analysisMessage({ state: 'paused_thermal' }), 'Paused while your phone cools down');
  stop();
});

test('a result arriving after disabling recommendations cannot restore mixes', async () => {
  const { createRecommendationStore } = await import('../src/recommendations.js');
  let resolve;
  const api = { addListener: () => ({ remove() {} }), recommendationStatus: async () => JSON.stringify({ enabled: true, mixesAvailable: true }), recommendationMixes: () => new Promise(r => resolve = r), recommendationEnable: async () => JSON.stringify({ enabled: false }) };
  const store = createRecommendationStore(api), stop = store.start(); await flush();
  await store.enable(false); resolve(JSON.stringify([{ id: 'stale' }])); await flush();
  assert.equal(store.getSnapshot().mixes.length, 0); stop();
});

test('For You opt-in, fixed previews, saving and settings fit both themes without changing playback', async () => {
  const { analysisMessage } = await import('../src/recommendations.js');
  const { tones } = await import('../src/design.js');
  for (const dark of [false, true]) {
    const c = palette(dark), calls = [];
    const value = { loaded: true, busy: false, error: '', status: { enabled: false, state: 'disabled' }, mixes: [] };
    const actions = Object.fromEntries(['enable','analyse','pause','refresh','play','save','deleteAnalysis'].map(name => [name, async (...args) => { calls.push([name, ...args]); return true; }]));
    const ui = harness('src/ForYou.js', ['ForYou', 'PersonalMixesSettings', 'AnalysisPanel', 'Action'], { useRecommendations: () => [value, actions], analysisMessage, tones, Platform: { OS: 'android' }, Alert: { alert() {} } });
    let tree = ui.render('ForYou', { c });
    const action = title => nodes(tree).find(n => n.props.title === title);
    await action('Enable personal mixes').props.onPress(); assert.deepEqual(calls.pop(), ['enable', true]);
    value.status = { enabled: true, state: 'analysing', analysed: 10, eligible: 50, mixesAvailable: true, failed: 2 };
    value.mixes = [{ id: 'snapshot', title: 'Your mix 1', subtitle: 'Artist A · Artist B', tracks: Array.from({ length: 30 }, (_, i) => ({ id: i, title: 'Long regional song title '.repeat(3), artist: 'Artist A' })) }];
    tree = ui.render('ForYou', { c });
    action('Preview your mix 1').props.onPress(); tree = ui.render('ForYou', { c });
    assert(nodes(tree).some(n => n.props.testID === 'mix-preview')); assert.equal(calls.length, 0, 'preview does not play');
    await action('Refresh suggestions').props.onPress(); assert.deepEqual(calls.pop(), ['refresh']);
    await action('Play your mix 1').props.onPress(); assert.deepEqual(calls.pop(), ['play', 'snapshot']);
    action('Save as playlist').props.onPress(); tree = ui.render('ForYou', { c });
    assert(nodes(tree).find(n => n.type === 'Modal').props.visible);
    nodes(tree).find(n => n.type === 'TextInput').props.onChangeText('My mix'); tree = ui.render('ForYou', { c });
    await action('Save playlist').props.onPress(); assert.deepEqual(calls.pop(), ['save', 'snapshot', 'My mix']);
    const panel = ui.render('AnalysisPanel', { value, actions, c });
    assert(nodes(panel).some(n => n.children.includes('10 of 50 songs analysed')));
    assert(nodes(panel).some(n => n.props.title === 'Retry failed files'));
    const settings = ui.render('PersonalMixesSettings', { c });
    assert(nodes(settings).some(n => n.props.title === 'Delete audio analysis'));
    const button = ui.render('Action', { title: 'Test', c, disabled: true });
    assert(button.props.disabled && button.props.accessibilityState.disabled && button.props.style.minHeight >= 48);
  }
});
