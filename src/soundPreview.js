// A single serialized lane prevents late previews/cancellations from undoing commits.
export function createSoundPreviewController({ preview, cancel, commit, now = Date.now, schedule = setTimeout, unschedule = clearTimeout, interval = 50 }) {
  let tail = Promise.resolve(), active = null;
  const enqueue = action => {
    const result = tail.then(action);
    tail = result.catch(() => {});
    return result;
  };
  const resolve = patch => typeof patch === 'function' ? patch() : patch;
  const controller = {
    start(onError = () => {}) {
      active?.discard();
      let closed = false, pending = null, timer = null, busy = false, last = -Infinity;
      const stop = () => { closed = true; pending = null; unschedule(timer); timer = null; if (active === session) active = null; };
      const fail = error => {
        if (closed) return;
        stop();
        enqueue(() => active ? undefined : cancel()).catch(() => {});
        onError(error);
      };
      const pump = () => {
        timer = null;
        if (closed || busy || !pending) return;
        const patch = pending; pending = null; busy = true;
        enqueue(async () => { if (!closed) { last = now(); await preview(resolve(patch)); } })
          .catch(fail).finally(() => { busy = false; if (!closed && pending) arm(); });
      };
      const arm = () => {
        if (closed || busy || timer !== null) return;
        const wait = Math.max(0, interval - (now() - last));
        if (wait === 0) pump(); else timer = schedule(pump, wait);
      };
      const session = {
        active: () => !closed,
        discard: stop,
        preview(patch) { if (!closed) { pending = patch; arm(); } },
        commit(action, patch) {
          if (closed) return Promise.resolve(null);
          stop();
          return enqueue(() => commit(action, resolve(patch))).catch(error => { enqueue(() => active ? undefined : cancel()).catch(() => {}); throw error; });
        },
        cancel() { if (closed) return tail; stop(); return enqueue(cancel); },
      };
      active = session;
      enqueue(cancel).catch(fail);
      return session;
    },
    cancel() { return active ? active.cancel() : tail; },
    perform(action) {
      active?.discard();
      // This also restores native preview state after an interrupted gesture.
      return enqueue(async () => { await cancel(); return action(); });
    },
  };
  return controller;
}
