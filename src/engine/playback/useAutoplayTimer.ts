import { useEffect, useRef } from 'react';

interface Clock {
  timer: number | undefined;
  remainingMs: number;
  armedAt: number;
  armedRate: number;
}

function arm(clock: Clock, timelineMs: number, rate: number, fire: () => void): void {
  window.clearTimeout(clock.timer);
  clock.remainingMs = timelineMs;
  clock.armedAt = Date.now();
  clock.armedRate = rate;
  clock.timer = window.setTimeout(fire, timelineMs / rate);
}

// Holds the step for `holdMs` of timeline time. A rate change mid-step keeps the unplayed rest,
// so the step still ends where its animation ends instead of restarting the full hold.
export function useAutoplayTimer(active: boolean, stepKey: number, holdMs: number, rate: number, onElapsed: () => void): void {
  const clock = useRef<Clock>({ timer: undefined, remainingMs: holdMs, armedAt: 0, armedRate: rate });
  const latestRate = useRef(rate);
  latestRate.current = rate;
  const latestElapsed = useRef(onElapsed);
  latestElapsed.current = onElapsed;

  useEffect(() => {
    if (!active) return undefined;
    const current = clock.current;
    arm(current, holdMs, latestRate.current, () => latestElapsed.current());
    return () => window.clearTimeout(current.timer);
  }, [active, stepKey, holdMs]);

  useEffect(() => {
    const current = clock.current;
    if (!active || rate === current.armedRate) return;
    const playedMs = (Date.now() - current.armedAt) * current.armedRate;
    arm(current, Math.max(0, current.remainingMs - playedMs), rate, () => latestElapsed.current());
  }, [active, rate]);
}
