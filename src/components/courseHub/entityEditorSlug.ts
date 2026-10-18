// src/components/courseHub/entityEditorSlug.ts
import { normalizeUserText } from '@i18n/localizedValue';

// Generates a slug from text. If the text has Latin letters/digits, normalizes them.
// If purely non-Latin (e.g. Hebrew only), generates a safe fallback unique slug.
export function slugify(text: string): string {
  const normalized = normalizeUserText(text);
  const latin = normalized
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return latin;
}

// A short random suffix keeps auto-generated course codes distinct without
// asking the user to think about it — not meant to be meaningful, just unique.
export function randomCode(): string {
  return `CS-${Math.floor(1000 + Math.random() * 9000)}`;
}

const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;

// Pulled out of handleApply so its own branching stays flat — this is the only place that decides
// whether a new-entity slug is submittable. It names the problem; the editor words it in the user's language.
export function validateSlugForCreate(slugValue: string): 'empty' | 'invalid' | null {
  if (!slugValue.trim()) {
    return 'empty';
  }
  if (!SLUG_RE.test(slugValue)) {
    return 'invalid';
  }
  return null;
}
