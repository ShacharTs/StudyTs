// src/components/courseHub/entityEditorLogic.ts
/** Pure decisions behind EntityEditor: how the entity's id is derived and what Apply saves. */
import { randomCode, slugify } from './entityEditorSlug';

export type EntityKind = 'course' | 'week' | 'topic';
export type FieldReader = (key: string, fallback: unknown) => unknown;

export interface SlugInfo {
  slugKey: string;
  isCreating: boolean;
}

export function slugInfo(kind: EntityKind, initial: Record<string, unknown>): SlugInfo {
  const slugKey = kind === 'week' ? 'weekKey' : 'id';
  return { slugKey, isCreating: !(slugKey in initial) };
}

/** Reads a field: the user's edit if there is one, else the initial value, else the fallback. */
export function fieldReader(fields: Record<string, unknown>, initial: Record<string, unknown>): FieldReader {
  return (key, fallback) => (key in fields ? fields[key] : initial[key] ?? fallback);
}

export function deriveSlug(info: SlugInfo, field: FieldReader, rawTitle: string): string {
  return (field(info.slugKey, '') as string) || slugify(rawTitle);
}

/** Extra fields a new entity gets so it is complete when created. */
function creationDefaults(kind: EntityKind, fields: Record<string, unknown>, field: FieldReader): Record<string, unknown> {
  if (kind === 'course') return { code: (fields.code as string) || randomCode(), badge: (fields.badge as string) || 'New Course' };
  if (kind === 'topic') return { contentType: field('contentType', 'canvas') as string };
  return {};
}

/** What Apply sends to onSave and which slug it validates. */
export function buildSave(
  kind: EntityKind,
  info: SlugInfo,
  fields: Record<string, unknown>,
  field: FieldReader,
  derivedSlug: string
): { effectiveFields: Record<string, unknown>; slugValue: string } {
  // An all-digit key would be listed first by JavaScript objects (they order numeric keys numerically), so a new
  // section or course would jump to the top of its list: prefix it with its kind.
  const readable = /^\d+$/.test(derivedSlug) ? `${kind}-${derivedSlug}` : derivedSlug;
  const fallbackSlug = readable || (info.isCreating ? `${kind}-${Date.now().toString(36)}` : '');
  return {
    effectiveFields: info.isCreating ? { ...fields, [info.slugKey]: fallbackSlug, ...creationDefaults(kind, fields, field) } : fields,
    slugValue: fallbackSlug,
  };
}
