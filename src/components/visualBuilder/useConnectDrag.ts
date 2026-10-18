import { useEffect, useRef } from 'react';
import type { Point } from '@core/geometry/geometryPrimitives';
import type { VisualSpec } from '@core/types/visualSpec';
import { boxCenter, elementBox } from '@core/visualBuilder/builderGeometry';
import { elementPortPoint } from '@core/visualBuilder/elementPortPoint';
import type { BuilderMode, ModeEvent } from '@core/visualBuilder/builderMode';
import { hitTest } from '@core/visualBuilder/hitTest';
import { nearestSide } from '@core/visualBuilder/viewMath';

const MOVE_THRESHOLD = 6;

type ToPoint = (clientX: number, clientY: number) => Point;

interface DragInputs {
  spec: VisualSpec;
  mode: BuilderMode;
  toPoint: ToPoint;
  dispatch: (event: ModeEvent) => void;
}

function dragOrigin({ spec, mode }: DragInputs): Point | null {
  const from = mode.kind === 'drag' ? spec.elements.find((el) => el.id === mode.from) : undefined;
  if (!from || mode.kind !== 'drag') return null;
  return mode.side ? elementPortPoint(from, mode.side) : boxCenter(elementBox(from));
}

function shapeUnder({ spec, mode }: DragInputs, point: Point): string | null {
  const hit = hitTest(spec, point, { selectedId: null });
  return hit.kind === 'shape' && mode.kind === 'drag' && hit.id !== mode.from ? hit.id : null;
}

// While a connection is being dragged: follow the pointer, report the shape under it, finish on release, cancel on blur.
export function useConnectDrag(spec: VisualSpec, mode: BuilderMode, toPoint: ToPoint, dispatch: (event: ModeEvent) => void): void {
  const latest = useRef<DragInputs>({ spec, mode, toPoint, dispatch });
  latest.current = { spec, mode, toPoint, dispatch };
  const dragging = mode.kind === 'drag';

  useEffect(() => {
    if (!dragging) return undefined;
    let origin = dragOrigin(latest.current);
    const onMove = (event: MouseEvent) => {
      const inputs = latest.current;
      const point = inputs.toPoint(event.clientX, event.clientY);
      origin = origin ?? point;
      const moved = Math.hypot(point.x - origin.x, point.y - origin.y) > MOVE_THRESHOLD;
      inputs.dispatch({ type: 'pointerMoved', over: shapeUnder(inputs, point), moved });
    };
    const onUp = (event: MouseEvent) => {
      const inputs = latest.current;
      const point = inputs.toPoint(event.clientX, event.clientY);
      const over = shapeUnder(inputs, point);
      const target = inputs.spec.elements.find((el) => el.id === over);
      inputs.dispatch({ type: 'released', point, over, overSide: target ? nearestSide(elementBox(target), point) : null });
    };
    const onBlur = () => latest.current.dispatch({ type: 'cancel' });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [dragging]);
}
