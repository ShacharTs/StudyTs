import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { INSERT_GALLERY_TEXT, useTranslation } from '@i18n';
import type { WorkspaceMode } from '@core/visualBuilder/modes/workspaceMode';
import { controlClass } from './controls/controlClass';
import { ModeDemo } from './ModeDemo';
import { usePopoutFit } from './usePopoutFit';
import styles from './ModeMenu.module.css';

interface ModeMenuProps {
  mode: WorkspaceMode;
  modes: readonly WorkspaceMode[];
  showAll: boolean;
  onMode: (id: string) => void;
  onShowAll: (showAll: boolean) => void;
}

const text = INSERT_GALLERY_TEXT;

function ModePanel({ mode, modes, showAll, onMode, onShowAll, onClose, anchor }: ModeMenuProps & { onClose: () => void; anchor: React.RefObject<HTMLButtonElement> }) {
  const { val } = useTranslation();
  const scopeOf = (entry: WorkspaceMode): string => {
    const count = entry.filters.categories?.length ?? 0;
    return entry.filters.categories === null ? val(text.modeEverything) : `${count} ${val(count === 1 ? text.modeCategory : text.modeCategories)}`;
  };
  const root = useRef<HTMLDivElement>(null);
  const active = useRef<HTMLButtonElement>(null);
  usePopoutFit(root, { anchor, align: 'start' });
  useEffect(() => active.current?.focus(), []);
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !anchor.current?.contains(target)) onClose();
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [anchor, onClose]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onClose();
  };

  return (
    <div role="dialog" aria-label={val(text.modeTitle)} className={styles.panel} ref={root} onKeyDown={onKeyDown}>
      <div className={styles.head}>
        <h3 className={styles.title}>{val(text.modeTitle)}</h3>
        <label className={styles.showAll}>
          <input type="checkbox" checked={showAll} onChange={(event) => onShowAll(event.target.checked)} />
          {val(text.modeShowAll)}
        </label>
      </div>
      <div className={styles.grid}>
        {modes.map((entry) => (
          <button
            key={entry.id}
            type="button"
            ref={entry.id === mode.id ? active : undefined}
            className={styles.card}
            aria-pressed={entry.id === mode.id}
            onClick={() => {
              onMode(entry.id);
              onClose();
            }}
          >
            <ModeDemo modeId={entry.id} />
            <b><span className={styles.icon} aria-hidden="true">{entry.icon}</span> {val(entry.label)}</b>
            <small>{entry.note ? val(entry.note) : scopeOf(entry)}</small>
            <span className={styles.scope}>{scopeOf(entry)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ModeMenu(props: ModeMenuProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { val } = useTranslation();
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <>
      <button ref={trigger} type="button" className={controlClass(undefined)} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((was) => !was)}>
        {`${val(text.modeButton)}: ${val(props.mode.label)}`}
      </button>
      {open && <ModePanel {...props} anchor={trigger} onClose={close} />}
    </>
  );
}
