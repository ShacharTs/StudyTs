'use strict';

const fs = require('fs');
const path = require('path');
const { writeFileAtomic } = require('../writeFileAtomic.cjs');

const LOCK_MAX_AGE_MS = 3_600_000; // 1 hour

const USER_DATA_INCLUDE = [
  'prisma/studyts.db',
  'prisma/studyts.db-wal',
  'prisma/studyts.db-shm',
  '.env',
  '.secrets',
  'data',
];

function defaultIsPidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock(stateDir, options = {}) {
  const now = options.now || Date.now();
  const isPidAlive = options.isPidAlive || defaultIsPidAlive;
  const lockFile = path.join(stateDir, 'lock.json');

  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }

  const payload = JSON.stringify({ pid: process.pid, at: now });

  try {
    const fd = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(fd, payload, 'utf8');
    fs.closeSync(fd);
  } catch (err) {
    if (err.code === 'EEXIST') {
      let existing;
      try {
        existing = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      } catch {
        existing = {};
      }

      const isStale = (existing.at && now - existing.at > LOCK_MAX_AGE_MS) || (existing.pid && !isPidAlive(existing.pid));

      if (isStale) {
        fs.rmSync(lockFile, { force: true });
        return acquireLock(stateDir, options);
      }

      throw new Error('Another update is in progress');
    }
    throw err;
  }

  return function releaseLock() {
    try {
      fs.rmSync(lockFile, { force: true });
    } catch {
      // ignore
    }
  };
}

function journalPath(stateDir) {
  return path.join(stateDir, 'journal.json');
}

function writeJournal(stateDir, entry) {
  writeFileAtomic(journalPath(stateDir), JSON.stringify(entry, null, 2));
}

function readJournal(stateDir) {
  try {
    return JSON.parse(fs.readFileSync(journalPath(stateDir), 'utf8'));
  } catch {
    return null;
  }
}

function clearJournal(stateDir) {
  try {
    fs.rmSync(journalPath(stateDir), { force: true });
  } catch {
    // ignore
  }
}

function backupUserData({ root, backupDir, include = USER_DATA_INCLUDE }) {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  let filesCount = 0;
  let bytesCount = 0;

  for (const rel of include) {
    const src = path.join(root, rel);
    if (!fs.existsSync(src)) continue;

    const dest = path.join(backupDir, rel);
    const destParent = path.dirname(dest);
    if (!fs.existsSync(destParent)) {
      fs.mkdirSync(destParent, { recursive: true });
    }

    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true, errorOnExist: false });
      // count directory files
      const walk = (d) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const entryPath = path.join(d, entry.name);
          if (entry.isDirectory()) walk(entryPath);
          else if (entry.isFile()) {
            filesCount++;
            bytesCount += fs.statSync(entryPath).size;
          }
        }
      };
      walk(src);
    } else if (stat.isFile()) {
      fs.copyFileSync(src, dest);
      filesCount++;
      bytesCount += stat.size;
    }
  }

  return { files: filesCount, bytes: bytesCount };
}

function verifyBackup(root, backupDir, include = USER_DATA_INCLUDE) {
  for (const rel of include) {
    const src = path.join(root, rel);
    const backup = path.join(backupDir, rel);

    if (!fs.existsSync(src)) continue;
    if (!fs.existsSync(backup)) {
      throw new Error(`Backup verification failed: missing backed-up target ${rel}`);
    }

    const srcStat = fs.statSync(src);
    const backupStat = fs.statSync(backup);

    if (srcStat.isFile()) {
      if (srcStat.size !== backupStat.size) {
        throw new Error(`Backup verification failed: size mismatch for ${rel} (src: ${srcStat.size}, backup: ${backupStat.size})`);
      }
    }
  }
}

function pruneBackups(backupsRoot, keep = 3) {
  if (!fs.existsSync(backupsRoot)) return;

  const entries = fs
    .readdirSync(backupsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  if (entries.length <= keep) return;

  const toDelete = entries.slice(0, entries.length - keep);
  for (const dirName of toDelete) {
    try {
      fs.rmSync(path.join(backupsRoot, dirName), { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

module.exports = {
  USER_DATA_INCLUDE,
  acquireLock,
  writeJournal,
  readJournal,
  clearJournal,
  backupUserData,
  verifyBackup,
  pruneBackups,
};
