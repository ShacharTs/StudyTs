import type { VisualSpec } from '../../types/visualSpec';

export const MIN_SPEC_SPEED = 0.25;
export const MAX_SPEC_SPEED = 8;

export function speedProblems(spec: VisualSpec): string[] {
  if (spec.speed === undefined) return [];
  const speed = spec.speed;
  const valid = typeof speed === 'number' && Number.isFinite(speed) && speed >= MIN_SPEC_SPEED && speed <= MAX_SPEC_SPEED;
  return valid ? [] : [`speed must be a number from ${MIN_SPEC_SPEED} to ${MAX_SPEC_SPEED} (got ${String(speed)})`];
}
