import type { VisualElementSpec, VisualSpec } from '../../../types/visualSpec';
import { parseViewBox } from '../../../shared/stageSize';
import { moveElements } from '../../builderEdits';
import { flattenPath } from '../../../geometry/pathSegments';
import { addPackObjectAtStep } from '../../sceneEdits';
import { createStampedPackElements } from '../../diagramPacks/packObjectElements';
import { packObjectByRef } from '../../diagramPacks/stylePackRegistry';
import { boxCenter, elementBox } from '../../builderGeometry';
import { readAutomaton, STATE_REF, ACCEPTING_REF, START_REF, STATE_REFS } from './automatonModel';

const STATE_GAP = 6;

export const isStateElement = (el: VisualElementSpec | undefined): boolean => STATE_REFS.includes(el?.builder?.pack ?? '');

const isMarkerPart = (el: VisualElementSpec, markerIds: string[]): boolean => markerIds.some((id) => el.id.startsWith(`${id}-part-`));

// The accepting flag swaps the state's pack object in place: same id, same label, same spot.
export function setAccepting(spec: VisualSpec, stateId: string, on: boolean): VisualSpec {
  const owner = spec.elements.find((el) => el.id === stateId);
  if (!isStateElement(owner)) return spec;
  const ref = on ? ACCEPTING_REF : STATE_REF;
  const object = packObjectByRef(ref);
  if (!object || !owner) return spec;
  const [main, ...parts] = createStampedPackElements(object, ref, stateId, boxCenter(elementBox(owner)), parseViewBox(spec.viewBox).w);
  if (!main) return spec;
  const replaced: VisualElementSpec = { ...main, content: owner.content, style: owner.style, builder: { ...owner.builder, pack: ref } };
  const elements = spec.elements.flatMap((el) => {
    if (el.id === stateId) return [replaced, ...parts];
    return el.id.startsWith(`${stateId}-part-`) ? [] : [el];
  });
  return { ...spec, elements };
}

// Only one start: the old marker goes, and the new one is lined up so its tip touches the state's left edge at the state's height.
export function setStart(spec: VisualSpec, stateId: string): VisualSpec {
  const state = spec.elements.find((el) => el.id === stateId);
  if (!isStateElement(state) || !state) return spec;
  if (readAutomaton(spec).start === stateId) return spec;
  const kept = clearStart(spec);
  const added = addPackObjectAtStep(kept, 0, START_REF, { x: 0, y: 0 });
  if (!added) return spec;
  const marker = added.spec.elements.find((el) => el.id === added.id);
  if (!marker) return spec;
  const box = elementBox(state);
  const centre = boxCenter(box);
  // The arrow's tip is the end of its shaft; the box can sit off the drawn arrow, so the tip is what lines up.
  const shaft = flattenPath(String(marker.attrs.d))[0];
  const tip = shaft[shaft.length - 1];
  const dx = box.x - STATE_GAP - tip.x;
  const dy = centre.y - tip.y;
  const ids = added.spec.elements.filter((el) => el.id === added.id || el.id.startsWith(`${added.id}-part-`)).map((el) => el.id);
  return moveElements(added.spec, ids, dx, dy);
}

// Unchecking start removes the marker, so the drawing has no start state until one is flagged again.
export function clearStart(spec: VisualSpec): VisualSpec {
  const markerIds = spec.elements.filter((el) => el.builder?.pack === START_REF).map((el) => el.id);
  return { ...spec, elements: spec.elements.filter((el) => !markerIds.includes(el.id) && !isMarkerPart(el, markerIds)) };
}
