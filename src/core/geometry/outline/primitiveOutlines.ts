import type { Anchor } from './geometryTypes';
import type { Point } from '@core/geometry/geometryPrimitives';

/** Cap radius used by both the renderer (cylinderPaths) and the hit math. */
export const capRadius = (capRatio: number, w: number, h: number): number => Math.min(h * capRatio, w * capRatio);

/** Top ellipse OR middle wall OR bottom convex arc. */
export function cylinderHit(capRatio: number, w: number, h: number, p: Point): boolean {
  const ry = capRadius(capRatio, w, h);
  if (p.y < ry) return ellipseHit(w, 2 * ry, p);
  if (p.y > h - ry) return ellipseHit(w, 2 * ry, { x: p.x, y: p.y - (h - 2 * ry) });
  return p.x >= 0 && p.x <= w;
}

export function cylinderAnchors(capRatio: number, w: number, h: number): Anchor[] {
  void capRatio;
  return [
    { id: 'top', x: w / 2, y: 0, normal: { x: 0, y: -1 } },
    { id: 'bottom', x: w / 2, y: h, normal: { x: 0, y: 1 } },
    { id: 'left', x: 0, y: h / 2, normal: { x: -1, y: 0 } },
    { id: 'right', x: w, y: h / 2, normal: { x: 1, y: 0 } },
  ];
}

/** Larger root of the ray (from the box centre) against a cap ellipse centred at (w/2, ey). */
function capCrossing(w: number, h: number, ey: number, ry: number, dir: Point): Point {
  const rx = w / 2;
  const oy = h / 2 - ey;
  const a = (dir.x / rx) ** 2 + (dir.y / ry) ** 2;
  const b = (2 * oy * dir.y) / (ry * ry);
  const c = (oy / ry) ** 2 - 1;
  const t = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
  return { x: w / 2 + dir.x * t, y: h / 2 + dir.y * t };
}

/** Wall hit when the ray exits through a side wall, otherwise the matching cap/bottom arc. */
export function cylinderIntersect(capRatio: number, w: number, h: number, from: Point): Point {
  const ry = capRadius(capRatio, w, h);
  const dir = { x: from.x - w / 2, y: from.y - h / 2 };
  if (Math.hypot(dir.x, dir.y) < EPS) return { x: w / 2, y: 0 };

  const tWall = Math.abs(dir.x) < EPS ? Infinity : w / 2 / Math.abs(dir.x);
  const wallY = h / 2 + dir.y * tWall;
  if (wallY >= ry && wallY <= h - ry) return { x: w / 2 + dir.x * tWall, y: wallY };
  return capCrossing(w, h, dir.y < 0 ? ry : h - ry, ry, dir);
}

/** Trims float noise so cardinal points come out as exact numbers. */
const round = (n: number) => +n.toFixed(9);

/** Anchor ids line up with the rect primitive and the legacy port sides. */
const CARDINALS: Array<[string, number]> = [
  ['top', -90], ['top-right', -45], ['right', 0], ['bottom-right', 45],
  ['bottom', 90], ['bottom-left', 135], ['left', 180], ['top-left', -135],
];

const radii = (w: number, h: number, rxRatio: number, ryRatio: number) => ({
  cx: w / 2,
  cy: h / 2,
  rx: (w / 2) * rxRatio,
  ry: (h / 2) * ryRatio,
});

/** Algebraic inside test: ((x-cx)/rx)^2 + ((y-cy)/ry)^2 <= 1. */
export function ellipseHit(w: number, h: number, p: Point, rxRatio = 1, ryRatio = 1): boolean {
  const { cx, cy, rx, ry } = radii(w, h, rxRatio, ryRatio);
  if (rx <= 0 || ry <= 0) return false;
  return ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 <= 1 + EPS;
}

/** Eight points on the curve (every 45 degrees), each with the outward curve normal. */
export function ellipseAnchors(w: number, h: number, rxRatio = 1, ryRatio = 1): Anchor[] {
  const { cx, cy, rx, ry } = radii(w, h, rxRatio, ryRatio);
  return CARDINALS.map(([id, deg]) => {
    const a = (deg * Math.PI) / 180;
    const x = round(cx + rx * Math.cos(a));
    const y = round(cy + ry * Math.sin(a));
    const nx = (x - cx) / (rx * rx || 1);
    const ny = (y - cy) / (ry * ry || 1);
    const len = Math.hypot(nx, ny) || 1;
    return { id, x, y, normal: { x: nx / len, y: ny / len } };
  });
}

/** Radial projection: the curve point on the ray from the centre toward `from`. */
export function ellipseIntersect(w: number, h: number, from: Point, rxRatio = 1, ryRatio = 1): Point {
  const { cx, cy, rx, ry } = radii(w, h, rxRatio, ryRatio);
  const dx = from.x - cx;
  const dy = from.y - cy;
  const k = Math.hypot(dx / (rx || 1), dy / (ry || 1));
  if (k < EPS) return { x: cx, y: cy - ry };
  return { x: cx + dx / k, y: cy + dy / k };
}

const EPS = 1e-9;

export function rectHit(w: number, h: number, p: Point): boolean {
  return p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;
}

/** Corners and edge midpoints; ids match the ellipse primitive and the legacy port sides. */
export function rectAnchors(w: number, h: number): Anchor[] {
  const at = (id: string, fx: number, fy: number, nx: number, ny: number): Anchor => ({ id, x: w * fx, y: h * fy, normal: { x: nx, y: ny } });
  return [
    at('top', 0.5, 0, 0, -1), at('top-right', 1, 0, 1, -1), at('right', 1, 0.5, 1, 0), at('bottom-right', 1, 1, 1, 1),
    at('bottom', 0.5, 1, 0, 1), at('bottom-left', 0, 1, -1, 1), at('left', 0, 0.5, -1, 0), at('top-left', 0, 0, -1, -1),
  ];
}

/** Where the ray from the box centre toward `from` leaves the rectangle. */
export function rectIntersect(w: number, h: number, from: Point): Point {
  const cx = w / 2;
  const cy = h / 2;
  const dx = from.x - cx;
  const dy = from.y - cy;
  if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) return { x: cx, y: 0 };
  const t = Math.min(cx / (Math.abs(dx) || 1e-6), cy / (Math.abs(dy) || 1e-6));
  return { x: cx + dx * t, y: cy + dy * t };
}
