import type { Request } from 'express';
import {
  BUILT_IN_LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  LANGUAGE_CODE_PATTERN,
} from '../../src/core/shared/languageDefaults.js';

type ServerLanguage = string;

// Legacy ISO code Hebrew browsers still send.
const LANGUAGE_ALIASES: Record<string, string> = { iw: 'he' };

// Languages a request has resolved to, so per-language caches can be dropped without a registry on the server.
const requestedLanguages = new Set<string>(BUILT_IN_LANGUAGE_CODES);

export function knownContentLanguages(): string[] {
  return [...requestedLanguages];
}

function languageFromAcceptHeader(header: string): ServerLanguage | undefined {
  const codes = header.split(',').map((part) => part.split(';')[0].trim().split('-')[0].toLowerCase());
  const resolved = codes.map((code) => LANGUAGE_ALIASES[code] ?? code);
  return resolved.find((code) => LANGUAGE_CODE_PATTERN.test(code));
}

function remember(lang: ServerLanguage): ServerLanguage {
  requestedLanguages.add(lang);
  return lang;
}

export function resolveLangFromRequest(req: Request): ServerLanguage {
  const queryLang = req.query.lang;
  if (typeof queryLang === 'string' && LANGUAGE_CODE_PATTERN.test(queryLang)) return remember(queryLang);

  const acceptLang = req.headers['accept-language'];
  const fromHeader = typeof acceptLang === 'string' ? languageFromAcceptHeader(acceptLang) : undefined;
  return remember(fromHeader ?? DEFAULT_LANGUAGE);
}

export function isBilingualObject(val: unknown): val is Record<string, string> {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const obj = val as Record<string, unknown>;
  const values = Object.values(obj);
  return typeof obj[FALLBACK_LANGUAGE] === 'string' && values.length > 1 && values.every((v) => typeof v === 'string');
}

export function resolveServerText(val: unknown, lang: ServerLanguage = DEFAULT_LANGUAGE): string {
  if (typeof val === 'string') return val;
  if (!val || typeof val !== 'object' || Array.isArray(val)) return '';
  const obj = val as Record<string, unknown>;
  const keys = [lang, FALLBACK_LANGUAGE, ...Object.keys(obj)];
  const found = keys.find((key) => typeof obj[key] === 'string' && obj[key] !== '');
  return found ? (obj[found] as string) : '';
}

/**
 * Deep-transforms a payload (catalog, topic, scene metadata) resolving all localized
 * objects (`{ en, ...other languages }`) into single localized strings for server-side localization.
 */
export function localizePayload<T>(payload: T, lang: ServerLanguage): T {
  if (payload === null || payload === undefined) return payload;

  if (isBilingualObject(payload)) {
    return resolveServerText(payload, lang) as unknown as T;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => localizePayload(item, lang)) as unknown as T;
  }

  if (typeof payload === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      result[key] = localizePayload(value, lang);
    }
    return result as T;
  }

  return payload;
}
