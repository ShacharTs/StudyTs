'use strict';

const { app, BrowserWindow, dialog, ipcMain, shell, utilityProcess } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const { resolveDesktopHome, unpackedPath } = require('./paths.cjs');
const { findFreePort } = require('./port.cjs');
const { runMigrations } = require('./migrate.cjs');
const { createUpdater } = require('./updater.cjs');
const { runMcpServer } = require('./mcpEntry.cjs');
const { createFileLogger } = require('./updateLog.cjs');

const HEALTH_POLL_MS = 250;
const HEALTH_TIMEOUT_MS = 30_000;
const SERVER_OUTPUT_TAIL_CHARS = 600;
const FIRST_UPDATE_CHECK_MS = 10_000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

// AppImage and .deb installs cannot set the SUID bit on Chromium's sandbox helper, and Ubuntu 24.04 blocks
// unprivileged user namespaces, so the app would not start at all. The window only loads this app's own
// localhost server and opens every other link in the system browser.
if (process.platform === 'linux') app.commandLine.appendSwitch('no-sandbox');

let mainWindow = null;
let splashWindow = null;
let serverProcess = null;
let serverOutput = '';
let quitting = false;
let dataHome = null;

function showSplash() {
  splashWindow = new BrowserWindow({ width: 360, height: 200, frame: false, resizable: false, show: true });
  const html = '<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;'
    + 'background:#010102;color:#f7f8f8;font:15px Inter,Arial,sans-serif">Starting StudyTs…</body>';
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

async function waitForServer(port) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!serverProcess) throw new Error(`The server stopped while starting. ${serverOutput.trim().slice(-SERVER_OUTPUT_TAIL_CHARS)}`);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return;
    } catch {
      // Not listening yet; keep polling until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS));
  }
  throw new Error(`The server did not answer within ${HEALTH_TIMEOUT_MS / 1000}s. ${serverOutput.trim().slice(-SERVER_OUTPUT_TAIL_CHARS)}`);
}

function startServer(packageRoot, env) {
  serverProcess = utilityProcess.fork(path.join(packageRoot, 'dist-server', 'index.mjs'), [], {
    cwd: packageRoot,
    env,
    stdio: 'pipe',
  });
  const collect = (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-4000); };
  serverProcess.stdout.on('data', collect);
  serverProcess.stderr.on('data', collect);
  serverProcess.once('exit', (code) => {
    serverProcess = null;
    if (!quitting && mainWindow) {
      dialog.showErrorBox('StudyTs stopped', `The background server exited (code ${code}).\n\n${serverOutput.trim().slice(-SERVER_OUTPUT_TAIL_CHARS)}`);
      app.quit();
    }
  });
}

function openMainWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // Links to other sites open in the normal browser, not inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.once('ready-to-show', () => {
    if (splashWindow) splashWindow.close();
    splashWindow = null;
    mainWindow.show();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

function stopServer() {
  quitting = true;
  if (serverProcess) serverProcess.kill();
}

// An unpackaged run (npm run desktop:dev) has no update feed, so the updater only runs in installed builds.
function setupUpdater() {
  autoUpdater.logger = createFileLogger(path.join(dataHome, '.logs', 'updater.log'));
  const updater = createUpdater({
    autoUpdater,
    currentVersion: app.getVersion(),
    openExternal: (url) => shell.openExternal(url),
    onState: (state) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:state', state);
    },
    beforeInstall: async () => stopServer(),
  });
  ipcMain.handle('update:state', () => updater.getState());
  ipcMain.handle('update:check', () => updater.check().catch(() => updater.getState()));
  ipcMain.handle('update:download', () => updater.download().catch(() => updater.getState()));
  ipcMain.handle('update:install', () => updater.installAndRestart());
  ipcMain.handle('update:open-page', () => updater.openReleasePage());
  // The folder holding the bundled MCP server script that every client config points at (see mcpEntry.cjs).
  ipcMain.handle('mcp:open-folder', async () => {
    const error = await shell.openPath(path.join(unpackedPath(app.getAppPath()), 'dist-server', 'mcp', 'servers'));
    return error ? { success: false, error } : { success: true };
  });
  if (!app.isPackaged) return;
  // A failed check is already reported to the window by the updater's error event.
  const runCheck = () => updater.check().catch((err) => console.warn('Update check failed:', err.message));
  setTimeout(runCheck, FIRST_UPDATE_CHECK_MS);
  setInterval(runCheck, UPDATE_CHECK_INTERVAL_MS);
}

async function boot() {
  const home = resolveDesktopHome(app);
  dataHome = home;
  fs.mkdirSync(home, { recursive: true });
  showSplash();

  const packageRoot = unpackedPath(app.getAppPath());
  const port = await findFreePort();
  const dbFile = path.join(home, 'studyts.db').replace(/\\/g, '/');
  const env = {
    ...process.env,
    STUDYTS_HOME: home,
    DATABASE_URL: `file:${dbFile}`,
    BACKEND_PORT: String(port),
    STUDYTS_DESKTOP: '1',
    STUDYTS_NODE_BIN: process.execPath,
    NODE_ENV: 'production',
  };

  await runMigrations({ packageRoot, env });
  startServer(packageRoot, env);
  await waitForServer(port);
  openMainWindow(port);
  setupUpdater();
}

if (process.argv.includes('--mcp')) {
  runMcpServer(app).catch((err) => {
    console.error(`StudyTs MCP failed to start: ${err.message}`);
    app.exit(1);
  });
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.on('before-quit', stopServer);
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(boot).catch((err) => {
    dialog.showErrorBox('StudyTs could not start', `${err.message}\n\nLogs: ${path.join(dataHome || app.getPath('userData'), '.logs')}`);
    app.quit();
  });
}
