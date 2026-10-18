import type { Point } from '@core/geometry/geometryPrimitives';
import type { VisualElementSpec, VisualSpec } from '@core/types/visualSpec';
import { boxCenter, elementBox } from './builderGeometry';
import { sceneAt, type SceneElement } from './scene';

export interface MoveTrail {
  id: string;
  from: Point;
  to: Point;
  origin: VisualElementSpec;
}

// Helpers and arrows follow their owner's move, so they would draw a trail of their own.
const isTrailable = (el: VisualElementSpec): boolean => !el.builder?.link && !el.builder?.parent && !el.builder?.say && !el.builder?.fx;

// Centres are compared, not boxes, so a resize that keeps the centre draws no trail.
export function moveTrailsAt(spec: VisualSpec, stepIndex: number): MoveTrail[] {
  if (stepIndex < 1) return [];
  const before = new Map(sceneAt(spec, stepIndex - 1).map((entry) => [entry.element.id, entry]));
  return sceneAt(spec, stepIndex).flatMap((entry) => trailOf(before.get(entry.element.id), entry));
}

function trailOf(previous: SceneElement | undefined, current: SceneElement): MoveTrail[] {
  if (!previous || previous.state !== 'live' || current.state !== 'live') return [];
  if (!isTrailable(current.element)) return [];
  const from = boxCenter(elementBox(previous.element));
  const to = boxCenter(elementBox(current.element));
  if (from.x === to.x && from.y === to.y) return [];
  return [{ id: current.element.id, from, to, origin: previous.element }];
}
