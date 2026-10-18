#!/usr/bin/env node
// Runs `npm run setup` (prisma generate + migrate deploy + seed) but never fails
// `npm install` itself — a blocked/offline Prisma engine download (or any other
// setup failure) would otherwise poison the whole install on a new machine.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');
const ENV_EXAMPLE_FILE = path.join(ROOT, '.env.example');
if (!fs.existsSync(ENV_FILE) && fs.existsSync(ENV_EXAMPLE_FILE)) {
  fs.copyFileSync(ENV_EXAMPLE_FILE, ENV_FILE);
  console.log('[postinstall] Created .env from .env.example (first run).');
}

try {
  execSync('npm run setup', { stdio: 'inherit', cwd: ROOT });
} catch {
  console.warn(
    '\n[postinstall] `npm run setup` failed (see above) — install continues anyway.\n' +
    '  Common causes: missing/invalid DATABASE_URL in .env, or a blocked Prisma engine\n' +
    '  download (offline/firewall/proxy). Once fixed, run `npm run setup` manually\n' +
    '  before `npm start`.\n'
  );
}
