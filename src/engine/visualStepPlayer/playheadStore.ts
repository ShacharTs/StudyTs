import { useSyncExternalStore } from 'react';

export interface PlayheadStore {
  get: () => number;
  set: (ms: number) => void;
  subscribe: (listener: () => void) => () => void;
}

// Frames write here instead of React state, so only the components that show the time re-render per frame.
export function createPlayheadStore(initialMs = 0): PlayheadStore {
  let value = initialMs;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(ms) {
      if (ms === value) return;
      value = ms;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function usePlayheadMs(store: PlayheadStore): number {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
