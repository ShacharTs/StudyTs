import fs from 'fs';
import { appendFile, writeFile, rename } from 'fs/promises';

type FailureHandler = (file: string, err: unknown) => void;

const queues = new Map<string, Promise<void>>();
let failureHandler: FailureHandler = (file, err) => {
  process.stderr.write(`[logging] could not write ${file}: ${err instanceof Error ? err.message : String(err)}\n`);
};

export function onWriteFailure(handler: FailureHandler): void {
  failureHandler = handler;
}

function enqueue(file: string, job: () => Promise<void>): Promise<void> {
  const previous = queues.get(file) ?? Promise.resolve();
  const next = previous.then(job).catch((err) => failureHandler(file, err));
  queues.set(file, next);
  void next.then(() => {
    if (queues.get(file) === next) queues.delete(file);
  });
  return next;
}

export function appendSerial(file: string, text: string): Promise<void> {
  return enqueue(file, () => appendFile(file, text, 'utf8'));
}

export function rewriteAtomic(file: string, text: string): Promise<void> {
  return enqueue(file, async () => {
    const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tmp, text, 'utf8');
    await rename(tmp, file);
  });
}

// Synchronous on purpose: process may exit immediately after crash, so write cannot be deferred.
export function appendSync(file: string, text: string): void {
  fs.appendFileSync(file, text, 'utf8');
}
