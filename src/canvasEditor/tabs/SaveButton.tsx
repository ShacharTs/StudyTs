import { useCanvasStore } from '@canvasStore';
import { useTranslation } from '@i18n';
import { saveNow } from '../saving/sceneSaving';
import styles from './SaveButton.module.css';

type SaveStatusKey = 'idle' | 'saving' | 'saved' | 'error';

// Saving is the only state that blocks the click; the dot tints with the same status.
const STATUS_CLASS: Record<SaveStatusKey, string> = {
  idle: styles.dotIdle,
  saving: styles.dotSaving,
  saved: styles.dotSaved,
  error: styles.dotIdle,
};

/** Save pill: a status dot and label that follow the shared save status (Save → Saving… → Saved). */
export function SaveButton({ id }: { id?: string }) {
  const status = useCanvasStore((s) => s.saveStatus);
  const { val } = useTranslation();
  return (
    <button
      id={id}
      className={styles.pill}
      onClick={() => void saveNow()}
      disabled={status === 'saving'}
      title={val({ key: 'canvasBlocks.ribbon.save.title' })}
    >
      <span className={`${styles.dot} ${STATUS_CLASS[status]}`} aria-hidden="true" />
      {val({ key: `canvasBlocks.ribbon.save.${status}` })}
    </button>
  );
}
