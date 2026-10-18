import { RECT_GEOMETRY, type Anchor, type GeometryDef } from '@core/geometry/outline/geometryTypes';
import { fitToBox, polygonAnchors, polygonHit, polygonIntersect, starVertices } from '@core/geometry/outline/polygon';
import {
  ellipseAnchors,
  ellipseHit,
  ellipseIntersect,
  rectAnchors,
  rectHit,
  rectIntersect,
  cylinderAnchors,
  cylinderHit,
  cylinderIntersect,
} from './primitiveOutlines';
import { samplePath } from '@core/geometry/outline/pathSampling';
import { compositeAnchors, compositeHit, compositeIntersect } from '@core/geometry/outline/composite';
import type { Point } from '@core/geometry/geometryPrimitives';


/** Sampled path outline as normalized polygon vertices, or null when the path cannot be sampled. */
function pathVertices(def: Extract<GeometryDef, { type: 'arbitrary-path' }>, w: number, h: number): Point[] | null {
  const pts = samplePath(def.pathData(w, h));
  if (!pts || w <= 0 || h <= 0) return null;
  return pts.map((p) => ({ x: p.x / w, y: p.y / h }));
}

/** Unit vertices for every polygon-like primitive (polygon, star, sampled path); null for the analytic ones. */
function vertexList(def: GeometryDef, w: number, h: number): Point[] | null {
  switch (def.type) {
    case 'polygon': return def.vertices;
    case 'star': return fitToBox(starVertices(def.points, def.innerRadiusRatio));
    case 'arbitrary-path': return pathVertices(def, w, h);
    default: return null;
  }
}

/** The geometry actually used for math: an unsampleable path falls back to its bounding rectangle. */
function resolved(def: GeometryDef, w: number, h: number): GeometryDef {
  return def.type === 'arbitrary-path' && !pathVertices(def, w, h) ? RECT_GEOMETRY : def;
}

/** Cardinal piercings of a vertex outline: the point where each axis ray from the centre leaves it. */
function cardinalAnchors(vertices: Point[], w: number, h: number): Anchor[] {
  const c = { x: w / 2, y: h / 2 };
  const far = Math.max(w, h) * 4;
  const probes: Array<[string, Point, Point]> = [
    ['top', { x: c.x, y: c.y - far }, { x: 0, y: -1 }],
    ['right', { x: c.x + far, y: c.y }, { x: 1, y: 0 }],
    ['bottom', { x: c.x, y: c.y + far }, { x: 0, y: 1 }],
    ['left', { x: c.x - far, y: c.y }, { x: -1, y: 0 }],
  ];
  return probes.map(([id, to, normal]) => ({ id, ...polygonIntersect(vertices, w, h, to), normal }));
}

/** True when a point (local mm, origin at the shape's top-left) is inside the shape's outline. */
export function hitTestOutline(def: GeometryDef, w: number, h: number, p: Point): boolean {
  const g = resolved(def, w, h);
  if (g.type === 'composite') return compositeHit(g.parts, w, h, p, hitTestOutline);
  const vertices = vertexList(g, w, h);
  if (vertices) return polygonHit(vertices, w, h, p);
  if (g.type === 'ellipse') return ellipseHit(w, h, p, g.rxRatio, g.ryRatio);
  if (g.type === 'cylinder') return cylinderHit(g.capRatio, w, h, p);
  return rectHit(w, h, p);
}

/** Connection points on the outline: polygon vertices+midpoints, 8 curve points, 4 for cylinders and paths. */
export function anchors(def: GeometryDef, w: number, h: number): Anchor[] {
  const g = resolved(def, w, h);
  if (g.type === 'composite') return compositeAnchors(g.parts, w, h, anchors, hitTestOutline);
  if (g.type === 'arbitrary-path') return cardinalAnchors(vertexList(g, w, h)!, w, h);
  const vertices = vertexList(g, w, h);
  if (vertices) return polygonAnchors(vertices, w, h);
  if (g.type === 'ellipse') return ellipseAnchors(w, h, g.rxRatio, g.ryRatio);
  if (g.type === 'cylinder') return cylinderAnchors(g.capRatio, w, h);
  return rectAnchors(w, h);
}

/** The outline point on the ray from the shape's centre toward `from` (so arrows land flush on the stroke). */
export function intersect(def: GeometryDef, w: number, h: number, from: Point): Point {
  const g = resolved(def, w, h);
  if (g.type === 'composite') return compositeIntersect(g.parts, w, h, from, hitTestOutline) ?? rectIntersect(w, h, from);
  const vertices = vertexList(g, w, h);
  if (vertices) return polygonIntersect(vertices, w, h, from);
  if (g.type === 'ellipse') return ellipseIntersect(w, h, from, g.rxRatio, g.ryRatio);
  if (g.type === 'cylinder') return cylinderIntersect(g.capRatio, w, h, from);
  return rectIntersect(w, h, from);
}
