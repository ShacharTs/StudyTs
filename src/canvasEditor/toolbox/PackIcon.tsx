import { PACK_BACKED_SHAPES } from '../shapeEngine/packBackedShapes';
import { packShapeNodes } from '../objectViews/packShapeBody';

const ICON_BOX = { x: 2, y: 2, w: 20, h: 20 };

// A toolbox icon for a pack-backed shape draws the same pack drawing as the canvas, so an icon cannot drift from its shape.
export function PackIcon({ kind }: { kind: string }) {
  const ref = PACK_BACKED_SHAPES[kind];
  const nodes = ref ? packShapeNodes(ref, ICON_BOX, 'currentColor', 1.5) : null;
  return <svg width="24" height="24" viewBox="0 0 24 24">{nodes}</svg>;
}
