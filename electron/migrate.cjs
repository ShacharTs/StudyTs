'use strict';

const { spawn } = require('child_process');
const path = require('path');

// Enough output to show why migration failed without flooding the error dialog.
const OUTPUT_TAIL_CHARS = 600;

// The previous window's server may still be closing, or an AI app may have the MCP server open on the same database.
// SQLite then answers "database is locked" for a moment; waiting and trying again beats an error dialog.
const LOCK_RETRIES = 8;
const LOCK_RETRY_MS = 1500;

const isLocked = (message) => /database is locked|SQLITE_BUSY/i.test(message);

// Runs `prisma migrate deploy` once, with Electron's own Node, so the user needs no Node install.
function runOnce({ packageRoot, env, execPath }) {
  const prismaCli = path.join(packageRoot, 'node_modules', 'prisma', 'build', 'index.js');
  const schema = path.join(packageRoot, 'prisma', 'schema.prisma');
  return new Promise((resolve, reject) => {
    const child = spawn(execPath, [prismaCli, 'migrate', 'deploy', '--schema', schema], {
      cwd: packageRoot,
      env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    const collect = (chunk) => { output += chunk.toString(); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Database setup failed (exit ${code}): ${output.trim().slice(-OUTPUT_TAIL_CHARS)}`));
    });
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runMigrations({ packageRoot, env, execPath = process.execPath, retries = LOCK_RETRIES, retryDelayMs = LOCK_RETRY_MS }) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await runOnce({ packageRoot, env, execPath });
    } catch (err) {
      if (!isLocked(err.message)) throw err;
      if (attempt >= retries) {
        throw new Error(`${err.message}\n\nThe database is still in use. Close any other StudyTs window and any AI app (Claude, Cursor...) that is using StudyTs, then start StudyTs again.`);
      }
      await wait(retryDelayMs);
    }
  }
}

module.exports = { runMigrations };
