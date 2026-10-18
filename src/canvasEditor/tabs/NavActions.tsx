import { Undo2, Redo2 } from 'lucide-react';
import { useCanvasStore } from '@canvasStore';
import { SaveButton } from './SaveButton';
import styles from './NavActions.module.css';

export function HistoryButtons() {
  const canUndo = useCanvasStore((s) => s.history.past.length > 0);
  const canRedo = useCanvasStore((s) => s.history.future.length > 0);
  return (
    <>
      <button className={styles.iconButton} aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => useCanvasStore.getState().undo()}>
        <Undo2 size={15} />
      </button>
      <button className={styles.iconButton} aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={() => useCanvasStore.getState().redo()}>
        <Redo2 size={15} />
      </button>
    </>
  );
}

/** Undo / Redo / Save, pinned at the end of the top bar. */
export function NavActions() {
  return (
    <div className={`${styles.actions} print-hide`}>
      <HistoryButtons />
      <SaveButton />
    </div>
  );
}
