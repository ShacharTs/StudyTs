'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const {
  acquireLock,
  writeJournal,
  readJournal,
  clearJournal,
  backupUserData,
  verifyBackup,
  pruneBackups,
  USER_DATA_INCLUDE,
} = require('./updateJournal.cjs');
const { isGitClone, updateViaGit, rollbackGit } = require('./gitStrategy.cjs');
const {
  downloadZip,
  extractZip,
  findExtractedRoot,
  applyStagedTree,
  restoreCode,
} = require('./zipStrategy.cjs');
const { writeFileAtomic } = require('../writeFileAtomic.cjs');

// Enough of the command's output to show why it failed without flooding the update notice.
const RUN_OUTPUT_TAIL_CHARS = 600;

// execFileSync's own message is just "Command failed: ..."; the useful part is what the command printed.
function summarizeRunFailure(cmd, args, err) {
  const output = [err.stderr, err.stdout]
    .map((stream) => (stream ? String(stream).trim() : ''))
    .filter(Boolean)
    .join('\n');
  const exit = err.status != null ? ` (exit ${err.status})` : '';
  const detail = output ? output.slice(-RUN_OUTPUT_TAIL_CHARS) : err.message;
  return `${cmd} ${args.join(' ')} failed${exit}: ${detail}`;
}

function defaultRun(cmd, args, cwd) {
  const isWin = process.platform === 'win32';
  const effectiveCmd = isWin && (cmd === 'npm' || cmd === 'npx') ? `${cmd}.cmd` : cmd;
  try {
    return execFileSync(effectiveCmd, args, {
      cwd,
      encoding: 'utf8',
      shell: isWin,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    throw new Error(summarizeRunFailure(cmd, args, err), { cause: err });
  }
}

function hashFile(file) {
  if (!fs.existsSync(file)) return '';
  const content = fs.readFileSync(file);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function isPidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function checkPidFile(root, pidChecker = isPidAlive) {
  const pidFile = path.join(root, '.studyts.pid');
  if (!fs.existsSync(pidFile)) return;

  const raw = fs.readFileSync(pidFile, 'utf8').trim();
  const pid = Number(raw);
  if (pid && pidChecker(pid)) {
    throw new Error('StudyTS is running; stop it first');
  }
}

function restoreDatabaseIfChanged(root, backupDir) {
  const dbRel = 'prisma/studyts.db';
  const dbCurrent = path.join(root, dbRel);
  const dbBackup = path.join(backupDir, dbRel);

  if (fs.existsSync(dbBackup)) {
    const currentHash = hashFile(dbCurrent);
    const backupHash = hashFile(dbBackup);
    if (currentHash !== backupHash) {
      fs.copyFileSync(dbBackup, dbCurrent);
    }
  }
}

async function applyUpdate({ root, config, latest, strategy = 'auto', deps = {} }) {
  const run = deps.run || defaultRun;
  const git = deps.git;
  const now = deps.now || Date.now();
  const doDownloadZip = deps.downloadZip || downloadZip;
  const doExtractZip = deps.extractZip || extractZip;
  const stateDir = path.join(root, config.stateDirName || '.update');

  const pkgJsonPath = path.join(root, 'package.json');
  let fromVersion = '1.0.0';
  try {
    fromVersion = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version || '1.0.0';
  } catch {
    // fallback
  }

  const toVersion = latest?.version || latest?.tag || 'unknown';
  const effectiveStrategy = strategy === 'zip' ? 'zip' : (isGitClone(root) && strategy !== 'zip' ? 'git' : 'zip');

  let releaseLock = null;
  const backupDirName = `${new Date(now).toISOString().replace(/[:.]/g, '')}-${fromVersion}-to-${toVersion}`;
  const backupsRoot = path.join(stateDir, 'backups');
  const backupDir = path.join(backupsRoot, backupDirName);

  const journal = {
    id: `upd-${now}`,
    state: 'started',
    strategy: effectiveStrategy,
    from: fromVersion,
    to: toVersion,
    backupDir,
  };

  try {
    checkPidFile(root, deps.isPidAlive);
    releaseLock = acquireLock(stateDir, { now, isPidAlive: deps.isPidAlive });
    writeJournal(stateDir, journal);

    backupUserData({ root, backupDir, include: USER_DATA_INCLUDE });
    verifyBackup(root, backupDir, USER_DATA_INCLUDE);

    journal.state = 'backed-up';
    const lockHashBefore = hashFile(path.join(root, 'package-lock.json'));
    journal.lockHashBefore = lockHashBefore;
    writeJournal(stateDir, journal);

    if (effectiveStrategy === 'git') {
      const gitResult = updateViaGit({
        root,
        config,
        target: { tag: latest?.tag },
        git,
        allowLocalOrigin: deps.allowLocalOrigin,
      });
      journal.gitHeadBefore = gitResult.headBefore;
      journal.changedFiles = gitResult.changedFiles;
    } else {
      const stagedRoot = path.join(stateDir, 'staged');
      if (fs.existsSync(stagedRoot)) fs.rmSync(stagedRoot, { recursive: true, force: true });
      fs.mkdirSync(stagedRoot, { recursive: true });

      if (!latest?.zipUrl) {
        throw new Error(`Release ${toVersion} has no source archive to download; publish it as a GitHub Release first`);
      }

      const zipFile = path.join(stateDir, 'download.zip');
      await doDownloadZip({
        url: latest.zipUrl,
        destFile: zipFile,
        maxBytes: config.maxZipBytes,
        fetchFn: deps.fetchFn,
      });

      doExtractZip(zipFile, stagedRoot);
      const extractedRoot = findExtractedRoot(stagedRoot);

      const stagedResult = applyStagedTree({ stagedRoot: extractedRoot, root, config, backupDir });
      journal.createdFiles = stagedResult.created;
      journal.overwrittenFiles = stagedResult.overwritten;

      try {
        fs.rmSync(stagedRoot, { recursive: true, force: true });
        fs.rmSync(zipFile, { force: true });
      } catch {
        // ignore
      }
    }

    journal.state = 'applied';
    writeJournal(stateDir, journal);

    const lockHashAfter = hashFile(path.join(root, 'package-lock.json'));
    if (lockHashAfter && lockHashAfter !== lockHashBefore) {
      run('npm', ['install'], root);
    }

    run('npm', ['run', 'setup'], root);

    journal.state = 'migrated';
    writeJournal(stateDir, journal);

    journal.state = 'done';
    writeJournal(stateDir, journal);
    pruneBackups(backupsRoot, config.keepBackups || 3);
    clearJournal(stateDir);

    const result = {
      ok: true,
      from: fromVersion,
      to: toVersion,
      strategy: effectiveStrategy,
      backupDir,
      restartRequired: true,
    };

    writeFileAtomic(path.join(stateDir, 'result.json'), JSON.stringify(result, null, 2));
    releaseLock();
    return result;
  } catch (err) {
    // Rollback
    try {
      if (journal.strategy === 'git' && journal.gitHeadBefore) {
        rollbackGit(root, journal.gitHeadBefore, git);
      } else if (journal.strategy === 'zip') {
        restoreCode({
          root,
          backupDir,
          created: journal.createdFiles || [],
          overwritten: journal.overwrittenFiles || [],
        });
      }
      restoreDatabaseIfChanged(root, backupDir);
      journal.state = 'rolled-back';
      writeJournal(stateDir, journal);
    } catch {
      // ignore rollback secondary errors
    }

    const failureResult = {
      ok: false,
      from: fromVersion,
      to: toVersion,
      strategy: effectiveStrategy,
      backupDir,
      error: err instanceof Error ? err.message : String(err),
      restartRequired: false,
    };

    try {
      writeFileAtomic(path.join(stateDir, 'result.json'), JSON.stringify(failureResult, null, 2));
    } catch {
      // ignore
    }

    if (releaseLock) releaseLock();
    return failureResult;
  }
}

function recoverInterrupted({ root, config, deps = {} }) {
  const stateDir = path.join(root, config.stateDirName || '.update');
  const journal = readJournal(stateDir);

  if (!journal || journal.state === 'done') {
    return { recovered: false };
  }

  try {
    if (journal.strategy === 'git' && journal.gitHeadBefore) {
      rollbackGit(root, journal.gitHeadBefore, deps.git);
    } else if (journal.strategy === 'zip' && journal.backupDir) {
      restoreCode({
        root,
        backupDir: journal.backupDir,
        created: journal.createdFiles || [],
        overwritten: journal.overwrittenFiles || [],
      });
    }

    if (journal.backupDir) {
      restoreDatabaseIfChanged(root, journal.backupDir);
    }

    clearJournal(stateDir);
    return {
      recovered: true,
      message: `Recovered interrupted update (was in state: ${journal.state})`,
    };
  } catch (err) {
    return {
      recovered: false,
      message: `Failed to recover interrupted update: ${err.message}`,
    };
  }
}

module.exports = {
  applyUpdate,
  recoverInterrupted,
  defaultRun,
};
