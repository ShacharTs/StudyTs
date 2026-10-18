export const TIMELINE_MIN_ZOOM = 40;
export const TIMELINE_MAX_ZOOM = 800;
export const DEFAULT_ZOOM = 160;
// Track numbers are gone, so the gutter only keeps the first tick and the play row on the same left line.
export const GUTTER_PX = 12;
export const MAGNET_PX = 8;
const FIT_MARGIN_PX = 16;

export const clampTimelineZoom = (pxPerSec: number): number => Math.min(TIMELINE_MAX_ZOOM, Math.max(TIMELINE_MIN_ZOOM, pxPerSec));

export const pxOf = (ms: number, pxPerSec: number): number => (ms / 1000) * pxPerSec;

// The page may be CSS-zoomed by --ui-scale; pointer distances must be divided by the same factor as the layout.
export function pixelScale(element: HTMLElement): number {
  return element.offsetWidth > 0 ? element.getBoundingClientRect().width / element.offsetWidth : 1;
}

const TICK_CANDIDATES_MS = [50, 100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000];
const MIN_TICK_PX = 70;
const MIN_FIT_MS = 5000;

// The smallest tick that still leaves a readable gap between two labels at this zoom.
export const tickMsFor = (pxPerSec: number): number =>
  TICK_CANDIDATES_MS.find((candidate) => (candidate / 1000) * pxPerSec >= MIN_TICK_PX) ?? TICK_CANDIDATES_MS[TICK_CANDIDATES_MS.length - 1];

// The ruler ends at the step (plus its padding), rounded up to a whole tick; a longer view never adds ticks past the step.
export function rulerLengthMs(stepMs: number, tickMs: number): number {
  return Math.max(tickMs, Math.ceil(stepMs / tickMs) * tickMs);
}

// The first view shows at least five seconds, so the clips of a short step still get room to move.
export const initialZoom = (viewWidth: number, stepMs: number): number => fitZoom(viewWidth, Math.max(stepMs, MIN_FIT_MS));

export const fitZoom = (viewWidth: number, contentMs: number): number => clampTimelineZoom(((viewWidth - GUTTER_PX - FIT_MARGIN_PX) / contentMs) * 1000);
