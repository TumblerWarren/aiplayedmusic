import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import Native from './native';
import { createMusicStore } from './stateStore';
import { createSoundPreviewController } from './soundPreview';

export const musicStore = createMusicStore({ current: null, playing: false, loading: false, duration: 0, queue: [], favorites: [], recent: [], playlists: {}, shuffle: false, repeat: 0, speed: 1, theme: 'Light', includeSubfolders: true, sort: 'Title', pauseDisconnect: true, sleepRemaining: 0 });
export const soundPreview = createSoundPreviewController({
  preview: patch => Native.previewSound(JSON.stringify(patch)),
  cancel: () => Native?.cancelSoundPreview(),
  commit: async (action, patch) => musicStore.accept(await Native.command(action, JSON.stringify(patch))),
});
export function useMusicSlice(key) {
  const subscribe = useCallback(listener => musicStore.subscribe(key, listener), [key]);
  const snapshot = useCallback(() => musicStore.get(key), [key]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
export function useStableCallback(callback) {
  const latest = useRef(callback);
  latest.current = callback;
  return useCallback((...args) => latest.current(...args), []);
}

export function useStatusPolling({ ready, active, page, soundTab, timerActive }) {
  const interval = page === 'player' ? 250 : page === 'sound' && soundTab !== 'Playback' ? 500 : page === 'sound' && timerActive ? 1000 : 0;
  useEffect(() => {
    if (!Native || !ready || !active || !interval) return;
    let cancelled = false, timer;
    const poll = async () => {
      try {
        const value = JSON.parse(await Native.playbackStatus(page === 'sound' && soundTab !== 'Playback'));
        if (!cancelled) musicStore.telemetry(value);
      } catch { /* State events and the next foreground refresh recover disconnects. */ }
      if (!cancelled) timer = setTimeout(poll, interval);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ready, active, interval, page, soundTab]);
}
