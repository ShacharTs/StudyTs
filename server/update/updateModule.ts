import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const { checkForUpdate, readCurrentVersion } = require('../../scripts/update/checkForUpdate.cjs');
const { readUpdateConfig } = require('../../scripts/update/updateConfig.cjs');
const { readUpdateState, writeUpdateState } = require('../../scripts/update/launchCheck.cjs');

export interface UpdateLatestInfo {
  version: string;
  tag: string;
  pageUrl: string;
  notes: string;
}

export interface UpdateStatusResult {
  status: 'up-to-date' | 'available' | 'offline' | 'rate-limited' | 'no-releases' | 'error';
  currentVersion: string;
  latest?: UpdateLatestInfo;
  mode: string;
  checkedAt?: number;
  pendingVersion?: string;
  skippedVersion?: string;
  lastResult?: {
    ok: boolean;
    from: string;
    to: string;
    strategy: string;
    error?: string;
    restartRequired: boolean;
  };
}

export async function checkStatus(force = false): Promise<UpdateStatusResult> {
  const root = process.cwd();
  const config = readUpdateConfig(process.env);
  const stateDir = path.join(root, config.stateDirName || '.update');
  const state = readUpdateState(stateDir);

  const checkRes = await checkForUpdate({ root, config, force });

  let lastResult;
  const resultPath = path.join(stateDir, 'result.json');
  try {
    const fs = require('fs');
    if (fs.existsSync(resultPath)) {
      lastResult = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    }
  } catch {
    // ignore
  }

  return {
    status: checkRes.status,
    currentVersion: checkRes.currentVersion || readCurrentVersion(root),
    latest: checkRes.latest
      ? {
          version: checkRes.latest.version,
          tag: checkRes.latest.tag,
          pageUrl: checkRes.latest.pageUrl,
          notes: checkRes.latest.notes,
        }
      : undefined,
    mode: config.mode,
    checkedAt: checkRes.checkedAt,
    pendingVersion: state.pendingVersion,
    skippedVersion: state.skippedVersion,
    lastResult,
  };
}

export function readState(): { pendingVersion?: string; skippedVersion?: string } {
  const root = process.cwd();
  const config = readUpdateConfig(process.env);
  const stateDir = path.join(root, config.stateDirName || '.update');
  return readUpdateState(stateDir);
}

export function writeState(partial: { pendingVersion?: string; skippedVersion?: string }): void {
  const root = process.cwd();
  const config = readUpdateConfig(process.env);
  const stateDir = path.join(root, config.stateDirName || '.update');
  const current = readUpdateState(stateDir);
  writeUpdateState(stateDir, { ...current, ...partial });
}

export function clearLastResult(): void {
  const root = process.cwd();
  const config = readUpdateConfig(process.env);
  const resultPath = path.join(root, config.stateDirName || '.update', 'result.json');
  try {
    const fs = require('fs');
    if (fs.existsSync(resultPath)) {
      fs.rmSync(resultPath, { force: true });
    }
  } catch {
    // ignore
  }
}
