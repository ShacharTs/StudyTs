import { readFile } from 'fs/promises';
import path from 'path';
import { LOG_FILE_PREFIX, LOG_LIMITS } from './logConfig.js';
import { rewriteAtomic } from './serialWriter.js';

const ENTRY_SEPARATOR = '\n\n';
const pending = new Map<string, Promise<void>>();

async function readEntries(file: string): Promise<string[]> {
  try {
    const text = await readFile(file, 'utf8');
    return text
      .split(ENTRY_SEPARATOR)
      .map((entry) => entry.trim())
      .filter((entry) => entry.startsWith('run: '));
  } catch {
    return [];
  }
}

export function recordRuntimeError(opts: {
  logDir: string;
  runId: string;
  block: string;
  keep?: number;
}): Promise<void> {
  const file = path.join(opts.logDir, `${LOG_FILE_PREFIX.digest}.log`);
  const keep = opts.keep ?? LOG_LIMITS.maxRuntimeErrors;
  const previous = pending.get(file) ?? Promise.resolve();
  const next = previous.then(async () => {
    const entries = await readEntries(file);
    entries.push(`run: ${opts.runId}\n${opts.block.trim()}`);
    await rewriteAtomic(file, entries.slice(-keep).join(ENTRY_SEPARATOR) + '\n');
  });
  pending.set(
    file,
    next.catch(() => undefined)
  );
  return next;
}
