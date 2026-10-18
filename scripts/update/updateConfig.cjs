'use strict';

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

const DEFAULTS = {
  repo: 'ShacharTs/StudyTs',
  apiBase: 'https://api.github.com',
  userAgent: 'StudyTS-Updater',
  apiVersion: '2022-11-28',
  timeoutMs: 8000,
  cacheTtlMs: 3600_000, // 1 hour
  mode: 'prompt', // 'prompt' | 'auto' | 'off'
  channel: 'release', // 'release' | 'commit'
  stateDirName: '.update',
  keepBackups: 3,
  maxZipBytes: 150_000_000, // 150MB
  allowedDownloadHosts: ['github.com', 'api.github.com', 'codeload.github.com', 'objects.githubusercontent.com'],
  promptTimeoutMs: 15000,
  preserve: [
    '.env',
    '.secrets/',
    '.logs/',
    'prisma/*.db*',
    'node_modules/',
    '.git/',
    'temp/',
  ],
  userContentDirs: ['data/'],
};

function readUpdateConfig(env = process.env) {
  const customRepo = env.STUDYTS_UPDATE_REPO && typeof env.STUDYTS_UPDATE_REPO === 'string' ? env.STUDYTS_UPDATE_REPO.trim() : '';
  const repo = REPO_PATTERN.test(customRepo) ? customRepo : DEFAULTS.repo;

  const rawMode = (env.STUDYTS_AUTO_UPDATE || '').toLowerCase();
  const mode = rawMode === 'auto' || rawMode === 'off' ? rawMode : 'prompt';

  const rawChannel = (env.STUDYTS_UPDATE_CHANNEL || '').toLowerCase();
  const channel = rawChannel === 'commit' ? 'commit' : 'release';

  return {
    ...DEFAULTS,
    repo,
    mode,
    channel,
  };
}

module.exports = {
  DEFAULTS,
  readUpdateConfig,
};
