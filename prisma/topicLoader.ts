/**
 * Safe, zero-eval topic loader for JSON scenes, models, and content files.
 * Provides resilient JSON loading with path traversal guards.
 */

import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import type { LocalizedPair } from './catalogScanner';

export const TOPIC_FILE_NAMES = {
  SCENE_JSON: 'scene.json',
  MODEL_JSON: 'model.json',
  CONTENT_JSON: 'content.json',
  CATALOG_JSON: 'catalog.json',
} as const;

export interface LoadedTopicData {
  scene?: unknown;
  model?: unknown;
  content?: unknown;
}

export function formatTopicTitle(topicId: string): { en: string } {
  const formatted = topicId
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
  return { en: formatted };
}

export function formatTopicDescription(topicId: string): { en: string } {
  const title = formatTopicTitle(topicId);
  return { en: `Interactive visualization module for ${title.en}` };
}

export function safeReadJson(filePath: string, label: string, allowedBaseDir?: string): unknown | null {
  try {
    const resolvedPath = resolve(filePath);
    if (allowedBaseDir && !resolvedPath.startsWith(resolve(allowedBaseDir))) {
      console.warn(`  WARN: Path traversal attempt rejected for ${label}: ${filePath}`);
      return null;
    }
    if (!existsSync(resolvedPath)) return null;

    const raw = readFileSync(resolvedPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  WARN: Could not parse JSON for ${label}: ${message}`);
    return null;
  }
}

export async function loadScene(topicDir: string, courseId: string, topicId: string, baseDataDir?: string): Promise<unknown> {
  return safeReadJson(join(topicDir, TOPIC_FILE_NAMES.SCENE_JSON), `scene for ${courseId}/${topicId}`, baseDataDir);
}

export async function loadModel(topicDir: string, courseId: string, topicId: string, baseDataDir?: string): Promise<unknown> {
  return safeReadJson(join(topicDir, TOPIC_FILE_NAMES.MODEL_JSON), `model for ${courseId}/${topicId}`, baseDataDir);
}

export async function loadContent(topicDir: string, courseId: string, topicId: string, baseDataDir?: string): Promise<unknown> {
  return safeReadJson(join(topicDir, TOPIC_FILE_NAMES.CONTENT_JSON), `content for ${courseId}/${topicId}`, baseDataDir);
}

export function loadCatalogTopicMetadata(
  courseId: string,
  weekKey: string,
  section: string,
  topicId: string,
  baseDataDir: string
): { title?: LocalizedPair; description?: LocalizedPair } | null {
  const catalogPath = join(baseDataDir, courseId, TOPIC_FILE_NAMES.CATALOG_JSON);
  const catalog = safeReadJson(catalogPath, `catalog for ${courseId}`, baseDataDir) as Record<string, unknown> | null;
  if (!catalog || typeof catalog !== 'object') return null;

  const week = catalog[weekKey] as Record<string, unknown> | null | undefined;
  if (!week || typeof week !== 'object') return null;

  const items = week[section];
  if (!Array.isArray(items)) return null;

  const found = items.find((item: { id?: string; title?: LocalizedPair; description?: LocalizedPair } | null) => item && item.id === topicId);
  if (!found) return null;

  return {
    title: found.title,
    description: found.description,
  };
}

export async function loadTopicData(
  courseId: string,
  weekKey: string,
  section: string,
  topicId: string,
  baseDataDir: string
): Promise<LoadedTopicData> {
  const topicDir = join(baseDataDir, courseId, weekKey, section, topicId);
  const [scene, model, content] = await Promise.all([
    loadScene(topicDir, courseId, topicId, baseDataDir),
    loadModel(topicDir, courseId, topicId, baseDataDir),
    loadContent(topicDir, courseId, topicId, baseDataDir),
  ]);

  return {
    scene: scene ?? undefined,
    model: model ?? undefined,
    content: content ?? undefined,
  };
}
