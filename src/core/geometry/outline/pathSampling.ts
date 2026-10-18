import type { Point } from '@core/geometry/geometryPrimitives';

export type PathSampler = (pathData: string) => Point[] | null;

const SAMPLE_COUNT = 96;

/** Browser sampler: walks an SVG path element. Returns null where SVG geometry APIs are missing (jsdom, SSR). */
function browserSampler(pathData: string): Point[] | null {
  if (typeof document === 'undefined') return null;
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  if (typeof el.getTotalLength !== 'function' || typeof el.getPointAtLength !== 'function') return null;
  el.setAttribute('d', pathData);
  const total = el.getTotalLength();
  if (!(total > 0)) return null;
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const p = el.getPointAtLength((total * i) / SAMPLE_COUNT);
    return { x: p.x, y: p.y };
  });
}

let sampler: PathSampler = browserSampler;

/** Tests inject a deterministic sampler; pass null to restore the browser one. */
export function setPathSampler(fn: PathSampler | null): void {
  sampler = fn ?? browserSampler;
}

/** The path outline as a closed polyline in local space, or null when it cannot be sampled. */
export function samplePath(pathData: string): Point[] | null {
  const pts = sampler(pathData);
  return pts && pts.length >= 3 ? pts : null;
}
