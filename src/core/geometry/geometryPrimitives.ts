// src/core/geometry/geometryPrimitives.ts
/** The plain geometry shapes shared by the canvas editor, the graph engine and the server. */

/** A position on a plane. */
export interface Point {
  x: number;
  y: number;
}

/** A rectangle given by its top-left corner and its width (w) and height (h). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

