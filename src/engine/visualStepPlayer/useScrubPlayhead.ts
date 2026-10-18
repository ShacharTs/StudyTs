import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';

const STEP_MS = 50;
const BIG_STEP_MS = 250;

export const msFromPointer = (clientX: number, rect: Pick<DOMRect, 'left' | 'width'>, stepMs: number): number => {
  const fraction = (clientX - rect.left) / (rect.width || 1);
  return Math.round(Math.min(1, Math.max(0, fraction)) * stepMs);
};

export function nextPlayheadMs(key: string, shift: boolean, playheadMs: number, stepMs: number): number | null {
  const delta = shift ? BIG_STEP_MS : STEP_MS;
  const targets: Record<string, number> = { ArrowLeft: playheadMs - delta, ArrowRight: playheadMs + delta, Home: 0, End: stepMs };
  return key in targets ? Math.min(stepMs, Math.max(0, targets[key])) : null;
}

// Pointer moves seek at most once per frame; the release always lands on the last pointer position. Keys stay synchronous.
export function useScrubPlayhead(stepMs: number, playheadMs: number, onScrub: (ms: number) => void) {
  // The argument says whether a pending seek still has to land: true on release, false on unmount.
  const stopDrag = useRef<((land: boolean) => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(false), []);

  const onMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      onScrub(msFromPointer(event.clientX, rect, stepMs));
      let frame = 0;
      let pending: number | null = null;
      const seekPending = () => {
        frame = 0;
        if (pending !== null) onScrub(pending);
        pending = null;
      };
      const move = (moved: MouseEvent) => {
        pending = msFromPointer(moved.clientX, rect, stepMs);
        if (!frame) frame = requestAnimationFrame(seekPending);
      };
      const end = (land: boolean) => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', release);
        cancelAnimationFrame(frame);
        frame = 0;
        if (land) seekPending();
        stopDrag.current = null;
      };
      const release = () => end(true);
      stopDrag.current?.(true);
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', release);
      stopDrag.current = end;
    },
    [onScrub, stepMs],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const next = nextPlayheadMs(event.key, event.shiftKey, playheadMs, stepMs);
      if (next === null) return;
      event.preventDefault();
      onScrub(next);
    },
    [onScrub, playheadMs, stepMs],
  );

  return { onMouseDown, onKeyDown };
}
