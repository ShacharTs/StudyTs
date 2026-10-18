import path from 'path';
import { DATA_ROOT } from '../runtime/appPaths.js';

export const LOG_LIMITS = {
  maxRunLogs: 10,
  maxRuntimeErrors: 10,
  maxCrashLogs: 20,
  maxClientReportBytes: 16 * 1024,
  maxFieldChars: 2000,
  clientReportsPerMinute: 30,
} as const;

export const LOG_FILE_PREFIX = { run: 'run-', crash: 'crash-', digest: 'runtime-errors' } as const;

export function resolveLogDir(env: NodeJS.ProcessEnv = process.env, cwd: string = DATA_ROOT): string {
  return path.resolve(env.STUDYTS_LOG_DIR ?? path.join(cwd, '.logs'));
}

export function makeRunId(now: Date = new Date(), pid: number = process.pid): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').replace('.', '-').replace('Z', '');
  return `${stamp}-p${pid}`;
}
