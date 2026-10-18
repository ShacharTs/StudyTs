import type { Point } from '@core/geometry/geometryPrimitives';
/** A connection point on a shape's outline, with the outward direction it faces. */
export interface Anchor {
  id: string;
  x: number;
  y: number;
  normal: Point;
}

/** One piece of a composite shape, placed by a box given as fractions of the whole shape. */
export interface CompositePart {
  geometry: GeometryDef;
  box: { x: number; y: number; w: number; h: number };
}

/** What the engine needs to know about a shape; hit-testing, anchors and edge snapping all derive from it. */
export type GeometryDef =
  | { type: 'polygon'; vertices: Point[] }
  | { type: 'star'; points: number; innerRadiusRatio: number }
  | { type: 'ellipse'; rxRatio?: number; ryRatio?: number }
  | { type: 'cylinder'; capRatio: number }
  | { type: 'rect' }
  | { type: 'composite'; parts: CompositePart[] }
  | { type: 'arbitrary-path'; pathData: (w: number, h: number) => string };

/** The plain box outline; the fallback when a path cannot be sampled. */
export const RECT_GEOMETRY: GeometryDef = { type: 'rect' };
