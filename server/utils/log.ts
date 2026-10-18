import fs from 'fs';
import path from 'path';

import { redact } from '../../src/core/shared/redact.js';
import { LOG_FILE_PREFIX, LOG_LIMITS, makeRunId, resolveLogDir } from '../logging/logConfig.js';
import { pruneOldestFiles } from '../logging/rotation.js';
import { appendSerial, appendSync, onWriteFailure } from '../logging/serialWriter.js';
import { recordRuntimeError } from '../logging/runtimeErrorDigest.js';

export { redact };

const LOG_DIR = resolveLogDir();
const CRASH_DIR = path.join(LOG_DIR, 'crashes');
const RUN_ID = makeRunId();
const RUN_LOG = path.join(LOG_DIR, `${LOG_FILE_PREFIX.run}${RUN_ID}.log`);

function reportFailure(what: string, detail: string): void {
  process.stderr.write(`[logging] ${what}: ${detail}\n`);
}

function startRun(): void {
  try {
    fs.mkdirSync(CRASH_DIR, { recursive: true });
  } catch (err) {
    reportFailure(
      'log directory unavailable, file logging disabled',
      err instanceof Error ? err.message : String(err)
    );
    return;
  }
  const run = pruneOldestFiles(LOG_DIR, LOG_FILE_PREFIX.run, LOG_LIMITS.maxRunLogs - 1);
  for (const f of run.failed) {
    reportFailure(`could not delete old log ${f.name}`, f.reason);
  }
}

startRun();
onWriteFailure((file, err) =>
  reportFailure(`could not write ${path.basename(file)}`, err instanceof Error ? err.message : String(err))
);

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogOptions {
  fileOnly?: boolean;
}

function consoleMethodFor(level: LogLevel): (msg: string) => void {
  if (level === 'error' || level === 'fatal') return console.error;
  if (level === 'warn') return console.warn;
  if (level === 'debug') return console.debug;
  return console.log;
}

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'OK   ',
  warn: 'WARN ',
  error: 'ERROR',
  fatal: 'CRASH',
};

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function describeError(err: unknown): string[] {
  if (!(err instanceof Error)) return [`    cause: ${String(err)}`];
  const code = (err as NodeJS.ErrnoException).code;
  const stack = (err.stack ?? '')
    .split('\n')
    .slice(1)
    .map((line) => `      ${line.trim()}`);
  return [`    cause: ${err.name}: ${err.message}${code ? ` (${code})` : ''}`, ...stack];
}

function formatReadable(
  ts: string,
  level: LogLevel,
  msg: string,
  fields?: Record<string, unknown>,
  err?: unknown
): string {
  const when = ts.slice(0, 19).replace('T', ' ');
  const lines = [`${when}  ${LEVEL_LABEL[level]}  ${msg}`];
  const safe = fields ? (redact(fields) as Record<string, unknown>) : {};
  for (const [key, value] of Object.entries(safe)) {
    lines.push(`    ${key}: ${formatValue(value)}`);
  }
  if (err) {
    lines.push(...describeError(err));
  }
  return lines.join('\n');
}

function output(
  level: LogLevel,
  msg: string,
  fields?: Record<string, unknown>,
  err?: unknown,
  _options?: LogOptions
): void {
  const ts = new Date().toISOString();
  const text = formatReadable(ts, level, msg, fields, err);

  const showOnConsole = level === 'error' || level === 'fatal' || process.env.STUDYTS_VERBOSE_LOGS === '1';
  if (showOnConsole) {
    consoleMethodFor(level)(text);
  }

  void appendSerial(RUN_LOG, text + '\n');
  if (level === 'error' || level === 'fatal') {
    void recordRuntimeError({ logDir: LOG_DIR, runId: RUN_ID, block: text });
  }
}

let crashSeq = 0;

function formatCrashReport(crashId: string, origin: string, error: unknown): string {
  const isError = error instanceof Error;
  const code = isError ? (error as NodeJS.ErrnoException).code : undefined;
  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  return [
    `CRASH REPORT ${crashId}`,
    `When:    ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
    `Where:   ${origin}`,
    `What:    ${isError ? `${error.name}: ${error.message}` : String(error)}${code ? ` (${code})` : ''}`,
    `Process: pid ${process.pid}, up ${Math.round(process.uptime())}s, ${rssMb} MB, node ${process.version} ${process.platform}`,
    '',
    'Stack:',
    ...(isError
      ? (error.stack ?? '')
          .split('\n')
          .slice(1)
          .map((line) => `  ${line.trim()}`)
      : ['  (not an Error, no stack)']),
    '',
  ].join('\n');
}

function writeCrashReport(error: unknown, origin: string): string {
  const crashId = `${LOG_FILE_PREFIX.crash}${Date.now()}-${String(crashSeq++).padStart(6, '0')}`;
  const crashFile = path.join(CRASH_DIR, `${crashId}.txt`);

  try {
    appendSync(crashFile, formatCrashReport(crashId, origin, error));
    const result = pruneOldestFiles(CRASH_DIR, LOG_FILE_PREFIX.crash, LOG_LIMITS.maxCrashLogs);
    for (const f of result.failed) {
      reportFailure(`could not delete old crash ${f.name}`, f.reason);
    }
    output('fatal', `Process crash recorded in ${crashFile}`, { crashId, origin }, error);
  } catch (err) {
    reportFailure(
      `failed to write crash report ${path.basename(crashFile)}`,
      err instanceof Error ? err.message : String(err)
    );
    output('fatal', `Failed to write crash report for ${origin}`, { crashId }, error);
  }

  return crashFile;
}

let handlersInstalled = false;
let shutdownHook: (() => Promise<void>) | null = null;

function handleUncaught(err: Error, origin: string): void {
  const reportPath = writeCrashReport(err, `uncaughtException: ${origin}`);
  process.stderr.write(`[FATAL CRASH] Uncaught exception logged to ${reportPath}\n`);
  if (process.env.EXIT_ON_UNCAUGHT !== '1') return;
  void (shutdownHook ? shutdownHook() : Promise.resolve())
    .catch(() => undefined)
    .finally(() => process.exit(1));
}

function setupProcessCrashHandlers(): void {
  if (handlersInstalled) return;
  handlersInstalled = true;
  process.on('uncaughtException', handleUncaught);
  process.on('unhandledRejection', (reason) => {
    writeCrashReport(reason, 'unhandledRejection');
    output('error', 'Unhandled promise rejection intercepted', undefined, reason);
  });
}

export const log = {
  runId: RUN_ID,
  logDir: LOG_DIR,
  debug: (msg: string, fields?: Record<string, unknown>) => output('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>, options?: LogOptions) =>
    output('info', msg, fields, undefined, options),
  warn: (msg: string, fields?: Record<string, unknown>) => output('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>, err?: unknown) => output('error', msg, fields, err),
  fatal: (msg: string, fields?: Record<string, unknown>, err?: unknown) => output('fatal', msg, fields, err),
  crash: (err: unknown, origin: string = 'runtime') => writeCrashReport(err, origin),
  initCrashHandlers: () => setupProcessCrashHandlers(),
  setShutdownHook: (fn: () => Promise<void>) => {
    shutdownHook = fn;
  },
};
