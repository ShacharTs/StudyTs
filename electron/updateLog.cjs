'use strict';

const fs = require('fs');
const path = require('path');

// electron-updater only logs to the console, which an installed app does not have; a file is the only place a
// failed check can be read afterwards.
function createFileLogger(logPath) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const write = (level) => (message) => {
    const text = message instanceof Error ? message.stack || message.message : String(message);
    try {
      fs.appendFileSync(logPath, `${new Date().toISOString()} ${level} ${text}\n`);
    } catch (err) {
      console.warn(`Could not write ${logPath}: ${err.message}`);
    }
  };
  return { info: write('INFO'), warn: write('WARN'), error: write('ERROR'), debug: write('DEBUG') };
}

module.exports = { createFileLogger };
