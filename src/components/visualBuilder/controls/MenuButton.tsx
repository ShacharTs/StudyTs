import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ControlIcon, type ControlIconName } from './controlIcons';
import { usePopoutFit } from '../usePopoutFit';
import styles from './Controls.module.css';

// className lets the layout hide an entry that only exists for a collapsed group (focus skips hidden entries).
type MenuAction = { label: string; icon?: ControlIconName; shortcut?: string; disabled?: boolean; checked?: boolean; className?: string; hint?: string; onSelect: () => void };
export type MenuButtonItem = { separator: true } | MenuAction;

interface MenuButtonProps {
  label: string;
  icon?: ControlIconName;
  items?: MenuButtonItem[];
  align?: 'start' | 'end';
  primary?: boolean;
  // Slot content (a form with its own state) stays mounted while the menu is closed, so closing never loses what was typed.
  keepMounted?: boolean;
  children?: ReactNode;
}

const isAction = (item: MenuButtonItem): item is MenuAction => !('separator' in item);

// Where focus goes for a key inside the open list; a letter jumps to the next item that starts with it.
function focusTarget(key: string, current: number, labels: string[]): number | null {
  const last = labels.length - 1;
  if (key === 'ArrowDown') return Math.min(current + 1, last);
  if (key === 'ArrowUp') return Math.max(current - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  if (key.length !== 1) return null;
  const turn = [...labels.slice(current + 1), ...labels.slice(0, current + 1)];
  const found = turn.findIndex((text) => text.toLowerCase().startsWith(key.toLowerCase()));
  return found < 0 ? null : (current + 1 + found) % labels.length;
}

function MenuRow({ item, onSelect }: { item: MenuAction; onSelect: (item: MenuAction) => void }) {
  const toggle = item.checked !== undefined;
  return (
    <button type="button" role={toggle ? 'menuitemcheckbox' : 'menuitem'} aria-checked={toggle ? item.checked : undefined} className={item.className ? `${styles.menuItem} ${item.className}` : styles.menuItem} title={item.hint} disabled={item.disabled} onClick={() => onSelect(item)}>
      {toggle && <span className={styles.menuTick}>{item.checked ? '✓' : ''}</span>}
      {item.icon && <ControlIcon name={item.icon} />}
      {item.label}
      {item.shortcut && <span className={styles.menuShortcut}>{item.shortcut}</span>}
    </button>
  );
}

export function MenuButton({ label, icon, items = [], align = 'start', primary, keepMounted, children }: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  usePopoutFit(list, { anchor: trigger, align, active: open });

  useEffect(() => {
    if (!open) return undefined;
    const outside = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    wrap.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)')?.focus();
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) return;
    if (event.key === 'Escape') {
      close();
      return;
    }
    const buttons = [...(wrap.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? [])].filter((button) => getComputedStyle(button).display !== 'none');
    const current = buttons.findIndex((button) => button === document.activeElement);
    const next = focusTarget(event.key, current, buttons.map((button) => button.textContent ?? ''));
    if (next === null) return;
    event.preventDefault();
    buttons[next]?.focus();
  };

  const select = (item: MenuAction) => {
    close();
    item.onSelect();
  };

  const showList = open || keepMounted;
  return (
    <div ref={wrap} className={styles.menuWrap} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        className={`${styles.control}${primary ? ` ${styles.primary}` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => event.key === 'ArrowDown' && setOpen(true)}
      >
        {icon && <ControlIcon name={icon} />}
        {label}
      </button>
      {showList && (
        <div ref={list} className={`${styles.menuList}${align === 'end' ? ` ${styles.menuEnd}` : ''}`} role="menu" aria-label={label} hidden={!open}>
          {items.map((item, index) => (isAction(item) ? <MenuRow key={item.label} item={item} onSelect={select} /> : <hr key={`separator-${index}`} className={styles.menuSeparator} />))}
          {children}
        </div>
      )}
    </div>
  );
}
