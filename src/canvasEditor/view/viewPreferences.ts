import { useEffect, useLayoutEffect } from 'react';
import { create } from 'zustand';
import { useCanvasStore } from '@canvasStore';

export const GRID_PREFERENCE_KEY = 'canvasEditor.showGrid';
export const GUIDES_PREFERENCE_KEY = 'canvasEditor.showGuides';

/** Storage can be blocked (private mode, disabled site data); the toggle then only lasts for this session. */
export function readViewFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === 'true';
  } catch {
    return fallback;
  }
}

export function writeViewFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Blocked storage must not break the toggle itself; the in-memory value still changes.
  }
}

interface GuidesVisibilityState {
  showGuides: boolean;
  toggleGuides(): void;
}

export const useGuidesVisibility = create<GuidesVisibilityState>((set, get) => ({
  showGuides: readViewFlag(GUIDES_PREFERENCE_KEY, true),
  toggleGuides: () => {
    const next = !get().showGuides;
    writeViewFlag(GUIDES_PREFERENCE_KEY, next);
    set({ showGuides: next });
  },
}));

/**
 * Restores the saved grid flag before the first paint, then saves every later change.
 * The canvas store owns the grid state; this only mirrors it to storage.
 */
export function useGridPreferenceSync(): void {
  useLayoutEffect(() => {
    useCanvasStore.setState({ showGrid: readViewFlag(GRID_PREFERENCE_KEY, false) });
  }, []);

  useEffect(
    () =>
      useCanvasStore.subscribe((state, previous) => {
        if (state.showGrid !== previous.showGrid) writeViewFlag(GRID_PREFERENCE_KEY, state.showGrid);
      }),
    []
  );
}
