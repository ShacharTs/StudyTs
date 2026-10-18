import type { Anchor, CompositePart, GeometryDef } from './geometryTypes';
import type { Rect, Point } from '@core/geometry/geometryPrimitives';

/** Parts thinner than this (mm) are widened for clicking, so a drawn line stays easy to grab. */
export const MIN_PART_MM = 3;

/** Thickness (mm) a zero-width part really has on screen (its stroke): used for ports and edge snapping. */
const DRAWN_MM = 0.4;

const MAX_PORTS = 8;
const PROBE_MM = 0.4;
const BISECT_STEPS = 14;

type HitFn = (def: GeometryDef, w: number, h: number, p: Point) => boolean;
type AnchorsFn = (def: GeometryDef, w: number, h: number) => Anchor[];

/** A part's box in the shape's own mm space, widened around its centre to at least `minMm`. */
function partBox(part: CompositePart, w: number, h: number, minMm: number): Rect {
  const cx = (part.box.x + part.box.w / 2) * w;
  const cy = (part.box.y + part.box.h / 2) * h;
  const pw = Math.max(part.box.w * w, minMm);
  const ph = Math.max(part.box.h * h, minMm);
  return { x: cx - pw / 2, y: cy - ph / 2, w: pw, h: ph };
}

/** Union hit-test: a point is inside when any part contains it. */
export function compositeHit(parts: CompositePart[], w: number, h: number, p: Point, hit: HitFn, minMm = MIN_PART_MM): boolean {
  return parts.some((part) => {
    const b = partBox(part, w, h, minMm);
    return hit(part.geometry, b.w, b.h, { x: p.x - b.x, y: p.y - b.y });
  });
}

/** Anchors worth keeping on a part: a thin line only offers its two ends, not its sides or corners. */
function usable(part: CompositePart, w: number, h: number, a: Anchor): boolean {
  const thinW = part.box.w * w < MIN_PART_MM;
  const thinH = part.box.h * h < MIN_PART_MM;
  if (thinW && thinH) return true;
  if (thinW) return Math.abs(a.normal.x) < 0.5;
  if (thinH) return Math.abs(a.normal.y) < 0.5;
  return true;
}

/** At most 8 ports, one per direction sector around the shape centre (the outermost candidate in each sector). */
function pickByDirection(candidates: Anchor[], w: number, h: number): Anchor[] {
  const cx = w / 2;
  const cy = h / 2;
  const best = new Map<number, { a: Anchor; d: number }>();
  for (const a of candidates) {
    const angle = Math.atan2(a.y - cy, a.x - cx) + Math.PI;
    const sector = Math.min(MAX_PORTS - 1, Math.floor((angle / (2 * Math.PI)) * MAX_PORTS));
    const d = Math.hypot(a.x - cx, a.y - cy);
    if (!best.has(sector) || d > best.get(sector)!.d) best.set(sector, { a, d });
  }
  return [...best.entries()].sort((x, y) => x[0] - y[0]).map(([, v]) => v.a);
}

/**
 * Anchors of the parts that sit on the union's outer outline, taken from the parts as drawn (not their widened
 * click boxes), so a port is never off the visible line. At most 8, spread by direction.
 */
export function compositeAnchors(parts: CompositePart[], w: number, h: number, anchorsOf: AnchorsFn, hit: HitFn): Anchor[] {
  const probe = PROBE_MM + DRAWN_MM / 2;
  const candidates = parts.flatMap((part, i) => {
    const b = partBox(part, w, h, DRAWN_MM);
    return anchorsOf(part.geometry, b.w, b.h)
      .filter((a) => usable(part, w, h, a))
      .map((a) => ({ ...a, id: `p${i}-${a.id}`, x: a.x + b.x, y: a.y + b.y }));
  });
  const onOutline = candidates.filter(
    (a) => !compositeHit(parts, w, h, { x: a.x + a.normal.x * probe, y: a.y + a.normal.y * probe }, hit, DRAWN_MM)
  );
  return pickByDirection(onOutline, w, h);
}

/**
 * The outline point where the ray from the shape's centre toward `from` leaves the union as drawn: march outward
 * to the last point still inside any part, then bisect the final step. Null when the ray never touches a part.
 */
export function compositeIntersect(parts: CompositePart[], w: number, h: number, from: Point, hit: HitFn): Point | null {
  const c = { x: w / 2, y: h / 2 };
  const len = Math.hypot(from.x - c.x, from.y - c.y);
  if (len < 1e-9) return null;
  const dir = { x: (from.x - c.x) / len, y: (from.y - c.y) / len };
  const at = (s: number): Point => ({ x: c.x + dir.x * s, y: c.y + dir.y * s });
  const inside = (s: number) => compositeHit(parts, w, h, at(s), hit, DRAWN_MM);
  const reach = Math.hypot(w, h);
  const step = Math.max(0.1, reach / 600);

  let lastInside = -1;
  for (let s = 0; s <= reach; s += step) if (inside(s)) lastInside = s;
  if (lastInside < 0) return null;

  let lo = lastInside;
  let hi = lastInside + step;
  for (let i = 0; i < BISECT_STEPS; i++) {
    const mid = (lo + hi) / 2;
    if (inside(mid)) lo = mid;
    else hi = mid;
  }
  return at(lo);
}
