'use strict';

const fs = require('fs');
const path = require('path');

function writeFileAtomic(file, content, mode = 0o600) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    fs.writeFileSync(tmp, content, { encoding: 'utf8', mode });
    fs.renameSync(tmp, file);
  } catch (error) {
    try {
      if (fs.existsSync(tmp)) {
        fs.rmSync(tmp, { force: true });
      }
    } catch {
      // ignore cleanup error
    }
    throw error;
  }
}

module.exports = { writeFileAtomic };
