import { useCanvasStore, addPage, removePage, movePage, pageSizeMm, PX_PER_MM } from '@canvasStore';
import { centerPage } from '../viewport/pageViewport';
import styles from './PagesPanel.module.css';
import { CanvasPageView } from './CanvasPageView';
import { PagePreviewProvider } from '@canvasEditor/page/pagePreviewContext';

const THUMB_W = 140;

interface PageThumbnailProps {
  pageId: string;
  index: number;
}

export function PageThumbnail({ pageId, index }: PageThumbnailProps) {
  void index;
  const page = useCanvasStore((state) => state.doc.pages.find((p) => p.id === pageId));
  const currentPageId = useCanvasStore((state) => state.currentPageId);
  if (!page) return null;

  const { w: pageWmm, h: pageHmm } = pageSizeMm(page.orientation, page.paperSize);
  const scale = THUMB_W / (pageWmm * PX_PER_MM);
  const boxH = pageHmm * PX_PER_MM * scale;

  return (
    <div
      className={`${styles.thumb} ${currentPageId === pageId ? styles.thumbActive : ''}`}
      data-testid="thumb-outer"
      style={{ width: THUMB_W, height: boxH }}
      onClick={() => useCanvasStore.getState().setCurrentPageId(pageId)}
    >
      <div
        className={styles.thumbInner}
        data-testid="thumb-inner"
        style={{ transform: `scale(${scale})`, pointerEvents: 'none' }}
      >
        <PagePreviewProvider value={true}>
          <CanvasPageView pageId={pageId} />
        </PagePreviewProvider>
      </div>
    </div>
  );
}

export function PagesPanel() {
  const pages = useCanvasStore((state) => state.doc.pages);

  return (
    <div className={styles.panel}>
      {pages.map((page, i) => (
        <div
          key={page.id}
          className={`${styles.pageRow} ${styles.pageRowStack}`}
        >
          <PageThumbnail pageId={page.id} index={i} />
          <div className={styles.pageRow}>
            <span>{i + 1}</span>
            <button
              type="button"
              data-testid={`page-move-up-${i}`}
              className={styles.iconBtn}
              title="Move page up"
              disabled={i === 0}
              onClick={() => {
                movePage(page.id, i - 1);
                centerPage(useCanvasStore.getState().doc.pages, i - 1);
              }}
            >
              ▲
            </button>
            <button
              type="button"
              data-testid={`page-move-down-${i}`}
              className={styles.iconBtn}
              title="Move page down"
              disabled={i === pages.length - 1}
              onClick={() => {
                movePage(page.id, i + 1);
                centerPage(useCanvasStore.getState().doc.pages, i + 1);
              }}
            >
              ▼
            </button>
            <button
              type="button"
              data-testid={`page-insert-${i}`}
              className={styles.iconBtn}
              title="Insert a new page after this one"
              onClick={() => addPage(i)}
            >
              ＋
            </button>
            <button
              type="button"
              data-testid={`page-delete-${i}`}
              className={styles.iconBtn}
              title="Delete this page"
              disabled={pages.length <= 1}
              onClick={() => {
                if (window.confirm(`Delete page ${i + 1}? This can't be undone.`)) {
                  removePage(page.id);
                }
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        data-testid="pages-panel-add"
        className={styles.addPageBtn}
        title="Add a new page"
        onClick={() => addPage(pages.length - 1)}
      >
        + Add page
      </button>
    </div>
  );
}
