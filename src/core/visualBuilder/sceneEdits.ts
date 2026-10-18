import type { Point } from '../geometry/geometryPrimitives';
import type { BuilderShape, VisualSpec } from '../types/visualSpec';
import { parseViewBox } from '../shared/stageSize';
import { connectShapes, type LinkPlacement } from './connectors';
import { addBlock, blocksOf, defaultBlock, updateBlock } from './blocks';
import { addShape, appendObject, appendShape, isOwner, moveElements } from './builderEdits';
import { createStampedPackElements } from './diagramPacks/packObjectElements';
import { packObjectByRef } from './diagramPacks/stylePackRegistry';
import { clampBox, boxCenter, elementBox } from './builderGeometry';
import { applyDrag, snapValue, type CanvasDrag } from './dragEdits';
import { sceneAt, type SceneElement } from './scene';

// Preview's default for a move block; a shorter glide would read as a jump.
const MOVE_DURATION = 500;

// A shape is created by a show block, so its slot must avoid what is on screen from this step on.
export function addShapeAtStep(spec: VisualSpec, stepIndex: number, shape: BuilderShape): { spec: VisualSpec; id: string } {
  if (stepIndex === 0) return addShape(spec, shape);
  const taken = sceneAt(spec, stepIndex)
    .filter((entry) => entry.state !== 'gone' && isOwner(entry.element))
    .map((entry) => elementBox(entry.element));
  const added = appendShape(spec, shape, taken);
  return { spec: addBlock(added.spec, stepIndex, defaultBlock('show', added.id)), id: added.id };
}

// Same step rules as addShapeAtStep for a style-pack object; null when the ref names nothing. `at` skips the free-slot search.
export function addPackObjectAtStep(spec: VisualSpec, stepIndex: number, ref: string, at?: Point): { spec: VisualSpec; id: string } | null {
  const object = packObjectByRef(ref);
  if (!object) return null;
  const make = (id: string, point: Point, viewWidth: number) => createStampedPackElements(object, ref, id, point, viewWidth);
  const taken = (stepIndex === 0 ? spec.elements.filter(isOwner).map(elementBox) : sceneAt(spec, stepIndex).filter((entry) => entry.state !== 'gone' && isOwner(entry.element)).map((entry) => elementBox(entry.element)));
  const added = appendObject(spec, object.preset ?? object.id, make, taken, at);
  return stepIndex === 0 ? added : { spec: addBlock(added.spec, stepIndex, defaultBlock('show', added.id)), id: added.id };
}

// A new shape past step 1 appears by a show block at the selected step, like any shape added there.
export function addShapeAt(spec: VisualSpec, stepIndex: number, shape: BuilderShape, at: Point): { spec: VisualSpec; id: string } {
  const added = addShape(spec, shape, at);
  if (stepIndex === 0) return added;
  return { spec: addBlock(added.spec, stepIndex, defaultBlock('show', added.id)), id: added.id };
}

// An arrow connected past step 1 is drawn by its own draw block at the selected step; without one it is on screen from step 1.
export function connectShapesAtStep(spec: VisualSpec, stepIndex: number, fromId: string, toId: string, placement: LinkPlacement = {}): { spec: VisualSpec; id: string } | null {
  const linked = connectShapes(spec, fromId, toId, true, placement);
  if (!linked || stepIndex === 0) return linked;
  return { spec: addBlock(linked.spec, stepIndex, defaultBlock('draw', linked.id)), id: linked.id };
}

// Shapes shown in this very step have no earlier place to glide from, so they move in the base.
export function moveAtStep(spec: VisualSpec, stepIndex: number, ids: string[], dx: number, dy: number): VisualSpec {
  if (stepIndex === 0) return moveElements(spec, ids, dx, dy);
  const shownHere = new Set(blocksOf(spec.steps[stepIndex]).filter((block) => block.action === 'show').map((block) => block.target));
  const created = ids.filter((id) => shownHere.has(id));
  const animated = ids.filter((id) => !shownHere.has(id));
  const base = created.length > 0 ? moveElements(spec, created, dx, dy) : spec;
  const scene = sceneAt(spec, stepIndex);
  return animated.reduce((next, id) => writeMoveBlock(next, stepIndex, scene, id, dx, dy), base);
}

export function applyDragAtStep(spec: VisualSpec, stepIndex: number | undefined, drag: CanvasDrag): VisualSpec {
  if (drag.mode === 'resize') return applyDrag(spec, drag);
  const step = stepIndex ?? 0;
  const offset = drag.snap ? snapOffset(spec, step, drag) : { dx: drag.dx, dy: drag.dy };
  return moveAtStep(spec, step, drag.ids ?? [drag.id], offset.dx, offset.dy);
}

// Snapping the offset alone leaves the centre off the grid when the shape started off it.
function snapOffset(spec: VisualSpec, stepIndex: number, drag: CanvasDrag): { dx: number; dy: number } {
  const entry = sceneAt(spec, stepIndex).find((candidate) => candidate.element.id === drag.id);
  if (!entry) return { dx: drag.dx, dy: drag.dy };
  const centre = boxCenter(elementBox(entry.element));
  return { dx: snapValue(centre.x + drag.dx, true) - centre.x, dy: snapValue(centre.y + drag.dy, true) - centre.y };
}

// The block stores the absolute centre, clamped so the shape stays inside the view box.
function writeMoveBlock(spec: VisualSpec, stepIndex: number, scene: SceneElement[], id: string, dx: number, dy: number): VisualSpec {
  const entry = scene.find((candidate) => candidate.element.id === id);
  if (!entry) return spec;
  const box = elementBox(entry.element);
  const centre = boxCenter(box);
  const landing = clampBox({ ...box, x: centre.x + dx - box.w / 2, y: centre.y + dy - box.h / 2 }, parseViewBox(spec.viewBox));
  const landed = boxCenter(landing);
  const to: Point = { x: Math.round(landed.x), y: Math.round(landed.y) };
  const existing = moveBlockIndex(spec, stepIndex, id);
  if (existing < 0) return addBlock(spec, stepIndex, { ...defaultBlock('move', id), duration: MOVE_DURATION, at: 0, to });
  return updateBlock(spec, stepIndex, existing, { to });
}

function moveBlockIndex(spec: VisualSpec, stepIndex: number, id: string): number {
  return blocksOf(spec.steps[stepIndex]).findIndex((block) => block.action === 'move' && block.target === id);
}
