// Present only when the web app runs inside the Electron installer (see electron/preload.cjs).
interface DesktopUpdateState {
  phase: 'idle' | 'checking' | 'available' | 'none' | 'downloading' | 'ready' | 'error';
  currentVersion: string;
  canAutoInstall: boolean;
  version?: string;
  notes?: string;
  percent?: number;
  message?: string;
  // The latest release has no installer files yet (no latest.yml).
  noInstaller?: boolean;
}

interface StudytsDesktop {
  isDesktop: true;
  platform: string;
  update: {
    getState: () => Promise<DesktopUpdateState>;
    check: () => Promise<DesktopUpdateState>;
    download: () => Promise<DesktopUpdateState>;
    installAndRestart: () => Promise<void>;
    openReleasePage: () => Promise<void>;
    onState: (callback: (state: DesktopUpdateState) => void) => () => void;
  };
  mcp: {
    openFolder: () => Promise<{ success: boolean; error?: string }>;
  };
}

interface Window {
  studytsDesktop?: StudytsDesktop;
}
