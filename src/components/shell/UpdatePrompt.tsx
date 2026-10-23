import React, { useState } from 'react';
import { ArrowUpCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { useTranslation, UPDATE_TEXT } from '../../i18n';
import { useUpdateStatus, type UpdateStatusInfo, type UpdateStatusResponse } from '../../hooks/useUpdateStatus';
import styles from './UpdatePrompt.module.css';

interface RollbackNoticeProps {
  reason?: string;
  onDismiss: () => void;
}

const RollbackNotice: React.FC<RollbackNoticeProps> = ({ reason, onDismiss }) => {
  const { val } = useTranslation();
  return (
    <div className={`${styles.promptBox} ${styles.rollback}`} dir="auto">
      <AlertTriangle size={18} className={styles.icon} />
      <div className={styles.content}>
        <div className={styles.titleRow}>
          <span className={styles.badge}>Rollback</span>
          <span className={styles.hint}>{val(UPDATE_TEXT.rollbackNotice)}</span>
        </div>
        {/* The updater records why it rolled back; without it the viewer has nothing to report or fix. */}
        {reason && (
          <div className={styles.reason} dir="auto">
            {val(UPDATE_TEXT.rollbackReason).replace('{reason}', reason)}
          </div>
        )}
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={onDismiss} className={styles.secondaryBtn}>
          {val(UPDATE_TEXT.dismiss)}
        </button>
      </div>
    </div>
  );
};

interface AvailableBannerProps {
  latest: UpdateStatusInfo;
  isPending: boolean;
  onSchedule: (v: string) => void;
  onUpdateRestart: (v: string) => Promise<boolean>;
  onSkip: (v: string) => void;
  onDismissSession: () => void;
  // Desktop installer: shows progress while downloading, and swaps the restart button for a download link when needed.
  downloadPercent?: number;
  manualOnly?: boolean;
  canSchedule: boolean;
}

const AvailableBanner: React.FC<AvailableBannerProps> = ({
  latest,
  isPending,
  onSchedule,
  onUpdateRestart,
  onSkip,
  onDismissSession,
  downloadPercent,
  manualOnly,
  canSchedule,
}) => {
  const { val } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleRestart = async () => {
    setBusy(true);
    const started = await onUpdateRestart(latest.version);
    if (!started) setBusy(false);
  };

  const downloading = downloadPercent !== undefined;
  let primaryLabel = busy ? val(UPDATE_TEXT.updateRestarting) : val(UPDATE_TEXT.updateAndRestart);
  if (manualOnly) primaryLabel = val(UPDATE_TEXT.downloadUpdate);
  if (downloading) primaryLabel = val(UPDATE_TEXT.downloadingUpdate).replace('{percent}', String(downloadPercent));

  return (
    <div className={styles.promptBox} dir="auto">
      <Sparkles size={18} className={styles.icon} />
      <div className={styles.content}>
        <div className={styles.titleRow}>
          <span className={styles.badge}>{val(UPDATE_TEXT.updateBadge)}</span>
          <span className={styles.version}>{latest.version}</span>
        </div>
        <span className={styles.hint}>
          {isPending ? val(UPDATE_TEXT.restartHint) : latest.notes || val(UPDATE_TEXT.updateAvailable)}
        </span>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          onClick={handleRestart}
          disabled={busy || downloading}
          className={styles.primaryBtn}
        >
          <ArrowUpCircle size={12} className={styles.inlineIcon} />
          {primaryLabel}
        </button>
        {!isPending && (
          <>
            {canSchedule && (
              <button
                type="button"
                onClick={() => onSchedule(latest.version)}
                className={styles.secondaryBtn}
              >
                {val(UPDATE_TEXT.updateAction)}
              </button>
            )}
            <button
              type="button"
              onClick={() => onSkip(latest.version)}
              className={styles.secondaryBtn}
            >
              {val(UPDATE_TEXT.skipVersion)}
            </button>
          </>
        )}
        <button type="button" onClick={onDismissSession} className={styles.secondaryBtn}>
          {val(UPDATE_TEXT.later)}
        </button>
      </div>
    </div>
  );
};

function isVersionSkipped(state: UpdateStatusResponse, latest: UpdateStatusInfo): boolean {
  if (!state.skippedVersion) return false;
  return state.skippedVersion === latest.version || state.skippedVersion === latest.tag;
}

function isVersionPending(state: UpdateStatusResponse, latest: UpdateStatusInfo): boolean {
  if (!state.pendingVersion) return false;
  return state.pendingVersion === latest.version || state.pendingVersion === latest.tag;
}

export const UpdatePrompt: React.FC = () => {
  const { state, schedule, updateAndRestart, skip, dismissResult } = useUpdateStatus();
  const [dismissedSession, setDismissedSession] = useState(false);

  if (dismissedSession || !state) return null;

  if (state.lastResult?.ok === false) {
    return <RollbackNotice reason={state.lastResult.error} onDismiss={dismissResult} />;
  }

  const latest = state.latest;
  if (state.status !== 'available' || !latest || isVersionSkipped(state, latest)) {
    return null;
  }

  return (
    <AvailableBanner
      latest={latest}
      isPending={isVersionPending(state, latest)}
      onSchedule={schedule}
      onUpdateRestart={updateAndRestart}
      onSkip={skip}
      onDismissSession={() => setDismissedSession(true)}
      downloadPercent={state.downloadPercent}
      manualOnly={state.manualOnly}
      canSchedule={state.mode !== 'desktop'}
    />
  );
};
