import type { GeometryBox } from './builderGeometry';

export const isOutside = (box: GeometryBox, view: { w: number; h: number }): boolean =>
  box.x < 0 || box.y < 0 || box.x + box.w > view.w || box.y + box.h > view.h;
