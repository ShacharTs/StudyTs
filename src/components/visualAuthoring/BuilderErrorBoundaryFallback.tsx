import { translateVisualAuthoring, useTranslation } from '@i18n';
import styles from './BuilderErrorBoundary.module.css';

interface BuilderErrorBoundaryFallbackProps {
  onRecover?: () => void;
  onReload: () => void;
}

// Reads the language from context, so the fallback shows the active language, not a fixed one.
// Recover is optional: the route-level boundary has no spec backup to restore.
export function BuilderErrorBoundaryFallback({ onRecover, onReload }: BuilderErrorBoundaryFallbackProps) {
  const { lang } = useTranslation();
  const translate = (key: string) => translateVisualAuthoring(key, lang);
  return (
    <div className={styles.panel} role="alert">
      <b>{translate('errorBoundary.title')}</b>
      <p>{translate('errorBoundary.safe')}</p>
      <div className={styles.actions}>
        {onRecover && <button type="button" onClick={onRecover}>{translate('errorBoundary.recover')}</button>}
        <button type="button" onClick={onReload}>{translate('errorBoundary.reload')}</button>
      </div>
    </div>
  );
}
