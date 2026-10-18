import { useCanvasStore } from '@canvasStore';
import { useTheme } from '../../core/theme/ThemeContext';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { clampPageIndex } from '../viewport/pageViewport';
import { useRightDockStore } from '../panelLayout/panelDockStores';
import styles from './StatusBar.module.css';

const ZOOM_STEP = 1.1;

function ZoomControl() {
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const setViewport = useCanvasStore((s) => s.setViewport);

  return (
    <div className={styles.group}>
      <button
        type="button"
        className={styles.navBtn}
        onClick={() => setViewport({ zoom: zoom / ZOOM_STEP })}
        title="Zoom Out"
      >
        <ZoomOut size={14} />
      </button>
      <span
        className={styles.zoomValue}
        onClick={() => setViewport({ zoom: 1 })}
        title="Reset zoom to 100%"
      >
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        className={styles.navBtn}
        onClick={() => setViewport({ zoom: zoom * ZOOM_STEP })}
        title="Zoom In"
      >
        <ZoomIn size={14} />
      </button>
    </div>
  );
}

export function PageIndicator() {
  const pages = useCanvasStore((s) => s.doc.pages);
  const currentPageId = useCanvasStore((s) => s.currentPageId);
  const setCurrentPageId = useCanvasStore((s) => s.setCurrentPageId);

  const total = pages.length;
  const index = Math.max(pages.findIndex((p) => p.id === currentPageId), 0);

  const goTo = (target: number) => {
    const clamped = clampPageIndex(target, total);
    const page = pages[clamped];
    if (!page) return;
    setCurrentPageId(page.id);
  };

  return (
    <div className={styles.group}>
      <button
        type="button"
        className={styles.navBtn}
        disabled={index <= 0}
        onClick={() => goTo(index - 1)}
        title="Previous Page"
      >
        <ChevronLeft size={14} />
      </button>
      <span>Page {total === 0 ? 0 : index + 1} of {total}</span>
      <button
        type="button"
        className={styles.navBtn}
        disabled={index >= total - 1}
        onClick={() => goTo(index + 1)}
        title="Next Page"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

export function StatusBar() {
  const objects = useCanvasStore((s) => Object.keys(s.doc.objects).length);
  const selected = useCanvasStore((s) => s.selectedIds.length);
  const theme = useTheme();
  const openPages = () => {
    useRightDockStore.getState().openFloating('pages', 260, 360);
  };
  const openLayers = () => {
    useRightDockStore.getState().openFloating('layers', 260, 360);
  };

  return (
    <div className={`${styles.bar} print-hide`}>
      <div className={styles.cluster}>
        <PageIndicator />
        <button
          type="button"
          className={styles.themeToggle}
          onClick={openPages}
        >
          Pages
        </button>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={openLayers}
        >
          Layers
        </button>
        <span className={styles.divider} />
        <span>Objects {objects}</span>
        {selected > 0 && <span>Selected {selected}</span>}
      </div>
      <div className={styles.cluster}>
        <ZoomControl />
        <button
          type="button"
          className={styles.themeToggle}
          onClick={() => theme.setMode(theme.mode === 'dark' ? 'light' : 'dark')}
        >
          {theme.mode === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </div>
  );
}
