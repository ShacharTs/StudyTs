import { useEffect, useRef, useState } from 'react';
import type { Point } from '@core/geometry/geometryPrimitives';
import type { GeometryBox } from '@core/visualBuilder/builderGeometry';

type ToPoint = (clientX: number, clientY: number) => Point;

interface Rubber {
  start: Point;
  end: Point;
  additive: boolean;
}

const MIN_DRAG = 4;

export const rubberBox = (rubber: Pick<Rubber, 'start' | 'end'>): GeometryBox => ({
  x: Math.min(rubber.start.x, rubber.end.x),
  y: Math.min(rubber.start.y, rubber.end.y),
  w: Math.abs(rubber.end.x - rubber.start.x),
  h: Math.abs(rubber.end.y - rubber.start.y),
});

// A background drag draws a rectangle; a plain click (no real drag) just clears the selection.
export function useVisualBuilderMarquee(toPoint: ToPoint, onDone: (box: GeometryBox | null, additive: boolean) => void) {
  const [rubber, setRubber] = useState<Rubber | null>(null);
  const latest = useRef({ rubber, toPoint, onDone });
  latest.current = { rubber, toPoint, onDone };
  const active = rubber !== null;

  useEffect(() => {
    if (!active) return undefined;
    const onMove = (event: MouseEvent) => {
      const { rubber: current, toPoint: locate } = latest.current;
      if (current) setRubber({ ...current, end: locate(event.clientX, event.clientY) });
    };
    const onUp = () => {
      const { rubber: finished, onDone: done } = latest.current;
      setRubber(null);
      if (!finished) return;
      const box = rubberBox(finished);
      done(box.w < MIN_DRAG && box.h < MIN_DRAG ? null : box, finished.additive);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [active]);

  const startMarquee = (start: Point, additive: boolean) => setRubber({ start, end: start, additive });
  return { rubber, startMarquee };
}
