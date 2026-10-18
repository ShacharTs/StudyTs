import { useEffect, useState, type RefObject } from 'react';
import type { Point } from '@core/geometry/geometryPrimitives';
import { pixelsToView } from '@core/visualBuilder/viewMath';
import { visibleViewBox } from './visibleViewBox';

export function useDragCursor(dragging: boolean, stage: RefObject<HTMLElement>): Point | null {
  const [cursor, setCursor] = useState<Point | null>(null);
  useEffect(() => {
    if (!dragging) {
      setCursor(null);
      return undefined;
    }
    const move = (event: MouseEvent) => {
      const canvas = stage.current?.querySelector('svg[aria-label="Builder canvas"]');
      const rect = canvas?.getBoundingClientRect();
      if (!canvas || !rect) return;
      setCursor(pixelsToView({ x: event.clientX, y: event.clientY }, visibleViewBox(canvas), { left: rect.left, top: rect.top, width: rect.width, height: rect.height }));
    };
    document.addEventListener('mousemove', move);
    return () => document.removeEventListener('mousemove', move);
  }, [dragging, stage]);
  return cursor;
}
