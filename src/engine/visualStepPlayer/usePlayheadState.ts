import { useCallback, useEffect, useState } from 'react';
import { createPlayheadStore, type PlayheadStore } from './playheadStore';

interface PlayheadState {
  // Read with usePlayheadMs; reading it during render would re-render the owner on every frame.
  store: PlayheadStore;
  scrubMs: number | null;
  scrub: (ms: number) => void;
  follow: (ms: number) => void;
  // Hands the playhead back to playback after a manual scrub; without it a stale scrub position pins the timeline.
  release: () => void;
}

export function usePlayheadState(stepIndex: number): PlayheadState {
  const [store] = useState(() => createPlayheadStore());
  const [scrubbed, setScrubbed] = useState(false);
  useEffect(() => {
    store.set(0);
    setScrubbed(false);
  }, [stepIndex, store]);
  const scrub = useCallback(
    (ms: number) => {
      store.set(ms);
      setScrubbed(true);
    },
    [store],
  );
  // Frames only move the store; setting the same flag again is a no-op, so playback never re-renders the owner.
  const follow = useCallback(
    (ms: number) => {
      store.set(ms);
      setScrubbed(false);
    },
    [store],
  );
  const release = useCallback(() => setScrubbed(false), []);
  return { store, scrubMs: scrubbed ? store.get() : null, scrub, follow, release };
}
