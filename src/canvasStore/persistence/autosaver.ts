export const AUTOSAVE_DELAY_MS = 1000;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface Autosaver<T> {
  /** Remember the latest payload and (re)start the debounce timer. */
  schedule(payload: T): void;
  /** Save the pending payload now (if any) and wait for any in-flight save to settle. */
  flush(): Promise<void>;
  /** Drop the pending payload without saving. */
  cancel(): void;
}

interface Options<T> {
  delayMs?: number;
  save: (payload: T) => Promise<void>;
  onStatus?: (status: SaveStatus, error?: unknown) => void;
}

/**
 * Debounced, single-flight saver. Only the newest payload is ever written; an edit that arrives
 * while a save is running is written by exactly one follow-up save, never concurrently.
 */
export function createAutosaver<T>({ delayMs = AUTOSAVE_DELAY_MS, save, onStatus }: Options<T>): Autosaver<T> {
  let pending: { value: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  async function drain(): Promise<void> {
    while (pending) {
      const { value } = pending;
      pending = null;
      onStatus?.('saving');
      try {
        await save(value);
        onStatus?.(pending ? 'saving' : 'saved');
      } catch (err) {
        onStatus?.('error', err);
        // Keep the failed version for the next flush; stop here so a dead server is not retried in a tight loop.
        if (!pending) {
          pending = { value };
          return;
        }
      }
    }
  }

  function run(): Promise<void> {
    if (!running) {
      running = drain().finally(() => {
        running = null;
      });
    }
    return running;
  }

  return {
    schedule(payload) {
      pending = { value: payload };
      clearTimer();
      onStatus?.('idle');
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, delayMs);
    },
    async flush() {
      clearTimer();
      await run();
    },
    cancel() {
      clearTimer();
      pending = null;
    },
  };
}
