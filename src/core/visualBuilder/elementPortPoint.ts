import type { Point } from '../geometry/geometryPrimitives';
import type { BuilderSide, VisualElementSpec } from '../types/visualSpec';
import { elementBox, sidePoint } from './builderGeometry';
import { packObjectByRef } from './diagramPacks/stylePackRegistry';

// The outward direction each side stands for; a pack anchor serves the side it faces most.
const SIDE_DIRECTION: Record<BuilderSide, Point> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
};

// Below half a facing an anchor would serve the wrong side, so the box side is used instead.
const MIN_FACING = 0.5;

// A pack object with anchors meets links at its own points; a side without one falls back to the box edge.
export function elementPortPoint(el: VisualElementSpec, side: BuilderSide): Point {
  const box = elementBox(el);
  const anchors = el.builder?.pack ? packObjectByRef(el.builder.pack)?.anchors ?? [] : [];
  const direction = SIDE_DIRECTION[side];
  let chosen: { x: number; y: number } | undefined;
  let bestFacing = MIN_FACING;
  for (const anchor of anchors) {
    const facing = anchor.nx * direction.x + anchor.ny * direction.y;
    if (facing >= bestFacing) {
      chosen = anchor;
      bestFacing = facing;
    }
  }
  return chosen ? { x: box.x + chosen.x * box.w, y: box.y + chosen.y * box.h } : sidePoint(box, side);
}
