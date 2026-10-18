#!/usr/bin/env node
// `npx studyts` entry point. Keeps user data in the OS app-data folder, so the app
// works from any directory and does not depend on where the package was installed.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const PORTS = [7301, 7302, 7303, 7304];

function defaultHome() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'StudyTs');
  }
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'StudyTs');
  return path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share'), 'studyts');
}

const HOME = process.env.STUDYTS_HOME ? path.resolve(process.env.STUDYTS_HOME) : defaultHome();
mkdirSync(HOME, { recursive: true });
const dbFile = path.join(HOME, 'studyts.db').replace(/\\/g, '/');
const env = { ...process.env, STUDYTS_HOME: HOME, DATABASE_URL: `file:${dbFile}` };

const prismaCli = path.join(path.dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
const migrate = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', path.join(PKG, 'prisma', 'schema.prisma')], {
  cwd: PKG,
  env,
  stdio: 'inherit',
});
if (migrate.status !== 0) {
  console.error('StudyTs: database setup failed. See the Prisma output above.');
  process.exit(migrate.status ?? 1);
}

// The prebuilt bundle needs no TypeScript runtime; path aliases were resolved at build time.
const server = spawn(process.execPath, [path.join(PKG, 'dist-server', 'index.mjs')], { cwd: PKG, env, stdio: 'inherit' });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
server.on('exit', (code) => process.exit(code ?? 0));

async function findRunningPort(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const port of PORTS) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/`);
        if (res.ok) return port;
      } catch {
        // Not up yet on this port; keep polling.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

const port = await findRunningPort();
if (port === null) {
  console.error('StudyTs: the server did not start in time. Check the output above.');
  server.kill('SIGTERM');
} else {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`StudyTs is running at ${url}  (data: ${HOME})`);
  if (!process.env.STUDYTS_NO_OPEN) {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref();
    else if (process.platform === 'darwin') spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
    else spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
  }
}
