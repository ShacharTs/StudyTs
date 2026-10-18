import type { Anchor } from './geometryTypes';
import type { Point } from '@core/geometry/geometryPrimitives';

const EPS = 1e-9;

const scaled = (vertices: Point[], w: number, h: number): Point[] => vertices.map((p) => ({ x: p.x * w, y: p.y * h }));

const centroid = (pts: Point[]): Point => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

function onSegment(a: Point, b: Point, p: Point): boolean {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  if (Math.abs(cross) > EPS * Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))) return false;
  return (
    p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS &&
    p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS
  );
}

/** Point-in-polygon by ray casting (Jordan curve); boundary points count as inside. */
export function polygonHit(vertices: Point[], w: number, h: number, p: Point): boolean {
  const pts = scaled(vertices, w, h);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    if (onSegment(pts[j], pts[i], p)) return true;
    const crosses = pts[i].y > p.y !== pts[j].y > p.y;
    if (crosses && p.x < ((pts[j].x - pts[i].x) * (p.y - pts[i].y)) / (pts[j].y - pts[i].y) + pts[i].x) inside = !inside;
  }
  return inside;
}

function unit(from: Point, to: Point): Point {
  const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
}

const MAX_PORTS = 8;
const SMALL_POLYGON = 4;

const signedArea = (pts: Point[]): number =>
  pts.reduce((sum, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return sum + (p.x * q.y - q.x * p.y);
  }, 0) / 2;

/** Indices of the convex vertices (the tips); reflex vertices such as a star's valleys or a callout's tail base are skipped. */
function convexIndices(pts: Point[]): number[] {
  const orientation = Math.sign(signedArea(pts)) || 1;
  return pts.map((_, i) => i).filter((i) => {
    const prev = pts[(i + pts.length - 1) % pts.length];
    const cur = pts[i];
    const next = pts[(i + 1) % pts.length];
    const cross = (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x);
    return Math.sign(cross) === orientation;
  });
}

/** At most `max` indices, spread evenly over the list. */
function spreadEvenly(indices: number[], max: number): number[] {
  if (indices.length <= max) return indices;
  return Array.from({ length: max }, (_, k) => indices[Math.floor((k * indices.length) / max)]);
}

/**
 * Connection ports chosen by role: the convex tips (ids v0...), plus edge midpoints (m0...) only on small convex
 * shapes (4 sides or fewer). Never more than 8, and never a reflex vertex, so a star has 5 ports, not 20.
 */
export function polygonAnchors(vertices: Point[], w: number, h: number): Anchor[] {
  const pts = scaled(vertices, w, h);
  const c = centroid(pts);
  const tips = convexIndices(pts);
  const convex = tips.length === pts.length;
  const verts = spreadEvenly(tips, MAX_PORTS).map((i) => ({ id: `v${i}`, x: pts[i].x, y: pts[i].y, normal: unit(c, pts[i]) }));
  if (!convex || pts.length > SMALL_POLYGON) return verts;
  const mids = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    return { id: `m${i}`, x: m.x, y: m.y, normal: unit(c, m) };
  });
  return [...verts, ...mids];
}

/** Distance factor t >= 0 where the ray c + t*dir crosses segment a-b, or null when it misses or runs parallel. */
function raySegmentT(c: Point, dir: Point, a: Point, b: Point): number | null {
  const e = { x: b.x - a.x, y: b.y - a.y };
  const denom = dir.x * e.y - dir.y * e.x;
  if (Math.abs(denom) < EPS) return null;
  const t = ((a.x - c.x) * e.y - (a.y - c.y) * e.x) / denom;
  const s = ((a.x - c.x) * dir.y - (a.y - c.y) * dir.x) / denom;
  return t >= 0 && s >= -EPS && s <= 1 + EPS ? t : null;
}

/** Boundary point where the ray from the shape's centre toward `from` leaves the outline (outermost crossing). */
export function polygonIntersect(vertices: Point[], w: number, h: number, from: Point): Point {
  const fallback = { x: w / 2, y: 0 };
  if (w <= 0 || h <= 0) return fallback;
  const pts = scaled(vertices, w, h);
  const c = { x: w / 2, y: h / 2 };
  const dir = { x: from.x - c.x, y: from.y - c.y };
  if (Math.hypot(dir.x, dir.y) < EPS) return fallback;

  const hits = pts
    .map((a, i) => raySegmentT(c, dir, a, pts[(i + 1) % pts.length]))
    .filter((t): t is number => t !== null);
  if (hits.length === 0) return fallback;
  const t = Math.max(...hits);
  return { x: c.x + dir.x * t, y: c.y + dir.y * t };
}

/** Normalized vertices of an n-pointed star, one tip straight up; inner points sit at `innerRatio` of the outer radius. */
export function starVertices(points: number, innerRatio: number): Point[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? 0.5 : 0.5 * innerRatio;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    return { x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) };
  });
}

/** Normalized vertices of a regular n-gon inscribed in the box, one corner straight up. */
export function ngonVertices(sides: number): Point[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    return { x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a) };
  });
}

/** Stretches a vertex list so its hull spans exactly 0..1 on both axes, so the resize frame hugs the shape. */
export function fitToBox(vertices: Point[]): Point[] {
  const xs = vertices.map((p) => p.x);
  const ys = vertices.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  return vertices.map((p) => ({ x: (p.x - minX) / spanX, y: (p.y - minY) / spanY }));
}
