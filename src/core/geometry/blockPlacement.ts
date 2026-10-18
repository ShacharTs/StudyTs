import type { Point } from './geometryPrimitives';

/**
 * Resolves non-overlapping coordinates and open slots on the canvas.
 */


/** Positions that put the target flush against each side (left, right, top, bottom) of `c`, where they fit the bounds. */
function sideSpots(c: BlockRect, x: number, y: number, width: number, height: number, bounds: BlockSize): Point[] {
  const spots: Point[] = [];
  if (c.x - width >= 0) spots.push({ x: c.x - width, y });
  if (c.x + c.width + width <= bounds.width) spots.push({ x: c.x + c.width, y });
  if (c.y - height >= 0) spots.push({ x, y: c.y - height });
  if (c.y + c.height + height <= bounds.height) spots.push({ x, y: c.y + c.height });
  return spots;
}

/** Free spots next to the colliding rects, nearest to the target's own position first. */
function nearestFreeSpot(target: BlockRect, at: Point, bounds: BlockSize, others: BlockRect[], colliding: BlockRect[]): Point | null {
  const { width, height } = target;
  const candidates: { x: number; y: number; dist: number }[] = [];
  for (const c of colliding) {
    for (const spot of sideSpots(c, at.x, at.y, width, height, bounds)) {
      const p = clampPosition({ ...spot, width, height }, bounds);
      if (others.some((o) => o !== c && isOverlapping({ ...target, ...p }, o, 1))) continue;
      candidates.push({ ...p, dist: Math.hypot(p.x - target.x, p.y - target.y) });
    }
  }
  candidates.sort((p, q) => p.dist - q.dist);
  return candidates.length > 0 ? { x: candidates[0].x, y: candidates[0].y } : null;
}

export function resolveNonOverlappingPosition(
  target: BlockRect,
  bounds: BlockSize,
  others: BlockRect[] = [],
  origPos?: Point
): Point {
  const clamped = clampPosition(target, bounds);
  const at = { x: clamped.x, y: clamped.y };
  if (others.length === 0) return at;

  const { width, height } = target;
  const snapped = snapBlockToGrid({ ...at, width, height }, others);
  const clampedSnap = clampPosition({ ...target, x: snapped.x, y: snapped.y }, bounds);
  if (!others.some((other) => isOverlapping({ ...target, ...clampedSnap }, other, 1))) return clampedSnap;

  const colliding = others.filter((other) => isOverlapping({ ...target, ...at }, other, 1));
  if (colliding.length === 0) return at;

  const free = nearestFreeSpot(target, at, bounds, others, colliding);
  if (free) return free;
  return origPos ? clampPosition({ ...target, ...origPos }, bounds) : at;
}

export function findOpenSlot(
  newSize: { width: number; height: number },
  bounds: BlockSize,
  existingBlocks: BlockRect[]
): { x: number; y: number } {
  if (existingBlocks.length === 0) {
    return { x: 0, y: 0 };
  }

  const xCandidates = [0, 562, 20];
  const maxY = existingBlocks.reduce((max, b) => Math.max(max, b.y + b.height), 0);

  for (const y of [0, 196, 492, maxY + 24]) {
    for (const x of xCandidates) {
      const candidate = { x, y, width: newSize.width, height: newSize.height };
      if (x + newSize.width <= bounds.width && !existingBlocks.some((b) => isOverlapping(candidate, b, 1))) {
        return { x, y };
      }
    }
  }

  return clampPosition({ x: 0, y: maxY + 24, width: newSize.width, height: newSize.height }, bounds);
}

// src/core/geometry/clampBlockGeometry.ts
/**
 * Pure clamping, snapping, and collision math shared across canvas editing & server scene operations.
 * Ensures blocks stay within canvas bounds, do not overlap other blocks,
 * and snap cleanly pixel-close to neighbor edges.
 */

export interface BlockSize {
  width: number;
  height: number;
}

export interface BlockRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_BLOCK_WIDTH = 80;
export const MIN_BLOCK_HEIGHT = 60;
export const SNAP_DISTANCE = 10;

export function clampPosition(rect: BlockRect, bounds: BlockSize): { x: number; y: number } {
  const maxX = Math.max(0, bounds.width - rect.width);
  const maxY = Math.max(0, bounds.height - rect.height);
  return {
    x: Math.min(Math.max(rect.x, 0), maxX),
    y: Math.min(Math.max(rect.y, 0), maxY),
  };
}

export function clampSize(
  rect: BlockRect,
  bounds: BlockSize,
  minWidth: number = MIN_BLOCK_WIDTH,
  minHeight: number = MIN_BLOCK_HEIGHT
): { width: number; height: number } {
  const maxWidth = bounds.width - rect.x;
  const maxHeight = bounds.height - rect.y;
  return {
    width: Math.min(Math.max(rect.width, minWidth), maxWidth),
    height: Math.min(Math.max(rect.height, minHeight), maxHeight),
  };
}

export function isOverlapping(a: BlockRect, b: BlockRect, tolerance = 1): boolean {
  return (
    a.x < b.x + b.width - tolerance &&
    a.x + a.width > b.x + tolerance &&
    a.y < b.y + b.height - tolerance &&
    a.y + a.height > b.y + tolerance
  );
}

/**
 * Snaps a moving rect to adjacent edges or alignments of neighbor blocks if within snapDistance.
 */
export function snapBlockToGrid(rect: BlockRect, others: BlockRect[], snapDist: number = SNAP_DISTANCE): { x: number; y: number } {
  let { x, y } = rect;
  const { width, height } = rect;

  for (const other of others) {
    // Snap X: left to other's right
    if (Math.abs(x - (other.x + other.width)) <= snapDist) {
      x = other.x + other.width;
    }
    // Snap X: right to other's left
    else if (Math.abs(x + width - other.x) <= snapDist) {
      x = other.x - width;
    }
    // Snap X alignment: left to other's left
    else if (Math.abs(x - other.x) <= snapDist) {
      x = other.x;
    }
    // Snap X alignment: right to other's right
    else if (Math.abs(x + width - (other.x + other.width)) <= snapDist) {
      x = other.x + other.width - width;
    }

    // Snap Y: top to other's bottom
    if (Math.abs(y - (other.y + other.height)) <= snapDist) {
      y = other.y + other.height;
    }
    // Snap Y: bottom to other's top
    else if (Math.abs(y + height - other.y) <= snapDist) {
      y = other.y - height;
    }
    // Snap Y alignment: top to other's top
    else if (Math.abs(y - other.y) <= snapDist) {
      y = other.y;
    }
    // Snap Y alignment: bottom to other's bottom
    else if (Math.abs(y + height - (other.y + other.height)) <= snapDist) {
      y = other.y + other.height - height;
    }
  }

  return { x, y };
}
