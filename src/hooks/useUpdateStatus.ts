import { useState, useEffect, useCallback } from 'react';
import { useDesktopUpdateStatus } from './useDesktopUpdateStatus';

export interface UpdateStatusInfo {
  version: string;
  tag: string;
  pageUrl: string;
  notes: string;
}

export interface UpdateStatusResponse {
  status: 'up-to-date' | 'available' | 'offline' | 'rate-limited' | 'no-releases' | 'error';
  currentVersion: string;
  latest?: UpdateStatusInfo;
  mode: string;
  checkedAt?: number;
  throttled?: boolean;
  pendingVersion?: string;
  skippedVersion?: string;
  // Desktop installer only: download progress, and whether this install type needs a manual download.
  downloadPercent?: number;
  manualOnly?: boolean;
  // Desktop installer only: why the last check or download failed.
  errorMessage?: string;
  lastResult?: {
    ok: boolean;
    from: string;
    to: string;
    strategy: string;
    error?: string;
    restartRequired: boolean;
  };
}

const UPDATE_POLL_MS = 6 * 60 * 60 * 1000; // 6 hours

function useServerUpdateStatus() {
  const [state, setState] = useState<UpdateStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const res = await fetch('/api/update/status', { signal });
      if (res.ok) {
        const data = (await res.json()) as UpdateStatusResponse;
        setState(data);
      }
    } catch {
      // swallow network errors to avoid breaking UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchStatus(controller.signal);

    const interval = setInterval(() => {
      void fetchStatus();
    }, UPDATE_POLL_MS);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchStatus]);

  const check = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/update/check', { method: 'POST' });
      if (res.ok) setState((await res.json()) as UpdateStatusResponse);
    } catch {
      // keep the previous state when the server is unreachable
    } finally {
      setLoading(false);
    }
  }, []);

  const schedule = useCallback(
    async (version: string) => {
      try {
        const res = await fetch('/api/update/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version }),
        });
        if (res.ok) {
          setState((prev) => (prev ? { ...prev, pendingVersion: version } : null));
        }
      } catch {
        // ignore
      }
    },
    [],
  );

  // Schedules the release, then restarts; the launcher applies it before relaunching.
  // Resolves false if the restart request was refused, so the caller can re-enable its button.
  const updateAndRestart = useCallback(
    async (version: string) => {
      await schedule(version);
      try {
        const res = await fetch('/api/update/restart', { method: 'POST' });
        if (!res.ok) return false;
      } catch {
        return false;
      }
      // Wait before polling: the old server exits ~300ms after replying, and an
      // early poll would hit it and reload into a dead page.
      for (let i = 0; i < 300; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const health = await fetch('/api/health');
          if (health.ok) {
            window.location.reload();
            return true;
          }
        } catch {
          // still restarting
        }
      }
      return false;
    },
    [schedule],
  );

  const skip = useCallback(
    async (version: string) => {
      try {
        const res = await fetch('/api/update/skip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version }),
        });
        if (res.ok) {
          setState((prev) => (prev ? { ...prev, skippedVersion: version } : null));
        }
      } catch {
        // ignore
      }
    },
    [],
  );

  const dismissResult = useCallback(async () => {
    try {
      await fetch('/api/update/clear-result', { method: 'POST' });
      setState((prev) => (prev ? { ...prev, lastResult: undefined } : null));
    } catch {
      // ignore
    }
  }, []);

  return {
    state,
    loading,
    refresh: fetchStatus,
    check,
    schedule,
    updateAndRestart,
    skip,
    dismissResult,
  };
}

// preload.cjs defines window.studytsDesktop before any page script runs, so this choice never changes
// during a session and the hook order stays stable.
const useUpdateStatusImpl = typeof window !== 'undefined' && window.studytsDesktop?.update ? useDesktopUpdateStatus : useServerUpdateStatus;

export function useUpdateStatus() {
  return useUpdateStatusImpl();
}
