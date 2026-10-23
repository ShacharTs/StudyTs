'use strict';

const os = require('os');
const path = require('path');

// Same folder names as bin/studyts.mjs, so people who used `npx studyts` keep their data.
const APP_NAME = 'StudyTs';

function resolveDesktopHome(app, platform = process.platform, env = process.env) {
  app.setName(APP_NAME);
  if (env.STUDYTS_HOME) return path.resolve(env.STUDYTS_HOME);
  // Built from the exact folder names bin/studyts.mjs uses: Electron's own userData follows the lower-case package
  // name, which would be a different folder on case-sensitive disks. Linux uses the XDG data folder, not ~/.config.
  const home = platform === 'linux'
    ? path.join(env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'studyts')
    : path.join(app.getPath('appData'), APP_NAME);
  const resolved = path.resolve(home);
  app.setPath('userData', resolved);
  return resolved;
}

// Native engines and the Prisma CLI cannot run from inside app.asar; electron-builder unpacks them next to it.
function unpackedPath(appPath) {
  return appPath.replace(/app\.asar(?![.\w])/, 'app.asar.unpacked');
}

module.exports = { APP_NAME, resolveDesktopHome, unpackedPath };
