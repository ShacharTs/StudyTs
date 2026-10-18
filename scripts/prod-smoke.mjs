// Production smoke test: build, boot the real server entry on a spare port with an isolated db,
// round-trip a same-origin save/load, and cleanly tear down.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SMOKE_PORT = 7391;
const SMOKE_KEY = '__prod-smoke__';
const HEALTH_ATTEMPTS = 60;
const HEALTH_INTERVAL_MS = 500;

function isValidPort(port) {
  return Number.isInteger(port) && port > 0;
}

export function smokeConfig(env) {
  const port = env.SMOKE_PORT === undefined ? DEFAULT_SMOKE_PORT : Number(env.SMOKE_PORT);
  if (!isValidPort(port)) {
    throw new Error(`SMOKE_PORT must be a positive integer, got "${env.SMOKE_PORT}"`);
  }
  return { port, origin: `http://localhost:${port}`, key: SMOKE_KEY };
}

export function buildSmokeDoc() {
  return {
    pages: [{ id: 'page-smoke-1', orientation: 'portrait', paperSize: 'A4', margin: 20, objects: [] }],
    objects: {},
    smokeStamp: Date.now(),
  };
}

export function createTempDbPath(tempDir = os.tmpdir()) {
  return path.join(tempDir, `studyts-smoke-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

function setupTempDb(tempDbPath) {
  const originalDb = path.join(ROOT, 'prisma', 'studyts.db');
  if (fs.existsSync(originalDb)) {
    fs.copyFileSync(originalDb, tempDbPath);
  }
}

function cleanupTempDb(tempDbPath) {
  if (!tempDbPath) return;
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(`${tempDbPath}${suffix}`, { force: true });
  }
}

function isAlive(server) {
  return Boolean(server && !server.killed && server.exitCode === null);
}

function killProcess(pid) {
  if (process.platform === 'win32') {
    execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    return;
  }
  process.kill(-pid, 'SIGTERM');
}

function stopServer(server) {
  if (!isAlive(server)) return;
  try {
    killProcess(server.pid);
  } catch {
    server.kill();
  }
}

function startServer(port, tempDbPath) {
  const require = createRequire(import.meta.url);
  const tsxDist = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist');
  const serverEntry = path.join(ROOT, 'server', 'index.ts');

  return spawn(
    process.execPath,
    [
      '--env-file=.env',
      '--require',
      path.join(tsxDist, 'preflight.cjs'),
      '--import',
      pathToFileURL(path.join(tsxDist, 'loader.mjs')).href,
      serverEntry,
    ],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        BACKEND_PORT: String(port),
        DATABASE_URL: `file:${tempDbPath.replace(/\\/g, '/')}`,
      },
      ...(process.platform === 'win32' ? {} : { detached: true }),
    }
  );
}

async function waitHealthy(origin) {
  for (let i = 0; i < HEALTH_ATTEMPTS; i++) {
    try {
      const res = await fetch(`${origin}/api/health`);
      if (res.ok) return;
    } catch {
      // server starting
    }
    await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS));
  }
  throw new Error('server never became healthy');
}

async function expectOk(label, res) {
  if (!res.ok) {
    throw new Error(`${label} failed: HTTP ${res.status} ${await res.text()}`);
  }
  console.log(`ok  ${label}`);
  return res;
}

async function roundTrip({ origin, key }) {
  const spa = await expectOk('GET / (SPA)', await fetch(`${origin}/`));
  const spaHtml = await spa.text();
  if (!spaHtml.includes('<div id="root"')) {
    throw new Error('GET / did not return the built SPA');
  }

  await expectOk('GET /api/registry (load path)', await fetch(`${origin}/api/registry`));

  const doc = buildSmokeDoc();
  await expectOk(
    'POST /api/canvas-store/save',
    await fetch(`${origin}/api/canvas-store/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ key, doc }),
    })
  );

  const loadRes = await expectOk(
    'GET /api/canvas-store/load',
    await fetch(`${origin}/api/canvas-store/load?key=${encodeURIComponent(key)}`)
  );
  const loaded = await loadRes.json();
  if (loaded.doc?.smokeStamp !== doc.smokeStamp) {
    throw new Error('loaded doc does not match the saved doc');
  }
}

async function main() {
  const config = smokeConfig(process.env);
  if (process.env.SMOKE_SKIP_BUILD !== '1') {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  }

  const tempDbPath = createTempDbPath();
  setupTempDb(tempDbPath);

  let server;
  try {
    server = startServer(config.port, tempDbPath);
    await waitHealthy(config.origin);
    await roundTrip(config);
    console.log('prod smoke passed');
  } finally {
    if (server) stopServer(server);
    cleanupTempDb(tempDbPath);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
