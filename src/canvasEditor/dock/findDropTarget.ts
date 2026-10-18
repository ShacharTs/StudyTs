import type { SplitAxis, WallSide } from './dockTypes';

export type DropTarget =
  | { kind: 'merge'; stackId: string }
  | { kind: 'split'; stackId: string; axis: SplitAxis; side: 'before' | 'after' }
  | { kind: 'wall'; axis: SplitAxis; side: 'before' | 'after' }
  | { kind: 'float' };

const WALL_THRESHOLD_PX = 24;
const SPLIT_EDGE_RATIO = 0.25;

export function pointInRect(x: number, y: number, r: DOMRect): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function wallSideToAxis(side: WallSide): SplitAxis {
  return side === 'left' || side === 'right' ? 'row' : 'column';
}

function wallSideToInsertSide(side: WallSide): 'before' | 'after' {
  return side === 'left' || side === 'top' ? 'before' : 'after';
}

function nearestSide(distances: Record<WallSide, number>): WallSide {
  return (Object.keys(distances) as WallSide[]).reduce((a, b) =>
    distances[a] <= distances[b] ? a : b
  );
}

export function computeDropTarget(
  instanceId: string,
  clientX: number,
  clientY: number
): DropTarget {
  const rootEl = document.querySelector<HTMLElement>(`[data-dock-root="${instanceId}"]`);
  if (rootEl) {
    const r = rootEl.getBoundingClientRect();
    if (pointInRect(clientX, clientY, r)) {
      const distances: Record<WallSide, number> = {
        left: clientX - r.left,
        right: r.right - clientX,
        top: clientY - r.top,
        bottom: r.bottom - clientY,
      };
      const side = nearestSide(distances);
      if (distances[side] <= WALL_THRESHOLD_PX) {
        return { kind: 'wall', axis: wallSideToAxis(side), side: wallSideToInsertSide(side) };
      }
    }
  }

  const el = document.elementFromPoint(clientX, clientY);

  const header = el?.closest<HTMLElement>(
    `[data-stack-header][data-dock-instance="${instanceId}"]`
  );
  if (header) return { kind: 'merge', stackId: header.dataset.stackHeader! };

  const content = el?.closest<HTMLElement>(
    `[data-stack-content][data-dock-instance="${instanceId}"]`
  );
  if (content) {
    const r = content.getBoundingClientRect();
    const relX = (clientX - r.left) / r.width;
    const relY = (clientY - r.top) / r.height;
    const edges: Record<WallSide, number> = {
      left: relX,
      right: 1 - relX,
      top: relY,
      bottom: 1 - relY,
    };
    const side = nearestSide(edges);
    if (edges[side] < SPLIT_EDGE_RATIO) {
      return {
        kind: 'split',
        stackId: content.dataset.stackContent!,
        axis: wallSideToAxis(side),
        side: wallSideToInsertSide(side),
      };
    }
    return { kind: 'merge', stackId: content.dataset.stackContent! };
  }

  return { kind: 'float' };
}
