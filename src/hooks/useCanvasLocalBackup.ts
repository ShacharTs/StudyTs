import { useEffect } from 'react';
import { log } from '@core/logger';
import { STORAGE_KEYS } from '@core/shared/storageKeys';

export const AUTO_SAVE_KEY_PREFIX = STORAGE_KEYS.autoSavePrefix;

/** True when a stored autosave is unparsable, has no `savedAt`, or is older than `maxAgeMs`. */
function isStaleAutoSave(item: string, now: number, maxAgeMs: number): boolean {
  try {
    const { savedAt } = JSON.parse(item);
    return !savedAt || now - savedAt > maxAgeMs;
  } catch {
    return true;
  }
}

export function pruneOldAutoSaves(maxAgeDays = 7): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(AUTO_SAVE_KEY_PREFIX)) continue;
      const item = localStorage.getItem(key);
      if (item && isStaleAutoSave(item, now, maxAgeMs)) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    log.warn('pruneOldAutoSaves failed', { error: String(e) });
  }
}

export function clearAutoSave(sceneId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(`${AUTO_SAVE_KEY_PREFIX}${sceneId}`);
  } catch (e) {
    log.warn('clearAutoSave failed', { sceneId, error: String(e) });
  }
}

export function useCanvasAutoSave(sceneId?: string, sceneState?: unknown): void {
  useEffect(() => {
    if (typeof localStorage === 'undefined' || !sceneId || !sceneState) return;
    const key = `${AUTO_SAVE_KEY_PREFIX}${sceneId}`;
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), sceneState }));
      } catch (e) {
        log.warn('autosave failed', { sceneId, error: String(e) });
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, [sceneId, sceneState]);
}
