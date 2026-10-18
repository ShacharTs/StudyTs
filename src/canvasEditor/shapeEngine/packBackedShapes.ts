import { packAnchorsOnBox, packFrame, packOutlineOnBox } from '@core/visualBuilder/diagramPacks/packPlacement';
import { packObjectByRef } from '@core/visualBuilder/diagramPacks/stylePackRegistry';
import { RECT_GEOMETRY, type Anchor, type GeometryDef } from '@core/geometry/outline/geometryTypes';

// Canvas shape kind -> the pack object that draws it. The canvas and the step player paint the same asset.
export const PACK_BACKED_SHAPES: Readonly<Record<string, string>> = {
  actor: 'uml/actor',
  router: 'network/router',
  switch: 'network/switch',
  firewall: 'network/firewall',
  pc: 'network/client',
  cloud: 'network/cloud',
  hub: 'network/hub',
  interface: 'uml/interface-lollipop',
  package: 'uml/package',
  fork: 'uml/fork-join',
  cylinder: 'network/database',
  server: 'network/server',
};

const ELLIPSE_GEOMETRY: GeometryDef = { type: 'ellipse' };

export function packBackedAnchors(ref: string, w: number, h: number): Anchor[] {
  const object = packObjectByRef(ref);
  if (!object) return [];
  return packAnchorsOnBox(object, packFrame(object, { x: 0, y: 0, w, h }).box);
}

// The hit shape follows the drawing: its outline, mapped from the frame into box fractions.
export function packBackedGeometry(ref: string, w: number, h: number): GeometryDef {
  const object = packObjectByRef(ref);
  if (!object) return RECT_GEOMETRY;
  const outline = packOutlineOnBox(object, packFrame(object, { x: 0, y: 0, w, h }).box);
  if (outline === 'rect') return RECT_GEOMETRY;
  if (outline === 'ellipse') return ELLIPSE_GEOMETRY;
  const vertices = outline.polygon.map((point) => ({ x: w > 0 ? point.x / w : 0, y: h > 0 ? point.y / h : 0 }));
  return { type: 'polygon', vertices };
}

// Undefined for kinds that are not pack-backed, so their definition keeps its own geometry and anchors.
export function packBackedGeometryFor(kind: string): ((_props: unknown, size: { w: number; h: number }) => GeometryDef) | undefined {
  const ref = PACK_BACKED_SHAPES[kind];
  return ref === undefined ? undefined : (_props, size) => packBackedGeometry(ref, size.w, size.h);
}

export function packBackedAnchorsFor(kind: string): ((w: number, h: number) => Anchor[]) | undefined {
  const ref = PACK_BACKED_SHAPES[kind];
  return ref === undefined ? undefined : (w, h) => packBackedAnchors(ref, w, h);
}
