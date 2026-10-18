'use strict';

const SEMVER = /^[vV]?(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(text) {
  const match = typeof text === 'string' ? SEMVER.exec(text.trim()) : null;
  return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) } : null;
}

function isNewerVersion(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch > b.patch;
}

module.exports = { parseVersion, isNewerVersion };
