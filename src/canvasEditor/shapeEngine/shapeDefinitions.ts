import type { ReactElement } from 'react';
import type { SceneObject } from '@canvasStore';
import { RECT_GEOMETRY, type Anchor, type GeometryDef } from '@core/geometry/outline/geometryTypes';
import { fitToBox, ngonVertices } from '@core/geometry/outline/polygon';
import type { Point } from '@core/geometry/geometryPrimitives';
import { packBackedAnchorsFor, packBackedGeometryFor } from './packBackedShapes';

export type ShapeCategory = 'uml' | 'system-design' | 'network' | 'database' | 'student-academic' | 'custom';

export interface ShapeRenderProps {
  width: number;
  height: number;
  stroke: string;
  fill: string;
  sw: number;
}

/**
 * A shape is declared, not coded: give it a geometry and the engine derives hit-testing, perimeter
 * anchors and edge snapping. `render` must use only the stroke/fill it is given (theme tokens).
 */
export interface ShapeDefinition {
  id: string;
  name: string;
  category: ShapeCategory;
  defaultDimensions: { width: number; height: number };
  geometry: GeometryDef | ((props: SceneObject['props'], size: { w: number; h: number }) => GeometryDef);
  /** Optional manual anchor placement replacing the automatic anchors. */
  customAnchors?: (w: number, h: number) => Anchor[];
  render?: (p: ShapeRenderProps) => ReactElement;
}

const ELLIPSE: GeometryDef = { type: 'ellipse' };

const poly = (...pts: Array<[number, number]>): GeometryDef => ({
  type: 'polygon',
  vertices: pts.map(([x, y]): Point => ({ x, y })),
});


const DIAMOND = poly([0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]);

/** Rectangle body (top 78%) with a triangular tail whose tip touches the bottom edge; mirrors the drawn callout. */
function calloutGeometry(props: SceneObject['props']): GeometryDef {
  const tailX = typeof props.tailX === 'number' ? props.tailX : 0.2;
  const tip = Math.min(0.95, Math.max(0.05, tailX));
  const half = Math.min(0.08, tip, 1 - tip);
  return poly([0, 0], [1, 0], [1, 0.78], [tip + half, 0.78], [tip, 1], [tip - half, 0.78], [0, 0.78]);
}

type Row = [id: string, name: string, category: ShapeCategory, w: number, h: number, geometry: ShapeDefinition['geometry']];

const BUILT_IN: Row[] = [
  ['rect', 'Rectangle', 'uml', 40, 30, RECT_GEOMETRY],
  ['rounded', 'Rounded Rectangle', 'uml', 40, 30, RECT_GEOMETRY],
  ['terminator', 'Terminator', 'uml', 40, 20, RECT_GEOMETRY],
  ['ellipse', 'Ellipse', 'uml', 40, 30, ELLIPSE],
  ['diamond', 'Diamond', 'uml', 40, 30, DIAMOND],
  ['decision', 'Decision', 'uml', 24, 24, DIAMOND],
  ['triangle', 'Triangle', 'student-academic', 40, 30, poly([0.5, 0], [1, 1], [0, 1])],
  ['pentagon', 'Pentagon', 'student-academic', 40, 30, { type: 'polygon', vertices: fitToBox(ngonVertices(5)) }],
  ['hexagon', 'Hexagon', 'student-academic', 40, 30, poly([0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5])],
  ['star', 'Star', 'student-academic', 40, 40, { type: 'star', points: 5, innerRadiusRatio: 0.4 }],
  ['parallelogram', 'Parallelogram', 'uml', 40, 30, poly([0.2, 0], [1, 0], [0.8, 1], [0, 1])],
  ['callout', 'Callout', 'student-academic', 40, 30, calloutGeometry],
  ['cylinder', 'Database', 'database', 22, 25, RECT_GEOMETRY],
  ['server', 'Server', 'network', 22, 25, RECT_GEOMETRY],
  ['router', 'Router', 'network', 19, 19, ELLIPSE],
  ['switch', 'Switch', 'network', 23, 11, RECT_GEOMETRY],
  ['firewall', 'Firewall', 'network', 19, 15, RECT_GEOMETRY],
  ['pc', 'PC', 'network', 19, 17, RECT_GEOMETRY],
  ['cloud', 'Cloud', 'network', 24, 16, ELLIPSE],
  ['hub', 'Hub', 'network', 25, 10, RECT_GEOMETRY],
  ['interface', 'Interface', 'uml', 30, 15, RECT_GEOMETRY],
  ['package', 'Package', 'uml', 44, 32, RECT_GEOMETRY],
  ['actor', 'Actor', 'uml', 12, 28, RECT_GEOMETRY],
  ['fork', 'Fork / Join', 'uml', 40, 7, RECT_GEOMETRY],
];

export const SHAPE_DEFINITIONS: Record<string, ShapeDefinition> = {};

export function defineShape(def: ShapeDefinition): ShapeDefinition {
  SHAPE_DEFINITIONS[def.id] = def;
  return def;
}

/** Test seam: removes a shape that a test registered with defineShape. */
export function unregisterShape(id: string): void {
  delete SHAPE_DEFINITIONS[id];
}

for (const [id, name, category, width, height, geometry] of BUILT_IN) {
  defineShape({ id, name, category, defaultDimensions: { width, height }, geometry: packBackedGeometryFor(id) ?? geometry, customAnchors: packBackedAnchorsFor(id) });
}

/** The geometry primitive for any scene object; anything that is not a registered shape is a rectangle. */
export function geometryOf(obj: SceneObject): GeometryDef {
  if (obj.type === 'node') return obj.props.shape === 'rect' ? RECT_GEOMETRY : ELLIPSE;
  if (obj.type !== 'shape') return RECT_GEOMETRY;
  const def = SHAPE_DEFINITIONS[(obj.props.shape as string | undefined) ?? 'rect'];
  if (!def) return RECT_GEOMETRY;
  return typeof def.geometry === 'function' ? def.geometry(obj.props, { w: obj.w, h: obj.h }) : def.geometry;
}
