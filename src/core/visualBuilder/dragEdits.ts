import type { Point } from '../geometry/geometryPrimitives';
import type { VisualSpec } from '../types/visualSpec';
import { groupMemberSpecs, moveElements, resizeElement } from './builderEdits';
import { elementBox } from './builderGeometry';

// Must equal the drawn grid spacing; a different value makes snapped points fall between visible lines.
export const CANVAS_GRID_UNITS = 24;

export interface CanvasDrag {
  mode: 'move' | 'resize';
  id: string;
  ids?: string[];
  start: Point;
  dx: number;
  dy: number;
  snap?: boolean;
}

export const snapValue = (value: number, snap: boolean): number => (snap ? Math.round(value / CANVAS_GRID_UNITS) * CANVAS_GRID_UNITS : Math.round(value));

export function applyDrag(spec: VisualSpec, drag: CanvasDrag): VisualSpec {
  // A group (a tape's cells, strip and head) moves as one object, whichever member was grabbed.
  if (drag.mode === 'move') return moveElements(spec, (drag.ids ?? [drag.id]).flatMap((id) => groupMemberSpecs(spec, id).map((m) => m.id)), drag.dx, drag.dy);
  const original = spec.elements.find((el) => el.id === drag.id);
  if (!original) return spec;
  const box = elementBox(original);
  const w = box.w + drag.dx;
  const h = box.h + drag.dy;
  const side = Math.max(w, h);
  return resizeElement(spec, drag.id, original.kind === 'circle' ? { ...box, w: side, h: side } : { ...box, w, h });
}
