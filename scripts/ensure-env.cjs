#!/usr/bin/env node
// Creates .env from .env.example on a fresh clone. .env is git-ignored, so Prisma and
// `tsx --env-file=.env` fail with no DATABASE_URL until someone copies the template by hand.
// Never overwrites an existing .env, so the user's keys are safe.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET = path.join(ROOT, '.env');
const TEMPLATE = path.join(ROOT, '.env.example');

if (fs.existsSync(TARGET)) {
  console.log('[ensure-env] .env already exists, leaving it alone.');
} else {
  fs.copyFileSync(TEMPLATE, TARGET);
  console.log('[ensure-env] created .env from .env.example.');
}
