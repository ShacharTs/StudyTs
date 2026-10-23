import { useState, useEffect, useCallback } from 'react';
import type { UpdateStatusResponse } from './useUpdateStatus';

const RELEASES_PAGE = 'https://github.com/ShacharTs/StudyTs/releases';

const OFFERED_PHASES: DesktopUpdateState['phase'][] = ['available', 'downloading', 'ready'];

function toLatest(desktop: DesktopUpdateState): UpdateStatusResponse['latest'] {
  if (!OFFERED_PHASES.includes(desktop.phase) || !desktop.version) return undefined;
  const tag = `v${desktop.version}`;
  return { version: desktop.version, tag, pageUrl: `${RELEASES_PAGE}/tag/${tag}`, notes: desktop.notes ?? '' };
}

// Maps the installer's updater state onto the shape the update banner and settings tab already render.
export function toUpdateStatus(desktop: DesktopUpdateState, skippedVersion?: string): UpdateStatusResponse {
  const latest = toLatest(desktop);
  let status: UpdateStatusResponse['status'] = latest ? 'available' : 'up-to-date';
  if (desktop.phase === 'error') status = 'error';
  else if (desktop.noInstaller) status = 'no-releases';
  return {
    status,
    currentVersion: desktop.currentVersion,
    mode: 'desktop',
    skippedVersion,
    latest,
    downloadPercent: desktop.phase === 'downloading' ? desktop.percent ?? 0 : undefined,
    manualOnly: !desktop.canAutoInstall,
    errorMessage: desktop.phase === 'error' ? desktop.message : undefined,
  };
}

export function useDesktopUpdateStatus() {
  const bridge = window.studytsDesktop?.update;
  const [desktopState, setDesktopState] = useState<DesktopUpdateState | null>(null);
  const [skippedVersion, setSkippedVersion] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bridge) return undefined;
    void bridge.getState().then(setDesktopState);
    return bridge.onState(setDesktopState);
  }, [bridge]);

  const check = useCallback(async () => {
    if (!bridge) return;
    setLoading(true);
    try {
      setDesktopState(await bridge.check());
    } finally {
      setLoading(false);
    }
  }, [bridge]);

  const schedule = useCallback(async () => {
    if (bridge) setDesktopState(await bridge.download());
  }, [bridge]);

  // Installers that cannot replace themselves send the user to the release page; the app keeps running.
  const updateAndRestart = useCallback(async () => {
    if (!bridge) return false;
    const current = await bridge.getState();
    if (!current.canAutoInstall) {
      await bridge.openReleasePage();
      return false;
    }
    const downloaded = current.phase === 'ready' ? current : await bridge.download();
    if (downloaded.phase !== 'ready') return false;
    await bridge.installAndRestart();
    return true;
  }, [bridge]);

  // A skip lasts for this session only; the installer has no on-disk update state to write to.
  const skip = useCallback(async (version: string) => setSkippedVersion(version), []);
  const dismissResult = useCallback(async () => undefined, []);
  const refresh = useCallback(async () => { if (bridge) setDesktopState(await bridge.getState()); }, [bridge]);

  return {
    state: desktopState ? toUpdateStatus(desktopState, skippedVersion) : null,
    loading,
    refresh,
    check,
    schedule,
    updateAndRestart,
    skip,
    dismissResult,
  };
}
