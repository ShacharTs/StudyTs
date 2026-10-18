import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Finds the folder that holds package.json. Works from source (server/runtime) and from the
// bundled output (dist-server), which sits one level below the package root.
function findPackageRoot(startDir: string): string {
  let dir = startDir;
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
  return dir;
}

// Read-only app files (dist, config, locales) ship with the code, so they resolve from the package.
export const PACKAGE_ROOT = findPackageRoot(path.dirname(fileURLToPath(import.meta.url)));

// Writable user data (courses, secrets, temp files). An npx install sets STUDYTS_HOME to the
// user's app-data folder; a repo checkout falls back to the project folder.
export const DATA_ROOT = process.env.STUDYTS_HOME ? path.resolve(process.env.STUDYTS_HOME) : PACKAGE_ROOT;
