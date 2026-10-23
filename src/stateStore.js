// Keep high-frequency telemetry separate from durable app state.
export function sharePrevious(previous, next) {
  if (Object.is(previous, next)) return previous;
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object' || Array.isArray(previous) !== Array.isArray(next)) return next;
  const keys = Object.keys(next);
  let unchanged = keys.length === Object.keys(previous).length;
  const result = Array.isArray(next) ? [] : {};
  for (const key of keys) {
    result[key] = sharePrevious(previous[key], next[key]);
    if (result[key] !== previous[key]) unchanged = false;
  }
  return unchanged ? previous : result;
}

export function createMusicStore(initial = {}) {
  const values = { main: initial, progress: { position: 0, duration: 0, sleepRemaining: 0 }, meters: {} };
  const listeners = Object.fromEntries(Object.keys(values).map(key => [key, new Set()]));
  let lastMainSequence = -1, lastTelemetrySequence = -1;
  const fresh = (value, sequence) => !Number.isFinite(value.sequence) || value.sequence >= sequence;
  const set = (key, next) => {
    const shared = sharePrevious(values[key], next);
    if (shared === values[key]) return;
    values[key] = shared;
    listeners[key].forEach(listener => listener());
  };
  const telemetry = (value, changedTrack = false) => {
    if (!changedTrack && !fresh(value, lastTelemetrySequence)) return;
    if (Number.isFinite(value.sequence)) lastTelemetrySequence = value.sequence;
    const progress = { position: value.position || 0, duration: value.duration || 0, sleepRemaining: value.sleepRemaining || 0, currentId: value.currentId ?? value.current?.id ?? null };
    set('progress', progress);
    if (value.soundStatus) set('meters', value.soundStatus);
  };
  return {
    get: key => values[key],
    subscribe: (key, listener) => { listeners[key].add(listener); return () => listeners[key].delete(listener); },
    telemetry(value) {
      if (value.currentId !== undefined && value.currentId !== values.main.current?.id && values.main.current) return;
      telemetry(value);
    },
    accept(raw) {
      const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!fresh(value, lastMainSequence)) return value;
      if (Number.isFinite(value.sequence)) lastMainSequence = value.sequence;
      // Progress can arrive before its command response; order each slice independently.
      telemetry(value, (value.current?.id ?? null) !== (values.progress.currentId ?? null));
      const { position, soundStatus, sequence, ...main } = value;
      // Timer activity belongs to the screen; its ticking label belongs to telemetry.
      main.sleepRemaining = value.sleepRemaining > 0 ? 1 : 0;
      set('main', main);
      return value;
    },
  };
}
