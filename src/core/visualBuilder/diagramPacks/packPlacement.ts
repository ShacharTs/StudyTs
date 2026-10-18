import type { Point } from '../../geometry/geometryPrimitives';
import type { GeometryBox } from '../builderGeometry';
import type { PackObjectDef } from './stylePackFormat';

export interface PlacedAnchor {
  id: string;
  x: number;
  y: number;
  normal: Point;
}

export type PlacedOutline = 'rect' | 'ellipse' | { polygon: Point[] };

// The frame is where the drawing sits: the view's aspect ratio, centred in the placed box.
// Anchors and outlines are fractions of this frame, so they stay on the figure at any box shape.
export interface PackFrame {
  box: GeometryBox;
  scale: number;
}

export function packFrame(object: PackObjectDef, box: GeometryBox): PackFrame {
  if (!object.view) return { box, scale: 1 };
  const scale = Math.min(box.w / object.view.w, box.h / object.view.h);
  const w = object.view.w * scale;
  const h = object.view.h * scale;
  return { box: { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h }, scale };
}

export function packAnchorsOnBox(object: PackObjectDef, frame: GeometryBox): PlacedAnchor[] {
  return (object.anchors ?? []).map((anchor) => ({
    id: anchor.id,
    x: frame.x + anchor.x * frame.w,
    y: frame.y + anchor.y * frame.h,
    normal: { x: anchor.nx, y: anchor.ny },
  }));
}

export function packOutlineOnBox(object: PackObjectDef, frame: GeometryBox): PlacedOutline {
  const outline = object.outline ?? 'rect';
  if (typeof outline === 'string') return outline;
  return {
    polygon: outline.polygon.map(([fx, fy]) => ({ x: frame.x + fx * frame.w, y: frame.y + fy * frame.h })),
  };
}
