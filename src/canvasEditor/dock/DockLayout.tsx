import type { PanelRegistry, DockNode, DockSplit, SplitAxis } from './dockTypes';
import type { DockStoreHook } from './createDockStore';
import { FloatingWindow } from './FloatingWindow';
import styles from './DockLayout.module.css';
import { useRef } from 'react';
import { DockPanel } from './DockPanel';
import { computeDropTarget } from './findDropTarget';

function edgeRect(
  r: DOMRect,
  axis: SplitAxis,
  side: 'before' | 'after',
  fraction: number
): React.CSSProperties {
  if (axis === 'row') {
    const w = r.width * fraction;
    return {
      left: side === 'before' ? r.left : r.right - w,
      top: r.top,
      width: w,
      height: r.height,
    };
  }
  const h = r.height * fraction;
  return {
    left: r.left,
    top: side === 'before' ? r.top : r.bottom - h,
    width: r.width,
    height: h,
  };
}

export function DropOverlay({
  store,
  registry,
}: {
  store: DockStoreHook;
  registry: PanelRegistry;
}) {
  const drag = store((s) => s.drag);
  const instanceId = store((s) => s.instanceId);
  if (!drag) return null;
  const target = computeDropTarget(instanceId, drag.x, drag.y);

  if (target.kind === 'merge') {
    const el = document.querySelector(
      `[data-stack-header="${target.stackId}"][data-dock-instance="${instanceId}"]`
    );
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return (
      <div
        className={styles.mergeHighlight}
        style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
      />
    );
  }

  if (target.kind === 'split') {
    const el = document.querySelector(
      `[data-stack-content="${target.stackId}"][data-dock-instance="${instanceId}"]`
    );
    if (!el) return null;
    return (
      <div
        className={styles.splitHighlight}
        style={edgeRect(el.getBoundingClientRect(), target.axis, target.side, 0.5)}
      />
    );
  }

  if (target.kind === 'wall') {
    const el = document.querySelector(`[data-dock-root="${instanceId}"]`);
    if (!el) return null;
    return (
      <div
        className={styles.splitHighlight}
        style={edgeRect(el.getBoundingClientRect(), target.axis, target.side, 0.3)}
      />
    );
  }

  return (
    <div className={styles.floatGhost} style={{ left: drag.x - 90, top: drag.y - 14 }}>
      {registry[drag.panelId]?.title ?? drag.panelId}
    </div>
  );
}

const MIN_SLOT_PX = 120;

function DockZone({
  store,
  registry,
  node,
  fixedLayout,
}: {
  store: DockStoreHook;
  registry: PanelRegistry;
  node: DockNode;
  fixedLayout?: boolean;
}) {
  if (node.type === 'stack') {
    return (
      <DockPanel
        store={store}
        registry={registry}
        stackId={node.id}
        panelIds={node.panelIds}
        activeId={node.activeId}
        collapsed={node.collapsed}
        collapsible={node.collapsible !== false}
        tabsDraggable={!fixedLayout}
        headerPlacement={node.headerPlacement}
        enableContentDrop
      />
    );
  }
  return <SplitZone store={store} registry={registry} split={node} fixedLayout={fixedLayout} />;
}

function SplitZone({
  store,
  registry,
  split,
  fixedLayout,
}: {
  store: DockStoreHook;
  registry: PanelRegistry;
  split: DockSplit;
  fixedLayout?: boolean;
}) {
  const elRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const isRow = split.type === 'row';

  const startDrag = (index: number, e: React.PointerEvent) => {
    e.preventDefault();
    const el = elRefs.current[index];
    const rect = el?.getBoundingClientRect();
    const base = rect ? (isRow ? rect.width : rect.height) : 240;
    const startPos = isRow ? e.clientX : e.clientY;
    const onMove = (ev: PointerEvent) => {
      const pos = isRow ? ev.clientX : ev.clientY;
      store.getState().resize(split.id, index, Math.max(MIN_SLOT_PX, base + (pos - startPos)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className={isRow ? styles.row : styles.column}>
      {split.children.map((child, i) => {
        const isLast = i === split.children.length - 1;
        const size = split.sizes[i];
        const isCollapsedStack = child.type === 'stack' && child.collapsed;
        const style: React.CSSProperties = isCollapsedStack
          ? { flex: '0 0 auto', minWidth: 0, minHeight: 0 }
          : size != null
            ? { flex: `0 1 ${size}px`, minWidth: 0, minHeight: 0 }
            : { flex: '1 1 0', minWidth: 0, minHeight: 0 };
        return (
          <div key={child.id} className={styles.contents}>
            <div
              ref={(el) => {
                elRefs.current[i] = el;
              }}
              className={styles.slot}
              style={style}
            >
              <DockZone store={store} registry={registry} node={child} fixedLayout={fixedLayout} />
            </div>
            {!isLast && !split.locked && (
              <div
                className={isRow ? styles.vDivider : styles.hDivider}
                onPointerDown={(e) => startDrag(i, e)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DockLayout({
  store,
  registry,
  className,
  style,
  fixedLayout,
}: {
  store: DockStoreHook;
  registry: PanelRegistry;
  className?: string;
  style?: React.CSSProperties;
  /** Panels cannot be dragged, floated or re-docked. */
  fixedLayout?: boolean;
}) {
  const root = store((s) => s.root);
  const instanceId = store((s) => s.instanceId);
  const floating = store((s) => s.floating);

  return (
    <>
      <div
        className={`${styles.root} print-hide ${className ?? ''}`}
        data-dock-root={instanceId}
        style={style}
      >
        {root ? (
          <DockZone store={store} registry={registry} node={root} fixedLayout={fixedLayout} />
        ) : (
          <div className={styles.empty}>Drop panels here</div>
        )}
      </div>
      <div className={`${styles.floatingLayer} print-hide`}>
        {Object.values(floating).map((p) => (
          <FloatingWindow key={p.id} store={store} registry={registry} panel={p} />
        ))}
        <DropOverlay store={store} registry={registry} />
      </div>
    </>
  );
}
