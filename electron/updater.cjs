'use strict';

const { isNewerVersion } = require('../scripts/update/versionCompare.cjs');

const REPO_RELEASES_URL = 'https://github.com/ShacharTs/StudyTs/releases';

// electron-updater can only swap the app in place when the installer type supports it. An unsigned macOS app,
// the Windows portable exe and a .deb cannot, so those get a link to the release page instead.
function canAutoInstall({ platform, env }) {
  if (platform === 'win32') return !env.PORTABLE_EXECUTABLE_DIR;
  if (platform === 'linux') return Boolean(env.APPIMAGE);
  return false;
}

// A release made before the installers existed has no latest.yml; that means "no installer update", not a failure.
function isMissingUpdateFeed(message) {
  return /latest[\w-]*\.yml/.test(message) && /404|cannot find/i.test(message);
}

function plainNotes(releaseNotes) {
  const raw = Array.isArray(releaseNotes)
    ? releaseNotes.map((entry) => entry.note || '').join('\n')
    : String(releaseNotes || '');
  return raw.replace(/<[^>]+>/g, '').trim();
}

const LATEST_RELEASE_API = 'https://api.github.com/repos/ShacharTs/StudyTs/releases/latest';

async function fetchLatestRelease() {
  const res = await fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub releases answered HTTP ${res.status}`);
  const body = await res.json();
  return { version: String(body.tag_name || '').replace(/^v/, ''), notes: String(body.body || '') };
}

function createUpdater({
  autoUpdater, platform = process.platform, env = process.env, currentVersion, openExternal, onState, beforeInstall,
  latestRelease = fetchLatestRelease,
}) {
  const autoInstall = canAutoInstall({ platform, env });
  let state = { phase: 'idle', currentVersion, canAutoInstall: autoInstall };

  function setState(patch) {
    state = { ...state, ...patch };
    onState(state);
  }

  // The user decides when to download, and only installers that can swap themselves install on quit.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = autoInstall;

  autoUpdater.on('checking-for-update', () => setState({ phase: 'checking', message: undefined }));
  autoUpdater.on('update-available', (info) => setState({
    phase: 'available',
    version: info.version,
    notes: plainNotes(info.releaseNotes),
    percent: undefined,
  }));
  autoUpdater.on('update-not-available', () => setState({ phase: 'none', noInstaller: false }));
  autoUpdater.on('download-progress', (progress) => setState({ phase: 'downloading', percent: Math.round(progress.percent) }));
  autoUpdater.on('update-downloaded', () => setState({ phase: 'ready', percent: 100 }));
  // An offline check or a failed download must never crash the app; the UI shows the reason.
  autoUpdater.on('error', (err) => {
    const message = err == null ? 'Unknown update error' : String(err.message || err);
    if (isMissingUpdateFeed(message)) {
      setState({ phase: 'none', noInstaller: true, message });
      void offerManualUpdate();
    } else setState({ phase: 'error', noInstaller: false, message });
  });

  // Without latest.yml the app cannot install by itself, but a newer release may still exist: ask GitHub directly
  // and offer the release page, so a release uploaded without update files still reaches the user.
  async function offerManualUpdate() {
    try {
      const release = await latestRelease();
      if (isNewerVersion(release.version, currentVersion)) {
        setState({ phase: 'available', version: release.version, notes: plainNotes(release.notes), canAutoInstall: false });
      }
    } catch (err) {
      setState({ message: `Could not reach GitHub releases: ${err && err.message ? err.message : err}` });
    }
  }

  return {
    getState: () => state,
    check: () => autoUpdater.checkForUpdates().then(() => state),
    download: () => autoUpdater.downloadUpdate().then(() => state),
    async installAndRestart() {
      if (beforeInstall) await beforeInstall();
      autoUpdater.quitAndInstall(true, true);
    },
    openReleasePage: () => openExternal(state.version ? `${REPO_RELEASES_URL}/tag/v${state.version}` : REPO_RELEASES_URL),
  };
}

module.exports = { canAutoInstall, createUpdater, plainNotes, REPO_RELEASES_URL };
