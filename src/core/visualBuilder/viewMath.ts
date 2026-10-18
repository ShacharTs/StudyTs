import type { Point } from '../geometry/geometryPrimitives';
import { SIDES, sidePoint, type GeometryBox } from './builderGeometry';
import type { BuilderSide } from '../types/visualSpec';

export interface Frame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Fit {
  scale: number;
  offsetX: number;
  offsetY: number;
}

// The picture is drawn "meet": as large as fits, centred, with empty bands on the short side. scale is pixels per view unit.
export function fitView(viewBox: { w: number; h: number }, container: { width: number; height: number }): Fit | null {
  if (container.width <= 0 || container.height <= 0 || viewBox.w <= 0 || viewBox.h <= 0) return null;
  const scale = Math.min(container.width / viewBox.w, container.height / viewBox.h);
  return { scale, offsetX: (container.width - viewBox.w * scale) / 2, offsetY: (container.height - viewBox.h * scale) / 2 };
}

// A viewBox may start away from the origin (a panned camera); x and y default to 0.
export interface ViewWindow {
  w: number;
  h: number;
  x?: number;
  y?: number;
}

export function pixelsToView(pixel: Point, viewBox: ViewWindow, frame: Frame): Point {
  const placement = fitView(viewBox, frame);
  if (!placement) return pixel;
  return { x: (viewBox.x ?? 0) + (pixel.x - frame.left - placement.offsetX) / placement.scale, y: (viewBox.y ?? 0) + (pixel.y - frame.top - placement.offsetY) / placement.scale };
}

export function viewToPixels(point: Point, viewBox: ViewWindow, frame: Frame): Point {
  const placement = fitView(viewBox, frame);
  if (!placement) return point;
  return { x: frame.left + placement.offsetX + (point.x - (viewBox.x ?? 0)) * placement.scale, y: frame.top + placement.offsetY + (point.y - (viewBox.y ?? 0)) * placement.scale };
}

export function nearestSide(box: GeometryBox, point: Point): BuilderSide {
  const distance = (side: BuilderSide) => Math.hypot(point.x - sidePoint(box, side).x, point.y - sidePoint(box, side).y);
  return SIDES.reduce((best, side) => (distance(side) < distance(best) ? side : best), SIDES[0]);
}
