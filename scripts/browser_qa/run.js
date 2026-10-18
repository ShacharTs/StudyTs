#!/usr/bin/env node
/**
 * Single-command cross-platform runner for StudyTs Browser QA & Live Browser automation.
 */
process.env.NODE_NO_WARNINGS = '1';

import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const runtimePorts = JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'config', 'runtimePorts.json'), 'utf8'));
const ROOT = resolve(__dirname, '..', '..');
const venvDir = resolve(__dirname, '.venv');
const isWin = process.platform === 'win32';
const pyExe = isWin
  ? join(venvDir, 'Scripts', 'python.exe')
  : join(venvDir, 'bin', 'python');

const setupScript = resolve(__dirname, 'setup_venv.py');
const cliScript = resolve(__dirname, 'cli.py');

const C = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m', reset: '\x1b[0m',
};

const BANNER_LINES = [
  `${C.bold}${C.cyan}  ███████╗████████╗██║   ██║██████╗ ██╗   ██║████████╗███████╗${C.reset}`,
  `${C.bold}${C.cyan}  ██╔════╝╚══██╔══╝██║   ██║██╔══██╗╚██╗ ██╔╝╚══██╔══╝██╔════╝${C.reset}`,
  `${C.bold}${C.cyan}  ███████╗   ██║   ██║   ██║██║  ██║ ╚████╔╝    ██║   ███████╗${C.reset}`,
  `${C.bold}${C.cyan}  ╚════██║   ██║   ██║   ██║██║  ██║  ╚██╔╝     ██║   ╚════██║${C.reset}`,
  `${C.bold}${C.cyan}  ███████║   ██║   ╚██████╔╝██████╔╝   ██║      ██║   ███████║${C.reset}`,
  `${C.bold}${C.cyan}  ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝    ╚═╝      ╚═╝   ╚══════╝${C.reset}`,
];

async function printAnimatedBanner() {
  console.log('');
  for (const line of BANNER_LINES) {
    console.log(line);
    await new Promise((r) => setTimeout(r, 20));
  }
  console.log('');
}

const args = process.argv.slice(2);
const isSetupOnly = args.includes('--setup');

function getArgValue(flag, defaultVal) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

let targetUrl = getArgValue('--url', `http://localhost:${runtimePorts.apiPort}`);

function runProcess(cmd, cmdArgs, opts = {}) {
  return new Promise((res, rej) => {
    const child = spawn(cmd, cmdArgs, {
      stdio: 'inherit',
      cwd: __dirname,
      windowsHide: true,
      ...opts,
    });
    child.on('close', (code) => {
      if (code === 0) res();
      else rej(new Error(`Process exited with code ${code}`));
    });
    child.on('error', rej);
  });
}

async function isServerReady(url) {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/registry`);
    return res.ok;
  } catch {
    return false;
  }
}

// start.cjs falls back to the next free port (7301→7304) when 7301 is taken, so the
// port the app actually bound is only knowable by probing the same range.
async function findReadyUrl(baseUrl) {
  const base = new URL(baseUrl);
  for (let offset = 0; offset < 4; offset++) {
    const candidate = `${base.protocol}//${base.hostname}:${Number(base.port) + offset}`;
    if (await isServerReady(candidate)) return candidate;
  }
  return null;
}

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (isWin) {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Process already exited
    }
  }
}

// First start on a new machine runs prisma generate, migrate and seed before Vite and the API are up.
const READY_TIMEOUT_MS = 240000;
const DEV_LOG = resolve(ROOT, 'logs', 'studyts-dev.log');
// Same file as start.cjs writes, so `npm run stop` also stops a server started here.
const PID_FILE = resolve(ROOT, '.studyts.pid');

// A server left behind by an earlier run keeps Prisma's engine file locked on Windows.
function stopLeftoverServer() {
  if (!existsSync(PID_FILE)) return;
  killProcessTree(Number(readFileSync(PID_FILE, 'utf8').trim()));
  rmSync(PID_FILE, { force: true });
}

function registerShutdown(child) {
  const stop = () => {
    killProcessTree(child.pid);
    rmSync(PID_FILE, { force: true });
  };
  process.once('exit', stop);
  process.once('SIGINT', () => {
    stop();
    process.exit(130);
  });
}

function logTail(lines = 25) {
  if (!existsSync(DEV_LOG)) return '(no dev log written)';
  return readFileSync(DEV_LOG, 'utf8').split(String.fromCharCode(10)).slice(-lines).join(String.fromCharCode(10));
}

async function waitForServer(url, child, maxWaitMs = READY_TIMEOUT_MS) {
  const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let spinIdx = 0;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    if (child.exitCode !== null) {
      process.stdout.write(String.fromCharCode(13) + C.red + '✗' + C.reset + ' Dev server stopped with code ' + child.exitCode + String.fromCharCode(10));
      return false;
    }
    const readyUrl = await findReadyUrl(url);
    if (readyUrl) {
      targetUrl = readyUrl;
      process.stdout.write(`\r${C.green}✓${C.reset} Ready at ${C.cyan}${readyUrl}${C.reset}               \n`);
      return true;
    }
    const spin = SPINNER[spinIdx % SPINNER.length];
    spinIdx++;
    process.stdout.write(`\r${C.cyan}${spin}${C.reset} Starting StudyTs...`);
    await new Promise((r) => setTimeout(r, 150));
  }
  process.stdout.write(`\r${C.red}✗${C.reset} Server timed out at ${url}\n`);
  return false;
}

// node_modules copied from another OS keeps that OS's native binaries, which fail to load here.
function checkDependenciesMatchThisSystem() {
  const esbuildPackage = join(ROOT, 'node_modules', '@esbuild', process.platform + '-' + process.arch);
  if (existsSync(join(ROOT, 'node_modules')) && !existsSync(esbuildPackage)) {
    throw new Error(
      'node_modules was installed on another system (' + process.platform + '-' + process.arch + ' is missing). ' +
        'Run "npm ci" in this terminal once, then "npm run studyts".'
    );
  }
}

async function main() {
  await printAnimatedBanner();
  checkDependenciesMatchThisSystem();

  if (!existsSync(pyExe) || isSetupOnly) {
    console.log(`${C.cyan}▸${C.reset} Initializing browser environment...`);
    const sysPython = isWin ? 'python' : 'python3';
    await runProcess(sysPython, [setupScript]);
    if (isSetupOnly) return;
  }

  let spawnedServer = null;
  stopLeftoverServer();
  const runningUrl = await findReadyUrl(targetUrl);
  const alreadyRunning = runningUrl !== null;
  if (alreadyRunning) targetUrl = runningUrl;

  if (!alreadyRunning) {
    // Dev output goes to a log file so a failed start can say why.
    mkdirSync(resolve(ROOT, 'logs'), { recursive: true });
    const devOutput = openSync(DEV_LOG, 'w');
    // Same entry as run.bat and `npm start`, so every launcher runs one process on one port.
    spawnedServer = spawn(process.execPath, [resolve(ROOT, 'start.cjs')], {
      cwd: ROOT,
      stdio: ['ignore', devOutput, devOutput],
      detached: !isWin,
    });

    writeFileSync(PID_FILE, String(spawnedServer.pid));
    registerShutdown(spawnedServer);
    const ready = await waitForServer(targetUrl, spawnedServer);
    if (!ready) {
      killProcessTree(spawnedServer.pid);
      throw new Error(`Server did not start at ${targetUrl}. Last lines of ${DEV_LOG}:` + String.fromCharCode(10) + logTail());
    }
  } else {
    console.log(`${C.green}✓${C.reset} Ready at ${C.cyan}${targetUrl}${C.reset}`);
  }

  const isAppMode = args.includes('--app') || args.includes('app');
  const targetScript = isAppMode ? resolve(__dirname, 'webview_app.py') : cliScript;
  const forwardArgs = args.filter((a) => a !== '--setup' && a !== '--app' && a !== 'app');

  await runProcess(pyExe, [targetScript, ...forwardArgs]);

  // The app stays up after the checks; Ctrl+C stops the server this launcher started.
  if (spawnedServer) {
    console.log(`${C.green}✓${C.reset} StudyTs is running at ${C.cyan}${targetUrl}${C.reset}. Press Ctrl+C to stop.`);
    await new Promise(() => {});
  }
}

main().catch((err) => {
  console.error(`\n${C.red}✗${C.reset} ${err.message}`);
  process.exit(1);
});
