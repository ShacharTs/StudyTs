import { Request, Response, Router } from 'express';
import fs from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { log } from '../utils/log.js';
import { LOG_FILE_PREFIX } from '../logging/logConfig.js';

export const logsRouter = Router();

async function readSafeFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function listRunLogs(logDir: string): string[] {
  try {
    return fs
      .readdirSync(logDir)
      .filter((name) => name.startsWith(LOG_FILE_PREFIX.run) && name.endsWith('.log'))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function resolveRunFile(logDir: string, requestedFile?: string): string {
  if (!requestedFile) {
    return path.join(logDir, `${LOG_FILE_PREFIX.run}${log.runId}.log`);
  }
  const cleanName = path.basename(requestedFile);
  if (!cleanName.startsWith(LOG_FILE_PREFIX.run) || !cleanName.endsWith('.log')) {
    return path.join(logDir, `${LOG_FILE_PREFIX.run}${log.runId}.log`);
  }
  return path.join(logDir, cleanName);
}

logsRouter.get('/logs', async (req: Request, res: Response) => {
  const logDir = log.logDir;
  const targetRunFile = resolveRunFile(logDir, typeof req.query.run === 'string' ? req.query.run : undefined);
  const digestFile = path.join(logDir, `${LOG_FILE_PREFIX.digest}.log`);

  const [runLog, runtimeErrors] = await Promise.all([
    readSafeFile(targetRunFile),
    readSafeFile(digestFile),
  ]);

  res.json({
    runId: log.runId,
    activeFile: path.basename(targetRunFile),
    runLog,
    runtimeErrors,
    runs: listRunLogs(logDir),
  });
});
