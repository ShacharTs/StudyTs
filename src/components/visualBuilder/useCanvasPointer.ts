import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Point } from '@core/geometry/geometryPrimitives';
import type { VisualSpec } from '@core/types/visualSpec';
import type { BuilderMode, ModeEvent } from '@core/visualBuilder/builderMode';
import type { CanvasDrag } from '@core/visualBuilder/dragEdits';
import { objectKindOf } from '@core/visualBuilder/effects';
import { hitTest, type Hit } from '@core/visualBuilder/hitTest';

interface CanvasPointerInputs {
  spec: VisualSpec;
  selectedId: string | null;
  selectedIds: string[];
  hoverId: string | null;
  mode: BuilderMode;
  toPoint: (clientX: number, clientY: number) => Point;
  portRadius: number;
  startDrag: (mode: CanvasDrag['mode'], id: string, start: Point, ids?: string[]) => void;
  startMarquee: (start: Point, additive: boolean) => void;
  dispatch: (event: ModeEvent) => void;
  onSelect: (id: string | null) => void;
  onToggle: (id: string) => void;
}

function modeEventFor(spec: VisualSpec, hit: Hit): ModeEvent {
  if (hit.kind === 'port') return { type: 'portPressed', id: hit.id, side: hit.side };
  if (hit.kind !== 'shape' && hit.kind !== 'link') return { type: 'backgroundPressed' };
  const element = spec.elements.find((el) => el.id === hit.id);
  if (!element) return { type: 'backgroundPressed' };
  return { type: 'shapePressed', id: hit.id, isLink: hit.kind === 'link', kind: objectKindOf(element) };
}

export function useCanvasPointer({ spec, selectedId, selectedIds, hoverId, mode, toPoint, portRadius, startDrag, startMarquee, dispatch, onSelect, onToggle }: CanvasPointerInputs) {
  const selectHit = (hit: Hit, point: Point, additive: boolean) => {
    if (hit.kind === 'port') return dispatch(modeEventFor(spec, hit));
    if (hit.kind === 'handle') return startDrag('resize', hit.id, point);
    if (hit.kind === 'background') return startMarquee(point, additive);
    if (additive) return onToggle(hit.id);
    const inGroup = selectedIds.length > 1 && selectedIds.includes(hit.id);
    if (!inGroup) onSelect(hit.id);
    if (hit.kind === 'shape') startDrag('move', hit.id, point, inGroup ? selectedIds : undefined);
    return undefined;
  };

  return (event: ReactMouseEvent) => {
    if (event.button !== 0) return undefined;
    const point = toPoint(event.clientX, event.clientY);
    if (mode.kind === 'pickSpot') return dispatch({ type: 'spotClicked', point });
    const hit = hitTest(spec, point, { selectedId, hoverId, arrow: mode.kind === 'connect', portRadius });
    return mode.kind === 'select' ? selectHit(hit, point, event.shiftKey || event.ctrlKey || event.metaKey) : dispatch(modeEventFor(spec, hit));
  };
}
