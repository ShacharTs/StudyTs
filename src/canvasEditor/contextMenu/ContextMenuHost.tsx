import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@canvasStore';
import { useTranslation } from '@i18n';
import { useContextMenu, type MenuAnchor, type MenuEntry, type MenuItem } from './contextMenuStore';
import { buildCanvasMenu } from './canvasMenu';
import { buildObjectMenu } from './objectMenu';
import styles from './ContextMenu.module.css';

const MARGIN = 4;
// Width a flyout needs; closer to the right edge than this, it opens to the left instead.
const SUBMENU_ROOM = 440;

interface MenuRowProps {
  item: MenuItem;
  flip: boolean;
  close: () => void;
}

/** One menu row; a row with a submenu shows its list in a flyout beside it. */
function MenuRow({ item, flip, close }: MenuRowProps) {
  const pick = (entry: MenuItem) => {
    entry.run?.();
    close();
  };
  if (!item.submenu) {
    return (
      <button className={styles.item} disabled={item.disabled} onClick={() => pick(item)}>
        <span>{item.label}</span>
      </button>
    );
  }
  return (
    <div className={styles.group}>
      <button className={styles.item} disabled={item.disabled}>
        <span>{item.label}</span>
        <span className={styles.shortcut}>{flip ? '◂' : '▸'}</span>
      </button>
      <div className={`${styles.submenu} ${flip ? styles.submenuFlip : ''}`}>
        {item.submenu.map((entry) => (
          <button key={entry.label} className={styles.item} disabled={entry.disabled} onClick={() => pick(entry)}>
            <span>{entry.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Right-click on a selection shows node actions only; on empty canvas it shows canvas actions only. */
function buildMenuItems(val: (input?: unknown) => string, anchor?: MenuAnchor): MenuEntry[] {
  return useCanvasStore.getState().selectedIds.length > 0 ? buildObjectMenu(val) : buildCanvasMenu(val, anchor);
}

export function ContextMenuHost() {
  const pos = useContextMenu((s) => s.pos);
  const anchor = useContextMenu((s) => s.anchor);
  const close = useContextMenu((s) => s.close);
  const { val } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<MenuEntry[]>([]);
  const [xy, setXY] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (pos) setItems(buildMenuItems(val, anchor ?? undefined));
  }, [pos, anchor, val]);

  useLayoutEffect(() => {
    if (!pos || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    setXY({
      x: Math.min(pos.x, window.innerWidth - width - MARGIN),
      y: Math.min(pos.y, window.innerHeight - height - MARGIN),
    });
  }, [pos, items]);

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', close, { passive: true });
    window.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', close);
      window.removeEventListener('pointerdown', close);
    };
  }, [pos, close]);

  if (!pos) return null;

  return (
    <div
      ref={ref}
      className={`${styles.menu} print-hide`}
      style={{ left: xy.x, top: xy.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={`sep-${i}`} className={styles.sep} />
        ) : (
          <MenuRow key={item.label} item={item} flip={xy.x > window.innerWidth - SUBMENU_ROOM} close={close} />
        )
      )}
    </div>
  );
}
