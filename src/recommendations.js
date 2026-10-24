// Separate from playback state: no audio embeddings cross this API.
export function analysisMessage(status = {}) {
  const messages = {
    disabled: 'Personal mixes are off', empty: 'No eligible music found', analysing: 'Analysing your music',
    ready: 'Audio analysis is up to date', waiting: 'Waiting to analyse', starting: 'Starting analysis',
    waiting_battery: 'Waiting for enough battery',
    waiting_foreground: 'Open the app to continue manual analysis', paused_user: 'Analysis paused',
    paused_thermal: 'Paused while your phone cools down',
    error: status.error || 'Audio analysis needs attention',
  };
  return messages[status.state] || 'Checking audio analysis';
}
export function createRecommendationStore(api) {
  let value = { status: { enabled: true, state: 'starting', analysed: 0, eligible: 0, failed: 0 }, mixes: [], busy: false, error: '', loaded: false };
  const listeners = new Set();
  let subscription, users = 0, generation = 0, loadingMixes = false;
  const update = patch => { value = { ...value, ...patch }; for (const listener of listeners) listener(); };
  const parse = raw => typeof raw === 'string' ? JSON.parse(raw) : raw;
  const loadMixes = async refresh => {
    if (loadingMixes) return;
    loadingMixes = true;
    const token = generation;
    try { const mixes = parse(await api.recommendationMixes(refresh)); if (token === generation) update({ mixes }); }
    finally {
      loadingMixes = false;
      if (token !== generation && value.status.enabled && value.status.mixesAvailable) loadMixes(false).catch(error => update({ error: error.message }));
    }
  };
  const accept = raw => {
    const status = parse(raw);
    if (status.historyVersion !== value.status.historyVersion) { generation++; update({ mixes: [] }); }
    if (!status.enabled) { generation++; update({ status, mixes: [], loaded: true }); }
    else { if (!status.mixesAvailable) { generation++; update({ mixes: [] }); } update({ status, loaded: true }); if (status.mixesAvailable && !value.mixes.length && !loadingMixes) loadMixes(false).catch(error => update({ error: error.message })); }
  };
  const perform = async action => {
    if (value.busy) return false;
    update({ busy: true, error: '' });
    try { await action(); return true; }
    catch (error) { update({ error: error?.message || 'Please try again.' }); return false; }
    finally { update({ busy: false }); }
  };
  return {
    getSnapshot: () => value,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    start() {
      if (users++ === 0 && api) {
        subscription = api.addListener('onRecommendationProgress', event => accept(event.json));
        api.recommendationStatus().then(raw => { accept(raw); if (value.status.mixesAvailable) return loadMixes(false); }).catch(error => update({ error: error.message, loaded: true }));
      }
      return () => { if (--users === 0) { subscription?.remove(); subscription = null; } };
    },
    enable: enabled => perform(async () => { accept(await api.recommendationEnable(enabled)); }),
    analyse: (retryFailed = false) => perform(async () => accept(await api.recommendationAnalyse(retryFailed))),
    pause: () => perform(async () => accept(await api.recommendationPause())),
    refresh: () => perform(() => loadMixes(true)),
    play: id => perform(() => api.recommendationPlay(id)),
    save: (id, name) => perform(() => api.recommendationSave(id, name)),
    deleteAnalysis: () => perform(async () => { generation++; accept(await api.recommendationDeleteAnalysis()); update({ mixes: [] }); }),
  };
}
