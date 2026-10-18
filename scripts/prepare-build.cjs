// Runs on `npm install github:...` and `npm pack`, before node_modules exists.
// Builds the client and server bundles only when they are missing. --ignore-scripts keeps
// this install from re-running prepare.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const built = fs.existsSync(path.join(root, 'dist', 'index.html')) && fs.existsSync(path.join(root, 'dist-server', 'index.mjs'));
if (built) process.exit(0);

// The outer global install sets npm_config_global, which would send these installs to the global folder.
const env = { ...process.env, npm_config_global: 'false', npm_config_location: 'project' };
const run = (cmd) => execSync(cmd, { cwd: root, env, stdio: 'inherit' });
run('npm install --ignore-scripts --no-audit --no-fund --location=project --prefix="' + root + '"');
run('npx vite build');
run('npm run build:server');
