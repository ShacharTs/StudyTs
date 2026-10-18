import type { Rect } from '@core/geometry/geometryPrimitives';

// Tight on purpose: a guide should only appear where the edges already coincide, not while the box is still drifting.
export const GUIDE_TOLERANCE_MM = 0.5;

type Axis = 'x' | 'y';

export interface GapSpan {
  from: number;
  to: number;
  mm: number;
}

/** A guide on `axis`: x is a vertical line at `position`, y a horizontal one. */
export interface AlignmentGuide {
  axis: Axis;
  position: number;
  gap: GapSpan | null;
}

interface Lane {
  start: number;
  size: number;
}

function lanesOf(box: Rect, axis: Axis): { line: Lane; perp: Lane } {
  const xLane = { start: box.x, size: box.w };
  const yLane = { start: box.y, size: box.h };
  return axis === 'x' ? { line: xLane, perp: yLane } : { line: yLane, perp: xLane };
}

function anchorsOf(lane: Lane): number[] {
  return [lane.start, lane.start + lane.size / 2, lane.start + lane.size];
}

/** Space between two boxes along the perpendicular axis; null when they overlap there. */
function gapBetween(moving: Lane, other: Lane): GapSpan | null {
  const movingEnd = moving.start + moving.size;
  const otherEnd = other.start + other.size;
  if (movingEnd <= other.start) return spanOf(movingEnd, other.start);
  if (otherEnd <= moving.start) return spanOf(otherEnd, moving.start);
  return null;
}

function spanOf(from: number, to: number): GapSpan {
  return { from, to, mm: Math.round((to - from) * 10) / 10 };
}

function guidesOnAxis(axis: Axis, moving: Rect, other: Rect): AlignmentGuide[] {
  const movingLanes = lanesOf(moving, axis);
  const otherLanes = lanesOf(other, axis);
  const gap = gapBetween(movingLanes.perp, otherLanes.perp);
  const positions = new Set<number>();
  for (const movingAnchor of anchorsOf(movingLanes.line)) {
    for (const otherAnchor of anchorsOf(otherLanes.line)) {
      if (Math.abs(movingAnchor - otherAnchor) <= GUIDE_TOLERANCE_MM) positions.add(otherAnchor);
    }
  }
  return [...positions].map((position) => ({ axis, position, gap }));
}

/** Guides for the moving box's edges and centre against each other box; judged on the final position, not the pre-snap one. */
export function computeAlignmentGuides(moving: Rect, others: Rect[]): AlignmentGuide[] {
  return others.flatMap((other) => [...guidesOnAxis('x', moving, other), ...guidesOnAxis('y', moving, other)]);
}
