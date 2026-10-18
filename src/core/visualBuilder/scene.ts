import type { Point } from '@core/geometry/geometryPrimitives';
import type { VisualElementSpec, VisualSpec } from '@core/types/visualSpec';
import { moveElements } from './builderEdits';
import { blocksOf } from './blocks';
import { boxCenter, elementBox } from './builderGeometry';
import { lifecycleAt, type Lifecycle } from './lifecycle';

export interface SceneElement {
  element: VisualElementSpec;
  state: Lifecycle;
}

// Move blocks store absolute centres, so the scene is the base spec shifted to the last one per target.
export function sceneAt(spec: VisualSpec, stepIndex: number): SceneElement[] {
  const states = lifecycleAt(spec, stepIndex);
  const shifted = shiftToCentre(spec, latestMoveCentres(spec, stepIndex));
  return shifted.elements.map((element) => ({ element, state: states.get(element.id) ?? 'live' }));
}

// The spec as drawn at a step, with removed and not-yet-created elements still included.
export function sceneSpecAt(spec: VisualSpec, stepIndex: number): VisualSpec {
  return { ...spec, elements: sceneAt(spec, stepIndex).map((entry) => entry.element) };
}

function latestMoveCentres(spec: VisualSpec, stepIndex: number): Map<string, Point> {
  const centres = new Map<string, Point>();
  for (const block of spec.steps.slice(0, stepIndex + 1).flatMap(blocksOf)) {
    if (block.action === 'move' && block.target && block.to) centres.set(block.target, block.to);
  }
  return centres;
}

// Offsets come from the base spec so that moving one target never changes another's offset.
function shiftToCentre(spec: VisualSpec, centres: Map<string, Point>): VisualSpec {
  return [...centres].reduce((scene, [id, to]) => shiftTowards(spec, scene, id, to), spec);
}

// Rounded like blockTweens.move so the scene matches what Preview animates to.
function shiftTowards(base: VisualSpec, scene: VisualSpec, id: string, to: Point): VisualSpec {
  const element = base.elements.find((candidate) => candidate.id === id);
  if (!element) return scene;
  const centre = boxCenter(elementBox(element));
  return moveElements(scene, [id], Math.round(to.x - centre.x), Math.round(to.y - centre.y));
}
