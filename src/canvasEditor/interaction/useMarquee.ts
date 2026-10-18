import { useCallback, useState, useRef } from 'react';
import { useCanvasStore, pxToMm } from '@canvasStore';
import type { Rect } from '@core/geometry/geometryPrimitives';
import { idsFullyInside } from './marqueeHitTest';

const DRAG_MIN_MM = 1;

export function useMarquee(
  pageId: string
): { marqueeRect: Rect | null; onPointerDown: (e: React.PointerEvent) => void } {
  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null);
  const latestRectRef = useRef<Rect | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Primary button only: a middle-button drag pans the viewport and a right press opens the context
      // menu; neither may also start a selection box.
      if ((e.button ?? 0) !== 0) return;
      const isMultiKey = e.shiftKey || e.ctrlKey || e.metaKey;
      const pageEl = e.currentTarget as HTMLElement;
      const pageRect = pageEl.getBoundingClientRect();
      const zoom = useCanvasStore.getState().viewport.zoom;
      const startX = pxToMm(e.clientX - pageRect.left, zoom);
      const startY = pxToMm(e.clientY - pageRect.top, zoom);
      let moved = false;
      latestRectRef.current = null;

      const onMove = (moveEvent: PointerEvent) => {
        const curX = pxToMm(moveEvent.clientX - pageRect.left, zoom);
        const curY = pxToMm(moveEvent.clientY - pageRect.top, zoom);
        const dx = curX - startX;
        const dy = curY - startY;
        if (Math.abs(dx) >= DRAG_MIN_MM || Math.abs(dy) >= DRAG_MIN_MM) moved = true;
        const nextRect: Rect = {
          x: Math.min(startX, curX),
          y: Math.min(startY, curY),
          w: Math.abs(dx),
          h: Math.abs(dy),
        };
        latestRectRef.current = nextRect;
        setMarqueeRect(nextRect);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        const finalRect = latestRectRef.current;
        latestRectRef.current = null;
        setMarqueeRect(null);

        if (!moved || !finalRect) {
          if (!isMultiKey) useCanvasStore.getState().clearSelection();
          return;
        }

        const state = useCanvasStore.getState();
        const page = state.doc.pages.find((p) => p.id === pageId);
        if (page) {
          const candidates = page.objects
            .map((id) => state.doc.objects[id])
            .filter((o): o is NonNullable<typeof o> => Boolean(o))
            .filter((o) => o.type !== 'edge' && !o.hidden);
          const hits = idsFullyInside(finalRect, candidates);
          if (isMultiKey) {
            state.select([...new Set([...state.selectedIds, ...hits])]);
          } else {
            state.select(hits);
          }
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [pageId]
  );

  return { marqueeRect, onPointerDown };
}
