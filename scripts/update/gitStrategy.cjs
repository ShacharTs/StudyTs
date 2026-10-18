'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const defaultGit = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function isGitClone(root) {
  return fs.existsSync(path.join(root, '.git'));
}

function parseRepoFromRemote(url) {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(String(url).trim());
  return match ? match[1] : null;
}

function assertOriginMatches(originUrl, repo, { allowLocalOrigin = false } = {}) {
  if (allowLocalOrigin) return;
  if (parseRepoFromRemote(originUrl) !== repo) {
    throw new Error(`origin (${originUrl}) is not ${repo}; refusing to update from it`);
  }
}

function dirtyTrackedPaths(root, git) {
  return git(['status', '--porcelain', '--untracked-files=no'], root)
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3).trim());
}

function assertCleanOutsideUserContent(root, userContentDirs = ['data/'], git = defaultGit) {
  const blocking = dirtyTrackedPaths(root, git).filter((p) => !userContentDirs.some((d) => p.startsWith(d)));
  if (blocking.length > 0) {
    throw new Error(`Local changes outside user content block the update: ${blocking.join(', ')}`);
  }
}

function updateViaGit({ root, config, target = {}, git = defaultGit, allowLocalOrigin = false }) {
  assertOriginMatches(git(['remote', 'get-url', 'origin'], root), config.repo, { allowLocalOrigin });
  assertCleanOutsideUserContent(root, config.userContentDirs, git);
  const headBefore = git(['rev-parse', 'HEAD'], root);
  const ref = target.tag ? `refs/tags/${target.tag}` : 'FETCH_HEAD';
  git(target.tag ? ['fetch', '--tags', '--force', 'origin'] : ['fetch', 'origin'], root);

  try {
    git(['merge-base', '--is-ancestor', 'HEAD', ref], root);
  } catch {
    throw new Error('Local history diverged from the release; not a fast-forward');
  }

  git(['merge', '--ff-only', ref], root);
  const headAfter = git(['rev-parse', 'HEAD'], root);
  const changedFiles = git(['diff', '--name-only', `${headBefore}..${headAfter}`], root)
    .split('\n')
    .filter(Boolean);

  return { headBefore, headAfter, changedFiles };
}

function rollbackGit(root, headBefore, git = defaultGit) {
  git(['reset', '--keep', headBefore], root);
}

module.exports = {
  isGitClone,
  parseRepoFromRemote,
  assertOriginMatches,
  assertCleanOutsideUserContent,
  updateViaGit,
  rollbackGit,
};
