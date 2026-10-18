import { useSyncExternalStore } from 'react';

export type GridMode = 'none' | 'lines' | 'dots';

// A view setting shared by the top bar and the stage, so both follow one value without threading props through.
let current: GridMode = 'lines';
const listeners = new Set<() => void>();

export function setGridMode(mode: GridMode): void {
  current = mode;
  listeners.forEach((notify) => notify());
}

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};

export const useGridMode = (): GridMode => useSyncExternalStore(subscribe, () => current);
