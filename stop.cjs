#!/usr/bin/env node
/**
 * STUDYTS — Stop
 * Run: npm stop  (or: studyts stop)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PLATFORM = process.platform;
const C = {
  green: '\x1b[32m', yellow: '\x1b[33m', bold: '\x1b[1m', reset: '\x1b[0m',
};

console.log(`\n${C.bold}StudyTS — Shutdown${C.reset}\n`);

const PID_FILE = path.join(ROOT, '.studyts.pid');
if (!fs.existsSync(PID_FILE)) {
  console.log(`${C.yellow}!${C.reset} No running instance found (no ${PID_FILE})\n`);
  process.exit(0);
}

const pid = Number(fs.readFileSync(PID_FILE, 'utf-8').trim());
try {
  if (PLATFORM === 'win32') {
    // start.cjs spawns via `shell: true` on Windows (npx.cmd needs a shell), so the
    // stored pid is the cmd.exe wrapper, not the real tsx/node process underneath it.
    // Plain process.kill would leave the actual server running — kill the whole tree.
    execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'pipe' });
  } else {
    process.kill(pid);
  }
  console.log(`${C.green}✓${C.reset} Stopped (pid ${pid})\n`);
} catch (err) {
  if (err.code === 'ESRCH') {
    console.log(`${C.yellow}!${C.reset} Process ${pid} was not running\n`);
  } else {
    console.log(`${C.yellow}!${C.reset} Could not stop process ${pid}: ${err.message}\n`);
  }
} finally {
  fs.rmSync(PID_FILE, { force: true });
}
