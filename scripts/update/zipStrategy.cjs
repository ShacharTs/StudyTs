'use strict';

const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable, Transform } = require('stream');
const { execFileSync } = require('child_process');

function assertDownloadAllowed(rawUrl, allowedHosts) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid download URL: ${rawUrl}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`Insecure download protocol: ${parsed.protocol}`);
  }

  if (Array.isArray(allowedHosts) && allowedHosts.length > 0) {
    const hostname = parsed.hostname.toLowerCase();
    const isAllowed = allowedHosts.some((h) => hostname === h.toLowerCase() || hostname.endsWith(`.${h.toLowerCase()}`));
    if (!isAllowed) {
      throw new Error(`Download host '${hostname}' is not in the allowed hosts list`);
    }
  }
}

async function downloadZip({ url, destFile, maxBytes = 200 * 1024 * 1024, fetchFn = fetch, timeoutMs = 30000 }) {
  assertDownloadAllowed(url);

  const destParent = path.dirname(destFile);
  if (!fs.existsSync(destParent)) {
    fs.mkdirSync(destParent, { recursive: true });
  }

  const tmpFile = `${destFile}.${process.pid}.tmp`;
  const response = await fetchFn(url, {
    method: 'GET',
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}: ${response.statusText}`);
  }

  // Check final URL in case of redirects
  if (response.url) {
    assertDownloadAllowed(response.url);
  }

  let totalBytes = 0;
  const countingTransform = new Transform({
    transform(chunk, encoding, callback) {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        callback(new Error(`Download exceeded maximum allowed size of ${maxBytes} bytes`));
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    const webStream = response.body;
    const nodeStream = webStream && typeof webStream.getReader === 'function' ? Readable.fromWeb(webStream) : webStream;

    if (nodeStream) {
      const fileOut = fs.createWriteStream(tmpFile);
      await pipeline(nodeStream, countingTransform, fileOut);
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > maxBytes) {
        throw new Error(`Download exceeded maximum allowed size of ${maxBytes} bytes`);
      }
      fs.writeFileSync(tmpFile, buffer);
      totalBytes = buffer.length;
    }

    fs.renameSync(tmpFile, destFile);
    return totalBytes;
  } catch (err) {
    try {
      if (fs.existsSync(tmpFile)) fs.rmSync(tmpFile, { force: true });
    } catch {
      // ignore
    }
    throw err;
  }
}

function extractZip(zipFile, destDir, { platform = process.platform, run = execFileSync } = {}) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (platform === 'win32' || platform === 'darwin') {
    run('tar', ['-xf', zipFile, '-C', destDir], { stdio: ['ignore', 'pipe', 'pipe'] });
  } else {
    run('unzip', ['-q', zipFile, '-d', destDir], { stdio: ['ignore', 'pipe', 'pipe'] });
  }
}

function findExtractedRoot(destDir) {
  const entries = fs.readdirSync(destDir, { withFileTypes: true });
  if (entries.length === 1 && entries[0].isDirectory()) {
    return path.join(destDir, entries[0].name);
  }
  if (entries.length === 0) {
    throw new Error('Extracted zip archive is empty');
  }
  return destDir;
}

function assertInsideDir(baseDir, targetPath) {
  const relative = path.relative(baseDir, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path '${targetPath}' escapes base directory '${baseDir}'`);
  }
}

function isPreserved(rel, config = {}, existsInRoot = false) {
  const normRel = rel.replace(/\\/g, '/');

  if (Array.isArray(config.preserve)) {
    for (const rule of config.preserve) {
      const normRule = rule.replace(/\\/g, '/');
      if (normRule.endsWith('/')) {
        if (normRel.startsWith(normRule) || normRel === normRule.slice(0, -1)) {
          return true;
        }
      } else if (normRel === normRule) {
        return true;
      }
    }
  }

  if (Array.isArray(config.userContentDirs)) {
    for (const udir of config.userContentDirs) {
      const normUdir = udir.replace(/\\/g, '/');
      if (normRel.startsWith(normUdir) && existsInRoot) {
        return true;
      }
    }
  }

  return false;
}

function applyStagedTree({ stagedRoot, root, config = {}, backupDir }) {
  const created = [];
  const overwritten = [];

  const walk = (currentDir) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(currentDir, entry.name);
      assertInsideDir(stagedRoot, srcPath);

      if (entry.isDirectory()) {
        walk(srcPath);
      } else if (entry.isFile()) {
        const rel = path.relative(stagedRoot, srcPath).replace(/\\/g, '/');
        const destPath = path.join(root, rel);
        assertInsideDir(root, destPath);

        const exists = fs.existsSync(destPath);
        if (isPreserved(rel, config, exists)) {
          continue;
        }

        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        if (exists) {
          if (backupDir) {
            const backupPath = path.join(backupDir, 'code', rel);
            const backupParent = path.dirname(backupPath);
            if (!fs.existsSync(backupParent)) {
              fs.mkdirSync(backupParent, { recursive: true });
            }
            fs.copyFileSync(destPath, backupPath);
          }
          overwritten.push(rel);
        } else {
          created.push(rel);
        }

        const tmp = `${destPath}.update.tmp`;
        fs.copyFileSync(srcPath, tmp);
        fs.renameSync(tmp, destPath);
      }
    }
  };

  walk(stagedRoot);
  return { created, overwritten };
}

function restoreCode({ root, backupDir, created = [], overwritten = [] }) {
  for (const rel of created) {
    const target = path.join(root, rel);
    try {
      if (fs.existsSync(target)) fs.rmSync(target, { force: true });
    } catch {
      // ignore
    }
  }

  if (backupDir) {
    for (const rel of overwritten) {
      const backedUp = path.join(backupDir, 'code', rel);
      const target = path.join(root, rel);
      if (fs.existsSync(backedUp)) {
        const parent = path.dirname(target);
        if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
        fs.copyFileSync(backedUp, target);
      }
    }
  }
}

module.exports = {
  assertDownloadAllowed,
  downloadZip,
  extractZip,
  findExtractedRoot,
  assertInsideDir,
  isPreserved,
  applyStagedTree,
  restoreCode,
};
