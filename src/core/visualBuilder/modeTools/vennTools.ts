import type { Point } from '../../geometry/geometryPrimitives';
import { parseViewBox } from '../../shared/stageSize';
import type { VisualSpec } from '../../types/visualSpec';
import type { VisualElementSpec } from '../../types/visualSpec';
import { COLOR_CHOICES, DEFAULT_SHAPE_COLOR } from '../builderColors';
import { deleteElements, isOwner, moveElements, resizeElement, setElementStyle } from '../builderEdits';
import { elementBox, type GeometryBox } from '../builderGeometry';
import { addPackObjectAtStep } from '../sceneEdits';

export const SET_REF = 'sets/set';
export const ELEMENT_REF = 'sets/element';
export const MIN_SETS = 2;
export const MAX_SETS = 6;

// Mock v2 units on a 900 wide canvas; everything scales with the view width.
const MOCK_WIDTH = 900;
const RING_RADIUS = { few: 70, many: 105 };
const SET_RADIUS = { few: 130, many: 105 };
const RING_RISE = 10;

const scaleOf = (spec: VisualSpec): number => parseViewBox(spec.viewBox).w / MOCK_WIDTH;

export function ringPositions(count: number, centre: Point, radius: number): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    return { x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) };
  });
}

const ringCentre = (spec: VisualSpec): Point => {
  const size = parseViewBox(spec.viewBox);
  return { x: size.w / 2, y: size.h / 2 + RING_RISE * scaleOf(spec) };
};

const ringRadiusFor = (spec: VisualSpec, count: number): number => (count === 2 ? RING_RADIUS.few : RING_RADIUS.many) * scaleOf(spec);
const setRadiusFor = (spec: VisualSpec, count: number): number => (count >= 4 ? SET_RADIUS.many : SET_RADIUS.few) * scaleOf(spec);

export const setIdsOf = (spec: VisualSpec): string[] =>
  spec.elements.filter((el) => isOwner(el) && el.builder?.pack === SET_REF).map((el) => el.id);

const centreOf = (box: GeometryBox): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

export function membershipOf(spec: VisualSpec, elementId: string): string[] {
  const element = spec.elements.find((el) => el.id === elementId);
  if (!element) return [];
  const at = centreOf(elementBox(element));
  return setIdsOf(spec).filter((id) => {
    const box = elementBox(spec.elements.find((el) => el.id === id)!);
    const centre = centreOf(box);
    return Math.hypot(at.x - centre.x, at.y - centre.y) <= box.w / 2;
  });
}

export const regionCount = (setCount: number): number => 2 ** setCount - 1;

const SET_COLOUR_NAMES = ['Blue', 'Orange', 'Green', 'Purple', 'Pink', 'Cyan'];

// Each set takes the next colour of the cycle so the regions can be told apart.
function colourOf(index: number): { stroke: string; fill: string } {
  const name = SET_COLOUR_NAMES[index % SET_COLOUR_NAMES.length];
  const value = COLOR_CHOICES.find((choice) => choice.name === name)?.value ?? DEFAULT_SHAPE_COLOR;
  return { stroke: value, fill: value };
}

// Adds the next set at its ring slot (existing sets stay where the user put them) or removes the last one.
export function setSetCount(spec: VisualSpec, requested: number): VisualSpec {
  const target = Math.min(MAX_SETS, Math.max(MIN_SETS, requested));
  let next = spec;
  let ids = setIdsOf(next);
  while (ids.length > target) {
    next = deleteElements(next, [ids[ids.length - 1]]);
    ids = setIdsOf(next);
  }
  while (ids.length < target) {
    const slot = ringPositions(ids.length + 1, ringCentre(next), ringRadiusFor(next, ids.length + 1))[ids.length];
    const added = addPackObjectAtStep(next, 0, SET_REF, slot);
    if (!added) return next;
    const radius = setRadiusFor(next, ids.length + 1);
    const sized = resizeElement(added.spec, added.id, { x: slot.x - radius, y: slot.y - radius, w: radius * 2, h: radius * 2 });
    next = setElementStyle(sized, added.id, colourOf(ids.length));
    ids = setIdsOf(next);
  }
  return next;
}

// Puts every set back on the ring at the default radius; elements stay where they are.
export function layoutRing(spec: VisualSpec): VisualSpec {
  const ids = setIdsOf(spec);
  const radius = setRadiusFor(spec, ids.length);
  const slots = ringPositions(ids.length, ringCentre(spec), ringRadiusFor(spec, ids.length));
  return ids.reduce((acc, id, index) => {
    const resized = resizeElement(acc, id, { x: slots[index].x - radius, y: slots[index].y - radius, w: radius * 2, h: radius * 2 });
    const box = elementBox(resized.elements.find((el) => el.id === id)!);
    const centre = centreOf(box);
    return moveElements(resized, [id], slots[index].x - centre.x, slots[index].y - centre.y);
  }, spec);
}

export function addElementAt(spec: VisualSpec, at: Point): { spec: VisualSpec; id: string } | null {
  return addPackObjectAtStep(spec, 0, ELEMENT_REF, at);
}

const OVERLAP_PREFIX = 'overlap-';
const REGION_OPACITY = 0.45;
const regionVisibility = (shown: boolean): { fillOpacity: number } => ({ fillOpacity: shown ? REGION_OPACITY : 0 });
const OVERLAP_STYLE = { fill: 'var(--accent)', stroke: 'none', ...regionVisibility(true) } as const;

interface Disc {
  x: number;
  y: number;
  r: number;
}

const discOf = (el: VisualElementSpec): Disc => {
  const box = elementBox(el);
  return { x: box.x + box.w / 2, y: box.y + box.h / 2, r: box.w / 2 };
};

// The lens two discs share: two arcs, each the part of one circle that lies inside the other. Null when they do not overlap.
export function overlapPath(a: Disc, b: Disc): string | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d === 0 || d >= a.r + b.r || d <= Math.abs(a.r - b.r)) return null;
  const along = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const half = Math.sqrt(Math.max(0, a.r * a.r - along * along));
  const ux = dx / d;
  const uy = dy / d;
  const foot = { x: a.x + ux * along, y: a.y + uy * along };
  const p1 = { x: foot.x - uy * half, y: foot.y + ux * half };
  const p2 = { x: foot.x + uy * half, y: foot.y - ux * half };
  const sweep = (from: Point, via: Point, to: Point): number => ((via.x - from.x) * (to.y - via.y) - (via.y - from.y) * (to.x - via.x) > 0 ? 1 : 0);
  const viaA = { x: a.x + ux * a.r, y: a.y + uy * a.r };
  const viaB = { x: b.x - ux * b.r, y: b.y - uy * b.r };
  const bigA = along < 0 ? 1 : 0;
  const bigB = d - along < 0 ? 1 : 0;
  const n = (value: number): number => Math.round(value * 10) / 10;
  return `M ${n(p1.x)} ${n(p1.y)} A ${n(a.r)} ${n(a.r)} 0 ${bigA} ${sweep(p1, viaA, p2)} ${n(p2.x)} ${n(p2.y)} A ${n(b.r)} ${n(b.r)} 0 ${bigB} ${sweep(p2, viaB, p1)} ${n(p1.x)} ${n(p1.y)} Z`;
}

export const overlapIdsOf = (spec: VisualSpec): string[] => spec.elements.filter((el) => el.id.startsWith(OVERLAP_PREFIX)).map((el) => el.id);

const isRegion = (el: VisualElementSpec): boolean => el.id.startsWith(OVERLAP_PREFIX);

// Hiding keeps the region elements: a step block that targets one must still find it.
export function toggleOverlaps(spec: VisualSpec): VisualSpec {
  const regions = spec.elements.filter(isRegion);
  if (regions.length > 0) {
    const show = regions.some((el) => el.style?.fillOpacity === 0);
    return { ...spec, elements: spec.elements.map((el) => (isRegion(el) ? { ...el, style: { ...el.style, ...regionVisibility(show) } } : el)) };
  }
  const sets = setIdsOf(spec).map((id) => ({ id, disc: discOf(spec.elements.find((el) => el.id === id)!) }));
  const lenses = sets.flatMap((first, index) =>
    sets.slice(index + 1).flatMap((second): VisualElementSpec[] => {
      const d = overlapPath(first.disc, second.disc);
      return d ? [regionElement(`${first.id}-${second.id}`, d)] : [];
    }),
  );
  const triples = sets.flatMap((first, i) =>
    sets.slice(i + 1).flatMap((second, j) =>
      sets.slice(i + j + 2).flatMap((third): VisualElementSpec[] => {
        const d = tripleRegionPath([first.disc, second.disc, third.disc]);
        return d ? [regionElement(`${first.id}-${second.id}-${third.id}`, d)] : [];
      }),
    ),
  );
  // Just above the last set: over the universe box (which is filled) and under the labels and elements.
  const lastSet = Math.max(...sets.map((entry) => spec.elements.findIndex((el) => el.id === entry.id)));
  const elements = [...spec.elements.slice(0, lastSet + 1), ...lenses, ...triples, ...spec.elements.slice(lastSet + 1)];
  return { ...spec, elements };
}

const regionElement = (ids: string, d: string): VisualElementSpec => ({ id: `${OVERLAP_PREFIX}${ids}`, kind: 'path', attrs: { d }, style: { ...OVERLAP_STYLE } });

// The triple piece is convex (an intersection of discs), so the hull of the circle samples that lie inside all three is the piece.
// ponytail: 96 samples per circle, straight chords; raise TRIPLE_SAMPLES if the edge reads faceted.
const TRIPLE_SAMPLES = 96;

const inDisc = (p: Point, d: Disc): boolean => Math.hypot(p.x - d.x, p.y - d.y) <= d.r + 1e-6;

const samplesOf = (d: Disc): Point[] =>
  Array.from({ length: TRIPLE_SAMPLES }, (_, i) => ({ x: d.x + d.r * Math.cos((2 * Math.PI * i) / TRIPLE_SAMPLES), y: d.y + d.r * Math.sin((2 * Math.PI * i) / TRIPLE_SAMPLES) }));

export function tripleRegionPath(discs: Disc[]): string | null {
  const inside = discs.flatMap((disc) => samplesOf(disc).filter((p) => discs.every((other) => inDisc(p, other))));
  const hull = convexHull(inside);
  if (hull.length < 3) return null;
  const n = (value: number): number => Math.round(value * 10) / 10;
  return `M ${hull.map((p) => `${n(p.x)} ${n(p.y)}`).join(' L ')} Z`;
}

// Andrew's monotone chain, counter-clockwise, no repeated first point.
function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((p, q) => p.x - q.x || p.y - q.y);
  const turn = (o: Point, a: Point, b: Point): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const chain = (list: Point[]): Point[] => list.reduce<Point[]>((out, p) => {
    while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
    return [...out, p];
  }, []);
  const lower = chain(sorted);
  const upper = chain([...sorted].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
