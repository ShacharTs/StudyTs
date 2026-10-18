#!/usr/bin/env node
'use strict';

const path = require('path');
const { readUpdateConfig } = require('./updateConfig.cjs');
const { checkForUpdate } = require('./checkForUpdate.cjs');
const { applyUpdate } = require('./applyUpdate.cjs');
const { readUpdateState } = require('./launchCheck.cjs');

async function main() {
  const root = process.cwd();
  const config = readUpdateConfig(process.env);
  const command = process.argv[2] || 'status';

  if (command === 'check') {
    const res = await checkForUpdate({ root, config, force: true });
    console.log(JSON.stringify(res, null, 2));
  } else if (command === 'apply') {
    const checkRes = await checkForUpdate({ root, config, force: true });
    if (checkRes.status !== 'available' || !checkRes.latest) {
      console.log(`No update available. Current status: ${checkRes.status}`);
      return;
    }
    console.log(`Applying update to ${checkRes.latest.version || checkRes.latest.tag}...`);
    const applyRes = await applyUpdate({ root, config, latest: checkRes.latest });
    console.log(JSON.stringify(applyRes, null, 2));
  } else if (command === 'status') {
    const stateDir = path.join(root, config.stateDirName || '.update');
    const state = readUpdateState(stateDir);
    const checkRes = await checkForUpdate({ root, config, force: false });
    console.log(JSON.stringify({ ...checkRes, state }, null, 2));
  } else {
    console.log('Usage: node scripts/update/cli.cjs [check|apply|status]');
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Update CLI error:', err);
    process.exit(1);
  });
}

module.exports = { main };
