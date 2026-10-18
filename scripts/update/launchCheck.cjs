'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { readUpdateConfig } = require('./updateConfig.cjs');
const { checkForUpdate } = require('./checkForUpdate.cjs');
const { applyUpdate, recoverInterrupted } = require('./applyUpdate.cjs');
const { writeFileAtomic } = require('../writeFileAtomic.cjs');

function stateFilePath(stateDir) {
  return path.join(stateDir, 'state.json');
}

function readUpdateState(stateDir) {
  try {
    return JSON.parse(fs.readFileSync(stateFilePath(stateDir), 'utf8'));
  } catch {
    return {};
  }
}

function writeUpdateState(stateDir, state) {
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  writeFileAtomic(stateFilePath(stateDir), JSON.stringify(state, null, 2));
}

function defaultAsk(question, timeoutMs = 15000) {
  if (!process.stdin.isTTY) return Promise.resolve(false);

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const timer = setTimeout(() => {
      rl.close();
      process.stdout.write('\n');
      resolve(false);
    }, timeoutMs);

    rl.question(`${question} [y/N]: `, (answer) => {
      clearTimeout(timer);
      rl.close();
      const clean = (answer || '').trim().toLowerCase();
      resolve(clean === 'y' || clean === 'yes');
    });
  });
}

async function runLaunchUpdate({
  root,
  env = process.env,
  isInteractive = Boolean(process.stdout && process.stdout.isTTY),
  ask = defaultAsk,
  check = checkForUpdate,
  apply = applyUpdate,
  recover = recoverInterrupted,
  log = console.log,
} = {}) {
  if (env.STUDYTS_JUST_UPDATED === '1') {
    return { action: 'none', restartRequired: false };
  }

  const config = readUpdateConfig(env);
  const stateDir = path.join(root, config.stateDirName || '.update');

  const recovery = recover({ root, config });
  if (recovery.recovered) {
    log(`[updater] ${recovery.message || 'Recovered previous update state'}`);
  }

  if (config.mode === 'off') {
    return { action: 'none', restartRequired: false };
  }

  const state = readUpdateState(stateDir);
  let checkResult;
  try {
    checkResult = await check({ root, config });
  } catch (err) {
    return { action: 'none', restartRequired: false };
  }

  if (!checkResult || !checkResult.latest) {
    return { action: 'none', restartRequired: false };
  }

  const latest = checkResult.latest;
  const isPending =
    state.pendingVersion && (state.pendingVersion === latest.version || state.pendingVersion === latest.tag);

  if (isPending) {
    delete state.pendingVersion;
    writeUpdateState(stateDir, state);
    log(`[updater] Applying scheduled update to ${latest.version || latest.tag}...`);
    const applyRes = await apply({ root, config, latest });
    return {
      action: applyRes.ok ? 'updated' : 'failed',
      restartRequired: Boolean(applyRes.restartRequired),
    };
  }

  if (checkResult.status === 'available') {
    const isSkipped =
      state.skippedVersion && (state.skippedVersion === latest.version || state.skippedVersion === latest.tag);
    if (isSkipped) {
      return { action: 'skipped', restartRequired: false };
    }

    if (config.mode === 'auto') {
      log(`[updater] Applying automatic update to ${latest.version || latest.tag}...`);
      const applyRes = await apply({ root, config, latest });
      return {
        action: applyRes.ok ? 'updated' : 'failed',
        restartRequired: Boolean(applyRes.restartRequired),
      };
    }

    if (config.mode === 'prompt') {
      if (!isInteractive) {
        return { action: 'skipped', restartRequired: false };
      }

      const shouldUpdate = await ask(
        `\n[updater] A new version of StudyTS is available (${latest.version || latest.tag}). Update now?`,
        config.promptTimeoutMs,
      );

      if (shouldUpdate) {
        log(`[updater] Applying update to ${latest.version || latest.tag}...`);
        const applyRes = await apply({ root, config, latest });
        return {
          action: applyRes.ok ? 'updated' : 'failed',
          restartRequired: Boolean(applyRes.restartRequired),
        };
      }

      return { action: 'declined', restartRequired: false };
    }
  }

  return { action: 'none', restartRequired: false };
}

module.exports = {
  readUpdateState,
  writeUpdateState,
  defaultAsk,
  runLaunchUpdate,
};
