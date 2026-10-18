// src/core/validation/topicJsonSchema.ts
import { type LocalizedValue, isLocalizedValue } from '../../i18n/localizedValue';
import { CanvasScene } from '../types/canvasScene';

interface CatalogWeekTopicJson {
  id: string;
  title: LocalizedValue;
  description: LocalizedValue;
}

interface CatalogWeekJson {
  title: LocalizedValue;
  lectures: CatalogWeekTopicJson[];
  practice: CatalogWeekTopicJson[];
}

type CourseCatalogJson = Record<string, CatalogWeekJson>;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateCatalogJson(raw: unknown): { valid: boolean; error?: string; catalog?: CourseCatalogJson } {
  if (!isObject(raw)) return { valid: false, error: 'Catalog must be an object keyed by weekKey' };

  for (const [weekKey, week] of Object.entries(raw)) {
    if (!isObject(week)) return { valid: false, error: `Week "${weekKey}" is not an object` };
    if (!isLocalizedValue(week.title)) return { valid: false, error: `Week "${weekKey}" has invalid title` };
    if (!Array.isArray(week.lectures) || !Array.isArray(week.practice)) {
      return { valid: false, error: `Week "${weekKey}" missing lectures or practice array` };
    }
  }

  return { valid: true, catalog: raw as CourseCatalogJson };
}

export function validateSceneJson(raw: unknown): { valid: boolean; error?: string; scene?: CanvasScene } {
  if (!isObject(raw)) return { valid: false, error: 'Scene must be an object' };
  if (typeof raw.id !== 'string') return { valid: false, error: 'Scene missing string id' };
  if (!Array.isArray(raw.blocks)) return { valid: false, error: 'Scene missing blocks array' };

  if ('backgroundPattern' in raw && raw.backgroundPattern !== undefined) {
    const validPatterns = ['dots', 'grid', 'isometric', 'blueprint', 'mesh', 'blank'];
    if (typeof raw.backgroundPattern !== 'string' || !validPatterns.includes(raw.backgroundPattern)) {
      return { valid: false, error: `Invalid background pattern: ${raw.backgroundPattern}` };
    }
  }

  return { valid: true, scene: raw as unknown as CanvasScene };
}

export function validateModelJson(raw: unknown): { valid: boolean; error?: string; model?: unknown } {
  if (Array.isArray(raw)) return { valid: true, model: raw };
  if (isObject(raw)) {
    if ('steps' in raw && Array.isArray(raw.steps)) return { valid: true, model: raw };
    return { valid: true, model: raw };
  }
  return { valid: false, error: 'Model must be an array of steps or an object' };
}
