import { INSERT_GALLERY_TEXT, useTranslation } from '@i18n';
import { TextButton } from './controls/TextButton';
import styles from './ModeBar.module.css';

interface ReplaceBarProps {
  onReplace: () => void;
  onKeep: () => void;
}

// Takes the place of the inspector row, so asking never moves the canvas.
export function ReplaceBar({ onReplace, onKeep }: ReplaceBarProps) {
  const { val } = useTranslation();
  return (
    <div className={styles.inspector} role="alertdialog" aria-label={val(INSERT_GALLERY_TEXT.replaceConfirm)}>
      <span>{val(INSERT_GALLERY_TEXT.replaceConfirm)}</span>
      <TextButton label={val(INSERT_GALLERY_TEXT.modeReplace)} tone="primary" onClick={onReplace} />
      <TextButton label={val(INSERT_GALLERY_TEXT.modeKeep)} onClick={onKeep} />
    </div>
  );
}
