export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

const EPSILON = 0.001;

export function stepZoom(current: number, direction: 1 | -1): number {
  const first = ZOOM_STEPS[0];
  const last = ZOOM_STEPS[ZOOM_STEPS.length - 1];
  if (direction === 1) return ZOOM_STEPS.find((step) => step > current + EPSILON) ?? last;
  return [...ZOOM_STEPS].reverse().find((step) => step < current - EPSILON) ?? first;
}
