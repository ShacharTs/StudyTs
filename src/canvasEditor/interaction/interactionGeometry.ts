import { GRID_MM, snapToGrid, type SceneObject } from '@canvasStore';
import type { Rect } from '@core/geometry/geometryPrimitives';

export interface GuideLine {
  axis: 'x' | 'y';
  position: number;
}

function edges(pos: number, size: number): number[] {
  return [pos, pos + size / 2, pos + size];
}

function trySnapAxis(
  movingEdges: number[],
  candidateEdges: number[],
  thresholdMm: number
): { offset: number; matched: number } | null {
  let best: { offset: number; matched: number; dist: number } | null = null;
  for (const me of movingEdges) {
    for (const ce of candidateEdges) {
      const dist = Math.abs(me - ce);
      if (dist <= thresholdMm && (!best || dist < best.dist)) {
        best = { offset: ce - me, matched: ce, dist };
      }
    }
  }
  return best ? { offset: best.offset, matched: best.matched } : null;
}

/** Spacing of the visible background grid; objects snap to it only while the grid is shown. */
export const VISIBLE_GRID_MM = 10;

/** A null grid means the grid is hidden, so unmatched positions keep their exact value. */
export function snapObjectToGuides(
  box: Rect,
  others: SceneObject[],
  thresholdMm: number,
  enabled: boolean,
  marginLines: { x?: number[]; y?: number[] },
  gridMm: number | null = GRID_MM
): { x: number; y: number; guides: GuideLine[] } {
  if (!enabled) return { x: box.x, y: box.y, guides: [] };

  const movingXEdges = edges(box.x, box.w);
  const movingYEdges = edges(box.y, box.h);

  const candidateX: number[] = [...(marginLines.x ?? [])];
  const candidateY: number[] = [...(marginLines.y ?? [])];
  for (const o of others) {
    candidateX.push(...edges(o.x, o.w));
    candidateY.push(...edges(o.y, o.h));
  }

  const guides: GuideLine[] = [];
  let x = box.x;
  let y = box.y;

  const xSnap = trySnapAxis(movingXEdges, candidateX, thresholdMm);
  if (xSnap) {
    x = box.x + xSnap.offset;
    guides.push({ axis: 'x', position: xSnap.matched });
  } else {
    x = gridMm === null ? box.x : snapToGrid(box.x, gridMm);
  }

  const ySnap = trySnapAxis(movingYEdges, candidateY, thresholdMm);
  if (ySnap) {
    y = box.y + ySnap.offset;
    guides.push({ axis: 'y', position: ySnap.matched });
  } else {
    y = gridMm === null ? box.y : snapToGrid(box.y, gridMm);
  }

  return { x, y, guides };
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface SnapLines {
  x: number[];
  y: number[];
}

export const MIN_MM = 1;
const DEG = Math.PI / 180;

/** Rotate a screen-space delta into the object's local (unrotated) frame. */
export function toLocalDelta(
  dxScreen: number,
  dyScreen: number,
  rotationDeg: number
): { dx: number; dy: number } {
  const t = rotationDeg * DEG;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  return { dx: dxScreen * cos + dyScreen * sin, dy: -dxScreen * sin + dyScreen * cos };
}

function anchorSigns(handle: ResizeHandle): { sx: number; sy: number } {
  const sx = handle.includes('w') ? 1 : handle.includes('e') ? -1 : 0;
  const sy = handle.includes('n') ? 1 : handle.includes('s') ? -1 : 0;
  return { sx, sy };
}

/** One axis after a drag: grows by `delta` when the handle is on that axis (towards `plus`), else unchanged. */
function dragAxis(current: number, active: boolean, plus: boolean, delta: number): number {
  return active ? Math.max(MIN_MM, current + (plus ? delta : -delta)) : current;
}

/** Re-derives the free axis (or the smaller-change axis for corners) so the original aspect ratio holds. */
function lockAspect(box: Rect, w: number, h: number, hasX: boolean, hasY: boolean): { w: number; h: number } {
  const ratio = box.w / box.h;
  if (hasX && hasY) {
    return Math.abs(w / box.w - 1) >= Math.abs(h / box.h - 1)
      ? { w, h: Math.max(MIN_MM, w / ratio) }
      : { w: Math.max(MIN_MM, h * ratio), h };
  }
  if (hasX) return { w, h: Math.max(MIN_MM, w / ratio) };
  if (hasY) return { w: Math.max(MIN_MM, h * ratio), h };
  return { w, h };
}

function newSize(box: Rect, handle: ResizeHandle, dx: number, dy: number, lockedAspect: boolean): { w: number; h: number } {
  const hasX = handle.includes('e') || handle.includes('w');
  const hasY = handle.includes('n') || handle.includes('s');
  const w = dragAxis(box.w, hasX, handle.includes('e'), dx);
  const h = dragAxis(box.h, hasY, handle.includes('s'), dy);
  return lockedAspect && box.w > 0 && box.h > 0 ? lockAspect(box, w, h, hasX, hasY) : { w, h };
}

export function resizeRotated(
  box: Rect,
  rotationDeg: number,
  handle: ResizeHandle,
  localDx: number,
  localDy: number,
  lockAspect: boolean
): Rect {
  const { sx, sy } = anchorSigns(handle);
  const { w, h } = newSize(box, handle, localDx, localDy, lockAspect);
  const cx0 = box.x + box.w / 2;
  const cy0 = box.y + box.h / 2;
  const ox = (sx * (box.w - w)) / 2;
  const oy = (sy * (box.h - h)) / 2;
  const t = rotationDeg * DEG;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const cxNew = cx0 + (ox * cos - oy * sin);
  const cyNew = cy0 + (ox * sin + oy * cos);
  return { x: cxNew - w / 2, y: cyNew - h / 2, w, h };
}

function nearestLine(value: number, candidates: number[], thresh: number): number | null {
  let best: { d: number; pos: number } | null = null;
  for (const c of candidates) {
    const d = Math.abs(value - c);
    if (d <= thresh && (!best || d < best.d)) best = { d, pos: c };
  }
  return best ? best.pos : null;
}

function snapEdge(
  value: number,
  lines: number[],
  thresh: number,
  useGrid: boolean,
  gridMm: number
): { pos: number; guide: boolean } | null {
  const hit = nearestLine(value, lines, thresh);
  if (hit != null) return { pos: hit, guide: true };
  if (useGrid) return { pos: snapToGrid(value, gridMm), guide: false };
  return null;
}

interface AxisSnap {
  start: number;
  size: number;
  guide?: number;
}

/** Snaps the far edge (e/s handles) of one axis; the box start stays put. */
function snapFarEdge(start: number, size: number, snap: { pos: number; guide: boolean } | null): AxisSnap {
  if (!snap) return { start, size };
  return { start, size: Math.max(MIN_MM, snap.pos - start), guide: snap.guide ? snap.pos : undefined };
}

/** Snaps the near edge (w/n handles) of one axis, keeping the far edge fixed; ignored if it would collapse the box. */
function snapNearEdge(start: number, size: number, snap: { pos: number; guide: boolean } | null): AxisSnap {
  const far = start + size;
  if (!snap || far - snap.pos < MIN_MM) return { start, size };
  return { start: snap.pos, size: far - snap.pos, guide: snap.guide ? snap.pos : undefined };
}

function snapAxis(start: number, size: number, farHandle: boolean, nearHandle: boolean, lines: number[], thresh: number, useGrid: boolean, gridMm: number): AxisSnap {
  if (farHandle) return snapFarEdge(start, size, snapEdge(start + size, lines, thresh, useGrid, gridMm));
  if (nearHandle) return snapNearEdge(start, size, snapEdge(start, lines, thresh, useGrid, gridMm));
  return { start, size };
}

export function snapResizeBox(
  box: Rect,
  handle: ResizeHandle,
  lines: SnapLines,
  thresh: number,
  useGrid: boolean,
  gridMm: number
): { box: Rect; guides: GuideLine[] } {
  const xs = snapAxis(box.x, box.w, handle.includes('e'), handle.includes('w'), lines.x, thresh, useGrid, gridMm);
  const ys = snapAxis(box.y, box.h, handle.includes('s'), handle.includes('n'), lines.y, thresh, useGrid, gridMm);
  const guides: GuideLine[] = [];
  if (xs.guide !== undefined) guides.push({ axis: 'x', position: xs.guide });
  if (ys.guide !== undefined) guides.push({ axis: 'y', position: ys.guide });
  return { box: { x: xs.start, y: ys.start, w: xs.size, h: ys.size }, guides };
}
