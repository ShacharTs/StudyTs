import type { SceneObject } from '@canvasStore';
import { computeBoundEdgeBox, computeBoundEdgeEndpoints, isSelfLoop } from './connectorBinding';
import { themedColor } from '../objectViews/themeColors';
import type { Point } from '@core/geometry/geometryPrimitives';

export type MarkerKind = 'none' | 'open' | 'filled' | 'generalization' | 'composition' | 'aggregation';

export const MARKER_KINDS: MarkerKind[] = ['none', 'open', 'filled', 'generalization', 'composition', 'aggregation'];

/** How a terminal is painted: `stroke` = solid in the line color, `surface` = hollow (page color), `none` = outline only. */
export interface MarkerDef {
  path: string;
  /** Marker box in marker units (1 unit = the line's stroke width); the tip sits at x = `w`. */
  w: number;
  h: number;
  fill: 'stroke' | 'surface' | 'none';
}

export const MARKER_DEFS: Record<MarkerKind, MarkerDef | null> = {
  none: null,
  open: { path: 'M 0 0 L 6 3 L 0 6', w: 6, h: 6, fill: 'none' },
  filled: { path: 'M 0 0 L 6 3 L 0 6 z', w: 6, h: 6, fill: 'stroke' },
  generalization: { path: 'M 0 0 L 8 4 L 0 8 z', w: 8, h: 8, fill: 'surface' },
  composition: { path: 'M 0 4 L 5 0 L 10 4 L 5 8 z', w: 10, h: 8, fill: 'stroke' },
  aggregation: { path: 'M 0 4 L 5 0 L 10 4 L 5 8 z', w: 10, h: 8, fill: 'surface' },
};

function asKind(v: unknown): MarkerKind | null {
  return MARKER_KINDS.includes(v as MarkerKind) ? (v as MarkerKind) : null;
}

/** The terminal for one end; falls back to the legacy `arrowStart` / `arrowEnd` / `arrowStyle` props. */
export function readMarker(p: Record<string, unknown>, end: 'Start' | 'End'): MarkerKind {
  const explicit = asKind(p[`marker${end}`]);
  if (explicit) return explicit;
  if (end === 'Start') return p.arrowStart === true ? 'filled' : 'none';
  return p.arrowEnd !== false && p.arrowStyle !== 'none' ? 'filled' : 'none';
}

interface ArrowGeometry {
  d: string;
  midX: number;
  labelY: number;
  viewBox: string;
  /** Straight-line distance between the two ends (mm); decides whether a label fits on the edge. */
  length: number;
  a: Point;
  b: Point;
}

export type Routing = 'straight' | 'elbow' | 'curved';

export const ROUTINGS: Routing[] = ['straight', 'elbow', 'curved'];

/** How far a 'curved' edge bows when no explicit curvature is set, as a fraction of its length. */
const AUTO_CURVE_RATIO = 0.2;

export const asRouting = (v: unknown): Routing => (ROUTINGS.includes(v as Routing) ? (v as Routing) : 'straight');

/** Right-angle path with one jog halfway along the dominant axis, so the terminals meet the shapes head-on. */
function elbowPath(a: Point, b: Point): string {
  if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
    const midX = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`;
  }
  const midY = (a.y + b.y) / 2;
  return `M ${a.x} ${a.y} L ${a.x} ${midY} L ${b.x} ${midY} L ${b.x} ${b.y}`;
}

/**
 * Control point for a quadratic curve from a to b, offset perpendicular to
 * the a->b direction by `curvature` (positive = clockwise side of travel).
 * Falls back to a straight-down offset when a and b coincide.
 */
export function curveControlPoint(a: Point, b: Point, curvature: number): Point {
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: midX, y: midY + curvature };

  const nx = -dy / len;
  const ny = dx / len;
  return { x: midX + nx * curvature, y: midY + ny * curvature };
}

/** Point at t=0.5 on the quadratic bezier a -> control -> b. */
export function bezierMidpoint(a: Point, control: Point, b: Point): Point {
  return {
    x: (a.x + 2 * control.x + b.x) / 4,
    y: (a.y + 2 * control.y + b.y) / 4,
  };
}

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

/** SVG stroke-dasharray for a stroke style (undefined = solid). */
export function dashArray(style: StrokeStyle, sw: number): string | undefined {
  const n = (x: number) => +x.toFixed(3);
  if (style === 'dashed') return `${n(sw * 3)} ${n(sw * 2)}`;
  if (style === 'dotted') return `${n(sw)} ${n(sw * 1.5)}`;
  return undefined;
}

export function readStrokeStyle(p: SceneObject['props']): StrokeStyle {
  if (p.strokeStyle === 'dashed' || p.strokeStyle === 'dotted') return p.strokeStyle;
  return p.dash === true ? 'dashed' : 'solid';
}

interface ArrowStyleProps {
  label: string;
  stroke: string;
  sw: number;
  strokeStyle: StrokeStyle;
  markerStart: MarkerKind;
  markerEnd: MarkerKind;
  curvature: number;
  routing: Routing;
  /** Label size in pt, like every other text size in the editor. */
  labelFontSize: number;
  /** Undefined = the theme's text color. */
  labelColor: string | undefined;
}

export const DEFAULT_LABEL_PT = 9;
export const MM_PER_PT = 0.3528;

export function readArrowStyleProps(p: SceneObject['props']): ArrowStyleProps {
  return {
    label: (p.label as string) ?? '',
    stroke: themedColor(p.stroke as string | undefined),
    sw: (p.strokeWidth as number) ?? 0.5,
    strokeStyle: readStrokeStyle(p),
    markerStart: readMarker(p, 'Start'),
    markerEnd: readMarker(p, 'End'),
    curvature: (p.curvature as number) ?? 0,
    routing: asRouting(p.routing),
    labelFontSize: typeof p.labelFontSize === 'number' && p.labelFontSize > 0 ? p.labelFontSize : DEFAULT_LABEL_PT,
    labelColor: typeof p.labelColor === 'string' && p.labelColor ? themedColor(p.labelColor) : undefined,
  };
}

export function resolveEndpoints(
  obj: SceneObject,
  isBound: boolean,
  sourceObj: SceneObject | undefined,
  targetObj: SceneObject | undefined
): { a: Point; b: Point } {
  if (!isBound) {
    // An unbound line runs along its box diagonal; flipX/flipY record a right-to-left or bottom-to-top drag.
    const fx = obj.props.flipX === true;
    const fy = obj.props.flipY === true;
    return {
      a: { x: fx ? obj.w : 0, y: fy ? obj.h : 0 },
      b: { x: fx ? 0 : obj.w, y: fy ? 0 : obj.h },
    };
  }

  const { startAbs, endAbs } = computeBoundEdgeEndpoints(obj, sourceObj, targetObj);
  return { a: startAbs, b: endAbs };
}

/** Smallest height (mm) of an unbound line's box: a flat box has a zero-scale axis and draws nothing. */
export const MIN_LINE_BOX_MM = 4;

/** Padding that keeps a flat or vertical unbound line's box drawable; the line stays centred in it. */
export function unboundLinePad(obj: SceneObject): { x: number; y: number } {
  if (obj.type !== 'line' && obj.type !== 'edge') return { x: 0, y: 0 };
  return {
    x: Math.max(0, (MIN_LINE_BOX_MM - obj.w) / 2),
    y: Math.max(0, (MIN_LINE_BOX_MM - obj.h) / 2),
  };
}

function unboundBox(obj: SceneObject) {
  const pad = unboundLinePad(obj);
  return { minX: -pad.x, minY: -pad.y, boxW: obj.w + 2 * pad.x, boxH: obj.h + 2 * pad.y };
}

/** Path data plus the point the label sits on, for the chosen routing. */
function routedPath(a: Point, b: Point, curvature: number, routing: Routing): { d: string; mid: Point } {
  if (routing === 'elbow') return { d: elbowPath(a, b), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  const bow = routing === 'curved' && !curvature ? Math.hypot(b.x - a.x, b.y - a.y) * AUTO_CURVE_RATIO : curvature;
  if (!bow) return { d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  const control = curveControlPoint(a, b, bow);
  return { d: `M ${a.x} ${a.y} Q ${control.x} ${control.y} ${b.x} ${b.y}`, mid: bezierMidpoint(a, control, b) };
}

export function computeArrowGeometry(
  obj: SceneObject,
  sourceObj: SceneObject | undefined,
  targetObj: SceneObject | undefined,
  curvature: number,
  routing: Routing = 'straight'
): ArrowGeometry {
  const isBound = Boolean(sourceObj || targetObj);
  const { a, b } = resolveEndpoints(obj, isBound, sourceObj, targetObj);
  // A loop back onto its own shape must bow clear of it, or its two close ends draw a flat stub.
  const loopBow = sourceObj && isSelfLoop(obj, sourceObj, targetObj) ? sourceObj.h * 1.2 : 0;
  const { d, mid } = routedPath(a, b, curvature || loopBow, loopBow && routing === 'elbow' ? 'straight' : routing);

  const { minX, minY, boxW, boxH } = isBound
    ? computeBoundEdgeBox(obj, sourceObj, targetObj)
    : unboundBox(obj);

  return { d, midX: mid.x, labelY: mid.y, viewBox: `${minX} ${minY} ${boxW} ${boxH}`, length: Math.hypot(b.x - a.x, b.y - a.y), a, b };
}

/** Rough text width (mm) for deciding whether a label fits on its edge; real width depends on the glyphs. */
export const estimateLabelWidth = (text: string, fontMm: number): number => text.length * fontMm * 0.55;

/**
 * Where an edge label is centred. On a long edge it sits on the line (its pill hides the stroke behind it);
 * on an edge too short to hold it, it moves clear of the line so it does not cover the shapes at the ends.
 */
export function placeLabel(geometry: Pick<ArrowGeometry, 'midX' | 'labelY' | 'length' | 'a' | 'b'>, labelWidth: number, fontMm: number): Point {
  const mid = { x: geometry.midX, y: geometry.labelY };
  if (geometry.length >= labelWidth + 2 * fontMm) return mid;
  const len = geometry.length || 1;
  const normal = { x: -(geometry.b.y - geometry.a.y) / len, y: (geometry.b.x - geometry.a.x) / len };
  // Up the page, so the label rides above a horizontal edge; beside (right of) a vertical one.
  const flip = normal.y > 1e-9 || (Math.abs(normal.y) <= 1e-9 && normal.x < 0);
  const nx = flip ? -normal.x : normal.x;
  const ny = flip ? -normal.y : normal.y;
  const away = fontMm * 1.4;
  return { x: mid.x + nx * away, y: mid.y + ny * away };
}
