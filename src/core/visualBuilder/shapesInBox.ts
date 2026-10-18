import type { VisualSpec } from '../types/visualSpec';
import { elementBox, type GeometryBox } from './builderGeometry';

const overlaps = (a: GeometryBox, b: GeometryBox): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// The top-level shapes a rectangle touches; labels, arrows and effect helpers follow their owners and are never picked alone.
export function shapesInBox(spec: VisualSpec, box: GeometryBox): string[] {
  return spec.elements
    .filter((el) => !el.builder?.link && !el.builder?.parent && !el.builder?.say && !el.builder?.fx)
    .filter((el) => overlaps(elementBox(el), box))
    .map((el) => el.id);
}
