import type { Point } from '../geometry/geometryPrimitives';

export interface Camera {
  cx: number;
  cy: number;
  s: number;
}

export interface FrameSize {
  width: number;
  height: number;
}

export interface VisibleBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;

const clampScale = (s: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s));

// margin is the total space around the stage: twice the --stage-pad the live preview uses, so both show it at one size.
export function fitCamera(world: { w: number; h: number }, frame: FrameSize, margin: number): Camera {
  const s = Math.min((frame.width - margin) / world.w, (frame.height - margin) / world.h);
  return { cx: world.w / 2, cy: world.h / 2, s: s > 0 ? clampScale(s) : 1 };
}

export function visibleBox(camera: Camera, frame: FrameSize): VisibleBox {
  const w = frame.width / camera.s;
  const h = frame.height / camera.s;
  return { x: camera.cx - w / 2, y: camera.cy - h / 2, w, h };
}

export function toWorld(camera: Camera, frame: FrameSize, pixel: Point): Point {
  return { x: camera.cx + (pixel.x - frame.width / 2) / camera.s, y: camera.cy + (pixel.y - frame.height / 2) / camera.s };
}

// The world point under the pointer stays under the pointer.
export function zoomAround(camera: Camera, frame: FrameSize, factor: number, pixel: Point): Camera {
  const s = clampScale(camera.s * factor);
  const world = toWorld(camera, frame, pixel);
  return { s, cx: world.x - (pixel.x - frame.width / 2) / s, cy: world.y - (pixel.y - frame.height / 2) / s };
}

export function zoomTo(camera: Camera, s: number): Camera {
  return { ...camera, s: clampScale(s) };
}

export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, cx: camera.cx - dx / camera.s, cy: camera.cy - dy / camera.s };
}
