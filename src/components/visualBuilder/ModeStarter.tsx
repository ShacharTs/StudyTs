import { INSERT_GALLERY_TEXT, useTranslation } from '@i18n';
import { templateByRef } from '@core/visualBuilder/diagramPacks/buildTemplate';
import { STARTER_ACTION_PREFIX } from '@core/visualBuilder/modes/workspaceMode';
import type { WorkspaceMode } from '@core/visualBuilder/modes/workspaceMode';
import styles from './ModeBar.module.css';

interface ModeStarterProps {
  mode: WorkspaceMode;
  empty: boolean;
  onStart: (templateRef: string) => void;
}

const text = INSERT_GALLERY_TEXT;

// On an empty canvas the mode says what it is for and offers its starter; the card disappears with the first object.
export function ModeStarter({ mode, empty, onStart }: ModeStarterProps) {
  const { val } = useTranslation();
  if (!empty) return null;
  const isAction = mode.starter?.startsWith(STARTER_ACTION_PREFIX) === true;
  const template = mode.starter && !isAction ? templateByRef(mode.starter) : undefined;
  const starterName = isAction && mode.starterLabel ? val(mode.starterLabel) : template ? val(template.def.name) : '';
  return (
    <div className={styles.starter} role="note">
      <span className={styles.starterIcon} aria-hidden="true">{mode.icon}</span>
      <b className={styles.starterTitle}>{val(mode.label)}</b>
      {mode.note && <span className={styles.muted}>{val(mode.note)}</span>}
      {starterName !== '' && mode.starter && (
        <button type="button" className={styles.starterButton} onClick={() => onStart(mode.starter as string)}>
          {`${val(text.modeStartWith)}: ${starterName}`}
        </button>
      )}
      <span className={styles.muted}>{val(text.modeStartHint)}</span>
    </div>
  );
}
