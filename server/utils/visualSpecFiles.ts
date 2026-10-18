/**
 * Mirror of saved VisualSpecs as data/_shared/visual-specs/<key>.json: git-diffable, and the load fallback when the
 * database row is missing. Writes go through writeTracked so the data/ watcher recognises them as our own and does
 * not reseed the database.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { writeTracked } from './fileSync.js';
import { isVisualSpecKey } from '../../src/core/validation/visualSpec/visualSpecKey.js';
import { DATA_ROOT } from '../runtime/appPaths.js';

export interface VisualSpecFileStore {
  write(key: string, spec: unknown): void;
  read(key: string): { spec: unknown } | null;
  listKeys(): string[];
}

export function createVisualSpecFileStore(directory: string): VisualSpecFileStore {
  const pathFor = (key: string): string => {
    // The key rule is the only barrier between a request and a filesystem path.
    if (!isVisualSpecKey(key)) throw new Error(`Invalid visual spec key "${key}"`);
    return join(directory, `${key}.json`);
  };

  return {
    write(key, spec) {
      const path = pathFor(key);
      mkdirSync(directory, { recursive: true });
      writeTracked(path, JSON.stringify(spec, null, 2));
    },
    read(key) {
      const path = pathFor(key);
      if (!existsSync(path)) return null;
      return { spec: JSON.parse(readFileSync(path, 'utf8')) };
    },
    listKeys() {
      if (!existsSync(directory)) return [];
      return readdirSync(directory)
        .filter((name) => name.endsWith('.json'))
        .map((name) => name.slice(0, -'.json'.length))
        .filter(isVisualSpecKey);
    },
  };
}

export const visualSpecFiles = createVisualSpecFileStore(join(DATA_ROOT, 'data', '_shared', 'visual-specs'));
