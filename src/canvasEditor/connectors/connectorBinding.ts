import type { SceneObject, ObjectType, PortSide } from '@canvasStore';
import { objectBoundary, objectHit, objectAnchors, localToPage } from '../shapeEngine/objectOutline';
import type { Point } from '@core/geometry/geometryPrimitives';

export type { PortSide };

/** Anchor position as a fraction of the box (x, y). */
const SIDE_FRACTION: Record<PortSide, [number, number]> = {
  top: [0.5, 0],
  right: [1, 0.5],
  bottom: [0.5, 1],
  left: [0, 0.5],
  'top-right': [1, 0],
  'bottom-right': [1, 1],
  'bottom-left': [0, 1],
  'top-left': [0, 0],
};

export const PORT_SIDES = Object.keys(SIDE_FRACTION) as PortSide[];

export const CONNECTABLE_TYPES = new Set<ObjectType>(['node', 'shape']);

/**
 * Page-space position of a port: an anchor id on the shape's outline, or a legacy side name
 * (top, right, top-right, ...) resolved to the nearest real anchor so old documents keep working.
 */
export function portPoint(obj: SceneObject, port: string): Point {
  const all = objectAnchors(obj);
  const exact = all.find((a) => a.id === port);
  if (exact) return { x: exact.x, y: exact.y };

  const frac = SIDE_FRACTION[port as PortSide] ?? [0.5, 0.5];
  const want = localToPage(obj, { x: obj.w * frac[0], y: obj.h * frac[1] });
  const nearest = all.reduce<Point | null>((best, a) => {
    const d = Math.hypot(a.x - want.x, a.y - want.y);
    return best === null || d < Math.hypot(best.x - want.x, best.y - want.y) ? { x: a.x, y: a.y } : best;
  }, null);
  return nearest ?? want;
}

/** Where a connector toward (towardX, towardY) meets the object's visible outline (flush against the stroke). */
export function boundaryPointToward(
  obj: SceneObject,
  towardX: number,
  towardY: number
): { x: number; y: number } {
  return objectBoundary(obj, { x: towardX, y: towardY });
}

interface BoundEdgeEndpoints {
  minX: number;
  minY: number;
  boxW: number;
  boxH: number;
  startAbs: { x: number; y: number };
  endAbs: { x: number; y: number };
}

function freePoint(
  obj: SceneObject,
  xKey: string,
  yKey: string,
  fallback: { x: number; y: number }
): { x: number; y: number } {
  const x = obj.props[xKey];
  const y = obj.props[yKey];
  if (typeof x === 'number' && typeof y === 'number') return { x, y };
  return fallback;
}

/** A chosen port wins; otherwise the end floats to the outline point facing the other end. */
function endPoint(
  shape: SceneObject,
  port: unknown,
  other: SceneObject | undefined,
  otherFallback: { x: number; y: number }
): { x: number; y: number } {
  if (typeof port === 'string' && port) return portPoint(shape, port);
  return boundaryPointToward(
    shape,
    other ? other.x + other.w / 2 : otherFallback.x,
    other ? other.y + other.h / 2 : otherFallback.y
  );
}

/** An edge from a shape to itself with no chosen ports: both ends sit on the top of the outline, apart, so it can loop over it. */
export function isSelfLoop(obj: SceneObject, sourceObj: SceneObject | undefined, targetObj: SceneObject | undefined): boolean {
  return Boolean(sourceObj && targetObj && sourceObj.id === targetObj.id && !obj.props.sourcePort && !obj.props.targetPort);
}

function selfLoopEndpoints(shape: SceneObject): { startAbs: Point; endAbs: Point } {
  const cx = shape.x + shape.w / 2;
  const top = shape.y - shape.h;
  return {
    startAbs: boundaryPointToward(shape, cx + shape.w / 3, top),
    endAbs: boundaryPointToward(shape, cx - shape.w / 3, top),
  };
}

function boxOf(startAbs: Point, endAbs: Point): BoundEdgeEndpoints {
  return {
    minX: Math.min(startAbs.x, endAbs.x),
    minY: Math.min(startAbs.y, endAbs.y),
    boxW: Math.max(1, Math.abs(startAbs.x - endAbs.x)),
    boxH: Math.max(1, Math.abs(startAbs.y - endAbs.y)),
    startAbs,
    endAbs,
  };
}

export function computeBoundEdgeEndpoints(
  obj: SceneObject,
  sourceObj: SceneObject | undefined,
  targetObj: SceneObject | undefined
): BoundEdgeEndpoints {
  if (sourceObj && isSelfLoop(obj, sourceObj, targetObj)) {
    const { startAbs, endAbs } = selfLoopEndpoints(sourceObj);
    return boxOf(startAbs, endAbs);
  }
  const fallbackStartAbs = freePoint(obj, 'freeSourceX', 'freeSourceY', { x: obj.x, y: obj.y + obj.h / 2 });
  const fallbackEndAbs = freePoint(obj, 'freeTargetX', 'freeTargetY', { x: obj.x + obj.w, y: obj.y + obj.h / 2 });
  const startAbs = sourceObj
    ? endPoint(sourceObj, obj.props.sourcePort, targetObj, fallbackEndAbs)
    : fallbackStartAbs;
  const endAbs = targetObj
    ? endPoint(targetObj, obj.props.targetPort, sourceObj, fallbackStartAbs)
    : fallbackEndAbs;

  return boxOf(startAbs, endAbs);
}

export function computeBoundEdgeBox(
  obj: SceneObject,
  sourceObj: SceneObject | undefined,
  targetObj: SceneObject | undefined
): { minX: number; minY: number; boxW: number; boxH: number } {
  return computeBoundEdgeEndpoints(obj, sourceObj, targetObj);
}



export function findConnectableObjectAt(
  objects: Record<string, SceneObject>,
  pageObjectIds: string[],
  xMm: number,
  yMm: number
): SceneObject | undefined {
  let best: SceneObject | undefined;
  for (const id of pageObjectIds) {
    const obj = objects[id];
    if (!obj || !CONNECTABLE_TYPES.has(obj.type)) continue;
    if (!objectHit(obj, { x: xMm, y: yMm })) continue;
    if (!best || obj.zIndex > best.zIndex) best = obj;
  }
  return best;
}
