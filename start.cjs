#!/usr/bin/env node
/**
 * STUDYTS — Start
 * Run: npm start
 * Builds the frontend if needed, then spawns the backend (which now also
 * serves the built frontend — see server/index.ts), waits for it to be
 * healthy, and opens a browser.
 */

const { execSync, spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PLATFORM = process.platform;
const runtimePorts = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config', 'runtimePorts.json'), 'utf-8'),
);

const C = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gold: '\x1b[38;2;224;160;74m',
  bold: '\x1b[1m', dim: '\x1b[2m', reset: '\x1b[0m',
};

const info = (m) => console.log(`${C.cyan}▸${C.reset} ${m}`);
const ok = (m) => console.log(`${C.green}✓${C.reset} ${m}`);
const warn = (m) => console.log(`${C.yellow}!${C.reset} ${m}`);
const fail = (m) => { console.log(`${C.red}✗${C.reset} ${m}`); process.exit(1); };

// OSC 8 hyperlink escape — makes the URL clickable in terminals that support
// it (Windows Terminal, VS Code, most modern terminals). Ignored harmlessly
// as plain text by terminals that don't (legacy cmd.exe/conhost).
const link = (url) => `\x1b]8;;${url}\x1b\\${url}\x1b]8;;\x1b\\`;

function run(cmd) {
  try { return execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf-8' }).trim(); }
  catch { return null; }
}

function openBrowser(url) {
  const cmd = PLATFORM === 'darwin' ? `open "${url}"`
    : PLATFORM === 'win32' ? `start "" "${url}"`
    : `xdg-open "${url}" 2>/dev/null`;
  try { execSync(cmd, { stdio: 'ignore' }); } catch {}
}

console.log(`
${C.bold}${C.cyan}  ███████╗████████╗██║   ██║██████╗ ██╗   ██║████████╗███████╗${C.reset}
${C.bold}${C.cyan}  ██╔════╝╚══██╔══╝██║   ██║██╔══██╗╚██╗ ██╔╝╚══██╔══╝██╔════╝${C.reset}
${C.bold}${C.cyan}  ███████╗   ██║   ██║   ██║██║  ██║ ╚████╔╝    ██║   ███████╗${C.reset}
${C.bold}${C.cyan}  ╚════██║   ██║   ██║   ██║██║  ██║  ╚██╔╝     ██║   ╚════██║${C.reset}
${C.bold}${C.cyan}  ███████║   ██║   ╚██████╔╝██████╔╝   ██║      ██║   ███████║${C.reset}
${C.bold}${C.cyan}  ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝    ╚═╝      ╚═╝   ╚══════╝${C.reset}
`);

// Node gate: package.json engines is >=22.12 (jsdom 29 / tsx need it). run.bat installs Node
// with winget when missing; this catches `npm start` on an old Node.
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 12)) {
  fail(`Node ${process.versions.node} is too old — StudyTS needs 22.12 or newer. Run run.bat (installs it) or get it from https://nodejs.org`);
}

// Exit code meaning "relaunch me": the update was applied, or the UI asked for a restart.
const RELAUNCH_CODE = 75;

// Update check runs in a child and is awaited before the server spawns. Running it
// concurrently let the server write .studyts.pid first, so a scheduled apply always hit
// "StudyTS is running" and stalled. A crash in the check must not block startup.
if (!process.env.STUDYTS_JUST_UPDATED) {
  const updateScript = `require(${JSON.stringify(path.join(ROOT, 'scripts', 'update', 'launchCheck.cjs'))})`
    + `.runLaunchUpdate({ root: ${JSON.stringify(ROOT)} })`
    + `.then((o) => process.exit(o.restartRequired ? ${RELAUNCH_CODE} : 0), () => process.exit(0));`;
  const upd = spawnSync(process.execPath, ['-e', updateScript], { cwd: ROOT, stdio: 'inherit' });
  if (upd.status === RELAUNCH_CODE) {
    const relaunch = spawnSync(process.execPath, [__filename], {
      stdio: 'inherit',
      env: { ...process.env, STUDYTS_JUST_UPDATED: '1' },
    });
    process.exit(relaunch.status ?? 0);
  }
}

// Dependencies: install when node_modules is missing or older than package.json / package-lock.json.
// npm keeps node_modules/.package-lock.json as its install stamp; touch it after a successful
// install so an install that changed nothing does not re-run on every start.
const NM_STAMP = path.join(ROOT, 'node_modules', '.package-lock.json');
const depsStale = !fs.existsSync(NM_STAMP) || ['package.json', 'package-lock.json'].some(
  (name) => fs.existsSync(path.join(ROOT, name)) && fs.statSync(path.join(ROOT, name)).mtimeMs > fs.statSync(NM_STAMP).mtimeMs,
);
if (depsStale) {
  info('Installing dependencies (first run, or package.json / package-lock.json changed)...');
  try {
    execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
    if (fs.existsSync(NM_STAMP)) { const now = new Date(); fs.utimesSync(NM_STAMP, now, now); }
  } catch {
    fail('npm install failed — see the error above.');
  }
}

const ENV_FILE = path.join(ROOT, '.env');
const ENV_EXAMPLE_FILE = path.join(ROOT, '.env.example');
if (!fs.existsSync(ENV_FILE) && fs.existsSync(ENV_EXAMPLE_FILE)) {
  fs.copyFileSync(ENV_EXAMPLE_FILE, ENV_FILE);
  info('Created .env from .env.example (first run).');
}

const DB_FILE = path.join(ROOT, 'prisma', 'studyts.db');
const PRISMA_CLIENT_FILE = path.join(ROOT, 'node_modules', '.prisma', 'client', 'index.js');
// A SQLite file with no tables is exactly one empty page (4096 bytes) — the file can
// exist (created on first connection attempt) without migrations ever having run
// against it, e.g. after an interrupted setup. Treat that as "not set up", not just
// missing, so we don't skip `migrate deploy`/seed and serve a schema-less database.
const dbIsEmpty = fs.existsSync(DB_FILE) && fs.statSync(DB_FILE).size <= 4096;
if (!fs.existsSync(DB_FILE) || dbIsEmpty || !fs.existsSync(PRISMA_CLIENT_FILE)) {
  info(fs.existsSync(DB_FILE) && !dbIsEmpty ? 'Prisma client missing, regenerating...' : 'Setting up (first run)...');
  try {
    execSync('npm run setup', { cwd: ROOT, stdio: 'inherit' });
  } catch {
    fail('Setup failed — see the error above. Common causes: missing/invalid DATABASE_URL in .env, or a blocked Prisma engine download (see README).');
  }
}

// Refuse to spawn a second server on top of one already running — the backend retries
// onto the next free port (7301→7304) instead of erroring, so a second `npm start` used
// to silently produce two live processes each watching/writing data/, with .studyts.pid
// overwritten to point only at the newer one (stop.cjs orphans the first).
const PID_FILE = path.join(ROOT, '.studyts.pid');
if (fs.existsSync(PID_FILE)) {
  const existingPid = Number(fs.readFileSync(PID_FILE, 'utf-8').trim());
  const alive = PLATFORM === 'win32'
    ? run(`tasklist /FI "PID eq ${existingPid}"`)?.includes(String(existingPid))
    : (() => { try { process.kill(existingPid, 0); return true; } catch { return false; } })();
  if (alive) fail(`Already running (pid ${existingPid}). Run \`npm stop\` first.`);
  fs.rmSync(PID_FILE, { force: true });
}

info('Starting...');
const built = run('npm run build');
if (built === null) fail('Build failed. Run `npm run build` to see the error.');

// Invoke tsx's own loader directly with `node`, instead of going through the
// npx.cmd/cmd.exe/npx-cli.js chain (shell:true previously nested 9 process levels deep
// on Windows — cmd -> npx-cli -> cmd -> tsx/cli.mjs -> node — which broke both `taskkill
// /T` and Job Object kill-on-close from reliably reaching the real server process,
// letting it survive as an orphan when the launching terminal closed). node is always a
// real executable, so no shell is needed on either platform, and process.execPath
// avoids re-resolving `node` off PATH.
const serverEntry = path.join(ROOT, 'server', 'index.ts');
// tsx's package.json restricts `exports`, so require.resolve('tsx/dist/...') is blocked —
// resolve the package root via its always-exported package.json instead.
const tsxDist = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist');
const server = spawn(
  process.execPath,
  [
    // The `tsx` CLI does NOT auto-load .env (verified 2026-09-24 — `npx tsx -e
    // "console.log(process.env.DATABASE_URL)"` prints undefined); this comment
    // previously claimed otherwise. Node's --env-file must be passed explicitly
    // here (and was added to the "dev"/"server" npm scripts too, §38 follow-up).
    '--env-file=.env',
    '--require', path.join(tsxDist, 'preflight.cjs'),
    '--import', require('url').pathToFileURL(path.join(tsxDist, 'loader.mjs')).href,
    serverEntry,
  ],
  {
    cwd: ROOT,
    stdio: 'inherit',
    // Lets the server's /update/restart endpoint know a launcher will relaunch it.
    env: { ...process.env, STUDYTS_SUPERVISED: '1' },
    ...(PLATFORM === 'win32' ? {} : { detached: true }),
  }
);
fs.writeFileSync(path.join(ROOT, '.studyts.pid'), String(server.pid));

let backendPort = null;
const basePort = runtimePorts.apiPort;
for (let i = 0; i < 20; i++) {
  for (const candidatePort of [basePort, basePort + 1, basePort + 2, basePort + 3]) {
    const h = run(`curl -s http://localhost:${candidatePort}/api/health`);
    if (h && h.includes('ok')) { backendPort = candidatePort; break; }
  }
  if (backendPort) break;
  if (i === 19) warn('Taking longer than usual to start...');
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
}

const url = `http://localhost:${backendPort || basePort}`;
openBrowser(url);

console.log('');
ok(`Ready at ${C.bold}${link(url)}${C.reset}`);
console.log(`  ${C.dim}Ctrl+C or close this window to stop${C.reset}`);
console.log('');

// Stay attached to the server and its console instead of exiting: on Windows, closing
// the console (X button) sends CTRL_CLOSE_EVENT, which Node maps to a 'SIGHUP' on THIS
// process, but only while it's still alive to receive it — a script that already
// exited (the previous "launch and detach" behavior) has nothing listening for that
// event, so the backend it spawned survived as an orphan when the window closed.
function shutdown() {
  try {
    if (PLATFORM === 'win32') run(`taskkill /pid ${server.pid} /T /F`);
    else process.kill(-server.pid, 'SIGTERM');
  } catch {}
  fs.rmSync(PID_FILE, { force: true });
  process.exit(0);
}
process.on('SIGHUP', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.on('exit', (code) => {
  fs.rmSync(PID_FILE, { force: true });
  if (code === RELAUNCH_CODE) {
    const relaunch = spawnSync(process.execPath, [__filename], { stdio: 'inherit', env: process.env });
    process.exit(relaunch.status ?? 0);
  }
  process.exit(0);
});
