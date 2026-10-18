import { ALGORITHM_TEXT } from '../../../i18n/dictionary';
import { val } from '../../../i18n/localizedValue';
import { PACK_TEMPLATE_COLORS, type StylePackIssue } from '../diagramPacks/stylePackFormat';
import { checkEnum, checkUnknownFields, isRecord, packIssue } from '../diagramPacks/validatePackPrimitives';

export type TextKey = keyof typeof ALGORITHM_TEXT;
export type ColorName = (typeof PACK_TEMPLATE_COLORS)[number];

export const isTextKey = (value: unknown): value is TextKey => typeof value === 'string' && Object.prototype.hasOwnProperty.call(ALGORITHM_TEXT, value);

// A data file names its text by key; the words live in src/i18n/modes/{en,he}.json under algorithmText.
export function checkTextKey(value: unknown, path: string): StylePackIssue[] {
  return isTextKey(value) ? [] : [packIssue(path, 'bad-value', 'must be a key of the algorithm text table')];
}

// An object whose fields are exactly `keys` and whose values are text keys.
export function checkKeyGroup(value: unknown, keys: readonly string[], path: string): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-value', `${path} must be an object`)];
  return [...checkUnknownFields(value, keys, path), ...keys.flatMap((key) => checkTextKey(value[key], `${path}.${key}`))];
}

// An object whose fields are exactly `keys` and whose values are colour names.
export function checkColorGroup(value: unknown, keys: readonly string[], path: string): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-value', `${path} must be an object`)];
  return [...checkUnknownFields(value, keys, path), ...keys.flatMap((key) => checkEnum(value[key], PACK_TEMPLATE_COLORS, `${path}.${key}`, 'bad-enum'))];
}

export const labelOfKey = (key: TextKey) => ALGORITHM_TEXT[key];

// The text of a key in a language, with {name} placeholders filled; an unknown name becomes an empty string.
export function algorithmText(key: TextKey, lang: string, values: Record<string, string> = {}): string {
  return val(ALGORITHM_TEXT[key], lang).replace(/\{(\w+)\}/g, (_match, name: string) => values[name] ?? '');
}

// Every language's wording of a key: an element or text written in one language is still recognised after the language changes.
export function textVariants(key: TextKey): string[] {
  const entry = ALGORITHM_TEXT[key] as Record<string, unknown>;
  return Object.values(entry).filter((value): value is string => typeof value === 'string' && value.length > 0);
}

export const isNamedAs = (name: string | undefined, key: TextKey): boolean => name !== undefined && textVariants(key).includes(name);

export function failOnIssues(what: string, issues: StylePackIssue[]): void {
  if (issues.length > 0) throw new Error(`${what} rejected: ${issues.map((issue) => `${issue.path} ${issue.message}`).join('; ')}`);
}
