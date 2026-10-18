import crypto from 'crypto';
import type { FallbackModelInfo } from '../../../src/core/shared/aiModelFallbacks.js';

export const MODEL_CACHE_TTL_MS = 600_000; // 10 minutes
export const NEGATIVE_CACHE_TTL_MS = 60_000; // 60 seconds

export interface CachedModelCatalog {
  at: number;
  models: FallbackModelInfo[];
  isNegative?: boolean;
  warning?: string;
}

const cache = new Map<string, CachedModelCatalog>();

export function buildCacheKey(provider: string, baseUrl: string = '', apiKey: string = ''): string {
  const keyHash = apiKey ? crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 16) : 'none';
  return `${provider}|${baseUrl}|${keyHash}`;
}

export function getCached(key: string, now = Date.now()): CachedModelCatalog | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;

  const ttl = entry.isNegative ? NEGATIVE_CACHE_TTL_MS : MODEL_CACHE_TTL_MS;
  if (now - entry.at > ttl) {
    cache.delete(key);
    return undefined;
  }

  return entry;
}

export function setCached(key: string, models: FallbackModelInfo[], now = Date.now()): void {
  cache.set(key, {
    at: now,
    models,
    isNegative: false,
  });
}

export function setNegativeCached(key: string, warning: string, now = Date.now()): void {
  cache.set(key, {
    at: now,
    models: [],
    isNegative: true,
    warning,
  });
}

export function clearCache(): void {
  cache.clear();
}
