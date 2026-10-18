/**
 * In-memory and distributed caching bridge for course catalog and registry queries.
 */

import { cacheService } from '../cache/cacheService.js';

let localMemoryCache: Record<string, unknown> | null = null;
let cacheTimestamp = 0;
let generation = 0;
const CACHE_TTL_MS = 60_000;

/** Snapshot before a slow DB read; pass it to setCachedRegistry so a write that raced an invalidation is dropped. */
export function registryGeneration(): number {
  return generation;
}

export function getCachedRegistry(): Record<string, unknown> | null {
  if (localMemoryCache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return localMemoryCache;
  }
  return null;
}

export function setCachedRegistry(data: Record<string, unknown>, readGeneration?: number): void {
  if (readGeneration !== undefined && readGeneration !== generation) return;
  localMemoryCache = data;
  cacheTimestamp = Date.now();
  cacheService.set('course_registry_raw', data, 120).catch(() => {});
}

export function invalidateRegistryCache(): Promise<void> {
  generation++;
  localMemoryCache = null;
  cacheTimestamp = 0;
  return cacheService.clear().catch(() => {});
}
