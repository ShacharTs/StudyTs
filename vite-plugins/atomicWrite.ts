/**
 * Per-path mutex + atomic write for the content-editor and canvas-editor
 * dev endpoints. Two overlapping requests touching the same file (a
 * double-click Save, or two browser tabs) otherwise race: both read the
 * same source text, both patch it independently, and the second write
 * silently discards the first's changes with no error to either caller.
 * data/index.ts is shared across every course (unlike per-scene files),
 * making this collision realistic rather than theoretical. The mutex
 * chains writes to the same resolved path through one shared Promise per
 * path; writes to different paths never block each other.
 *
 * Every write goes through `<path>.tmp` -> fs.rename rather than a direct
 * writeFile, so a crash mid-write can never leave the real file truncated
 * — rename is atomic on the same volume, including on Windows.
 */

import { writeFile, rename } from 'fs/promises';

const pathLocks = new Map<string, Promise<void>>();

async function writeOnce(absPath: string, content: string | Buffer): Promise<void> {
  const tmpPath = `${absPath}.tmp`;
  await writeFile(tmpPath, content);
  await rename(tmpPath, absPath);
}

export function atomicWriteFile(absPath: string, content: string | Buffer): Promise<void> {
  const previous = pathLocks.get(absPath) ?? Promise.resolve();
  const next = previous.then(() => writeOnce(absPath, content));
  // Store a settled-tracking promise so a failed write doesn't wedge the
  // chain for subsequent writers to the same path.
  pathLocks.set(
    absPath,
    next.catch(() => undefined)
  );
  return next;
}
