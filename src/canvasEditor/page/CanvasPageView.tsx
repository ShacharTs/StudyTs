import { useCanvasStore, pageSizeMm, pxToMm } from '@canvasStore';
import { CanvasObjectFrame } from './CanvasObjectFrame';
import { useMarquee } from '../interaction/useMarquee';
import { MarqueeOverlay } from '../interaction/MarqueeOverlay';
import { AlignmentGuidesOverlay } from '../interaction/AlignmentGuidesOverlay';
import { DraftEdgeOverlay } from '../connectors/DraftEdgeOverlay';
import { spawnAtPoint, startLineDraw } from '../interaction/drawTools';
import { useContextMenu } from '../contextMenu/contextMenuStore';
import { usePageDrop } from '../interaction/pageDropStore';
import styles from './Page.module.css';

interface PageProps {
  pageId: string;
  printClassName?: string;
  dataCurrentPage?: 'true' | 'false';
}

export function CanvasPageView({ pageId, printClassName, dataCurrentPage }: PageProps) {
  const page = useCanvasStore((state) => state.doc.pages.find((p) => p.id === pageId));
  const showGrid = useCanvasStore((state) => state.showGrid);
  const isDropTarget = usePageDrop((state) => state.targetPageId === pageId);
  const { marqueeRect, onPointerDown: onMarqueePointerDown } = useMarquee(pageId);

  if (!page) return null;
  const { w, h } = pageSizeMm(page.orientation, page.paperSize);

  const handlePointerDown = (e: React.PointerEvent) => {
    useCanvasStore.getState().setCurrentPageId(pageId);
    if (e.target !== e.currentTarget) return;
    // Middle-button drags pan the viewport and right press opens the context menu: they must not
    // also spawn objects, draw lines or start a selection box.
    if (e.button !== 0) return;

    const tool = useCanvasStore.getState().activeTool;

    if (tool === 'hand') {
      return;
    }

    if (tool === 'text' || tool === 'shape') {
      const pageEl = e.currentTarget as HTMLElement;
      const rect = pageEl.getBoundingClientRect();
      const { zoom } = useCanvasStore.getState().viewport;
      const xMm = pxToMm(e.clientX - rect.left, zoom);
      const yMm = pxToMm(e.clientY - rect.top, zoom);
      spawnAtPoint(pageId, tool, xMm, yMm);
      return;
    }

    if (tool === 'line') {
      const pageEl = e.currentTarget as HTMLElement;
      const rect = pageEl.getBoundingClientRect();
      const { zoom } = useCanvasStore.getState().viewport;
      const xMm = pxToMm(e.clientX - rect.left, zoom);
      const yMm = pxToMm(e.clientY - rect.top, zoom);
      startLineDraw(pageId, xMm, yMm, pageEl, zoom);
      return;
    }

    onMarqueePointerDown(e);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Only empty canvas reaches here (objects stop propagation), so show the canvas menu, not the stale selection's.
    useCanvasStore.getState().clearSelection();
    useCanvasStore.getState().setCurrentPageId(pageId);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { zoom } = useCanvasStore.getState().viewport;
    useContextMenu.getState().open(e.clientX, e.clientY, {
      pageId,
      xMm: pxToMm(e.clientX - rect.left, zoom),
      yMm: pxToMm(e.clientY - rect.top, zoom),
    });
  };

  return (
    <div
      className={`${printClassName ? `${styles.page} ${printClassName}` : styles.page}${isDropTarget ? ` ${styles.dropTarget}` : ''}`}
      data-page-id={page.id}
      data-paper-size={page.paperSize}
      data-orientation={page.orientation}
      data-current-page={dataCurrentPage}
      style={{ width: `${w}mm`, height: `${h}mm` }}
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
    >
      {showGrid && <div className={`${styles.grid} print-hide`} />}
      <DraftEdgeOverlay pageId={page.id} />
      <MarqueeOverlay rect={marqueeRect} />
      <AlignmentGuidesOverlay pageId={page.id} />
      {page.objects.map((id) => (
        <CanvasObjectFrame key={id} objectId={id} pageId={page.id} />
      ))}
    </div>
  );
}
