import type { VisualElementSpec, VisualSpec } from '../../types/visualSpec';
import type { GeometryBox } from '../builderGeometry';
import { createLabel } from '../shapeCatalog';
import type { PackObjectDef } from './stylePackFormat';

const LABEL_HEIGHT = 28;
// The strip starts a little away from the object so its outline never touches the text box.
const LABEL_GAP = 6;
// A caption under or over a small object may be wider than the object so a short name never wraps or clips.
const CAPTION_MIN_WIDTH = 80;

const slotId = (parentId: string, index: number): string => (index === 0 ? `${parentId}-label` : `${parentId}-label-${index + 1}`);

// The strip a label is centred in: the object itself, or the strip beside it that labelAt names, `lines` rows tall.
export function labelHostBox(box: GeometryBox, slot: string | undefined, lines = 1): GeometryBox {
  const strip = LABEL_HEIGHT * lines;
  const wide = Math.max(box.w, CAPTION_MIN_WIDTH);
  const caption = { x: box.x + box.w / 2 - wide / 2, w: wide };
  const hosts: Record<string, GeometryBox> = {
    below: { ...box, ...caption, y: box.y + box.h + LABEL_GAP, h: strip },
    top: { ...box, ...caption, y: box.y - strip - LABEL_GAP, h: strip },
    left: { ...box, x: box.x - box.w },
    right: { ...box, x: box.x + box.w },
  };
  return hosts[slot ?? ''] ?? box;
}

const isPlainLabel = (object: PackObjectDef): boolean => (object.lines ?? 1) === 1 && object.labelPrefix === undefined;

// One label child per line; the first carries the object's prefix. A single plain label stays lazy (made by the first text edit).
export function createLabelSlots(object: PackObjectDef, parentId: string, box: GeometryBox): VisualElementSpec[] {
  if (isPlainLabel(object) || object.labelAt === 'none') return [];
  const lines = object.lines ?? 1;
  const host = labelHostBox(box, object.labelAt, lines);
  const rowHeight = host.h / lines;
  return Array.from({ length: lines }, (_row, index) => ({
    ...createLabel(parentId, { ...host, y: host.y + index * rowHeight, h: rowHeight }, index === 0 ? (object.labelPrefix ?? '') : ''),
    id: slotId(parentId, index),
  }));
}

function withPrefix(text: string, prefix: string | undefined): string {
  return prefix === undefined || text.startsWith(prefix) ? text : `${prefix}${text}`;
}

// Line i goes to slot i; lines past the last slot stay joined in it so the cut is reported by cutLabelLineProblems, never silent.
export function distributeLabelText(object: PackObjectDef, text: string, slotCount: number): string[] {
  const rows = text.split('\n');
  const head = rows.slice(0, slotCount - 1);
  const tail = rows.slice(slotCount - 1).join('\n');
  return [...head, tail].map((row, index) => (index === 0 ? withPrefix(row, object.labelPrefix) : row));
}

export function slotsOf(spec: VisualSpec, parentId: string): VisualElementSpec[] {
  return spec.elements.filter((el) => el.builder?.parent === parentId && el.kind === 'math');
}

// Writes `text` into the object's slots; null when the object has none, so the caller keeps its single-label path.
export function writeSlotText(spec: VisualSpec, object: PackObjectDef, parentId: string, text: string): VisualSpec | null {
  const slots = slotsOf(spec, parentId);
  if (slots.length === 0 || isPlainLabel(object)) return null;
  const rows = distributeLabelText(object, text, slots.length);
  const byId = new Map(slots.map((slot, index) => [slot.id, rows[index] ?? ''] as const));
  return { ...spec, elements: spec.elements.map((el) => (byId.has(el.id) ? { ...el, content: byId.get(el.id) } : el)) };
}

// F3: a slot holds one line; extra lines past the last slot are clipped on stage, so they are reported.
export function cutLabelLineProblems(spec: VisualSpec, objectOf: (ref: string) => PackObjectDef | undefined): string[] {
  return spec.elements.flatMap((el) => {
    const ref = el.builder?.pack;
    const object = ref === undefined ? undefined : objectOf(ref);
    if (!object || object.lines === undefined) return [];
    const rows = slotsOf(spec, el.id).flatMap((slot) => (slot.content ?? '').split('\n'));
    return rows.length > object.lines ? [`element "${el.id}": ${rows.length} label lines but "${ref}" has ${object.lines} slots; the extra lines are cut`] : [];
  });
}
