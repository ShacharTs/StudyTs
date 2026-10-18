import type { FloatingPanel, PanelRegistry } from './dockTypes';
import type { DockStoreHook } from './createDockStore';
import { DockPanel } from './DockPanel';
import styles from './FloatingWindow.module.css';

const MIN_W = 220;
const MIN_H = 160;
const VISIBLE_MARGIN = 40;

export function FloatingWindow({
  store,
  registry,
  panel,
}: {
  store: DockStoreHook;
  registry: PanelRegistry;
  panel: FloatingPanel;
}) {
  const startMove = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const baseX = panel.x;
    const baseY = panel.y;
    const onMove = (ev: PointerEvent) => {
      const maxX = window.innerWidth - VISIBLE_MARGIN;
      const maxY = window.innerHeight - VISIBLE_MARGIN;
      const nextX = Math.min(Math.max(baseX + (ev.clientX - startX), -panel.w + VISIBLE_MARGIN), maxX);
      const nextY = Math.min(Math.max(baseY + (ev.clientY - startY), 0), maxY);
      store.getState().moveFloating(panel.id, nextX, nextY);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const baseW = panel.w;
    const baseH = panel.h;
    const onMove = (ev: PointerEvent) => {
      store
        .getState()
        .resizeFloating(
          panel.id,
          Math.max(MIN_W, baseW + (ev.clientX - startX)),
          Math.max(MIN_H, baseH + (ev.clientY - startY))
        );
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      className={styles.floating}
      style={{ left: panel.x, top: panel.y, width: panel.w, height: panel.h, zIndex: panel.z }}
      onPointerDownCapture={() => store.getState().bringToFront(panel.id)}
    >
      <DockPanel
        store={store}
        registry={registry}
        stackId={panel.id}
        panelIds={panel.panelIds}
        activeId={panel.activeId}
        collapsed={panel.collapsed}
        enableContentDrop={false}
        onHeaderBackgroundPointerDown={startMove}
        onClose={() => store.getState().closeFloating(panel.id)}
      />
      <div className={styles.resizeHandle} onPointerDown={startResize} />
    </div>
  );
}
