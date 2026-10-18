import type { PanelRegistry } from './dockTypes';
import type { DockStoreHook } from './createDockStore';

const DRAG_THRESHOLD_PX = 4;

/** Press on a tab: a click selects it, moving past the threshold drags it out of its stack. */
export function startTabDrag(store: DockStoreHook, stackId: string, panelId: string, e: React.PointerEvent): void {
  e.stopPropagation();
  const startX = e.clientX;
  const startY = e.clientY;
  const started = { current: false };

  const onMove = (ev: PointerEvent) => {
    if (!started.current) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
      started.current = true;
      store.getState().startDrag(panelId, stackId, ev.clientX, ev.clientY);
    } else {
      store.getState().updateDrag(ev.clientX, ev.clientY);
    }
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (started.current) store.getState().endDrag();
    else store.getState().setActiveTab(stackId, panelId);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

/** Whether a stack shows a header, and which tabs it lists. */
export function headerLayout(registry: PanelRegistry, panelIds: string[], collapsible: boolean, onClose?: () => void) {
  const hasVisibleTitle = panelIds.some((panelId) => registry[panelId]?.title);
  const showHeader = Boolean(collapsible || onClose || panelIds.length > 1 || hasVisibleTitle);
  // A lone untitled panel (e.g. the toolbox) has nothing to show or switch to, so it gets no tab
  // button (an empty padded button was rendered before). With several panels every tab stays
  // reachable, falling back to the panel id when its title is empty.
  const tabIds = panelIds.length > 1 ? panelIds : panelIds.filter((id) => registry[id]?.title ?? id);
  const tabLabel = (id: string) => registry[id]?.title || id;
  return { showHeader, tabIds, tabLabel };
}
