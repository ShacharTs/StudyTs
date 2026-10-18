import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { BUILDER_TEXT, useTranslation, type LocalizedText, type TranslateFn } from '@i18n';
import type { ContextAction, ContextItem } from '@core/visualBuilder/contextMenuItems';
import { menuVariables } from './cssVariables';
import { usePopoutFit } from './usePopoutFit';
import controlStyles from './controls/Controls.module.css';
import styles from './BuilderWorkbench.module.css';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  items: ContextItem[];
  onChoose: (item: ContextItem) => void;
  onClose: () => void;
}

const STEP_KEYS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

// Core supplies the English labels; these translate them by action, so a new core action shows its English label until it gets a row here.
const MENU_TEXT: Partial<Record<string, LocalizedText>> = {
  'add:text': BUILDER_TEXT.cvAddText,
  'add:caption': BUILDER_TEXT.cvAddCaption,
  insert: BUILDER_TEXT.cvInsertObject,
  addLabel: BUILDER_TEXT.cvAddLabel,
  removeLabel: BUILDER_TEXT.cvRemoveLabel,
  connect: BUILDER_TEXT.cvConnect,
  animate: BUILDER_TEXT.cvAnimate,
  duplicate: BUILDER_TEXT.cvDuplicate,
  delete: BUILDER_TEXT.cvDelete,
  reverse: BUILDER_TEXT.cvReverse,
  'route:straight': BUILDER_TEXT.cvStraight,
  'route:elbow': BUILDER_TEXT.cvElbow,
  'route:curve': BUILDER_TEXT.cvCurve,
};

function menuKey(action: ContextAction): string {
  if (action.type === 'add') return `add:${action.shape}`;
  if (action.type === 'route') return `route:${action.route}`;
  return action.type;
}

function menuLabel(item: ContextItem, val: TranslateFn): string {
  const translated = MENU_TEXT[menuKey(item.action)];
  return translated ? val(translated) : item.label;
}

function moveFocus(menu: HTMLElement, key: string) {
  const step = STEP_KEYS[key];
  if (!step) return;
  const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button')];
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
  buttons[(current + step + buttons.length) % buttons.length]?.focus();
}

// Closes on Escape, a press outside the menu and the window losing focus, so it never traps the user.
function useDismiss(menu: RefObject<HTMLElement>, onClose: () => void) {
  useEffect(() => {
    const onPress = (event: MouseEvent) => menu.current?.contains(event.target as Node) || onClose();
    const onKey = (event: globalThis.KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onPress);
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', onClose);
    return () => {
      document.removeEventListener('mousedown', onPress);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onClose);
    };
  }, [menu, onClose]);
}

export function CanvasContextMenu({ x, y, items, onChoose, onClose }: CanvasContextMenuProps) {
  const { val } = useTranslation();
  const root = useRef<HTMLDivElement>(null);
  useDismiss(root, onClose);
  usePopoutFit(root);
  useEffect(() => root.current?.querySelector('button')?.focus(), []);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (root.current) moveFocus(root.current, event.key);
  };
  return (
    <div ref={root} className={styles.contextMenu} style={menuVariables(x, y, items.length)} role="menu" aria-label={val(BUILDER_TEXT.cvCanvasActions)} onKeyDown={onKeyDown}>
      {items.map((item) => (
        <button key={item.label} type="button" role="menuitem" className={controlStyles.menuItem} onClick={() => onChoose(item)}>
          {menuLabel(item, val)}
        </button>
      ))}
    </div>
  );
}
