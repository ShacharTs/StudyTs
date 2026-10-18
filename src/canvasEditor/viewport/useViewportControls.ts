import { useEffect } from 'react';
import { useCanvasStore, clampZoom } from '@canvasStore';

export function useViewportControls(viewportRef: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom, panX, panY } = useCanvasStore.getState().viewport;
      if (e.ctrlKey || e.metaKey) {
        const next = clampZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const k = next / zoom;
        useCanvasStore.getState().setViewport({
          zoom: next,
          panX: cx - (cx - panX) * k,
          panY: cy - (cy - panY) * k,
        });
      } else {
        useCanvasStore.getState().setViewport({ panX: panX - e.deltaX, panY: panY - e.deltaY });
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewportRef]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    const onPointerDown = (e: PointerEvent) => {
      const isHand = useCanvasStore.getState().activeTool === 'hand';
      const middle = e.button === 1;
      if (!middle && !isHand) return;

      const start = {
        x: e.clientX,
        y: e.clientY,
        panX: useCanvasStore.getState().viewport.panX,
        panY: useCanvasStore.getState().viewport.panY,
      };

      const onMove = (moveEvent: PointerEvent) => {
        useCanvasStore.getState().setViewport({
          panX: start.panX + (moveEvent.clientX - start.x),
          panY: start.panY + (moveEvent.clientY - start.y),
        });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    el.addEventListener('pointerdown', onPointerDown);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
    };
  }, [viewportRef]);
}
