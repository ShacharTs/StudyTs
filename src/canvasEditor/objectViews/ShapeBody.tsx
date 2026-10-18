import type { ReactElement } from 'react';
import { polygonPoints } from './shapeGeometry';
import { PAINTED, type ShapePaint } from '../shapeBodies/shapePaint';
import { SHAPE_DEFINITIONS } from '../shapeEngine/shapeDefinitions';
import { PACK_BACKED_SHAPES } from '../shapeEngine/packBackedShapes';
import { packShapeBody } from './packShapeBody';

export type { ShapePaint };

const ellipse = ({ w, h, fill, stroke, sw }: ShapePaint) => {
  const inset = sw / 2;
  return <ellipse cx={w/2} cy={h/2} rx={Math.max(0, w/2 - inset)} ry={Math.max(0, h/2 - inset)} fill={fill} stroke={stroke} strokeWidth={sw} style={PAINTED} />;
};

function cornerRadius({ kind, h, radius }: ShapePaint): number {
  if (kind === 'rounded') return radius ?? 3;
  return kind === 'terminator' ? h / 2 : 0;
}

const rect = (p: ShapePaint) => {
  const inset = p.sw / 2;
  return <rect x={inset} y={inset} width={Math.max(0, p.w - p.sw)} height={Math.max(0, p.h - p.sw)} rx={cornerRadius(p)} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} style={PAINTED} />;
};

const NON_POLYGON: Record<string, (p: ShapePaint) => ReactElement> = {
  ellipse,
};

/** The filled shape for a `kind` (polygon kinds, ellipse, cylinder, server, otherwise a rect). */
export function ShapeBody(p: ShapePaint) {
  // A registered definition that brings its own render wins; built-in kinds keep the tables below.
  const custom = SHAPE_DEFINITIONS[p.kind]?.render;
  if (custom) return custom({ width: p.w, height: p.h, stroke: p.stroke, fill: p.fill, sw: p.sw });
  const packRef = PACK_BACKED_SHAPES[p.kind];
  if (packRef !== undefined) return packShapeBody(p, packRef);
  const pts = polygonPoints(p.kind, p.w, p.h, p.tailX);
  if (pts) return <polygon points={pts} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} style={PAINTED} />;
  return (NON_POLYGON[p.kind] ?? rect)(p);
}

/** The inner outline drawn for `doubleStroke` shapes (kinds without their own double outline fall back to a rect). */
export function ShapeOutline({ kind, w, h, stroke, sw }: ShapePaint) {
  const pts = polygonPoints(kind, w, h);
  const inset = sw / 2;
  let outline: ReactElement;
  if (pts) outline = <polygon points={pts} fill="none" stroke={stroke} strokeWidth={sw} />;
  else if (kind === 'ellipse') outline = <ellipse cx={w/2} cy={h/2} rx={Math.max(0, w/2-inset)} ry={Math.max(0, h/2-inset)} fill="none" stroke={stroke} strokeWidth={sw} />;
  else outline = <rect x={inset} y={inset} width={Math.max(0,w-sw)} height={Math.max(0,h-sw)} rx={kind==='rounded'?3:0} fill="none" stroke={stroke} strokeWidth={sw} />;
  return (
    <g transform={`translate(${w/2} ${h/2}) scale(0.86) translate(${-w/2} ${-h/2})`}>{outline}</g>
  );
}
