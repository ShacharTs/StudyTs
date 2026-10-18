import { useObject, type SceneObject } from '@canvasStore';
import { computeBoundEdgeEndpoints } from './connectorBinding';

interface PlaceholderBox {
  minX: number;
  minY: number;
  boxW: number;
  boxH: number;
}

export interface BoundEdgeLine extends PlaceholderBox {
  startAbs: { x: number; y: number };
  endAbs: { x: number; y: number };
}

export function isBoundEdgeObject(obj: SceneObject | undefined): boolean {
  if (!obj) return false;
  return (obj.type === 'edge' || obj.type === 'line') && Boolean(obj.props.sourceId || obj.props.targetId);
}

export function useBoundEdgeGeometry(obj: SceneObject | undefined): BoundEdgeLine | null {
  const isBound = isBoundEdgeObject(obj);
  const sourceObj = useObject(isBound ? (obj!.props.sourceId as string) || '' : '');
  const targetObj = useObject(isBound ? (obj!.props.targetId as string) || '' : '');

  if (!obj || !isBound) return null;
  return computeBoundEdgeEndpoints(obj, sourceObj, targetObj);
}

const PAINTED_ONLY = new Set(['shape', 'node', 'line', 'edge']);

export function placeholderWrapperStyle(
  box: PlaceholderBox,
  isBoundEdge: boolean,
  obj: SceneObject,
  computedZIndex: number
): React.CSSProperties {
  return {
    left: `${box.minX}mm`,
    top: `${box.minY}mm`,
    width: `${box.boxW}mm`,
    height: `${box.boxH}mm`,
    transform: !isBoundEdge && obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
    zIndex: computedZIndex,
    cursor: isBoundEdge ? undefined : obj.locked ? 'default' : 'move',
    // Shapes, nodes and lines are SVG-painted: only the painted contour/stroke is hit, so empty box area falls through.
    pointerEvents: isBoundEdge || PAINTED_ONLY.has(obj.type) ? 'none' : 'auto',
  };
}
