import type { Rect } from '@core/geometry/geometryPrimitives';

interface Boxed {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fully inside, not merely touching: a box that only grazes the selection rectangle must stay unselected. */
export function isFullyInside(rect: Rect, box: Omit<Boxed, 'id'>): boolean {
  return (
    box.x >= rect.x &&
    box.y >= rect.y &&
    box.x + box.w <= rect.x + rect.w &&
    box.y + box.h <= rect.y + rect.h
  );
}

export function idsFullyInside(rect: Rect, boxes: Boxed[]): string[] {
  return boxes.filter((box) => isFullyInside(rect, box)).map((box) => box.id);
}
