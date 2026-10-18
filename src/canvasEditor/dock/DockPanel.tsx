import type { HeaderPlacement, PanelRegistry } from './dockTypes';
import type { DockStoreHook } from './createDockStore';
import { headerLayout, startTabDrag } from './dockHeader';
import styles from './DockPanel.module.css';

interface HeaderProps {
  store: DockStoreHook;
  registry: PanelRegistry;
  stackId: string;
  panelIds: string[];
  activeId: string;
  collapsed: boolean;
  collapsible: boolean;
  tabsDraggable: boolean;
  placement: HeaderPlacement;
  onClose?: () => void;
}

function CollapseButton({ store, stackId, collapsed }: { store: DockStoreHook; stackId: string; collapsed: boolean }) {
  return (
      <button
        className={styles.collapseBtn}
        title={collapsed ? 'Expand' : 'Collapse'}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => store.getState().toggleCollapsed(stackId)}
      >
        <svg
          className={collapsed ? styles.collapseIconCollapsed : styles.collapseIcon}
          width="14"
          height="14"
          viewBox="0 0 14 14"
        >
          <path d="M4 5.5 L7 8.5 L10 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
      <button
        className={styles.closeBtn}
        title="Close"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
      >
        ✕
      </button>
  );
}

function DockPanelHeader(props: HeaderProps & { instanceId: string; onBackgroundPointerDown?: (e: React.PointerEvent) => void }) {
  const { store, registry, stackId, panelIds, activeId, collapsed, collapsible, tabsDraggable, onClose } = props;
  const { tabIds, tabLabel } = headerLayout(registry, panelIds, collapsible, onClose);
  const selectTab = (panelId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    store.getState().setActiveTab(stackId, panelId);
  };
  return (
    <div
      className={props.placement === 'bottom' ? `${styles.header} ${styles.headerBottom}` : styles.header}
      data-stack-header={stackId}
      data-dock-instance={props.instanceId}
      onPointerDown={props.onBackgroundPointerDown}
    >
      <div className={styles.tabs}>
        {tabIds.map((panelId) => (
          <button
            key={panelId}
            className={`${styles.tab} ${panelId === activeId ? styles.tabActive : ''} ${tabsDraggable ? '' : styles.tabFixed}`}
            onPointerDown={(e) => (tabsDraggable ? startTabDrag(store, stackId, panelId, e) : selectTab(panelId, e))}
          >
            {tabLabel(panelId)}
          </button>
        ))}
      </div>
      {collapsible && <CollapseButton store={store} stackId={stackId} collapsed={collapsed} />}
      {onClose && <CloseButton onClose={onClose} />}
    </div>
  );
}

export function DockPanel({
  store,
  registry,
  stackId,
  panelIds,
  activeId,
  collapsed,
  collapsible = true,
  tabsDraggable = true,
  headerPlacement = 'top',
  enableContentDrop,
  onHeaderBackgroundPointerDown,
  onClose,
}: {
  store: DockStoreHook;
  registry: PanelRegistry;
  stackId: string;
  panelIds: string[];
  activeId: string;
  collapsed: boolean;
  collapsible?: boolean;
  /** When false a tab only selects its panel; it cannot be dragged out, floated or re-docked. */
  tabsDraggable?: boolean;
  /** Bottom tabs sit under the content, e.g. a panel stack acting as a footer switcher. */
  headerPlacement?: HeaderPlacement;
  enableContentDrop: boolean;
  onHeaderBackgroundPointerDown?: (e: React.PointerEvent) => void;
  onClose?: () => void;
}) {
  const instanceId = store((s) => s.instanceId);
  const ActiveComponent = registry[activeId]?.Component;
  const { showHeader } = headerLayout(registry, panelIds, collapsible, onClose);
  const header = showHeader ? (
    <DockPanelHeader
      {...{ store, registry, stackId, panelIds, activeId, collapsed, collapsible, tabsDraggable, onClose, instanceId, placement: headerPlacement }}
      onBackgroundPointerDown={onHeaderBackgroundPointerDown}
    />
  ) : null;

  return (
    <div className={styles.panel}>
      {headerPlacement === 'top' && header}
      <div className={collapsed ? styles.contentCollapse : styles.contentExpand}>
        <div
          className={styles.content}
          data-stack-content={enableContentDrop ? stackId : undefined}
          data-dock-instance={enableContentDrop ? instanceId : undefined}
        >
          {ActiveComponent ? <ActiveComponent /> : null}
        </div>
      </div>
      {headerPlacement === 'bottom' && header}
    </div>
  );
}
