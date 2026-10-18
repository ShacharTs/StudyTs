// Schema validation and placeholder parsing for drop-in locale packs.

import {
  DEFAULT_RTL_CODES,
  LOCALE_CODE_PATTERN,
  LOCALE_PACK_LIMITS,
  RESERVED_LOCALE_CODES,
} from './localePackLimits.js';

export interface LocalePackMeta {
  code: string;
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
  flag: string;
}

export interface LocalePack {
  meta: LocalePackMeta;
  strings: Record<string, string>;
}

export type PackIssueLevel = 'error' | 'warning';

export interface PackIssue {
  level: PackIssueLevel;
  key?: string;
  message: string;
}

export interface PackCoverage {
  code: string;
  translated: number;
  total: number;
  missing: string[];
}

export interface ValidationResult {
  pack: LocalePack | null;
  issues: PackIssue[];
}

export function placeholdersOf(text: string): string[] {
  const matches = text.match(/\{([a-zA-Z0-9_-]+)\}/g);
  if (!matches) return [];
  const unique = new Set(matches.map((m) => m.slice(1, -1)));
  return Array.from(unique).sort();
}

function validateCode(code: unknown): { code: string; issues: PackIssue[] } {
  if (typeof code !== 'string' || !LOCALE_CODE_PATTERN.test(code)) {
    return { code: '', issues: [{ level: 'error', message: `Invalid locale code: "${String(code)}"` }] };
  }
  if (RESERVED_LOCALE_CODES.includes(code.toLowerCase())) {
    return { code: '', issues: [{ level: 'error', message: `Reserved locale code: "${code}"` }] };
  }
  return { code, issues: [] };
}

function resolveDirection(code: string, dir: unknown): { dir: 'ltr' | 'rtl'; valid: boolean } {
  if (dir === undefined || dir === null || dir === '') {
    const isDefaultRtl = DEFAULT_RTL_CODES.includes(code.split('-')[0].toLowerCase());
    return { dir: isDefaultRtl ? 'rtl' : 'ltr', valid: true };
  }
  if (dir === 'ltr' || dir === 'rtl') {
    return { dir, valid: true };
  }
  return { dir: 'ltr', valid: false };
}

function validateMeta(raw: Record<string, unknown>): { meta: LocalePackMeta | null; issues: PackIssue[] } {
  const issues: PackIssue[] = [];
  const codeRes = validateCode(raw.code);
  issues.push(...codeRes.issues);

  const nativeName = typeof raw.nativeName === 'string' ? raw.nativeName.trim() : '';
  const englishName = typeof raw.englishName === 'string' ? raw.englishName.trim() : '';
  if (!nativeName || !englishName) {
    issues.push({ level: 'error', message: 'meta.nativeName and meta.englishName are required non-empty strings' });
  }

  const dirRes = resolveDirection(codeRes.code, raw.dir);
  if (!dirRes.valid) {
    issues.push({ level: 'error', message: `Invalid dir: "${String(raw.dir)}". Must be "ltr" or "rtl"` });
  }

  const flag = typeof raw.flag === 'string' ? raw.flag.trim() : '';

  if (issues.some((i) => i.level === 'error')) {
    return { meta: null, issues };
  }

  return {
    meta: {
      code: codeRes.code,
      nativeName,
      englishName,
      dir: dirRes.dir,
      flag,
    },
    issues,
  };
}

function validateStrings(
  rawStrings: Record<string, unknown>,
  knownKeys: ReadonlySet<string>
): { strings: Record<string, string>; issues: PackIssue[] } {
  const issues: PackIssue[] = [];
  const strings: Record<string, string> = Object.create(null);
  const entries = Object.entries(rawStrings);

  if (entries.length > LOCALE_PACK_LIMITS.maxKeys) {
    issues.push({ level: 'error', message: `Key count exceeds limit of ${LOCALE_PACK_LIMITS.maxKeys}` });
    return { strings: {}, issues };
  }

  for (const [key, value] of entries) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;

    if (!knownKeys.has(key)) {
      issues.push({ level: 'warning', key, message: `Unknown translation key: "${key}"` });
      continue;
    }

    if (typeof value !== 'string' || value.trim() === '') {
      issues.push({ level: 'warning', key, message: `Non-string or empty translation for key "${key}"` });
      continue;
    }

    if (value.length > LOCALE_PACK_LIMITS.maxStringLength) {
      issues.push({ level: 'warning', key, message: `Translation string exceeds max length for key "${key}"` });
      continue;
    }

    strings[key] = value;
  }

  return { strings, issues };
}

function checkRootStructure(raw: unknown): { obj: Record<string, unknown> | null; issue?: PackIssue } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { obj: null, issue: { level: 'error', message: 'Locale pack must be an object' } };
  }
  const obj = raw as Record<string, unknown>;
  if (!obj.meta || typeof obj.meta !== 'object' || Array.isArray(obj.meta)) {
    return { obj: null, issue: { level: 'error', message: 'Locale pack missing meta object' } };
  }
  if (!obj.strings || typeof obj.strings !== 'object' || Array.isArray(obj.strings)) {
    return { obj: null, issue: { level: 'error', message: 'Locale pack missing strings object' } };
  }
  return { obj };
}

export function validateLocalePack(raw: unknown, knownKeys: ReadonlySet<string>): ValidationResult {
  const root = checkRootStructure(raw);
  if (!root.obj) {
    return { pack: null, issues: [root.issue!] };
  }

  const metaRes = validateMeta(root.obj.meta as Record<string, unknown>);
  const stringsRes = validateStrings(root.obj.strings as Record<string, unknown>, knownKeys);
  const issues = [...metaRes.issues, ...stringsRes.issues];

  if (!metaRes.meta || issues.some((i) => i.level === 'error')) {
    return { pack: null, issues };
  }

  return { pack: { meta: metaRes.meta, strings: stringsRes.strings }, issues };
}
