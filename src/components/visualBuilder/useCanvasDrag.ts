import { useEffect, useRef, useState } from 'react';
import type { Point } from '@core/geometry/geometryPrimitives';
import { snapValue, type CanvasDrag } from '@core/visualBuilder/dragEdits';

type ToPoint = (clientX: number, clientY: number) => Point;

export function useCanvasDrag(snap: boolean, toPoint: ToPoint, onCommit: (drag: CanvasDrag) => void) {
  const [drag, setDrag] = useState<CanvasDrag | null>(null);
  const latest = useRef({ drag, snap, toPoint, onCommit });
  latest.current = { drag, snap, toPoint, onCommit };
  const dragging = drag !== null;

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (event: MouseEvent) => {
      const { drag: current, snap: grid, toPoint: locate } = latest.current;
      if (!current) return;
      const point = locate(event.clientX, event.clientY);
      setDrag({ ...current, dx: snapValue(point.x - current.start.x, grid), dy: snapValue(point.y - current.start.y, grid) });
    };
    const onUp = () => {
      const { drag: finished, onCommit: commit } = latest.current;
      setDrag(null);
      if (finished && (finished.dx !== 0 || finished.dy !== 0)) commit(finished);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const startDrag = (mode: CanvasDrag['mode'], id: string, start: Point, ids?: string[]) => setDrag({ mode, id, ids, start, dx: 0, dy: 0, snap });
  return { drag, startDrag };
}
