import type { VisualStepSpec, VisualTweenSpec } from './visualSpec';

export const STEP_BREATH_MS = 200;

// Anime.js plays a tween for one second when it gets no duration.
const DEFAULT_TWEEN_MS = 1000;

const numberOr = (value: number | string | undefined, fallback: number): number => (typeof value === 'number' ? value : fallback);

const endOf = (tween: VisualTweenSpec): number => (tween.at ?? 0) + numberOr(tween.params.delay, 0) + numberOr(tween.params.duration, DEFAULT_TWEEN_MS);

// How long autoplay stays on a step: its animation plus a breath, so the next step follows without idling. A step with no animation returns null so the caller keeps its own reading time.
export function stepHoldMs(step: VisualStepSpec, factor = 1): number | null {
  if (step.tweens.length === 0) return null;
  return Math.max(...step.tweens.map(endOf)) / factor + STEP_BREATH_MS;
}
