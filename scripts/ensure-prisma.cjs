#!/usr/bin/env node
// Brings the Prisma client and database up to date before dev starts, without failing on a file lock
// that does not matter. Windows keeps the query engine DLL locked while any old StudyTs process runs, so
// `prisma generate` can fail with EPERM even when the client already matches the schema.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCHEMA = path.join(ROOT, 'prisma', 'schema.prisma');
// Written only after a successful generate, so a half-finished generate never counts as current.
const MARKER = path.join(ROOT, 'node_modules', '.prisma', 'client', '.studyts-schema-hash');
const CLIENT_INDEX = path.join(ROOT, 'node_modules', '.prisma', 'client', 'index.js');

function schemaHash() {
  return crypto.createHash('sha256').update(fs.readFileSync(SCHEMA)).digest('hex');
}

function clientMatchesSchema() {
  return fs.existsSync(MARKER) && fs.readFileSync(MARKER, 'utf8') === schemaHash();
}

function run(command) {
  execSync(command, { stdio: 'inherit', cwd: ROOT });
}

function generateClient() {
  if (clientMatchesSchema()) return;
  try {
    run('npx prisma generate');
  } catch (err) {
    // A client built before this check existed has no marker yet; it is usable, so keep going.
    if (fs.existsSync(CLIENT_INDEX) && !fs.existsSync(MARKER)) {
      console.warn('[ensure-prisma] generate was blocked; using the existing client.');
      return;
    }
    throw new Error(
      '[ensure-prisma] The Prisma client cannot be rebuilt because another StudyTs process is holding it. ' +
        'Run "npm run stop", then start again.',
      { cause: err },
    );
  }
  fs.writeFileSync(MARKER, schemaHash());
}

generateClient();
run('npx prisma migrate deploy');
