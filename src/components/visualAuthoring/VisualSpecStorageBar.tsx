/** Key field, Save button, saved-spec picker and the last status message. Stateless: the page owns the state. */
import { isVisualSpecKey } from '@engine/visualStepPlayer';
import type { VisualSpecStorageStatus } from './useVisualSpecStorage';
import styles from './VisualSpecStorageBar.module.css';

interface VisualSpecStorageBarProps {
  storageKey: string;
  onKeyChange: (key: string) => void;
  savedKeys: string[];
  status: VisualSpecStorageStatus;
  /** False while the JSON has problems, so a broken spec is never saved. */
  canSave: boolean;
  onSave: () => void;
  onOpen: (key: string) => void;
  /** A spec opened read-only has no Save: nothing is written back. */
  readOnly?: boolean;
}

export function VisualSpecStorageBar({ storageKey, onKeyChange, savedKeys, status, canSave, onSave, onOpen, readOnly = false }: VisualSpecStorageBarProps) {
  const keyIsValid = isVisualSpecKey(storageKey);
  return (
    <div className={styles.bar}>
      <input
        aria-label="Spec key"
        className={styles.input}
        dir="ltr"
        placeholder="spec-key"
        value={storageKey}
        onChange={(event) => onKeyChange(event.target.value)}
      />
      {!readOnly && (
        <button type="button" className={styles.button} disabled={!canSave || !keyIsValid} onClick={onSave}>
          Save
        </button>
      )}
      <select
        aria-label="Open saved spec"
        className={styles.select}
        value=""
        onChange={(event) => event.target.value && onOpen(event.target.value)}
      >
        <option value="">Open saved…</option>
        {savedKeys.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
      {!keyIsValid && storageKey !== '' && (
        <span className={styles.hint}>Key: lowercase letters, digits and dashes, 1-64 characters, not starting with a dash.</span>
      )}
      <span role="status" className={styles.status} data-kind={status.kind}>
        {status.kind === 'idle' ? '' : status.message}
      </span>
    </div>
  );
}
