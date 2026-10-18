import type { Rect } from '@core/geometry/geometryPrimitives';
import { addObject, pageSizeMm, useCanvasStore, type SceneObject } from '@canvasStore';

export const MAX_TABLE_ROWS = 30;
export const MAX_TABLE_COLS = 12;

const CELL_W_MM = 30;
const CELL_H_MM = 8;
const SCAN_STEP_MM = 5;


export function clampTableDim(n: number, max: number): number {
  return Math.min(max, Math.max(1, Math.round(n) || 1));
}

/** Shrinks column width so a wide table still fits the page's printable width. */
export function tableSizeMm(rows: number, cols: number, innerW: number): { w: number; h: number } {
  return { w: Math.min(cols * CELL_W_MM, innerW), h: rows * CELL_H_MM };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * First top-left-most spot inside the margins where `size` hits no occupied rect.
 * Returns null when the page has no room, so the caller can fall back instead of silently stacking.
 */
export function findFreeSpot(
  occupied: Rect[],
  size: { w: number; h: number },
  page: { w: number; h: number; margin: number }
): { x: number; y: number } | null {
  const maxX = page.w - page.margin - size.w;
  const maxY = page.h - page.margin - size.h;
  for (let y = page.margin; y <= maxY; y += SCAN_STEP_MM) {
    for (let x = page.margin; x <= maxX; x += SCAN_STEP_MM) {
      if (!occupied.some((o) => overlaps({ x, y, ...size }, o))) return { x, y };
    }
  }
  return null;
}

function occupiedRects(objectIds: string[], objects: Record<string, SceneObject>): Rect[] {
  return objectIds
    .map((id) => objects[id])
    .filter((o): o is SceneObject => Boolean(o) && !o.hidden && o.type !== 'edge')
    .map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
}

/** Inserts a rows x cols table on the current page in free space; returns the object, or null if the page is full. */
export function insertTable(rowsIn: number, colsIn: number): SceneObject | null {
  const rows = clampTableDim(rowsIn, MAX_TABLE_ROWS);
  const cols = clampTableDim(colsIn, MAX_TABLE_COLS);
  const { doc, currentPageId } = useCanvasStore.getState();
  const page = doc.pages.find((p) => p.id === currentPageId) ?? doc.pages[0];
  if (!page) return null;

  const { w: pageW, h: pageH } = pageSizeMm(page.orientation, page.paperSize);
  const size = tableSizeMm(rows, cols, pageW - 2 * page.margin);
  const spot = findFreeSpot(occupiedRects(page.objects, doc.objects), size, { w: pageW, h: pageH, margin: page.margin });
  if (!spot) return null;

  const cells = Array.from({ length: rows }, () => Array<string>(cols).fill(''));
  return addObject('table', { ...spot, ...size, props: { rows, cols, cells } }, page.id);
}
