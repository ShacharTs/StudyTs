import type { Point } from '../../geometry/geometryPrimitives';
import type { VisualElementSpec } from '../../types/visualSpec';
import { pathBounds, round, type GeometryBox } from '../builderGeometry';
import { shapeStyle } from '../shapeCatalog';
import { packFrame } from './packPlacement';
import type { SvgNode } from './parseSvgTemplate';
import { PACK_COLOR_TOKENS, type PackObjectDef, type PackObjectStyle } from './stylePackFormat';

// The drawing is authored in size units centred on (0,0). Absolute points map to the centre plus scaled
// offsets; lengths only scale. A box with no view draws at scale 1 in its own units, as before.
export interface PackDrawing {
  size: { w: number; h: number };
  scale: number;
  centre: Point;
  strokeScale: number;
  // An absolute stroke width for hosts that stroke in their own units; it replaces the scaled one.
  strokeWidth?: number;
}

export function boxDrawing(box: GeometryBox): PackDrawing {
  return { size: { w: box.w, h: box.h }, scale: 1, centre: { x: box.x + box.w / 2, y: box.y + box.h / 2 }, strokeScale: 1 };
}

export function withStrokeWidth(drawing: PackDrawing, strokeWidth: number): PackDrawing {
  return { ...drawing, strokeWidth };
}

export function packDrawing(object: PackObjectDef, box: GeometryBox): PackDrawing {
  const frame = packFrame(object, box);
  if (!object.view) return boxDrawing(box);
  const centre = { x: frame.box.x + frame.box.w / 2, y: frame.box.y + frame.box.h / 2 };
  return { size: object.view, scale: frame.scale, centre, strokeScale: object.strokeScaling === 'fixed' ? 1 : frame.scale };
}

type Attrs = Map<string, string>;
type Axis = 'x' | 'y' | 'len' | 'keep';

const INNER_RING_GAP = 3;
const LINE_WIDTH = 3;
const NUMBER = /-?\d*\.?\d+(?:e-?\d+)?/gi;

const lineStyle = (color: string): Record<string, number | string> => ({ fill: 'none', stroke: color, color, strokeWidth: LINE_WIDTH });

// Tokens are offsets from the drawing centre, so a template reads the same at every size.
function sizeTokens(size: { w: number; h: number }): Record<string, number> {
  const hw = size.w / 2;
  const hh = size.h / 2;
  return { w: size.w, h: size.h, hw, hh, y3a: -hh + size.h / 3, y3b: -hh + (2 * size.h) / 3, x4b: -hw + (3 * size.w) / 4, inner: Math.max(1, hw - INNER_RING_GAP) };
}

function resolveAttrs(node: SvgNode, tokens: Record<string, number>): Attrs {
  const fill = (value: string): string => value.replace(/\{(\w+)\}/g, (_match, token: string) => String(round(tokens[token] ?? 0)));
  // "-{y3a}" of a negative token reads "--10"; two minus signs are a plus.
  const resolved = node.attrs.map(([name, value]): [string, string] => [name, fill(value).replace(/(?<![\w-])--(?=[\d.])/g, '')]);
  return new Map(resolved);
}

const num = (attrs: Attrs, name: string): number => Number(attrs.get(name) ?? '0') || 0;

// Which kind of value each path argument is: a point axis, a length, or a flag that is kept as is.
const PATH_ARITY: Record<string, Axis[]> = {
  M: ['x', 'y'], L: ['x', 'y'], T: ['x', 'y'], C: ['x', 'y', 'x', 'y', 'x', 'y'], S: ['x', 'y', 'x', 'y'], Q: ['x', 'y', 'x', 'y'],
  Z: [], H: ['x'], V: ['y'], A: ['len', 'len', 'keep', 'keep', 'keep', 'x', 'y'],
};

// A relative command is a delta, so it scales but never shifts.
function mapValue(value: number, axis: Axis, relative: boolean, drawing: PackDrawing): number {
  if (axis === 'keep') return value;
  const scaled = value * drawing.scale;
  if (axis === 'len' || relative) return scaled;
  return scaled + (axis === 'x' ? drawing.centre.x : drawing.centre.y);
}

function transformPath(d: string, drawing: PackDrawing): string {
  return d.replace(/([A-Za-z])([^A-Za-z]*)/g, (_match, command: string, args: string) => {
    const upper = command.toUpperCase();
    const axes = PATH_ARITY[upper];
    if (!axes || axes.length === 0) return command;
    const relative = command !== upper;
    const values = args.match(NUMBER) ?? [];
    const mapped = values.map((value, index) => String(round(mapValue(Number(value), axes[index % axes.length], relative, drawing))));
    return `${command} ${mapped.join(' ')} `;
  }).trim();
}

function pointsPath(points: string, drawing: PackDrawing, close: boolean): string {
  const values = (points.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const pairs: string[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    pairs.push(`${round(mapValue(values[index], 'x', false, drawing))} ${round(mapValue(values[index + 1], 'y', false, drawing))}`);
  }
  return `M ${pairs.join(' L ')}${close ? ' Z' : ''}`;
}

function lineElement(attrs: Attrs, drawing: PackDrawing): string {
  const from = `${round(mapValue(num(attrs, 'x1'), 'x', false, drawing))} ${round(mapValue(num(attrs, 'y1'), 'y', false, drawing))}`;
  const to = `${round(mapValue(num(attrs, 'x2'), 'x', false, drawing))} ${round(mapValue(num(attrs, 'y2'), 'y', false, drawing))}`;
  return `M ${from} L ${to}`;
}

type Drawn = Pick<VisualElementSpec, 'kind' | 'attrs'>;
type Draw = (attrs: Attrs, drawing: PackDrawing) => Drawn;

const atX = (value: number, drawing: PackDrawing): number => round(mapValue(value, 'x', false, drawing));
const atY = (value: number, drawing: PackDrawing): number => round(mapValue(value, 'y', false, drawing));
const scaled = (value: number, drawing: PackDrawing): number => value * drawing.scale;

const DRAWERS: Record<string, Draw> = {
  circle: (a, d) => ({ kind: 'circle', attrs: { cx: atX(num(a, 'cx'), d), cy: atY(num(a, 'cy'), d), r: scaled(num(a, 'r'), d) } }),
  ellipse: (a, d) => ({ kind: 'ellipse', attrs: { cx: atX(num(a, 'cx'), d), cy: atY(num(a, 'cy'), d), rx: scaled(num(a, 'rx'), d), ry: scaled(num(a, 'ry'), d) } }),
  rect: (a, d) => ({
    kind: 'rect',
    attrs: {
      x: atX(num(a, 'x'), d),
      y: atY(num(a, 'y'), d),
      width: scaled(num(a, 'width'), d),
      height: scaled(num(a, 'height'), d),
      ...(a.has('rx') ? { rx: scaled(num(a, 'rx'), d) } : {}),
    },
  }),
  path: (a, d) => ({ kind: 'path', attrs: { d: transformPath(a.get('d') ?? '', d) } }),
  polygon: (a, d) => ({ kind: 'path', attrs: { d: pointsPath(a.get('points') ?? '', d, true) } }),
  polyline: (a, d) => ({ kind: 'path', attrs: { d: pointsPath(a.get('points') ?? '', d, false) } }),
  line: (a, d) => ({ kind: 'path', attrs: { d: lineElement(a, d) } }),
};

// An open path or a line has no inside to fill, so it defaults to a bare stroke.
function isOpenStroke(node: SvgNode, drawn: Drawn): boolean {
  if (node.tag === 'line' || node.tag === 'polyline') return true;
  return drawn.kind === 'path' && node.tag === 'path' && !/z/i.test(String(drawn.attrs.d));
}

function colourOf(value: string | undefined, fallback: string): string {
  return value === undefined || value === 'currentColor' ? fallback : value;
}

const DASH_PATTERNS = { dashed: '8 6', dotted: '2 6' } as const;

const paintToken = (paint: NonNullable<PackObjectStyle['fill']>): string => (paint === 'none' ? 'none' : PACK_COLOR_TOKENS[paint]);

// An object's own look rewrites the base fill, outline and dash; colours stay theme tokens and an svg attribute still wins.
function applyLook(style: Record<string, number | string>, look: PackObjectStyle): void {
  if (look.fill !== undefined) style.fill = paintToken(look.fill);
  if (look.stroke !== undefined) style.stroke = paintToken(look.stroke);
  if (look.strokeWidth !== undefined) style.strokeWidth = look.strokeWidth;
  if (look.dash === 'none') delete style.strokeDasharray;
  else if (look.dash !== undefined) style.strokeDasharray = DASH_PATTERNS[look.dash];
}

// The paint is the theme colour token and the object's own look; an svg attribute still wins over both.
interface StylePaint {
  colorToken: string;
  strokeScale: number;
  strokeWidth?: number;
  look?: PackObjectStyle;
}

// The svg's own attributes win over the paint, so a pack can still name a colour or dash of its own.
function applyAttributes(style: Record<string, number | string>, attrs: Attrs, colorToken: string): void {
  const fill = attrs.get('fill');
  const stroke = attrs.get('stroke');
  const dash = attrs.get('stroke-dasharray');
  if (fill !== undefined) style.fill = colourOf(fill, colorToken);
  if (stroke !== undefined) style.stroke = colourOf(stroke, colorToken);
  if (attrs.has('stroke-width')) style.strokeWidth = num(attrs, 'stroke-width');
  if (dash !== undefined) style.strokeDasharray = dash;
}

// A width the host sets wins; otherwise the pack's width grows with its drawing unless it is fixed.
function fitStrokeWidth(style: Record<string, number | string>, paint: StylePaint): void {
  if (paint.strokeWidth !== undefined) style.strokeWidth = paint.strokeWidth;
  else if (typeof style.strokeWidth === 'number') style.strokeWidth = style.strokeWidth * paint.strokeScale;
}

function styleFor(node: SvgNode, drawn: Drawn, attrs: Attrs, paint: StylePaint): Record<string, number | string> {
  const { colorToken } = paint;
  const role = attrs.get('data-role');
  const bare = role === 'line' || (role === undefined && isOpenStroke(node, drawn));
  const style: Record<string, number | string> = bare ? lineStyle(colorToken) : shapeStyle(colorToken);
  if (role === 'solid') style.fillOpacity = 1;
  if (paint.look) applyLook(style, paint.look);
  applyAttributes(style, attrs, colorToken);
  fitStrokeWidth(style, paint);
  return style;
}

// A <g> only groups; its children are the primitives, in document order.
function primitives(nodes: SvgNode[]): SvgNode[] {
  return nodes.flatMap((node) => (node.tag === 'g' ? primitives(node.children) : [node]));
}

// Elements come back with empty ids; the caller names them so ids stay unique inside the spec.
export function svgToElements(nodes: SvgNode[], drawing: PackDrawing, colorToken: string, look?: PackObjectStyle): VisualElementSpec[] {
  const tokens = sizeTokens(drawing.size);
  return primitives(nodes).flatMap((node) => {
    const draw = DRAWERS[node.tag];
    if (!draw) return [];
    const attrs = resolveAttrs(node, tokens);
    const drawn = draw(attrs, drawing);
    const element: VisualElementSpec = { id: '', ...drawn, style: styleFor(node, drawn, attrs, { colorToken, look, strokeScale: drawing.strokeScale, strokeWidth: drawing.strokeWidth }) };
    return [drawn.kind === 'path' ? { ...element, builder: { box: pathBounds(String(drawn.attrs.d)) } } : element];
  });
}
