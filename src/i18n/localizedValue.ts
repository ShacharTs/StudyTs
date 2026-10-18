import { DEFAULT_LANGUAGE, FALLBACK_LANGUAGE } from '../core/shared/languageDefaults';

export type Language = string;

export { DEFAULT_LANGUAGE, FALLBACK_LANGUAGE };

export interface LocalizedText {
  he?: string;
  en?: string;
  [key: string]: string | undefined;
}

export type TextValue = string;
export type LocalizedValue = string | Record<string, string | undefined> | LocalizedText;

export function isLocalizedValue(v: unknown): v is LocalizedValue {
  if (typeof v === 'string') return true;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const record = v as Record<string, unknown>;
  return typeof record[FALLBACK_LANGUAGE] === 'string' && Object.values(record).every((value) => typeof value === 'string');
}

export interface LanguageMetadata {
  id: Language;
  code: string;
  label: string;
  nativeName: string;
  flag: string;
  direction: 'rtl' | 'ltr';
}

const DEFAULT_LANGUAGES: LanguageMetadata[] = [
  { id: 'he', code: 'he', label: 'עברית (HE)', nativeName: 'עברית', flag: '🇮🇱', direction: 'rtl' },
  { id: 'en', code: 'en', label: 'English (EN)', nativeName: 'English', flag: '🇺🇸', direction: 'ltr' },
];

let languageCatalog: LanguageMetadata[] = [...DEFAULT_LANGUAGES];

export function getRegisteredLanguages(): LanguageMetadata[] {
  return [...languageCatalog];
}

export function registerLanguage(meta: LanguageMetadata): void {
  const existingIdx = languageCatalog.findIndex((l) => l.id === meta.id);
  if (existingIdx >= 0) {
    languageCatalog[existingIdx] = meta;
  } else {
    languageCatalog.push(meta);
  }
}

// Test seam: restores the built-in language list (the catalog is private to this module).
export function resetLanguageRegistry(): void {
  languageCatalog = [...DEFAULT_LANGUAGES];
}

export function getLanguageMetadata(lang: Language): LanguageMetadata {
  return (
    languageCatalog.find((l) => l.id === lang) ?? {
      id: lang,
      code: lang,
      label: lang.toUpperCase(),
      nativeName: lang.toUpperCase(),
      flag: '🌐',
      direction: isRtl(lang) ? 'rtl' : 'ltr',
    }
  );
}

export function isRegisteredLanguage(lang: string): boolean {
  return languageCatalog.some((l) => l.id === lang);
}

let valCache = new WeakMap<object, Map<string, string>>();

export function clearValCache(): void {
  valCache = new WeakMap();
}

const firstString = (obj: Record<string, unknown>): string | undefined =>
  Object.values(obj).find((v): v is string => typeof v === 'string' && v.trim() !== '');

// The target language's text, else English, else whatever non-empty string the object has.
function pickText(obj: Record<string, unknown>, targetLang: Language): string {
  const direct = obj[targetLang];
  if (typeof direct === 'string' && direct.trim() !== '') return direct;
  const fallback = obj[FALLBACK_LANGUAGE];
  if (typeof fallback === 'string' && fallback.trim() !== '') return fallback;
  return firstString(obj) ?? '';
}

type KeyResolver = (key: string, lang: Language) => string | undefined;

let keyResolver: KeyResolver = () => undefined;

// Set by the module that owns the dictionary. Without it (server side) a key shows as itself.
export function setKeyResolver(resolver: KeyResolver): void {
  keyResolver = resolver;
}

// Placeholders stay visible when a value is missing, so a broken string never reads as blank.
function fillParams(text: string, params: unknown): string {
  if (!params || typeof params !== 'object') return text;
  const values = params as Record<string, unknown>;
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = values[name];
    return typeof value === 'string' ? value : placeholder;
  });
}

export function val(input?: unknown, targetLang: Language = DEFAULT_LANGUAGE): string {
  if (!input) return '';
  if (typeof input === 'string') return input;
  if (typeof input !== 'object' || Array.isArray(input)) return '';

  const obj = input as Record<string, unknown>;
  try {
    if (typeof obj.key === 'string') return fillParams(keyResolver(obj.key, targetLang) ?? obj.key, obj.params);
    const cachedMap = valCache.get(obj);
    const cachedVal = cachedMap?.get(targetLang);
    if (cachedVal !== undefined) return cachedVal;

    const resolved = pickText(obj, targetLang);
    if (cachedMap) cachedMap.set(targetLang, resolved);
    else valCache.set(obj, new Map([[targetLang, resolved]]));
    return resolved;
  } catch {
    return '';
  }
}

export const resolveLocalized = val;
export const resolveLocalizedText = val;

export function normalizeUserText(input: unknown, preferredLang: string = DEFAULT_LANGUAGE): string {
  if (typeof input === 'string') return input;
  if (!input || typeof input !== 'object') return '';
  const rec = input as Record<string, unknown>;
  const preferred = rec[preferredLang];
  if (typeof preferred === 'string') return preferred;
  const fallback = rec[FALLBACK_LANGUAGE];
  if (typeof fallback === 'string') return fallback;
  return Object.values(rec).find((v): v is string => typeof v === 'string') ?? '';
}

export function getOppositeLanguage(lang: Language): Language {
  const list = languageCatalog.map((l) => l.id);
  const currentIdx = list.indexOf(lang);
  if (currentIdx === -1 || list.length <= 1) return list[0] ?? lang;
  const nextIdx = (currentIdx + 1) % list.length;
  return list[nextIdx];
}

export const switchLanguage = getOppositeLanguage;

// Fallback for codes not in the catalog yet (e.g. a locale pack still loading).
const RTL_LANGUAGE_CODES = new Set(['he', 'ar', 'fa', 'ur', 'yi', 'ps', 'arc', 'dv']);

export function isRtl(lang: Language): boolean {
  const meta = languageCatalog.find((l) => l.id === lang);
  if (meta) return meta.direction === 'rtl';
  return RTL_LANGUAGE_CODES.has(lang);
}

export function getLanguageDirection(lang: Language): 'rtl' | 'ltr' {
  return isRtl(lang) ? 'rtl' : 'ltr';
}

const RTL_CHAR_RE = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const LATIN_CHAR_RE = /[A-Za-z]/g;

/**
 * Detects text direction from typed content based on majority script characters.
 * Resistant to strings opening with Latin acronyms or math formulas (e.g. "O(n log n) אלגוריתם...").
 */
export function detectDirectionFromText(text: string): 'rtl' | 'ltr' {
  if (!text) return 'ltr';
  const rtlCount = text.match(RTL_CHAR_RE)?.length ?? 0;
  const latinCount = text.match(LATIN_CHAR_RE)?.length ?? 0;
  if (rtlCount === 0 && latinCount === 0) return 'ltr';
  return rtlCount >= latinCount ? 'rtl' : 'ltr';
}

export function getLanguageLabel(lang: Language): string {
  const meta = languageCatalog.find((l) => l.id === lang);
  return meta ? meta.label : lang.toUpperCase();
}

export function getLanguageFlag(lang: Language): string {
  const meta = languageCatalog.find((l) => l.id === lang);
  return meta?.flag ?? '🌐';
}
