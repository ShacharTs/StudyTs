import type { Point } from '../geometry/geometryPrimitives';
import { flattenPath, pointAtFraction } from '../geometry/pathSegments';
import type { BuilderSide, LinkRoute, VisualElementBuilder, VisualElementSpec, VisualSpec } from '../types/visualSpec';
import { DEFAULT_SHAPE_COLOR, GLOW_OFF } from './builderColors';
import { nextId } from './builderIds';
import { boxCenter, elementBox, endLabelBox, headPath, linePath, round, type ArrowHeadStyle } from './builderGeometry';
import { elementPortPoint } from './elementPortPoint';
import type { GeometryBox } from './builderGeometry';

type LinkData = NonNullable<VisualElementBuilder['link']>;

export interface LinkPlacement {
  route?: LinkRoute;
  fromPort?: BuilderSide | null;
  toPort?: BuilderSide | null;
}

const CURVE_PULL = 70;
const CURVE_PULL_SHARE = 0.5;
const CURVE_PULL_FLOOR = 0.15;
const NORMALS: Record<BuilderSide, Point> = { e: { x: 1, y: 0 }, w: { x: -1, y: 0 }, n: { x: 0, y: -1 }, s: { x: 0, y: 1 } };
const LABEL_SIZE = { w: 56, h: 22 };
const LABEL_GAP = 18;
// A loop carries a short symbol set, so its label box is small and sits close to the loop.
const LOOP_LABEL_SIZE = { w: 32, h: 22 };
const LOOP_LABEL_GAP = 6;
const LABEL_CHAR_WIDTH = 8;
const LABEL_PAD = 14;

// Where a line from the element's centre toward `toward` leaves the element's outline.
function edgePoint(el: VisualElementSpec, toward: Point): Point {
  const box = elementBox(el);
  const center = boxCenter(box);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const rx = Math.max(box.w / 2, 1);
  const ry = Math.max(box.h / 2, 1);
  let scale: number;
  if (el.kind === 'circle' || el.kind === 'ellipse') scale = 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2);
  else if (el.builder?.shape === 'diamond') scale = 1 / (Math.abs(dx) / rx + Math.abs(dy) / ry);
  else scale = 1 / Math.max(Math.abs(dx) / rx, Math.abs(dy) / ry);
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

function plainPath(from: VisualElementSpec, to: VisualElementSpec, arrow: boolean, headStyle: ArrowHeadStyle = 'notched'): string {
  const fromCenter = boxCenter(elementBox(from));
  const toCenter = boxCenter(elementBox(to));
  return linePath(edgePoint(from, toCenter), edgePoint(to, fromCenter), arrow, headStyle);
}

type Ends = { p: Point; q: Point; fromSide: BuilderSide; toSide: BuilderSide; fromNormal?: Point; toNormal?: Point };
interface Routed { d: string; direction: Point }

const unit = (a: Point, b: Point): Point => {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
};
const polyline = (points: Point[]): string => points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${round(pt.x)} ${round(pt.y)}`).join(' ');

// The sides that face each other: along the axis with the larger gap between the outlines, so a link never has to hook around
// two shapes that are almost touching on the axis it leaves by.
function facingSides(a: GeometryBox, b: GeometryBox): [BuilderSide, BuilderSide] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  const gapX = Math.abs(dx) - (a.w + b.w) / 2;
  const gapY = Math.abs(dy) - (a.h + b.h) / 2;
  if (gapX >= gapY) return dx >= 0 ? ['e', 'w'] : ['w', 'e'];
  return dy >= 0 ? ['s', 'n'] : ['n', 's'];
}

const isHorizontal = (side: BuilderSide): boolean => side === 'e' || side === 'w';

// Leaving and arriving along the same axis gives a Z; leaving along one axis and arriving along the other gives an L.
function elbowRoute({ p, q, fromSide, toSide }: Ends): Routed {
  const horizontal = isHorizontal(fromSide);
  if (horizontal !== isHorizontal(toSide)) {
    const corner = horizontal ? { x: q.x, y: p.y } : { x: p.x, y: q.y };
    return { d: polyline([p, corner, q]), direction: unit(corner, q) };
  }
  const mid = horizontal ? (p.x + q.x) / 2 : (p.y + q.y) / 2;
  const bend1 = horizontal ? { x: mid, y: p.y } : { x: p.x, y: mid };
  const bend2 = horizontal ? { x: mid, y: q.y } : { x: q.x, y: mid };
  return { d: polyline([p, bend1, bend2, q]), direction: unit(bend2, q) };
}

// Close ends pull less, otherwise the curve overshoots into a loop between two neighbouring shapes.
function curveRoute({ p, q, fromSide, toSide, fromNormal, toNormal }: Ends): Routed {
  const distance = Math.hypot(q.x - p.x, q.y - p.y);
  // An arc leaves sideways to its ends, so its height comes from the whole distance, not from the span on the leaving axis.
  const span = fromNormal ? distance : isHorizontal(fromSide) ? Math.abs(q.x - p.x) : Math.abs(q.y - p.y);
  const pull = Math.min(CURVE_PULL, Math.max(span * CURVE_PULL_SHARE, distance * CURVE_PULL_FLOOR));
  const [out, into] = [fromNormal ?? NORMALS[fromSide], toNormal ?? NORMALS[toSide]];
  const c1 = { x: p.x + out.x * pull, y: p.y + out.y * pull };
  const c2 = { x: q.x + into.x * pull, y: q.y + into.y * pull };
  return { d: `M ${round(p.x)} ${round(p.y)} C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(q.x)} ${round(q.y)}`, direction: unit(c2, q) };
}

const straightRoute = ({ p, q }: Ends): Routed => ({ d: polyline([p, q]), direction: unit(p, q) });
const ROUTES: Record<LinkRoute, (ends: Ends) => Routed> = { straight: straightRoute, elbow: elbowRoute, curve: curveRoute };

const DIAGONAL = Math.SQRT1_2;

// Two curves between neighbours that both leave by the top (or bottom) arc over, like the textbook automaton: each end sits on the
// shape's outline at 45 degrees toward the other shape instead of at the very top, where the curve would stand up like an ear.
function arcEnds(from: VisualElementSpec, to: VisualElementSpec, side: BuilderSide): Partial<Ends> | null {
  const a = boxCenter(elementBox(from));
  const b = boxCenter(elementBox(to));
  const across = Math.sign(b.x - a.x);
  if (across === 0 || (side !== 'n' && side !== 's')) return null;
  const up = side === 'n' ? -1 : 1;
  const [outward, inward] = [{ x: across * DIAGONAL, y: up * DIAGONAL }, { x: -across * DIAGONAL, y: up * DIAGONAL }];
  const at = (el: VisualElementSpec, centre: Point, direction: Point): Point => edgePoint(el, { x: centre.x + direction.x * 1000, y: centre.y + direction.y * 1000 });
  return { p: at(from, a, outward), q: at(to, b, inward), fromNormal: outward, toNormal: inward };
}

// A bent link is a cubic whose midpoint sits `bend` px off the straight chord, so the user can push it either way.
function bentPath(from: VisualElementSpec, to: VisualElementSpec, link: LinkData): string {
  const fromCenter = boxCenter(elementBox(from));
  const toCenter = boxCenter(elementBox(to));
  const p = edgePoint(from, toCenter);
  const q = edgePoint(to, fromCenter);
  const length = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  const normal = { x: -(q.y - p.y) / length, y: (q.x - p.x) / length };
  const middle = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const bend = link.bend ?? 0;
  const control = { x: middle.x + normal.x * 2 * bend, y: middle.y + normal.y * 2 * bend };
  const c1 = { x: p.x + (2 / 3) * (control.x - p.x), y: p.y + (2 / 3) * (control.y - p.y) };
  const c2 = { x: q.x + (2 / 3) * (control.x - q.x), y: q.y + (2 / 3) * (control.y - q.y) };
  const body = `M ${round(p.x)} ${round(p.y)} C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(q.x)} ${round(q.y)}`;
  return link.arrow ? `${body} ${headPath(q, unit(c2, q), link.head ?? 'notched')}` : body;
}

function routedPath(from: VisualElementSpec, to: VisualElementSpec, link: LinkData): string {
  // The bend is the user's explicit curve, so it wins over the route until it is set back to zero.
  if (link.bend) return bentPath(from, to, link);
  const a = elementBox(from);
  const b = elementBox(to);
  const [fromFacing, toFacing] = facingSides(a, b);
  const fromSide = link.fromPort ?? fromFacing;
  const toSide = link.toPort ?? toFacing;
  const arc = link.route === 'curve' && fromSide === toSide ? arcEnds(from, to, fromSide) : null;
  const ends: Ends = { fromSide, toSide, p: elementPortPoint(from, fromSide), q: elementPortPoint(to, toSide), ...arc };
  const routed = ROUTES[link.route ?? 'straight'](ends);
  return link.arrow ? `${routed.d} ${headPath(ends.q, routed.direction, link.head ?? 'notched')}` : routed.d;
}

const isPlain = (link: LinkData): boolean => link.route === undefined && link.fromPort === undefined && link.toPort === undefined && !link.bend;

const LOOP_SHAPE = {
  halfAngle: 0.6,
  reach: 3.2,
  bulge: 0.8,
};
const LOOP_HALF_ANGLE = LOOP_SHAPE.halfAngle;
const LOOP_REACH = LOOP_SHAPE.reach;
const LOOP_BULGE = LOOP_SHAPE.bulge;
const LOOP_HEAD_CLEARANCE = 3;
const LOOP_NEIGHBOUR_RANGE = 1.6;
const LOOP_CANDIDATES = [-90, 180, 0, 90, -135, -45, 135, 45].map((deg) => (deg * Math.PI) / 180);
const SIDE_ANGLE: Record<BuilderSide, number> = { e: 0, s: Math.PI / 2, w: Math.PI, n: -Math.PI / 2 };

const angleGap = (a: number, b: number): number => {
  const raw = Math.abs(a - b) % (2 * Math.PI);
  return raw > Math.PI ? 2 * Math.PI - raw : raw;
};

const isLoopOn = (el: VisualElementSpec, shape: VisualElementSpec): boolean => {
  const link = el.builder?.link;
  return link !== undefined && link.from === link.to && link.from === shape.id;
};

// A loop starts LOOP_HALF_ANGLE before its side, so the side is read back from the start point.
function loopSide(el: VisualElementSpec, shape: VisualElementSpec): number {
  const centre = boxCenter(elementBox(shape));
  const [, x, y] = String(el.attrs.d ?? '').split(' ');
  return Math.atan2(Number(y) - centre.y, Number(x) - centre.x) + LOOP_HALF_ANGLE;
}

// The side of a shape no other link uses, so a loop never lands on an arc: sides facing a neighbour, a chosen port or another loop are avoided, the top is preferred.
function freeLoopAngle(elements: VisualElementSpec[], shape: VisualElementSpec): number {
  const centre = boxCenter(elementBox(shape));
  const taken: number[] = elements.filter((el) => isLoopOn(el, shape)).map((el) => loopSide(el, shape));
  elements.forEach((el) => {
    const link = el.builder?.link;
    if (!link || link.from === link.to || (link.from !== shape.id && link.to !== shape.id)) return;
    const otherId = link.from === shape.id ? link.to : link.from;
    const port = link.from === shape.id ? link.fromPort : link.toPort;
    const other = elements.find((candidate) => candidate.id === otherId);
    if (port) taken.push(SIDE_ANGLE[port]);
    if (other) {
      const target = boxCenter(elementBox(other));
      const toward = Math.atan2(target.y - centre.y, target.x - centre.x);
      taken.push(toward);
      // An arc leaving by a port bends toward the other shape, so it sweeps the angle between the two.
      if (port) taken.push(Math.atan2(Math.sin(SIDE_ANGLE[port]) + Math.sin(toward), Math.cos(SIDE_ANGLE[port]) + Math.cos(toward)));
    }
  });
  const near = Math.max(elementBox(shape).w, elementBox(shape).h) * LOOP_NEIGHBOUR_RANGE;
  elements.forEach((el) => {
    if (el.id === shape.id || el.builder?.link || el.builder?.parent || el.builder?.say) return;
    const target = boxCenter(elementBox(el));
    if (Math.hypot(target.x - centre.x, target.y - centre.y) <= near) taken.push(Math.atan2(target.y - centre.y, target.x - centre.x));
  });
  if (taken.length === 0) return LOOP_CANDIDATES[0];
  const score = (angle: number): number => Math.min(...taken.map((used) => angleGap(angle, used)));
  return LOOP_CANDIDATES.reduce((best, angle) => (score(angle) > score(best) + 1e-6 ? angle : best), LOOP_CANDIDATES[0]);
}

// A link from a shape to itself is a loop standing out from one side of the shape; it ends in the arrowhead like any other link.
function loopPath(el: VisualElementSpec, arrow: boolean, angle: number, headStyle: ArrowHeadStyle = 'notched'): string {
  const box = elementBox(el);
  const centre = boxCenter(box);
  const reach = (Math.max(box.w, box.h) / 2) * LOOP_REACH;
  const around = (theta: number, distance: number): Point => ({ x: centre.x + Math.cos(theta) * distance, y: centre.y + Math.sin(theta) * distance });
  const p = edgePoint(el, around(angle - LOOP_HALF_ANGLE, 1000));
  const rim = edgePoint(el, around(angle + LOOP_HALF_ANGLE, 1000));
  // The head stops just outside the outline so the shape's stroke does not cover its tip.
  const outward = unit(centre, rim);
  const q = arrow ? { x: rim.x + outward.x * LOOP_HEAD_CLEARANCE, y: rim.y + outward.y * LOOP_HEAD_CLEARANCE } : rim;
  const c1 = around(angle - LOOP_HALF_ANGLE * LOOP_BULGE, reach);
  const c2 = around(angle + LOOP_HALF_ANGLE * LOOP_BULGE, reach);
  const body = `M ${round(p.x)} ${round(p.y)} C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(q.x)} ${round(q.y)}`;
  return arrow ? `${body} ${headPath(q, unit(c2, q), headStyle)}` : body;
}

// A loop keeps the side it already stands on: a reroute recomputes free sides from the neighbours, which can change once tape or steps move.
function loopAngle(shape: VisualElementSpec, context: LinkContext): number {
  const kept = context.current ? loopSide(context.current, shape) : NaN;
  return Number.isFinite(kept) ? kept : freeLoopAngle(context.elements, shape);
}

interface LinkContext {
  elements: VisualElementSpec[];
  current?: VisualElementSpec;
}

// Liang-Barsky clip: true when the segment p-q touches the box.
function segmentTouchesBox(p: Point, q: Point, box: GeometryBox): boolean {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const clips: [number, number][] = [[-dx, p.x - box.x], [dx, box.x + box.w - p.x], [-dy, p.y - box.y], [dy, box.y + box.h - p.y]];
  let enter = 0;
  let leave = 1;
  for (const [den, num] of clips) {
    if (den === 0) {
      if (num < 0) return false;
      continue;
    }
    const t = num / den;
    if (den < 0) {
      if (t > leave) return false;
      enter = Math.max(enter, t);
    } else {
      if (t < enter) return false;
      leave = Math.min(leave, t);
    }
  }
  return true;
}

// Labels and link parts belong to their owner, so only free shapes can sit on a chord.
const isObstacle = (el: VisualElementSpec, from: VisualElementSpec, to: VisualElementSpec): boolean =>
  el.id !== from.id && el.id !== to.id && !el.builder?.link && !el.builder?.parent && !el.builder?.say;

// A straight chord that runs through another shape would cross its body and its label; a bow of this size clears the blocker.
const OBSTACLE_CLEARANCE = 30;

function clearingBend(from: VisualElementSpec, to: VisualElementSpec, elements: VisualElementSpec[]): number {
  const p = edgePoint(from, boxCenter(elementBox(to)));
  const q = edgePoint(to, boxCenter(elementBox(from)));
  const blocker = elements.find((el) => isObstacle(el, from, to) && segmentTouchesBox(p, q, elementBox(el)));
  if (!blocker) return 0;
  const box = elementBox(blocker);
  return Math.max(box.w, box.h) / 2 + OBSTACLE_CLEARANCE;
}

function connectorPath(from: VisualElementSpec, to: VisualElementSpec, link: LinkData, context: LinkContext): string {
  const headStyle = link.head ?? 'notched';
  if (from.id === to.id) return loopPath(from, link.arrow, loopAngle(from, context), headStyle);
  if (!isPlain(link)) return routedPath(from, to, link);
  const bend = clearingBend(from, to, context.elements);
  return bend ? bentPath(from, to, { ...link, bend }) : plainPath(from, to, link.arrow, headStyle);
}

const isLink = (el: VisualElementSpec | undefined): boolean => el?.builder?.link !== undefined;

function canConnect(spec: VisualSpec, from: VisualElementSpec | undefined, to: VisualElementSpec | undefined): boolean {
  if (!from || !to || isLink(from) || isLink(to)) return false;
  if (from.id === to.id) return true;
  return !spec.elements.some((el) => el.builder?.link?.from === from.id && el.builder.link.to === to.id);
}

function linkData(fromId: string, toId: string, arrow: boolean, placement: LinkPlacement): LinkData {
  const { route, fromPort, toPort } = placement;
  return { from: fromId, to: toId, arrow, ...(route && { route }), ...(fromPort && { fromPort }), ...(toPort && { toPort }) };
}

// Adds a connector under the shapes (a link from a shape to itself is a loop). Returns null for an unknown shape, a duplicate, or a link to a link.
export function connectShapes(spec: VisualSpec, fromId: string, toId: string, arrow = true, placement: LinkPlacement = {}): { spec: VisualSpec; id: string } | null {
  const from = spec.elements.find((el) => el.id === fromId);
  const to = spec.elements.find((el) => el.id === toId);
  if (!from || !to || !canConnect(spec, from, to)) return null;
  const id = nextId('link', spec.elements.map((el) => el.id));
  const data = linkData(fromId, toId, arrow, placement);
  const link: VisualElementSpec = {
    id,
    kind: 'path',
    attrs: { d: connectorPath(from, to, data, { elements: spec.elements }) },
    style: { fill: 'none', stroke: DEFAULT_SHAPE_COLOR, color: DEFAULT_SHAPE_COLOR, strokeWidth: 3, filter: GLOW_OFF },
    builder: { shape: arrow ? 'arrow' : 'line', link: data },
  };
  return { spec: { ...spec, elements: [link, ...spec.elements] }, id };
}

// Where a link's label sits: off to the upper side of the middle of its shaft; a loop's label sits outside the loop, away from its shape.
// A label is never narrower than its text, so a multi-symbol loop label such as 0,1 does not spill onto the loop.
const labelSize = (base: { w: number; h: number }, text: string): { w: number; h: number } => ({ w: Math.max(base.w, Math.ceil(text.length * LABEL_CHAR_WIDTH + LABEL_PAD)), h: base.h });

function labelPlace(el: VisualElementSpec, shape?: VisualElementSpec, text = ''): GeometryBox {
  const [shaft] = flattenPath(String(el.attrs.d ?? ''));
  const mid = pointAtFraction(shaft, 0.5);
  const ahead = pointAtFraction(shaft, 0.52);
  const behind = pointAtFraction(shaft, 0.48);
  const length = Math.hypot(ahead.x - behind.x, ahead.y - behind.y) || 1;
  const side = ahead.x - behind.x >= 0 ? 1 : -1;
  const along = { x: ((ahead.y - behind.y) / length) * side, y: ((behind.x - ahead.x) / length) * side };
  const normal = shape ? outwardOf(mid, shape) : along;
  const size = labelSize(shape ? LOOP_LABEL_SIZE : LABEL_SIZE, text);
  const reach = (shape ? LOOP_LABEL_GAP : LABEL_GAP) + (Math.abs(normal.x) * size.w + Math.abs(normal.y) * size.h) / 2;
  return { x: mid.x + normal.x * reach - size.w / 2, y: mid.y + normal.y * reach - size.h / 2, ...size };
}

function outwardOf(point: Point, shape: VisualElementSpec): Point {
  const centre = boxCenter(elementBox(shape));
  const length = Math.hypot(point.x - centre.x, point.y - centre.y) || 1;
  return { x: (point.x - centre.x) / length, y: (point.y - centre.y) / length };
}

type LinkEnd = 'start' | 'end';

// Multiplicity and role sit by the link's ends, not at its middle (F7).
function endLabelPlace(el: VisualElementSpec, end: LinkEnd): GeometryBox {
  const [shaft] = flattenPath(String(el.attrs.d ?? ''));
  const atStart = end === 'start';
  return endLabelBox(pointAtFraction(shaft, atStart ? 0 : 1), pointAtFraction(shaft, atStart ? 0.15 : 0.85), LABEL_SIZE);
}

function endOfLabel(label: VisualElementSpec, owner: VisualElementSpec): LinkEnd | null {
  if (label.id === `${owner.id}-label-start`) return 'start';
  return label.id === `${owner.id}-label-end` ? 'end' : null;
}

function placeLabels(elements: VisualElementSpec[]): VisualElementSpec[] {
  const links = new Map(elements.filter((el) => el.builder?.link).map((el) => [el.id, el]));
  const loopShape = (owner: VisualElementSpec): VisualElementSpec | undefined => {
    const link = owner.builder?.link;
    return link && link.from === link.to ? elements.find((candidate) => candidate.id === link.from) : undefined;
  };
  return elements.map((el) => {
    const owner = links.get(el.builder?.parent ?? '');
    if (!owner) return el;
    const end = endOfLabel(el, owner);
    const box = end ? endLabelPlace(owner, end) : labelPlace(owner, loopShape(owner), el.content);
    const loop = loopShape(owner) !== undefined && !end;
    return { ...el, attrs: { ...el.attrs, x: round(box.x), y: round(box.y), ...(loop ? { width: box.w, height: box.h } : {}) } };
  });
}

export const BEND_LIMIT = 120;

// Zero is the default straight link, so it is stored as no bend at all.
export function setLinkBend(spec: VisualSpec, linkId: string, bend: number): VisualSpec {
  const clamped = Math.max(-BEND_LIMIT, Math.min(BEND_LIMIT, Math.round(bend)));
  const elements = spec.elements.map((el) => {
    if (el.id !== linkId || !el.builder?.link) return el;
    const link = { ...el.builder.link, bend: clamped === 0 ? undefined : clamped };
    return { ...el, builder: { ...el.builder, link } };
  });
  return rerouteLinks({ ...spec, elements });
}

// Recomputes every connector from its shapes' current positions; a connector whose shape is gone is removed.
export function rerouteLinks(spec: VisualSpec): VisualSpec {
  const byId = new Map(spec.elements.map((el) => [el.id, el]));
  const elements = spec.elements.flatMap((el) => {
    const link = el.builder?.link;
    if (!link) return [el];
    const from = byId.get(link.from);
    const to = byId.get(link.to);
    if (!from || !to) return [];
    const others = spec.elements.filter((other) => other.id !== el.id);
    return [{ ...el, attrs: { ...el.attrs, d: connectorPath(from, to, link, { elements: others, current: el }) } }];
  });
  return { ...spec, elements: placeLabels(elements) };
}

export function setLinkArrow(spec: VisualSpec, linkId: string, arrow: boolean): VisualSpec {
  const elements = spec.elements.map((el) => {
    if (el.id !== linkId || !el.builder?.link) return el;
    return { ...el, builder: { ...el.builder, shape: arrow ? ('arrow' as const) : ('line' as const), link: { ...el.builder.link, arrow } } };
  });
  return rerouteLinks({ ...spec, elements });
}

function updateLink(spec: VisualSpec, linkId: string, link: LinkData): VisualSpec {
  const elements = spec.elements.map((el) => (el.id === linkId ? { ...el, builder: { ...el.builder, link } } : el));
  return rerouteLinks({ ...spec, elements });
}

export function setLinkRoute(spec: VisualSpec, linkId: string, route: LinkRoute): VisualSpec {
  const link = spec.elements.find((el) => el.id === linkId)?.builder?.link;
  if (!link) return spec;
  return updateLink(spec, linkId, { ...link, route });
}

export function reverseLink(spec: VisualSpec, linkId: string): VisualSpec {
  const link = spec.elements.find((el) => el.id === linkId)?.builder?.link;
  if (!link) return spec;
  const { fromPort, toPort, labelStart, labelEnd, ...rest } = link;
  const swapped = { ...rest, from: link.to, to: link.from, ...(toPort && { fromPort: toPort }), ...(fromPort && { toPort: fromPort }), ...(labelEnd && { labelStart: labelEnd }), ...(labelStart && { labelEnd: labelStart }) };
  const next = updateLink(spec, linkId, swapped);
  const content = new Map([[`${linkId}-label-start`, labelEnd], [`${linkId}-label-end`, labelStart]]);
  return { ...next, elements: next.elements.map((el) => (content.has(el.id) ? { ...el, content: content.get(el.id) } : el)) };
}

function linkLabel(id: string, linkId: string, text: string, box: GeometryBox): VisualElementSpec {
  return {
    id,
    kind: 'math',
    attrs: { x: round(box.x), y: round(box.y), width: LABEL_SIZE.w, height: LABEL_SIZE.h },
    content: text,
    style: { color: 'var(--text-primary)', '--label-size': '0.9rem' },
    builder: { shape: 'text', parent: linkId },
  };
}

export function setLinkLabel(spec: VisualSpec, linkId: string, text: string): VisualSpec {
  const link = spec.elements.find((el) => el.id === linkId);
  if (!link?.builder?.link) return spec;
  const id = `${linkId}-label`;
  const others = spec.elements.filter((el) => el.id !== id);
  if (text.trim() === '') return { ...spec, elements: others };
  const existing = spec.elements.find((el) => el.id === id);
  const label = { ...(existing ?? linkLabel(id, linkId, text, labelPlace(link, undefined, text))), content: text };
  return { ...spec, elements: placeLabels([...others, label]) };
}

// Sets or clears the text near one end of a link; the text is mirrored in builder.link so it survives a re-route.
export function setLinkEndLabel(spec: VisualSpec, linkId: string, end: LinkEnd, text: string): VisualSpec {
  const link = spec.elements.find((el) => el.id === linkId);
  if (!link?.builder?.link) return spec;
  const field = end === 'start' ? 'labelStart' : 'labelEnd';
  const data = { ...link.builder.link };
  const id = `${linkId}-label-${end}`;
  const others = spec.elements.filter((el) => el.id !== id).map((el) => (el.id === linkId ? { ...el, builder: { ...el.builder, link: data } } : el));
  if (text.trim() === '') {
    delete data[field];
    return { ...spec, elements: others };
  }
  data[field] = text;
  const existing = spec.elements.find((el) => el.id === id);
  const label = { ...(existing ?? linkLabel(id, linkId, text, endLabelPlace(link, end))), content: text };
  return { ...spec, elements: [...others, label] };
}
