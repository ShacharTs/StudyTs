import type { Point } from './geometryPrimitives';

export type PathSegment = [number, number, number, number];

const CURVE_STEPS = 16;
const COMMAND = /([MLQCZ])([^MLQCZ]*)/g;

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const reduceLevel = (level: Point[], t: number): Point[] => level.slice(1).map((next, index) => lerp(level[index], next, t));

// De Casteljau: the point at t of a quadratic (3 points) or cubic (4 points) Bezier.
function bezierPoint(points: Point[], t: number): Point {
  let level = points;
  while (level.length > 1) level = reduceLevel(level, t);
  return level[0];
}

function pairs(text: string, dx: number, dy: number): Point[] {
  const values = (text.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  return Array.from({ length: Math.floor(values.length / 2) }, (_, i) => ({ x: values[i * 2] + dx, y: values[i * 2 + 1] + dy }));
}

function appended(command: string, points: Point[], from: Point): Point[] {
  if (command !== 'Q' && command !== 'C') return points;
  return Array.from({ length: CURVE_STEPS }, (_, i) => bezierPoint([from, ...points], (i + 1) / CURVE_STEPS));
}

// Absolute M, L, Q, C and Z commands; a new M starts a new line, which keeps arrow heads from joining the shaft.
export function flattenPath(d: string, dx = 0, dy = 0): Point[][] {
  const lines: Point[][] = [];
  for (const [, command, rest] of d.matchAll(COMMAND)) {
    const points = pairs(rest, dx, dy);
    const line = lines[lines.length - 1];
    if (command === 'M') lines.push(points.slice(0, 1));
    else if (line && command === 'Z') line.push(line[0]);
    else if (line) line.push(...appended(command, points, line[line.length - 1]));
  }
  return lines.filter((line) => line.length > 1);
}

export function pathSegments(d: string, dx = 0, dy = 0): PathSegment[] {
  return flattenPath(d, dx, dy).flatMap((line) => line.slice(1).map((point, i): PathSegment => [line[i].x, line[i].y, point.x, point.y]));
}

export function distanceToSegment(point: Point, [x1, y1, x2, y2]: PathSegment): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lengthSquared = vx * vx + vy * vy;
  const along = lengthSquared === 0 ? 0 : ((point.x - x1) * vx + (point.y - y1) * vy) / lengthSquared;
  const t = Math.max(0, Math.min(1, along));
  return Math.hypot(point.x - (x1 + t * vx), point.y - (y1 + t * vy));
}

export function pointAtFraction(points: Point[], fraction: number): Point {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  const lengths = points.slice(1).map((point, i) => Math.hypot(point.x - points[i].x, point.y - points[i].y));
  const target = Math.max(0, Math.min(1, fraction)) * lengths.reduce((sum, length) => sum + length, 0);
  let travelled = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    if (travelled + lengths[i] >= target && lengths[i] > 0) return lerp(points[i], points[i + 1], (target - travelled) / lengths[i]);
    travelled += lengths[i];
  }
  return points[points.length - 1];
}

export const pointsAlong = (points: Point[], count: number): Point[] =>
  Array.from({ length: count + 1 }, (_, i) => pointAtFraction(points, i / count));
