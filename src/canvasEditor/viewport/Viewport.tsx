import { useEffect, useRef } from 'react';
import { useCanvasStore } from '@canvasStore';
import { CanvasPageView } from '../page/CanvasPageView';
import { registerViewportEl } from './pageViewport';
import { useViewportControls } from './useViewportControls';
import { PageDropGhosts } from './PageDropGhosts';
import styles from './Viewport.module.css';

export function Viewport() {
  const ref = useRef<HTMLDivElement>(null);
  const pages = useCanvasStore((state) => state.doc.pages);
  const viewport = useCanvasStore((state) => state.viewport);
  const currentPageId = useCanvasStore((state) => state.currentPageId);

  useEffect(() => {
    registerViewportEl(ref.current);
    return () => registerViewportEl(null);
  }, []);

  useViewportControls(ref);

  return (
    <div ref={ref} className={`${styles.viewport} canvasPrintStage`}>
      <div
        className={`${styles.world} canvasPrintWorld`}
        data-testid="canvas-world"
        style={{
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        }}
      >
        {pages.map((p) => (
          <CanvasPageView
            key={p.id}
            pageId={p.id}
            printClassName="canvasPrintPage"
            dataCurrentPage={p.id === currentPageId ? 'true' : 'false'}
          />
        ))}
      </div>
      <PageDropGhosts />
    </div>
  );
}
