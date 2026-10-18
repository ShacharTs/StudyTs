'use strict';

const fs = require('fs');
const path = require('path');
const { isNewerVersion, parseVersion } = require('./versionCompare.cjs');
const { writeFileAtomic } = require('../writeFileAtomic.cjs');

function readCurrentVersion(root) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function cachePath(root, config) {
  return path.join(root, config.stateDirName, 'cache.json');
}

function readCache(root, config) {
  try {
    return JSON.parse(fs.readFileSync(cachePath(root, config), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return {};
    return {};
  }
}

function writeCache(root, config, cache) {
  try {
    const dir = path.join(root, config.stateDirName);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    writeFileAtomic(cachePath(root, config), JSON.stringify(cache, null, 2));
  } catch {
    // ignore cache write errors
  }
}

function toLatest(json) {
  if (!json || typeof json !== 'object') return null;
  const version = parseVersion(json.tag_name) && String(json.tag_name).replace(/^[vV]/, '');
  if (!version || json.draft || json.prerelease) return null;
  return {
    version,
    tag: json.tag_name,
    pageUrl: json.html_url || '',
    zipUrl: json.zipball_url || '',
    notes: String(json.body || ''),
  };
}

function buildResult(base, cache, currentVersion, status) {
  const latest = cache.release || undefined;
  const available = latest && isNewerVersion(latest.tag, currentVersion);
  return {
    currentVersion,
    latest,
    checkedAt: cache.checkedAt || base.now,
    fromCache: base.fromCache,
    status: status || (available ? 'available' : 'up-to-date'),
  };
}

function rateLimitedUntil(headers, now) {
  const reset = Number(headers.get ? headers.get('x-ratelimit-reset') : headers['x-ratelimit-reset']);
  const retryAfter = Number(headers.get ? headers.get('retry-after') : headers['retry-after']);
  if (retryAfter > 0) return now + retryAfter * 1000;
  return reset > 0 ? reset * 1000 : now + 60 * 60 * 1000;
}

async function requestLatest({ config, cache, fetchFn }) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': config.userAgent,
    'X-GitHub-Api-Version': config.apiVersion,
  };
  if (cache.etag) {
    headers['If-None-Match'] = cache.etag;
  }
  return fetchFn(`${config.apiBase}/repos/${config.repo}/releases/latest`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(config.timeoutMs),
  });
}

function interpretResponse({ response, root, config, cache, currentVersion, now }) {
  if (response.status === 304) {
    const updated = { ...cache, checkedAt: now };
    writeCache(root, config, updated);
    return buildResult({ now, fromCache: true }, updated, currentVersion);
  }

  if (response.status === 200) {
    return response
      .json()
      .then((data) => {
        const latest = toLatest(data);
        if (!latest) {
          return buildResult({ now, fromCache: false }, cache, currentVersion, 'error');
        }
        const etag = response.headers.get ? response.headers.get('etag') : response.headers['etag'];
        const updated = {
          etag: etag || undefined,
          checkedAt: now,
          release: latest,
          rateLimitedUntil: undefined,
        };
        writeCache(root, config, updated);
        return buildResult({ now, fromCache: false }, updated, currentVersion);
      })
      .catch(() => buildResult({ now, fromCache: false }, cache, currentVersion, 'error'));
  }

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get ? response.headers.get('x-ratelimit-remaining') : response.headers['x-ratelimit-remaining'];
    const retryAfter = response.headers.get ? response.headers.get('retry-after') : response.headers['retry-after'];
    if (remaining === '0' || retryAfter) {
      const until = rateLimitedUntil(response.headers, now);
      const updated = { ...cache, rateLimitedUntil: until };
      writeCache(root, config, updated);
      return buildResult({ now, fromCache: false }, updated, currentVersion, 'rate-limited');
    }
    return buildResult({ now, fromCache: false }, cache, currentVersion, 'error');
  }

  if (response.status === 404) {
    return buildResult({ now, fromCache: false }, cache, currentVersion, 'no-releases');
  }

  return buildResult({ now, fromCache: false }, cache, currentVersion, 'error');
}

async function checkForUpdate({
  root,
  currentVersion = readCurrentVersion(root),
  config,
  fetchFn = fetch,
  now = Date.now(),
  force = false,
}) {
  const cache = readCache(root, config);
  const base = { now, fromCache: true };

  if (cache.rateLimitedUntil && now < cache.rateLimitedUntil) {
    return buildResult(base, cache, currentVersion, 'rate-limited');
  }

  if (!force && cache.checkedAt && now - cache.checkedAt < config.cacheTtlMs) {
    return buildResult(base, cache, currentVersion);
  }

  let response;
  try {
    response = await requestLatest({ config, cache, fetchFn });
  } catch {
    return buildResult(base, cache, currentVersion, 'offline');
  }

  return interpretResponse({ response, root, config, cache, currentVersion, now });
}

module.exports = {
  checkForUpdate,
  readCurrentVersion,
};
