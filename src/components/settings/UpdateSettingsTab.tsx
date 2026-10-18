import React from 'react';
import { RefreshCw, ArrowUpCircle } from 'lucide-react';
import { useTranslation, UPDATE_TEXT } from '../../i18n';
import { useUpdateStatus, type UpdateStatusResponse } from '../../hooks/useUpdateStatus';
import styles from './UpdateSettingsTab.module.css';

const STATUS_MESSAGE: Record<string, typeof UPDATE_TEXT[keyof typeof UPDATE_TEXT]> = {
  'up-to-date': UPDATE_TEXT.upToDate,
  offline: UPDATE_TEXT.offline,
  'rate-limited': UPDATE_TEXT.rateLimited,
  'no-releases': UPDATE_TEXT.noReleases,
  error: UPDATE_TEXT.checkError,
};

function matchesVersion(stored: string | undefined, latest: { version: string; tag: string }): boolean {
  return Boolean(stored && (stored === latest.version || stored === latest.tag));
}

interface CurrentVersionCardProps {
  version?: string;
  checkedAt?: number;
  throttled?: boolean;
  loading: boolean;
  onCheck: () => void;
}

const CurrentVersionCard: React.FC<CurrentVersionCardProps> = ({
  version,
  checkedAt,
  throttled,
  loading,
  onCheck,
}) => {
  const { val, lang } = useTranslation();
  return (
    <div className="settings-section-card">
      <div className={styles.versionRow}>
        <span className="settings-section-title">{val(UPDATE_TEXT.currentVersion)}</span>
        <span className={styles.version}>{version ?? '...'}</span>
      </div>
      {checkedAt ? (
        <div className={styles.muted}>
          {val(UPDATE_TEXT.lastChecked)}: {new Date(checkedAt).toLocaleString(lang)}
        </div>
      ) : null}
      <div className={styles.actions}>
        <button type="button" className="mcp-btn" disabled={loading} onClick={onCheck}>
          <RefreshCw size={13} /> {val(loading ? UPDATE_TEXT.checking : UPDATE_TEXT.checkNow)}
        </button>
      </div>
      {throttled ? <div className={styles.muted}>{val(UPDATE_TEXT.justChecked)}</div> : null}
    </div>
  );
};

interface AvailableProps {
  state: UpdateStatusResponse;
  onSchedule: (version: string) => void;
  onSkip: (version: string) => void;
}

const AvailableUpdate: React.FC<AvailableProps> = ({ state, onSchedule, onSkip }) => {
  const { val } = useTranslation();
  const latest = state.latest;
  if (!latest) return null;
  const pending = matchesVersion(state.pendingVersion, latest);
  return (
    <>
      <div className={styles.versionRow} dir="auto">
        <span className="settings-section-title">{val(UPDATE_TEXT.updateAvailable)}</span>
        <span className={styles.version}>{latest.version}</span>
      </div>
      {latest.notes ? <div className={styles.notes} dir="auto">{latest.notes}</div> : null}
      {pending ? (
        <div className="settings-section-desc">{val(UPDATE_TEXT.restartHint)}</div>
      ) : (
        <div className={styles.actions}>
          <button type="button" className="mcp-btn" onClick={() => onSchedule(latest.version)}>
            <ArrowUpCircle size={13} /> {val(UPDATE_TEXT.updateAction)}
          </button>
          <button type="button" className="mcp-btn" onClick={() => onSkip(latest.version)}>
            {val(UPDATE_TEXT.skipVersion)}
          </button>
        </div>
      )}
    </>
  );
};

interface StatusSectionCardProps {
  state: UpdateStatusResponse | null;
  onSchedule: (version: string) => void;
  onSkip: (version: string) => void;
  onDismiss: () => void;
}

const StatusSectionCard: React.FC<StatusSectionCardProps> = ({
  state,
  onSchedule,
  onSkip,
  onDismiss,
}) => {
  const { val } = useTranslation();
  if (!state) return null;

  const isSkipped = Boolean(state.latest && matchesVersion(state.skippedVersion, state.latest));
  const isAvailable = state.status === 'available' && Boolean(state.latest) && !isSkipped;
  const statusMsg = !isAvailable ? STATUS_MESSAGE[state.status] : undefined;

  return (
    <div className="settings-section-card">
      {isAvailable ? <AvailableUpdate state={state} onSchedule={onSchedule} onSkip={onSkip} /> : null}
      {statusMsg ? <div className="settings-section-desc">{val(statusMsg)}</div> : null}
      {state.lastResult?.ok === false ? (
        <div className={styles.actions}>
          <span className={styles.warning} dir="auto">{val(UPDATE_TEXT.rollbackNotice)}</span>
          <button type="button" className="mcp-btn" onClick={onDismiss}>
            {val(UPDATE_TEXT.dismiss)}
          </button>
        </div>
      ) : null}
      <div className={styles.muted}>{val(UPDATE_TEXT.appliedOnNextStart)}</div>
    </div>
  );
};

export const UpdateSettingsTab: React.FC = () => {
  const { state, loading, check, schedule, skip, dismissResult } = useUpdateStatus();

  return (
    <div className="settings-tab-container">
      <CurrentVersionCard
        version={state?.currentVersion}
        checkedAt={state?.checkedAt}
        throttled={state?.throttled}
        loading={loading}
        onCheck={() => void check()}
      />
      <StatusSectionCard
        state={state}
        onSchedule={schedule}
        onSkip={skip}
        onDismiss={() => void dismissResult()}
      />
    </div>
  );
};
