import { setProp, type SceneObject } from '@canvasStore';
import type { Anchor } from '@core/geometry/outline/geometryTypes';

// Connection points a user placed inside a shape. Positions are fractions of the frame, so they scale with the shape.
export const CONNECTION_POINTS_KEY = 'connectionPoints';

export interface ConnectionPoint {
  id: string;
  x: number;
  y: number;
}

export function connectionPoints(obj: SceneObject): ConnectionPoint[] {
  const raw = obj.props[CONNECTION_POINTS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is ConnectionPoint => typeof p?.id === 'string' && typeof p.x === 'number' && typeof p.y === 'number',
  );
}

// The normal faces away from the centre, so the dot is nudged inward from the point rather than out of the frame.
export function connectionPointAnchors(obj: SceneObject): Anchor[] {
  return connectionPoints(obj).map((p) => {
    const dx = p.x - 0.5;
    const dy = p.y - 0.5;
    const length = Math.hypot(dx, dy);
    const normal = length < 1e-9 ? { x: 0, y: -1 } : { x: dx / length, y: dy / length };
    return { id: p.id, x: p.x * obj.w, y: p.y * obj.h, normal };
  });
}

export function addConnectionPoint(obj: SceneObject, fx: number, fy: number): string {
  const id = `cp-${Math.random().toString(36).slice(2, 8)}`;
  setProp(obj.id, CONNECTION_POINTS_KEY, [...connectionPoints(obj), { id, x: fx, y: fy }], 'Add connection point');
  return id;
}

export function removeConnectionPoint(obj: SceneObject, pointId: string): void {
  setProp(
    obj.id,
    CONNECTION_POINTS_KEY,
    connectionPoints(obj).filter((p) => p.id !== pointId),
    'Remove connection point',
  );
}
