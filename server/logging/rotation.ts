import fs from 'fs';
import path from 'path';

export interface PruneResult {
  deleted: string[];
  failed: { name: string; reason: string }[];
}

interface Candidate {
  name: string;
  mtimeMs: number;
}

function mtimeOrZero(file: string): number {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function listCandidates(dir: string, prefix: string): Candidate[] {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.startsWith(prefix))
    .map((name) => ({ name, mtimeMs: mtimeOrZero(path.join(dir, name)) }));
}

function byAge(a: Candidate, b: Candidate): number {
  return a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name);
}

export function pruneOldestFiles(dir: string, prefix: string, keep: number): PruneResult {
  const result: PruneResult = { deleted: [], failed: [] };
  const sorted = listCandidates(dir, prefix).sort(byAge);
  const excess = sorted.slice(0, Math.max(0, sorted.length - Math.max(0, keep)));
  for (const { name } of excess) {
    try {
      fs.unlinkSync(path.join(dir, name));
      result.deleted.push(name);
    } catch (err) {
      result.failed.push({ name, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}
