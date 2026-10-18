// src/ai/chat/sendWithRetry.ts
/** Re-sends one model request after a transient failure, waiting longer each time, until it works or the user stops it. */
import { AiProviderError } from '@core/shared/aiTypes';

/** Waits before retry 1, 2 and 3; every later retry waits the last value. */
export const RETRY_DELAYS_MS = [3_000, 5_000, 10_000, 60_000];

export const retryDelayMs = (retryNumber: number): number =>
  RETRY_DELAYS_MS[Math.min(retryNumber, RETRY_DELAYS_MS.length) - 1];

/** Bad credentials or a malformed request fail the same way every time, so retrying only hides the real error. */
export function isRetryable(err: unknown): boolean {
  if (err instanceof AiProviderError) return err.category !== 'auth' && err.category !== 'bad-request';
  // A dropped connection, an interrupted stream or a timeout; the caller has already ruled out a user stop.
  return err instanceof DOMException || err instanceof TypeError;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}

interface RetryOptions {
  /** The user's Stop button: ends the waiting and the retrying. */
  signal: AbortSignal;
  /** Tells the UI which retry is next and how long it waits. */
  onRetryScheduled: (retryNumber: number, delayMs: number) => void;
  /** Tells the UI the request is going out again. */
  onAttemptStart: () => void;
}

export async function sendWithRetry<T>(attempt: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { signal, onRetryScheduled, onAttemptStart } = options;
  for (let retryNumber = 1; ; retryNumber++) {
    try {
      return await attempt();
    } catch (err) {
      if (signal.aborted || !isRetryable(err)) throw err;
      const delay = retryDelayMs(retryNumber);
      onRetryScheduled(retryNumber, delay);
      await wait(delay, signal);
      if (signal.aborted) throw err;
      onAttemptStart();
    }
  }
}
