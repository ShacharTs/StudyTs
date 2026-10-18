import type { SceneObject } from '@canvasStore';
import type { Anchor } from '@core/geometry/outline/geometryTypes';
import { anchors, hitTestOutline, intersect } from '@core/geometry/outline/outlineEngine';
import { SHAPE_DEFINITIONS, geometryOf } from './shapeDefinitions';
import type { Point } from '@core/geometry/geometryPrimitives';
import { connectionPointAnchors } from '../connectors/customPorts';

const rotate = (p: Point, c: Point, deg: number): Point => {
  const a = (deg * Math.PI) / 180;
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
};

const centre = (o: SceneObject): Point => ({ x: o.x + o.w / 2, y: o.y + o.h / 2 });

/** Object (page) space → the shape's own un-rotated space with its top-left at the origin. */
function toLocal(o: SceneObject, p: Point): Point {
  const q = rotate(p, centre(o), -o.rotation);
  return { x: q.x - o.x, y: q.y - o.y };
}

function fromLocal(o: SceneObject, p: Point): Point {
  return rotate({ x: p.x + o.x, y: p.y + o.y }, centre(o), o.rotation);
}

/** True when a page-space point is inside the object's visible outline (rotation-aware). */
export function objectHit(o: SceneObject, p: Point): boolean {
  return hitTestOutline(geometryOf(o), o.w, o.h, toLocal(o, p));
}

/** The point on the object's outline where a connector toward `toward` should end, so it touches the stroke. */
export function objectBoundary(o: SceneObject, toward: Point): Point {
  return fromLocal(o, intersect(geometryOf(o), o.w, o.h, toLocal(o, toward)));
}

/** Anchors in the shape's own un-rotated space (what is drawn inside the rotated wrapper). */
export function localAnchorsOf(o: SceneObject): Anchor[] {
  const custom = o.type === 'shape' ? SHAPE_DEFINITIONS[(o.props.shape as string | undefined) ?? 'rect']?.customAnchors : undefined;
  const base = custom ? custom(o.w, o.h) : anchors(geometryOf(o), o.w, o.h);
  return [...base, ...connectionPointAnchors(o)];
}

/** A point given in the shape's own space, expressed in page space (rotation-aware). */
export function localToPage(o: SceneObject, p: Point): Point {
  return fromLocal(o, p);
}

/** Connection anchors on the outline in page space (a definition's customAnchors replace the automatic ones). */
export function objectAnchors(o: SceneObject): Anchor[] {
  const origin = centre(o);
  return localAnchorsOf(o).map((a) => {
    const at = fromLocal(o, a);
    const n = rotate({ x: origin.x + a.normal.x, y: origin.y + a.normal.y }, origin, o.rotation);
    return { id: a.id, x: at.x, y: at.y, normal: { x: n.x - origin.x, y: n.y - origin.y } };
  });
}
