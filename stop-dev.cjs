#!/usr/bin/env node
/**
 * STUDYTS — Stop dev servers (npm run dev's vite + tsx backend)
 * Run: npm run stop:dev
 * Unlike stop.cjs (which kills the npm-start production process by PID file),
 * `npm run dev` has no PID file — concurrently owns both children directly.
 * This kills whatever is actually listening on the dev ports instead.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const runtimePorts = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'config', 'runtimePorts.json'), 'utf-8'),
);
const PORTS = [runtimePorts.frontendPort, runtimePorts.apiPort];
const PLATFORM = process.platform;

function killPort(port) {
  if (PLATFORM === 'win32') {
    let out;
    try {
      out = execSync(`netstat -ano -p tcp | findstr LISTENING | findstr :${port}`, { encoding: 'utf-8' });
    } catch {
      return false;
    }
    const pids = [...new Set(out.trim().split('\n').map((l) => l.trim().split(/\s+/).pop()).filter(Boolean))];
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'pipe' });
        console.log(`✓ Killed process tree ${pid} on port ${port}`);
      } catch {
        // already gone
      }
    }
    return pids.length > 0;
  }
  try {
    const pids = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
    for (const pid of pids) {
      execSync(`kill -9 ${pid}`);
      console.log(`✓ Killed process ${pid} on port ${port}`);
    }
    return pids.length > 0;
  } catch {
    return false;
  }
}

let any = false;
for (const port of PORTS) {
  if (killPort(port)) any = true;
}
console.log(any ? '' : 'No dev processes found on ports 7300/7301.');
