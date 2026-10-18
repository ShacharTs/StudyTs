import { STORAGE_KEYS } from '@core/shared/storageKeys';

export function getCustomRules(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.aiCustomRules) || '[]'); } catch { return []; }
}

export function getStoredItem(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    try {
      const val = localStorage.getItem(key);
      if (val) return val;
    } catch { /* localStorage unavailable (private mode / quota) */ }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      return sessionStorage.getItem(key);
    } catch { /* localStorage unavailable (private mode / quota) */ }
  }
  return null;
}

export function setStoredItem(key: string, value: string): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, value);
    } catch { /* localStorage unavailable (private mode / quota) */ }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(key, value);
    } catch { /* localStorage unavailable (private mode / quota) */ }
  }
}

export function removeStoredItem(key: string): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch { /* localStorage unavailable (private mode / quota) */ }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(key);
    } catch { /* localStorage unavailable (private mode / quota) */ }
  }
}
