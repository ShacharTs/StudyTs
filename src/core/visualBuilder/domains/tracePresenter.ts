import type { Point } from '../../geometry/geometryPrimitives';
import { parseViewBox } from '../../shared/stageSize';
import type { BuilderBlock, VisualSpec } from '../../types/visualSpec';
import { addBlock } from '../blocks';
import { COLOR_CHOICES } from '../builderColors';
import { isOwner, renameBuilderElement, resizeElement, setShapeText } from '../builderEdits';
import { boxCenter, elementBox } from '../builderGeometry';
import { addEffectAtStart, appendStep } from '../recipes';
import { addShapeAt } from '../sceneEdits';
import { algorithmText, isNamedAs } from './algorithmText';
import type { GraphModel } from './graph/graphModel';
import type { SearchSpec } from './search/searchSpec';
import type { GraphEvent, GraphTrace } from './trace';
import type { TraceStyle } from './traceStyle';

const block = (action: BuilderBlock['action'], target: string): BuilderBlock => ({ action, target, speed: 'normal' });
const tint = (target: string, name: string): BuilderBlock => ({ ...block('tint', target), color: COLOR_CHOICES.find((choice) => choice.name.toLowerCase() === name)?.value });

type Shown = Exclude<GraphEvent, { type: 'relax' }>;
type Discovery = Extract<GraphEvent, { type: 'discover' }>;

type Relaxation = Extract<GraphEvent, { type: 'relax' }>;

interface Group {
  head: Shown;
  found: Discovery[];
  relaxed: Relaxation[];
}

// perVisit: one step per start or visit with the discoveries that follow it; perEvent: one step per event.
function groupsOf(trace: GraphTrace, granularity: TraceStyle['granularity']): Group[] {
  return trace.reduce<Group[]>((groups, event) => {
    const last = groups[groups.length - 1];
    if (event.type === 'relax') return last ? [...groups.slice(0, -1), { ...last, relaxed: [...last.relaxed, event] }] : groups;
    const joins = event.type === 'discover' && last && granularity === 'perVisit';
    if (!joins) return [...groups, { head: event, found: [], relaxed: [] }];
    return [...groups.slice(0, -1), { ...last, found: [...last.found, event] }];
  }, []);
}

function blocksFor(group: Group, previous: string | null, style: TraceStyle): BuilderBlock[] {
  const { head } = group;
  const arriving = head.type === 'visit' || head.type === 'start';
  const calm = previous && arriving ? [block('calm', previous)] : [];
  const current = head.type === 'discover' ? [tint(head.vertex, style.colors.discovered)] : [block('highlight', head.vertex), tint(head.vertex, style.colors.visited)];
  const entered = head.type === 'visit' && head.edge ? [block('highlight', head.edge)] : [];
  const found = group.found.flatMap((event) => [tint(event.vertex, style.colors.discovered), block('highlight', event.edge)]);
  return [...calm, ...entered, ...current, ...found];
}

function frontierOf(group: Group): string[] {
  const last = group.found.at(-1) ?? group.head;
  return last.type === 'start' ? [] : last.frontier;
}

function titleOf(group: Group, model: GraphModel, style: TraceStyle, lang: string): string {
  const { head } = group;
  const key = head.type === 'start' ? 'start' : head.type === 'visit' ? 'visit' : 'discover';
  return algorithmText(style.captions[key], lang, { vertex: model.labelOf(head.vertex) });
}

function stripText(frontier: string[], order: string[], search: SearchSpec, style: TraceStyle, lang: string): string {
  const word = algorithmText(style.strip[search.frontier.policy], lang);
  return `${word}: [${frontier.join(', ')}]   ${algorithmText(style.strip.order, lang)}: ${order.join(' ')}`;
}

// The strip is a caption that exists for one step only: shown there, hidden again by the next step.
const STRIP_SIZE = { w: 380, h: 28 };
const STRIP_SPOTS = [
  { x: 0.5, y: 0.93 },
  { x: 0, y: 0.93 },
  { x: 1, y: 0.93 },
  { x: 0, y: 0.1 },
  { x: 1, y: 0.1 },
];

const touches = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// The first corner or edge spot the strip does not touch a shape or an earlier caption in; the bottom centre when all are taken.
function stripBox(spec: VisualSpec): { x: number; y: number; w: number; h: number } {
  const view = parseViewBox(spec.viewBox);
  const taken = spec.elements.filter((el) => isOwner(el) && el.builder?.fx !== true && !isNamedAs(el.builder?.name, 'nameStrip') && !isNamedAs(el.builder?.name, 'nameDistance')).map(elementBox);
  const margin = 12;
  const boxes = STRIP_SPOTS.map((spot) => ({
    x: spot.x === 0.5 ? view.w / 2 - STRIP_SIZE.w / 2 : spot.x === 0 ? margin : view.w - STRIP_SIZE.w - margin,
    y: view.h * spot.y - STRIP_SIZE.h / 2,
    ...STRIP_SIZE,
  }));
  return boxes.find((box) => taken.every((other) => !touches(box, other))) ?? boxes[0];
}

function withStrip(spec: VisualSpec, step: number, text: string, name: string): { spec: VisualSpec; id: string } {
  const box = stripBox(spec);
  const added = addShapeAt(spec, step, 'caption', { x: box.x + box.w / 2, y: box.y + box.h / 2 });
  const sized = resizeElement(added.spec, added.id, box);
  return { spec: setShapeText(renameBuilderElement(sized, added.id, name), added.id, text), id: added.id };
}

const hideStrip = (spec: VisualSpec, step: number, id: string | null): VisualSpec => (id ? addBlock(spec, step, block('hide', id)) : spec);

// A distance sits under its vertex from the step that learns it until a shorter one replaces it.
const DIRECTIONS = [90, -90, 0, 180, 45, -45, 135, -135].map((degrees) => (degrees * Math.PI) / 180);
const DISTANCE_SIZE = { w: 60, h: 22 };
const gap = (a: number, b: number): number => {
  const raw = Math.abs(a - b) % (2 * Math.PI);
  return raw > Math.PI ? 2 * Math.PI - raw : raw;
};

// The side of the vertex that no edge leaves by and that stays inside the stage, so the number never sits on a line.
function freeSide(spec: VisualSpec, model: GraphModel, vertex: string, centre: Point, radius: number): Point {
  // The label box must clear the outline whatever the direction, so the distance grows with the box's extent along it.
  const reachAt = (angle: number): number => radius + Math.abs(Math.cos(angle)) * (DISTANCE_SIZE.w / 2) + Math.abs(Math.sin(angle)) * (DISTANCE_SIZE.h / 2) + 6;
  const view = parseViewBox(spec.viewBox);
  const toward = model
    .neighbours(vertex)
    .flatMap((next) => {
      const el = spec.elements.find((candidate) => candidate.id === next.vertex);
      return el ? [Math.atan2(boxCenter(elementBox(el)).y - centre.y, boxCenter(elementBox(el)).x - centre.x)] : [];
    });
  const others = spec.elements.filter((el) => isOwner(el) && el.id !== vertex && el.builder?.fx !== true).map(elementBox);
  const inside = (angle: number): boolean => {
    const x = centre.x + Math.cos(angle) * reachAt(angle);
    const y = centre.y + Math.sin(angle) * reachAt(angle);
    const box = { x: x - DISTANCE_SIZE.w / 2, y: y - DISTANCE_SIZE.h / 2, ...DISTANCE_SIZE };
    const free = others.every((other) => box.x >= other.x + other.w || other.x >= box.x + box.w || box.y >= other.y + other.h || other.y >= box.y + box.h);
    return free && box.x >= 0 && box.x + box.w <= view.w && box.y >= 0 && box.y + box.h <= view.h;
  };
  const score = (angle: number): number => (inside(angle) ? Math.min(Math.PI, ...toward.map((used) => gap(angle, used))) : -1);
  const best = DIRECTIONS.reduce((chosen, angle) => (score(angle) > score(chosen) + 1e-6 ? angle : chosen), DIRECTIONS[0]);
  return { x: centre.x + Math.cos(best) * reachAt(best), y: centre.y + Math.sin(best) * reachAt(best) };
}

function withDistance(spec: VisualSpec, model: GraphModel, step: number, vertex: string, text: string, name: string, old: string | undefined): { spec: VisualSpec; id: string } | null {
  const element = spec.elements.find((el) => el.id === vertex);
  if (!element) return null;
  const box = elementBox(element);
  const at = freeSide(spec, model, vertex, boxCenter(box), Math.max(box.w, box.h) / 2);
  const added = addShapeAt(hideStrip(spec, step, old ?? null), step, 'caption', at);
  const sized = resizeElement(added.spec, added.id, { x: at.x - DISTANCE_SIZE.w / 2, y: at.y - DISTANCE_SIZE.h / 2, ...DISTANCE_SIZE });
  return { spec: setShapeText(renameBuilderElement(sized, added.id, name), added.id, text), id: added.id };
}

function withDistances(spec: VisualSpec, model: GraphModel, step: number, group: Group, shown: Map<string, string>, lang: string): VisualSpec {
  const learned = [
    ...(group.head.type === 'start' ? [{ vertex: group.head.vertex, distance: 0 }] : []),
    ...group.relaxed.filter((event) => event.improved).map((event) => ({ vertex: event.to, distance: event.distance })),
  ];
  return learned.reduce((current, { vertex, distance }) => {
    const written = withDistance(current, model, step, vertex, algorithmText('distance', lang, { value: String(distance) }), algorithmText('nameDistance', lang), shown.get(vertex));
    if (!written) return current;
    shown.set(vertex, written.id);
    return written.spec;
  }, spec);
}

export interface PresentInput {
  spec: VisualSpec;
  model: GraphModel;
  trace: GraphTrace;
  search: SearchSpec;
  style: TraceStyle;
  lang: string;
}

// Appends the trace as ordinary steps and blocks; nothing in the saved spec says an algorithm made them.
export function presentGraphTrace({ spec, model, trace, search, style, lang }: PresentInput): VisualSpec {
  const order: string[] = [];
  let previous: string | null = null;
  let strip: string | null = null;
  const distances = new Map<string, string>();
  let next = spec;
  groupsOf(trace, style.granularity).forEach((group) => {
    if (group.head.type === 'visit') order.push(model.labelOf(group.head.vertex));
    next = appendStep(next, titleOf(group, model, style, lang), blocksFor(group, previous, style));
    const step = next.steps.length - 1;
    next = hideStrip(next, step, strip);
    if (search.relax) next = withDistances(next, model, step, group, distances, lang);
    if (group.head.type === 'visit' && group.head.edge) next = addEffectAtStart(next, step, 'travel', group.head.edge);
    previous = group.head.type === 'discover' ? previous : group.head.vertex;
    const written = withStrip(next, step, stripText(frontierOf(group), order, search, style, lang), algorithmText('nameStrip', lang));
    next = written.spec;
    strip = written.id;
  });
  const done = appendStep(next, algorithmText(style.captions.done, lang, { order: order.join(' ') }), previous ? [block('calm', previous)] : []);
  return hideStrip(done, done.steps.length - 1, strip);
}
