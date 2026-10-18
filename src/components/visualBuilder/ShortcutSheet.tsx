import { useRef } from 'react';
import { BUILDER_TEXT, useTranslation, type LocalizedText } from '@i18n';
import { TextButton } from './controls/TextButton';
import { usePopoutFit } from './usePopoutFit';
import styles from './BuilderWorkbench.module.css';

const text = BUILDER_TEXT;

const SHORTCUTS: Array<[string, LocalizedText]> = [
  ['V', text.cvShortcutSelectTool],
  ['L', text.cvShortcutArrowTool],
  ['1 to 8', text.cvShortcutAddShapes],
  ['A', text.cvShortcutAnimate],
  ['N', text.cvShortcutNewStep],
  ['[ ]', text.cvShortcutPrevNext],
  ['Space', text.cvShortcutPlayPause],
  ['Del', text.cvShortcutDelete],
  ['F2 or Enter', text.cvShortcutEdit],
  ['Esc', text.cvShortcutCancel],
  ['Ctrl Z / Y', text.cvShortcutUndoRedo],
  ['Ctrl D', text.cvShortcutDuplicate],
  ['Arrows', text.cvShortcutNudge],
];

export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const { val } = useTranslation();
  const root = useRef<HTMLDivElement>(null);
  usePopoutFit(root);
  return (
    <div ref={root} role="dialog" aria-label={val(text.cvKeyboardShortcuts)} className={styles.sheet} onKeyDown={(event) => event.key === 'Escape' && onClose()}>
      {SHORTCUTS.map(([keys, what]) => (
        <div key={keys} className={styles.sheetRow}>
          <kbd>{keys}</kbd>
          <span>{val(what)}</span>
        </div>
      ))}
      <TextButton label={val(text.cvClose)} onClick={onClose} />
    </div>
  );
}
