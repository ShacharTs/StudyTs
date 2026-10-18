import type { AiMessage } from '@core/shared/aiTypes';
import { log } from '../../core/logger';
import { STORAGE_KEYS } from '@core/shared/storageKeys';

/** A chat turn that was still running: what to send the model to carry on if the page reloads. */
export interface PendingTurn {
  prompt: string;
  /** The user message as it enters the saved history (prompt plus any attached file). */
  userText: string;
  messages: AiMessage[];
  savedAt: number;
}

const STORAGE_KEY = STORAGE_KEYS.aiPendingTurn;
// A turn older than this was abandoned, not interrupted; resuming it would surprise the user.
const MAX_AGE_MS = 30 * 60 * 1000;

export function savePendingTurn(turn: Omit<PendingTurn, 'savedAt'>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...turn, savedAt: Date.now() }));
  } catch (err) {
    // Quota or blocked storage: the turn still runs, it just cannot survive a reload.
    log.warn('Could not save the in-flight AI turn', { error: String(err) });
  }
}

export function loadPendingTurn(): PendingTurn | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const turn = JSON.parse(raw) as PendingTurn;
    return Date.now() - turn.savedAt <= MAX_AGE_MS && Array.isArray(turn.messages) ? turn : null;
  } catch (err) {
    log.warn('Could not read the in-flight AI turn', { error: String(err) });
    return null;
  }
}

export function clearPendingTurn(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    log.warn('Could not clear the in-flight AI turn', { error: String(err) });
  }
}
