import { themedColor, themedFill } from './themeColors';
import { fitToBox, ngonVertices, starVertices } from '@core/geometry/outline/polygon';
import type { Point } from '@core/geometry/geometryPrimitives';

/** Rectangle body (top 78% of the box) with a triangular tail whose tip touches the bottom edge. */
function calloutPoints(w: number, h: number, tailX: number): string {
  const bodyH = h * 0.78;
  const tip = Math.min(0.95, Math.max(0.05, tailX)) * w;
  const half = Math.min(w * 0.08, tip, w - tip);
  return `0,0 ${w},0 ${w},${bodyH} ${tip + half},${bodyH} ${tip},${h} ${tip - half},${bodyH} 0,${bodyH}`;
}

type PolygonFn = (w: number, h: number, tailX: number) => string;

const pt = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;

/** Vertices (unit box) scaled to the shape size as an SVG points string. */
function toPoints(vertices: Point[], w: number, h: number): string {
  return vertices.map((v) => pt(v.x * w, v.y * h)).join(' ');
}

const diamond: PolygonFn = (w, h) => `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;

const POLYGONS: Record<string, PolygonFn> = {
  diamond,
  decision: diamond,
  hexagon: (w, h) => `${w * 0.25},0 ${w * 0.75},0 ${w},${h / 2} ${w * 0.75},${h} ${w * 0.25},${h} 0,${h / 2}`,
  callout: calloutPoints,
  triangle: (w, h) => `${w / 2},0 ${w},${h} 0,${h}`,
  pentagon: (w, h) => toPoints(fitToBox(ngonVertices(5)), w, h),
  star: (w, h) => toPoints(fitToBox(starVertices(5, 0.4)), w, h),
  parallelogram: (w, h) => `${w * 0.2},0 ${w},0 ${w * 0.8},${h} 0,${h}`,
};

/** Polygon vertices (SVG `points`) for the polygonal shape kinds, or null for kinds drawn another way. */
export function polygonPoints(kind: string, w: number, h: number, tailX = 0.2): string | null {
  return POLYGONS[kind]?.(w, h, tailX) ?? null;
}

/** A shape object's style props with their defaults applied. */
export function readShapeProps(p: Record<string, unknown>) {
  return {
    kind: (p.shape as string) ?? 'rect',
    fill: themedFill(p.fill as string | undefined),
    stroke: themedColor(p.stroke as string | undefined),
    sw: (p.strokeWidth as number) ?? 0.4,
    label: (p.label as string) ?? '',
    opacity: (p.opacity as number) ?? 1,
    labelColor: themedColor(p.labelColor as string | undefined),
    fontSize: (p.fontSize as number) ?? 11,
    radius: p.radius as number | undefined,
    tailX: (p.tailX as number) ?? 0.2,
  };
}
