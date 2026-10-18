/**
 * Shared normalization primitives for content editor tool parameters:
 * localized-object fallback, slug sanitization, hex/rgba color coercion,
 * and Lucide icon-name normalization against an allowlist.
 */

import { FALLBACK_LANGUAGE } from '@core/shared/languageDefaults';

const HEX_COLOR_REGEX = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))$/;

export type LocalizedObject = { en: string } & Record<string, string | undefined>;

const ACTIONS = ['create', 'update', 'delete', 'move'];

/** The tool arguments as an object (anything else counts as no arguments). */
export const asArgs = (args: unknown): Record<string, unknown> =>
  (args && typeof args === 'object' ? (args as Record<string, unknown>) : {});

/** The requested action, defaulting to create when missing or unknown. */
export function readAction(args: Record<string, unknown>): string {
  return typeof args.action === 'string' && ACTIONS.includes(args.action) ? args.action : 'create';
}

export interface ToolParamValidationResult {
  valid: boolean;
  sanitized: Record<string, unknown>;
  errors?: string[];
}

/**
 * Normalizes any string, number, or object into a localized object that always carries `en`.
 */
const nonEmptyText = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

// App-authored defaults are stored as a key so every language can render them later.
export type LocalizedKeyRef = { key: string; params?: Record<string, string> };

// A blank input gets only the default's own shape, never the other languages it carried.
const defaultFor = (fallback: LocalizedObject | LocalizedKeyRef): LocalizedObject | LocalizedKeyRef =>
  'key' in fallback ? fallback : { en: fallback.en };

export function normalizeLocalized(value: unknown, fallback: LocalizedObject | LocalizedKeyRef): LocalizedObject | LocalizedKeyRef {
  if (!value) return fallback;
  if (typeof value === 'string') return nonEmptyText(value) ? { en: value.trim() } : defaultFor(fallback);
  if (typeof value !== 'object' || Array.isArray(value)) return fallback;
  const texts: Record<string, string> = {};
  for (const [language, text] of Object.entries(value)) {
    const clean = nonEmptyText(text);
    if (clean !== undefined) texts[language] = clean;
  }
  // `en` falls back to whichever language was given before using the default.
  const en = texts[FALLBACK_LANGUAGE] ?? Object.values(texts)[0];
  return en === undefined ? defaultFor(fallback) : { ...texts, en };
}

/**
 * Normalizes a slug to lowercase letters, digits, and hyphens matching ^[a-z0-9][a-z0-9_-]*$
 */
export function normalizeSlug(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }
  let slug = value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) return fallback;
  if (!/^[a-z0-9]/.test(slug)) {
    slug = `item-${slug}`.replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
  }
  return slug || fallback;
}

/**
 * Resolves a courseId against an optional live registry case-insensitively,
 * returning the actual registered ID if matched, or the normalized slug.
 */
export function resolveCourseId(courseId: unknown, registry?: Record<string, unknown>): string {
  if (typeof courseId !== 'string' || !courseId.trim()) return 'complexity';
  const trimmed = courseId.trim();
  const lower = trimmed.toLowerCase();

  if (registry && typeof registry === 'object') {
    for (const regKey of Object.keys(registry)) {
      if (regKey.toLowerCase() === lower) {
        return regKey;
      }
    }

    const cleanLower = lower.replace(/[-_]/g, '');
    for (const regKey of Object.keys(registry)) {
      if (regKey.toLowerCase().replace(/[-_]/g, '') === cleanLower) {
        return regKey;
      }
    }
  }

  return normalizeSlug(trimmed, 'course-1');
}

/**
 * Resolves a weekKey against a course's available weeks from an optional live registry.
 * If user says "week 1" or "week1", and course has "week01" or "week-1", maps to the existing week.
 */
export function resolveWeekKey(
  courseId: string,
  weekKey: unknown,
  registry?: Record<string, { catalog?: Record<string, unknown> }>
): string {
  const normalizedSlug = normalizeSlug(weekKey, 'week1');
  const course = registry?.[courseId];
  if (!course || !course.catalog) return normalizedSlug;

  const availableWeeks = Object.keys(course.catalog);
  if (availableWeeks.length === 0) return normalizedSlug;

  // Exact match
  if (availableWeeks.includes(normalizedSlug)) return normalizedSlug;

  // Case-insensitive match
  const matchCase = availableWeeks.find((w) => w.toLowerCase() === normalizedSlug.toLowerCase());
  if (matchCase) return matchCase;

  // Number extraction match (e.g. week 1 -> week01, week-1)
  const numMatch = normalizedSlug.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    const candidate = availableWeeks.find((w) => {
      const wNum = w.match(/\d+/);
      return wNum && parseInt(wNum[0], 10) === num;
    });
    if (candidate) return candidate;
  }

  return normalizedSlug;
}

/**
 * Normalizes color to valid hex or rgba format with safe fallback.
 */
export function normalizeColor(value: unknown, fallback: string = '#06b6d4'): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const trimmed = value.trim();
  if (HEX_COLOR_REGEX.test(trimmed)) return trimmed;
  // If user provided 6-digit hex without #
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) return `#${trimmed}`;
  return fallback;
}

const ALLOWED_ICONS = new Set([
  'Cpu',
  'GitPullRequest',
  'Layers',
  'Binary',
  'Code2',
  'Database',
  'Network',
  'BrainCircuit',
  'Terminal',
  'Sigma',
  'Braces',
  'Sparkles',
  'Flame',
  'BookOpen',
  'GraduationCap',
]);

/**
 * Normalizes Lucide icon name to PascalCase and ensures it is in the supported icons list.
 */
export function normalizeIcon(value: unknown, fallback: string = 'Cpu'): string {
  const safeFallback = ALLOWED_ICONS.has(fallback) ? fallback : 'Cpu';
  if (typeof value !== 'string' || !value.trim()) return safeFallback;
  const trimmed = value.trim();
  let candidate = trimmed;
  // Convert kebab-case or lowercase to PascalCase if needed
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(trimmed)) {
    candidate = trimmed
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
  if (ALLOWED_ICONS.has(candidate)) {
    return candidate;
  }
  return safeFallback;
}
