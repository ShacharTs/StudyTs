import { flattenPath, pointAtFraction } from '../geometry/pathSegments';
import type { Point } from '../geometry/geometryPrimitives';
import type { VisualSpec } from '../types/visualSpec';
import { elementBox } from './builderGeometry';
import { viewToPixels, type Frame, type ViewWindow } from './viewMath';

export const TOOLBAR_LIFT = 14;

export interface StageFrames {
  viewBox: ViewWindow;
  canvas: Frame;
  stage: Frame;
}

// The highest point of the links that start or end at a shape and rise over it (a loop and its label), so the toolbar clears them.
function highestOverShape(spec: VisualSpec, id: string, box: { x: number; w: number }): number {
  const centre = box.x + box.w / 2;
  const heights = spec.elements.flatMap((candidate) => {
    const link = candidate.builder?.link;
    if (!link || (link.from !== id && link.to !== id)) return [];
    const shaft = String(candidate.attrs.d ?? '').split(' M ')[0];
    const points = (flattenPath(shaft)[0] ?? []).filter((point) => Math.abs(point.x - centre) <= box.w);
    const label = spec.elements.find((el) => el.id === `${candidate.id}-label`);
    const labelTop = label && Math.abs(elementBox(label).x + elementBox(label).w / 2 - centre) <= box.w ? [elementBox(label).y] : [];
    return [...points.map((point) => point.y), ...labelTop];
  });
  return heights.length > 0 ? Math.min(...heights) : Infinity;
}

// Where the floating toolbar points to: top centre of a shape (above the loops that rise over it), middle of an arrow, in view space.
export function anchorInView(spec: VisualSpec, id: string): Point | null {
  const element = spec.elements.find((candidate) => candidate.id === id);
  if (!element) return null;
  if (!element.builder?.link) {
    const box = elementBox(element);
    return { x: box.x + box.w / 2, y: Math.min(box.y, highestOverShape(spec, id, box)) };
  }
  // The arrow head is a second subpath; only the shaft counts.
  const shaft = String(element.attrs.d ?? '').split(' M ')[0];
  const line = flattenPath(shaft)[0] ?? [];
  return line.length > 0 ? pointAtFraction(line, 0.5) : null;
}

export interface BoxSize {
  width: number;
  height: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

// The anchor is the bottom centre of a toolbar (translate -50% -100%); below is where the shape's bottom edge sits.
export function placeInside(anchor: Point, size: BoxSize, frame: BoxSize, below: number): Point {
  const half = size.width / 2;
  const fitsAbove = anchor.y - size.height >= 0;
  const y = fitsAbove ? anchor.y : below + TOOLBAR_LIFT + size.height;
  return { x: clamp(anchor.x, half, frame.width - half), y: clamp(y, size.height, frame.height) };
}

export function viewToStage(point: Point, frames: StageFrames, lift = 0): Point {
  const pixel = viewToPixels(point, frames.viewBox, frames.canvas);
  return { x: pixel.x - frames.stage.left, y: pixel.y - frames.stage.top - lift };
}

export function centerInView(spec: VisualSpec, id: string): Point | null {
  const element = spec.elements.find((candidate) => candidate.id === id);
  if (!element) return null;
  const box = elementBox(element);
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}
