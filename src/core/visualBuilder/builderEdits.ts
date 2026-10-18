import type { Point } from '../geometry/geometryPrimitives';
import type { BuilderShape, VisualElementSpec, VisualSpec, VisualStepSpec } from '../types/visualSpec';
import { BUILDER_TEXT } from '../../i18n/dictionary';
import { removeElement } from '../visualSpec/visualSpecEdits';
import { parseViewBox, type StageSize } from '../shared/stageSize';
import { nextId } from './builderIds';
import { boxesOverlap, clampBox, elementBox, MIN_SIZE, moveElement, setElementBox, type GeometryBox } from './builderGeometry';
import { createLabel, createShapeElements, labelBox, shapeLabel } from './shapeCatalog';
import { rerouteLinks } from './connectors';
import { writeSlotText } from './diagramPacks/packLabelSlots';
import { elementLabelHostBox } from './diagramPacks/packObjectElements';
import { packObjectByRef } from './diagramPacks/stylePackRegistry';

export const childrenOf = (spec: VisualSpec, id: string): VisualElementSpec[] => spec.elements.filter((el) => el.builder?.parent === id);

// A label or decoration belongs to its owner's group, so selecting or deleting it acts on the whole object.
export function groupMemberSpecs(spec: VisualSpec, id: string): VisualElementSpec[] {
  const el = spec.elements.find((candidate) => candidate.id === id);
  const owner = el?.builder?.parent ? spec.elements.find((candidate) => candidate.id === el.builder?.parent) : el;
  const group = owner?.builder?.group;
  if (!group) return el ? [el] : [];
  return spec.elements.filter((candidate) => candidate.builder?.group === group);
}

export function orphansOf(spec: VisualSpec): string[] {
  const allIds = new Set(spec.elements.map((el) => el.id));
  return spec.elements
    .filter((el) => {
      if (el.builder?.parent && !allIds.has(el.builder.parent)) return true;
      const link = el.builder?.link;
      if (link && (!allIds.has(link.from) || !allIds.has(link.to))) return true;
      return false;
    })
    .map((el) => el.id);
}

const sizeOf = (spec: VisualSpec): StageSize => parseViewBox(spec.viewBox);

function unionBox(boxes: GeometryBox[]): GeometryBox {
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  return { x, y, w: Math.max(...boxes.map((box) => box.x + box.w)) - x, h: Math.max(...boxes.map((box) => box.y + box.h)) - y };
}

// Shifts a group of shapes (labels follow, links are rerouted by the caller) so the group stays on the canvas.
function keepInside(spec: VisualSpec, elements: VisualElementSpec[]): VisualElementSpec[] {
  const owners = elements.filter((el) => !el.builder?.link && !el.builder?.parent);
  if (owners.length === 0) return elements;
  const box = unionBox(owners.map(elementBox));
  const inside = clampBox(box, sizeOf(spec));
  const dx = inside.x - box.x;
  const dy = inside.y - box.y;
  if (dx === 0 && dy === 0) return elements;
  return elements.map((el) => (el.builder?.link ? el : moveElement(el, dx, dy)));
}

export const isOwner = (el: VisualElementSpec): boolean => !el.builder?.say && !el.builder?.parent && !el.builder?.link;

function slotPositions(spec: VisualSpec): Point[] {
  const { w, h } = sizeOf(spec);
  const slots: Point[] = [];
  for (let y = 110; y <= h - 150; y += 110) {
    for (let x = 120; x <= w - 120; x += 160) slots.push({ x, y });
  }
  return slots;
}

// The first grid slot where the new shape's box (after clamping) overlaps no existing shape, or the middle when the canvas is full.
export type ElementsFactory = (id: string, at: Point, viewWidth: number) => VisualElementSpec[];

const presetFactory = (shape: BuilderShape): ElementsFactory => (id, at, viewWidth) => createShapeElements(shape, id, at, viewWidth);

function freeSlotElements(spec: VisualSpec, make: ElementsFactory, id: string, taken: GeometryBox[]): VisualElementSpec[] {
  const middle = { x: sizeOf(spec).w / 2, y: (sizeOf(spec).h - 110) / 2 };
  let fallback: VisualElementSpec[] | null = null;
  for (const slot of [...slotPositions(spec), middle]) {
    const placed = keepInside(spec, make(id, slot, sizeOf(spec).w));
    fallback ??= placed;
    const box = unionBox(placed.filter(isOwner).map(elementBox));
    if (taken.every((other) => !boxesOverlap(box, other))) return placed;
  }
  return fallback ?? [];
}

export function nextFreePosition(spec: VisualSpec): Point {
  const taken = spec.elements.filter(isOwner).map(elementBox);
  const free = slotPositions(spec).find((slot) => taken.every((box) => !boxesOverlap({ x: slot.x - 45, y: slot.y - 45, w: 90, h: 90 }, box)));
  return free ?? { x: sizeOf(spec).w / 2, y: (sizeOf(spec).h - 110) / 2 };
}

export function addShape(spec: VisualSpec, shape: BuilderShape, at?: Point): { spec: VisualSpec; id: string } {
  return appendShape(spec, shape, spec.elements.filter(isOwner).map(elementBox), at);
}

// `taken` is the set of boxes a free slot must avoid, so a step-scoped add can ignore what is not on screen.
export function appendShape(spec: VisualSpec, shape: BuilderShape, taken: GeometryBox[], at?: Point): { spec: VisualSpec; id: string } {
  return appendObject(spec, shape, presetFactory(shape), taken, at);
}

// Same placement rules for any object; `make` draws it once a slot is chosen.
export function appendObject(spec: VisualSpec, prefix: string, make: ElementsFactory, taken: GeometryBox[], at?: Point): { spec: VisualSpec; id: string } {
  const id = nextId(prefix, spec.elements.map((el) => el.id));
  const created = at ? keepInside(spec, make(id, at, sizeOf(spec).w)) : freeSlotElements(spec, make, id, taken);
  return { spec: { ...spec, elements: [...spec.elements, ...created] }, id };
}


export function addLabelledShape(spec: VisualSpec, shape: BuilderShape, label: string, at?: Point): { spec: VisualSpec; id: string } {
  const added = addShape(spec, shape, at);
  return { spec: setElementText(added.spec, added.id, label), id: added.id };
}

// Moves shapes (and their labels) and re-routes connectors.
export function moveElements(spec: VisualSpec, ids: string[], dx: number, dy: number): VisualSpec {
  const moving = new Set(ids.flatMap((id) => [id, ...childrenOf(spec, id).map((child) => child.id)]));
  const moved = spec.elements.filter((el) => moving.has(el.id)).map((el) => moveElement(el, dx, dy));
  const placed = new Map(keepInside(spec, moved).map((el) => [el.id, el]));
  return rerouteLinks({ ...spec, elements: spec.elements.map((el) => placed.get(el.id) ?? el) });
}

// A zero-step move: keepInside pulls the shape back onto the canvas.
export function bringInside(spec: VisualSpec, id: string): VisualSpec {
  return moveElements(spec, [id], 0, 0);
}

// A label re-centres; a pack decoration keeps its place relative to the parent box.
function refitChild(child: VisualElementSpec, from: GeometryBox, to: GeometryBox): VisualElementSpec {
  if (child.kind === 'math') return setElementBox(child, labelBox(to));
  const own = elementBox(child);
  const scaleX = from.w === 0 ? 1 : to.w / from.w;
  const scaleY = from.h === 0 ? 1 : to.h / from.h;
  return setElementBox(child, { x: to.x + (own.x - from.x) * scaleX, y: to.y + (own.y - from.y) * scaleY, w: own.w * scaleX, h: own.h * scaleY });
}

// Resizes a shape, re-centres its label and re-routes connectors.
export function resizeElement(spec: VisualSpec, id: string, requested: GeometryBox): VisualSpec {
  const canvas = sizeOf(spec);
  const x = Math.min(Math.max(0, requested.x), canvas.w - MIN_SIZE);
  const y = Math.min(Math.max(0, requested.y), canvas.h - MIN_SIZE);
  const box = { x, y, w: Math.min(requested.w, Math.max(MIN_SIZE, canvas.w - x)), h: Math.min(requested.h, Math.max(MIN_SIZE, canvas.h - y)) };
  const resized = spec.elements.map((el) => (el.id === id ? setElementBox(el, box) : el));
  const parent = resized.find((el) => el.id === id);
  const before = spec.elements.find((el) => el.id === id);
  const elements = parent && before ? resized.map((el) => (el.builder?.parent === id ? refitChild(el, elementBox(before), elementBox(parent)) : el)) : resized;
  return rerouteLinks({ ...spec, elements });
}

// Sets style keys (undefined deletes one). Changing the outline also changes the glow colour.
export function setElementStyle(spec: VisualSpec, id: string, patch: Record<string, number | string | undefined>): VisualSpec {
  const elements = spec.elements.map((el) => {
    if (el.id !== id) return el;
    const style: Record<string, number | string> = { ...el.style };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete style[key];
      else style[key] = value;
    }
    if (typeof patch.stroke === 'string' && patch.stroke !== 'none') style.color = patch.stroke;
    return { ...el, style };
  });
  return { ...spec, elements };
}

// Text of a shape: its own content (text, note) or the label that belongs to it (created when missing).
export function setElementText(spec: VisualSpec, id: string, text: string): VisualSpec {
  const el = spec.elements.find((candidate) => candidate.id === id);
  if (!el) return spec;
  if (el.kind === 'math' || el.kind === 'bubble' || el.kind === 'text') {
    return { ...spec, elements: spec.elements.map((candidate) => (candidate.id === id ? { ...candidate, content: text } : candidate)) };
  }
  const object = packObjectByRef(el.builder?.pack);
  const slotted = object ? writeSlotText(spec, object, id, text) : null;
  if (slotted) return slotted;
  const label = childrenOf(spec, id).find((child) => child.kind === 'math');
  if (label) return { ...spec, elements: spec.elements.map((candidate) => (candidate.id === label.id ? { ...candidate, content: text } : candidate)) };
  const index = spec.elements.indexOf(el);
  const elements = [...spec.elements];
  elements.splice(index + 1, 0, createLabel(id, elementLabelHostBox(el), text));
  return { ...spec, elements };
}

function doomedIds(spec: VisualSpec, ids: string[]): Set<string> {
  const expanded = ids.flatMap((id) => groupMemberSpecs(spec, id).map((m) => m.id));
  const doomed = new Set(expanded.flatMap((id) => [id, ...childrenOf(spec, id).map((child) => child.id)]));
  const touchesDoomed = (el: VisualElementSpec): boolean => {
    const link = el.builder?.link;
    return link !== undefined && (doomed.has(link.from) || doomed.has(link.to));
  };
  spec.elements.filter(touchesDoomed).forEach((el) => doomed.add(el.id));
  return doomed;
}

function withoutBlocksOn(step: VisualStepSpec, doomed: Set<string>): VisualStepSpec {
  const blocks = step.builder?.blocks;
  if (!blocks) return step;
  return { ...step, builder: { ...step.builder, blocks: blocks.filter((block) => !block.target || !doomed.has(block.target)) } };
}

// Deletes shapes with their labels, connectors touching them, tween targets and blocks that reference them.
export function deleteElements(spec: VisualSpec, ids: string[]): VisualSpec {
  const doomed = doomedIds(spec, ids);
  const next = [...doomed].reduce(removeElement, spec);
  return { ...next, steps: next.steps.map((step) => withoutBlocksOn(step, doomed)) };
}

export function duplicateElement(spec: VisualSpec, id: string): { spec: VisualSpec; id: string } | null {
  const source = spec.elements.find((el) => el.id === id);
  if (!source || source.builder?.link) return null;
  const newId = nextId(source.builder?.shape ?? source.kind, spec.elements.map((el) => el.id));
  const copies = [source, ...childrenOf(spec, id)].map((el) => {
    const moved = moveElement(el, 24, 24);
    if (el.id === id) return { ...moved, id: newId };
    return { ...moved, id: `${newId}${el.id.slice(id.length)}`, builder: { ...moved.builder, parent: newId } };
  });
  return { spec: { ...spec, elements: [...spec.elements, ...keepInside(spec, copies)] }, id: newId };
}

// Front = last (drawn on top); back = just above the connectors, which always stay at the bottom.
export function moveInOrder(spec: VisualSpec, id: string, where: 'front' | 'back'): VisualSpec {
  const group = spec.elements.filter((el) => el.id === id || el.builder?.parent === id);
  const rest = spec.elements.filter((el) => !group.includes(el));
  if (where === 'front') return { ...spec, elements: [...rest, ...group] };
  const firstShape = rest.findIndex((el) => !el.builder?.link);
  const at = firstShape === -1 ? rest.length : firstShape;
  return { ...spec, elements: [...rest.slice(0, at), ...group, ...rest.slice(at)] };
}

const TEXT_KINDS = ['math', 'bubble', 'text'];

const plain = (text: string): string => text.replace(/[*$\\]/g, '').trim().slice(0, 24);

// An arrow's lane row reads from its ends, since the arrow itself cannot be named.
function endpointName(spec: VisualSpec, id: string): string {
  const el = spec.elements.find((candidate) => candidate.id === id);
  if (el?.builder?.name) return el.builder.name;
  const text = el && TEXT_KINDS.includes(el.kind) ? el.content : childrenOf(spec, id).find((child) => child.kind === 'math')?.content;
  const name = text ? plain(text) : '';
  return name || id;
}

// The words around an element's name, so a caller can speak any language; the default is English from the builder table.
export interface ElementWords {
  arrow: (from: string, to: string) => string;
  labelled: (shape: string, label: string) => string;
  identified: (shape: string, id: string) => string;
  shape: (shape?: BuilderShape) => string;
}

const fillWords = (text: string, values: Record<string, string>): string => text.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? '');

export const ENGLISH_ELEMENT_WORDS: ElementWords = {
  arrow: (from, to) => fillWords(BUILDER_TEXT.nameArrow.en, { from, to }),
  labelled: (shape, label) => fillWords(BUILDER_TEXT.nameLabelled.en, { shape, label }),
  identified: (shape, id) => fillWords(BUILDER_TEXT.nameIdentified.en, { shape, id }),
  shape: shapeLabel,
};

export function describeElementWith(spec: VisualSpec, id: string, words: ElementWords): string {
  const el = spec.elements.find((candidate) => candidate.id === id);
  if (!el) return id;
  if (el.builder?.name) return el.builder.name;
  if (el.builder?.link) return words.arrow(endpointName(spec, el.builder.link.from), endpointName(spec, el.builder.link.to));
  const isText = TEXT_KINDS.includes(el.kind);
  const label = isText ? el.content : childrenOf(spec, id).find((child) => child.kind === 'math')?.content;
  const name = words.shape(el.builder?.shape);
  // The text is the name: a labelled shape is named by its text alone.
  return label ? plain(label) : words.identified(name, id);
}

export const describeElement = (spec: VisualSpec, id: string): string => describeElementWith(spec, id, ENGLISH_ELEMENT_WORDS);

function isNameable(el: { builder?: { link?: unknown; parent?: unknown } } | undefined): boolean {
  if (!el) return false;
  return !el.builder?.link && !el.builder?.parent;
}

// Renames a shape; labels and links are not nameable (they follow their shape).
export function renameBuilderElement(spec: VisualSpec, id: string, name: string): VisualSpec {
  const el = spec.elements.find((candidate) => candidate.id === id);
  if (!isNameable(el)) return spec;
  const trimmed = name.trim();
  const rest = Object.fromEntries(Object.entries(el?.builder ?? {}).filter(([key]) => key !== 'name'));
  const builder = trimmed ? { ...rest, name: trimmed } : rest;
  return { ...spec, elements: spec.elements.map((candidate) => (candidate.id === id ? { ...candidate, builder } : candidate)) };
}

const labelOf = (spec: VisualSpec, id: string): VisualElementSpec | undefined => childrenOf(spec, id).find((child) => child.kind === 'math');

export const hasLabel = (spec: VisualSpec, id: string): boolean => labelOf(spec, id) !== undefined;

export function canAddLabel(spec: VisualSpec, id: string): boolean {
  const el = spec.elements.find((candidate) => candidate.id === id);
  return el !== undefined && !el.builder?.link && !TEXT_KINDS.includes(el.kind) && !hasLabel(spec, id);
}

export function removeLabel(spec: VisualSpec, id: string): VisualSpec {
  const label = labelOf(spec, id);
  return label ? deleteElements(spec, [label.id]) : spec;
}

export function elementText(spec: VisualSpec, id: string): string {
  const el = spec.elements.find((candidate) => candidate.id === id);
  return labelOf(spec, id)?.content ?? el?.content ?? '';
}

// Inline editing: blank text removes a shape's label instead of leaving an empty one.
export function setShapeText(spec: VisualSpec, id: string, text: string): VisualSpec {
  const el = spec.elements.find((candidate) => candidate.id === id);
  if (el && text.trim() === '' && !TEXT_KINDS.includes(el.kind)) return removeLabel(spec, id);
  return setElementText(spec, id, text);
}

// Omitted at normal speed so specs that never set a speed stay byte-identical.
export function setSpecSpeed(spec: VisualSpec, speed: number): VisualSpec {
  const next = { ...spec };
  delete next.speed;
  return speed === 1 ? next : { ...next, speed };
}
