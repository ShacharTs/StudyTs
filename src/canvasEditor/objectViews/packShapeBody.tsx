import { createElement, type ReactElement } from 'react';
import type { VisualElementSpec } from '@core/types/visualSpec';
import { packDrawingElements } from '@core/visualBuilder/diagramPacks/packObjectElements';
import { packObjectByRef } from '@core/visualBuilder/diagramPacks/stylePackRegistry';
import { PAINTED, type ShapePaint } from '../shapeBodies/shapePaint';

const SVG_TAGS: readonly string[] = ['circle', 'ellipse', 'rect', 'path'];
const PAINT_KEYS = ['fill', 'stroke', 'strokeWidth', 'strokeDasharray', 'fillOpacity'] as const;

function paintOf(style: VisualElementSpec['style']): Record<string, number | string> {
  const paint: Record<string, number | string> = {};
  for (const key of PAINT_KEYS) {
    const value = style?.[key];
    if (value !== undefined) paint[key] = value;
  }
  return paint;
}

function drawnNode(el: VisualElementSpec, index: number): ReactElement | null {
  if (!SVG_TAGS.includes(el.kind)) return null;
  return createElement(el.kind, { ...el.attrs, ...paintOf(el.style), key: index });
}

// The pack's drawing as React nodes, in one colour; any host (canvas body, toolbox icon) paints the same asset.
export function packShapeNodes(ref: string, box: { x: number; y: number; w: number; h: number }, colorToken: string, strokeWidth?: number): (ReactElement | null)[] | null {
  const object = packObjectByRef(ref);
  if (!object) return null;
  return packDrawingElements(object, box, colorToken, strokeWidth).map(drawnNode);
}

// The canvas paints the pack's own drawing, in its own stroke and colour; the transparent box keeps the whole figure grabbable.
export function packShapeBody(p: ShapePaint, ref: string): ReactElement | null {
  const nodes = packShapeNodes(ref, { x: 0, y: 0, w: p.w, h: p.h }, p.stroke, p.sw);
  if (!nodes) return null;
  return (
    <g style={PAINTED}>
      <rect x={0} y={0} width={p.w} height={p.h} fill="transparent" stroke="none" />
      {nodes}
    </g>
  );
}
