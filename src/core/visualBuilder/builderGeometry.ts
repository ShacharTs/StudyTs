import type { Point } from '../geometry/geometryPrimitives';
import type { BuilderSide, VisualElementBuilder, VisualElementSpec } from '../types/visualSpec';

export interface GeometryBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MIN_SIZE = 20;
export const MIN_VISIBLE = 24;

const num = (value: number | string | undefined, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const round = (value: number): number => Math.round(value * 10) / 10;

export const SIDES: BuilderSide[] = ['n', 'e', 's', 'w'];

const SIDE_POINTS: Record<BuilderSide, (box: GeometryBox) => Point> = {
  n: (box) => ({ x: box.x + box.w / 2, y: box.y }),
  e: (box) => ({ x: box.x + box.w, y: box.y + box.h / 2 }),
  s: (box) => ({ x: box.x + box.w / 2, y: box.y + box.h }),
  w: (box) => ({ x: box.x, y: box.y + box.h / 2 }),
};

export const sidePoint = (box: GeometryBox, side: BuilderSide): Point => SIDE_POINTS[side](box);

const END_LABEL_ALONG = 24;
const END_LABEL_GAP = 10;

// A label near one end of a link: a little in along the shaft and off to its upper side, clear of the head.
export function endLabelBox(end: Point, inward: Point, size: { w: number; h: number }): GeometryBox {
  const length = Math.hypot(inward.x - end.x, inward.y - end.y) || 1;
  const along = { x: (inward.x - end.x) / length, y: (inward.y - end.y) / length };
  const normal = { x: along.y, y: -along.x };
  const reach = END_LABEL_GAP + (Math.abs(normal.x) * size.w + Math.abs(normal.y) * size.h) / 2;
  const cx = end.x + along.x * END_LABEL_ALONG + normal.x * reach;
  const cy = end.y + along.y * END_LABEL_ALONG + normal.y * reach;
  return { x: round(cx - size.w / 2), y: round(cy - size.h / 2), ...size };
}

export const boxCenter = (box: GeometryBox): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

// Argument count per command: the end point is the last pair (an arc's last two values).
const SEGMENT_ARGS: Record<string, number> = { M: 2, L: 2, T: 2, C: 6, S: 4, Q: 4, A: 7, H: 1, V: 1, Z: 0 };
const TAU = 2 * Math.PI;

// Centre form of an axis-aligned SVG arc (SVG spec F.6.5).
interface ArcCentre {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  theta1: number;
  dTheta: number;
}

const angleBetween = (ux: number, uy: number, vx: number, vy: number): number => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);

function arcCentre(x1: number, y1: number, rxIn: number, ryIn: number, largeArc: number, sweep: number, x2: number, y2: number): ArcCentre {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const lambda = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx;
  const den = rx * rx * dy * dy + ry * ry * dx * dx;
  const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * dy) / ry;
  const cyp = (-coef * ry * dx) / rx;
  const ux = (dx - cxp) / rx;
  const uy = (dy - cyp) / ry;
  let dTheta = angleBetween(ux, uy, (-dx - cxp) / rx, (-dy - cyp) / ry);
  if (!sweep && dTheta > 0) dTheta -= TAU;
  if (sweep && dTheta < 0) dTheta += TAU;
  return { cx: cxp + (x1 + x2) / 2, cy: cyp + (y1 + y2) / 2, rx, ry, theta1: angleBetween(1, 0, ux, uy), dTheta };
}

// Whether the arc's sweep passes the angle theta.
function sweepCovers(arc: ArcCentre, theta: number): boolean {
  const offset = arc.dTheta >= 0 ? theta - arc.theta1 : arc.theta1 - theta;
  return ((offset % TAU) + TAU) % TAU <= Math.abs(arc.dTheta);
}

// An arc's end point plus the horizontal and vertical extremes that its sweep passes.
function arcPoints(x1: number, y1: number, rx: number, ry: number, largeArc: number, sweep: number, x2: number, y2: number): Point[] {
  const end = { x: x2, y: y2 };
  if (rx === 0 || ry === 0) return [end];
  const arc = arcCentre(x1, y1, rx, ry, largeArc, sweep, x2, y2);
  const extremes = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]
    .filter((theta) => sweepCovers(arc, theta))
    .map((theta) => ({ x: arc.cx + arc.rx * Math.cos(theta), y: arc.cy + arc.ry * Math.sin(theta) }));
  return [end, ...extremes];
}

// The points one command draws, and where its current point ends. Relative values are offset by `from`.
function segmentPoints(command: string, v: number[], from: Point, offset: Point): { points: Point[]; to: Point } {
  if (command === 'H') {
    const to = { x: offset.x + v[0], y: from.y };
    return { points: [to], to };
  }
  if (command === 'V') {
    const to = { x: from.x, y: offset.y + v[0] };
    return { points: [to], to };
  }
  if (command === 'A') {
    const to = { x: offset.x + v[5], y: offset.y + v[6] };
    return { points: arcPoints(from.x, from.y, v[0], v[1], v[3], v[4], to.x, to.y), to };
  }
  // Control points count too: a curve never reaches past its own control polygon.
  const points: Point[] = [];
  for (let i = 0; i + 1 < v.length; i += 2) points.push({ x: offset.x + v[i], y: offset.y + v[i + 1] });
  return { points, to: points[points.length - 1] ?? from };
}

// Every drawn extreme of a path, following the current point so H, V and relative commands land where they draw.
function pathPoints(d: string): Point[] {
  const points: Point[] = [];
  let at: Point = { x: 0, y: 0 };
  for (const [, command, args] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const upper = command.toUpperCase();
    const count = SEGMENT_ARGS[upper];
    if (!count) continue;
    const values = (args.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
    const offset = command !== upper ? at : { x: 0, y: 0 };
    for (let start = 0; start + count <= values.length; start += count) {
      const segment = segmentPoints(upper, values.slice(start, start + count), at, offset);
      points.push(...segment.points);
      at = segment.to;
    }
  }
  return points;
}

export function pathBounds(d: string): GeometryBox {
  const points = pathPoints(d);
  if (points.length === 0) return { x: 0, y: 0, w: MIN_SIZE, h: MIN_SIZE };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// Maps every coordinate pair of an absolute-command path from one box onto another (move and resize of any path).
function remapPath(d: string, from: GeometryBox, to: GeometryBox): string {
  const scaleX = from.w === 0 ? 1 : to.w / from.w;
  const scaleY = from.h === 0 ? 1 : to.h / from.h;
  let index = 0;
  return d.replace(/-?\d*\.?\d+/g, (token) => {
    const value = Number(token);
    const mapped = index % 2 === 0 ? to.x + (value - from.x) * scaleX : to.y + (value - from.y) * scaleY;
    index += 1;
    return String(round(mapped));
  });
}

export function diamondPath(box: GeometryBox): string {
  const { x, y, w, h } = box;
  return `M ${round(x + w / 2)} ${round(y)} L ${round(x + w)} ${round(y + h / 2)} L ${round(x + w / 2)} ${round(y + h)} L ${round(x)} ${round(y + h / 2)} Z`;
}

export function trianglePath(box: GeometryBox): string {
  const { x, y, w, h } = box;
  return `M ${round(x + w / 2)} ${round(y)} L ${round(x + w)} ${round(y + h)} L ${round(x)} ${round(y + h)} Z`;
}

export type ArrowHeadStyle = 'solid' | 'open' | 'notched';

// Sizes in px as drawn in the visual-fixes mock: length back from the tip, half width of the wings, and for notched the depth of the notch.
interface HeadStyleConfig {
  length: number;
  halfWidth: number;
  notch: number;
}

const HEAD_STYLES: Record<ArrowHeadStyle, HeadStyleConfig> = {
  open: { length: 16, halfWidth: 10, notch: 0 },
  notched: { length: 20, halfWidth: 10, notch: 15 },
  solid: { length: 16, halfWidth: 8, notch: 0 },
};

export function headPath(tip: Point, direction: Point, style: ArrowHeadStyle = 'notched'): string {
  const cfg = HEAD_STYLES[style] ?? HEAD_STYLES.notched;
  const length = Math.hypot(direction.x, direction.y) || 1;
  const u = { x: direction.x / length, y: direction.y / length };
  const n = { x: -u.y, y: u.x };
  const at = (along: number, side: number): Point => ({ x: tip.x - u.x * along + n.x * side, y: tip.y - u.y * along + n.y * side });
  const wingA = at(cfg.length, cfg.halfWidth);
  const wingB = at(cfg.length, -cfg.halfWidth);
  const pt = (p: Point): string => `${round(p.x)} ${round(p.y)}`;
  if (style === 'open') return `M ${pt(wingA)} L ${pt(tip)} L ${pt(wingB)}`;
  if (style === 'notched') return `M ${pt(tip)} L ${pt(wingA)} L ${pt(at(cfg.notch, 0))} L ${pt(wingB)} Z`;
  return `M ${pt(tip)} L ${pt(wingA)} L ${pt(wingB)} Z`;
}

const arrowHead = (tip: Point, from: Point, style: ArrowHeadStyle = 'notched'): string =>
  headPath(tip, { x: tip.x - from.x, y: tip.y - from.y }, style);

export function linePath(from: Point, to: Point, arrow: boolean, headStyle: ArrowHeadStyle = 'notched'): string {
  const body = `M ${round(from.x)} ${round(from.y)} L ${round(to.x)} ${round(to.y)}`;
  return arrow ? `${body} ${arrowHead(to, from, headStyle)}` : body;
}

export const POINTER_WIDTH = 24;
export const POINTER_HEIGHT = 62;

// The head sits at the top because the caption below must not overlap it, the shaft rising from under the caption.
export function pointerPath(box: GeometryBox): string {
  const { x, y, w, h } = box;
  const cx = round(x + w / 2);
  const shoulder = round(y + 20);
  const pt = (px: number, py: number): string => `${round(px)} ${round(py)}`;
  return `M ${pt(cx, y + h)} L ${pt(cx, shoulder)} M ${pt(cx, y)} L ${pt(x + w, shoulder)} L ${pt(cx, y + 14)} L ${pt(x, shoulder)} Z`;
}

function lineBetweenBoxCorners(builder: VisualElementBuilder, box: GeometryBox): string {
  const flip = builder.flip === true;
  const from = { x: box.x, y: flip ? box.y + box.h : box.y };
  const to = { x: box.x + box.w, y: flip ? box.y : box.y + box.h };
  return linePath(from, to, builder.shape === 'arrow');
}

const SHAPED_PATHS: Partial<Record<string, (builder: VisualElementBuilder, box: GeometryBox) => string>> = {
  diamond: (_builder, box) => diamondPath(box),
  triangle: (_builder, box) => trianglePath(box),
  pointer: (_builder, box) => pointerPath(box),
  line: lineBetweenBoxCorners,
  arrow: lineBetweenBoxCorners,
};

function shapedPath(builder: VisualElementBuilder, box: GeometryBox): string | null {
  const draw = SHAPED_PATHS[builder.shape ?? ''];
  return draw ? draw(builder, box) : null;
}

export function elementBox(el: VisualElementSpec): GeometryBox {
  const a = el.attrs;
  if (el.kind === 'circle') {
    const r = num(a.r);
    return { x: num(a.cx) - r, y: num(a.cy) - r, w: r * 2, h: r * 2 };
  }
  if (el.kind === 'ellipse') {
    const rx = num(a.rx);
    const ry = num(a.ry);
    return { x: num(a.cx) - rx, y: num(a.cy) - ry, w: rx * 2, h: ry * 2 };
  }
  if (el.kind === 'path') return el.builder?.box ?? pathBounds(String(a.d ?? ''));
  return { x: num(a.x), y: num(a.y), w: num(a.width, 80), h: num(a.height, 24) };
}

const isLine = (el: VisualElementSpec): boolean => el.builder?.shape === 'line' || el.builder?.shape === 'arrow';

function resizePath(el: VisualElementSpec, box: GeometryBox): VisualElementSpec {
  const shaped = el.builder ? shapedPath(el.builder, box) : null;
  if (shaped !== null) return { ...el, attrs: { ...el.attrs, d: shaped }, builder: { ...el.builder, box } };
  const d = remapPath(String(el.attrs.d ?? ''), elementBox(el), box);
  return { ...el, attrs: { ...el.attrs, d }, ...(el.builder ? { builder: { ...el.builder, box } } : {}) };
}

// A line may be flat on one axis but not collapse to a point.
function minimumBox(el: VisualElementSpec, requested: GeometryBox): GeometryBox {
  const box = { x: round(requested.x), y: round(requested.y), w: round(requested.w), h: round(requested.h) };
  if (!isLine(el)) return { ...box, w: Math.max(MIN_SIZE, box.w), h: Math.max(MIN_SIZE, box.h) };
  const w = Math.max(0, box.w);
  const h = Math.max(0, box.h);
  return { ...box, w: Math.hypot(w, h) < MIN_SIZE ? MIN_SIZE : w, h };
}

// Moves/resizes an element to a box. Connectors are skipped: their path always comes from the shapes they join.
export function setElementBox(el: VisualElementSpec, requested: GeometryBox): VisualElementSpec {
  if (el.builder?.link) return el;
  const box = minimumBox(el, requested);
  const center = boxCenter(box);
  if (el.kind === 'circle') {
    const size = Math.min(box.w, box.h);
    return { ...el, attrs: { ...el.attrs, cx: round(box.x + size / 2), cy: round(box.y + size / 2), r: round(size / 2) } };
  }
  if (el.kind === 'ellipse') return { ...el, attrs: { ...el.attrs, cx: round(center.x), cy: round(center.y), rx: round(box.w / 2), ry: round(box.h / 2) } };
  if (el.kind === 'path') return resizePath(el, box);
  return { ...el, attrs: { ...el.attrs, x: box.x, y: box.y, width: box.w, height: box.h } };
}

export function moveElement(el: VisualElementSpec, dx: number, dy: number): VisualElementSpec {
  const box = elementBox(el);
  return setElementBox(el, { ...box, x: box.x + dx, y: box.y + dy });
}

const clampAxis = (position: number, size: number, limit: number): number => {
  const [low, high] = size <= limit ? [0, limit - size] : [MIN_VISIBLE - size, limit - MIN_VISIBLE];
  return Math.min(high, Math.max(low, position));
};

export function clampBox(box: GeometryBox, canvas: { w: number; h: number }): GeometryBox {
  return { ...box, x: clampAxis(box.x, box.w, canvas.w), y: clampAxis(box.y, box.h, canvas.h) };
}

export const boxesOverlap = (a: GeometryBox, b: GeometryBox): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
