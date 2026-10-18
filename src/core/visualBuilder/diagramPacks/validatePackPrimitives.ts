import { FALLBACK_LANGUAGE, LANGUAGE_CODE_PATTERN } from '../../shared/languageDefaults';
import { PACK_ID_PATTERN, PACK_LIMITS, type StylePackIssue, type PackIssueCode } from './stylePackFormat';

export const packIssue = (path: string, code: PackIssueCode, message: string): StylePackIssue => ({ path, code, message });

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function checkUnknownFields(value: Record<string, unknown>, allowed: readonly string[], path: string): StylePackIssue[] {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => packIssue(`${path}.${key}`, 'unknown-field', `${key} is not a pack field`));
}

export function checkId(value: unknown, path: string): StylePackIssue[] {
  const { min, max } = PACK_LIMITS.idChars;
  const valid = typeof value === 'string' && value.length >= min && value.length <= max && PACK_ID_PATTERN.test(value);
  return valid ? [] : [packIssue(path, 'bad-id', `id must be kebab-case, ${min} to ${max} characters`)];
}

// Angle brackets and control characters never reach a label; Hebrew and mixed RTL text pass.
const hasControlCharacter = (text: string): boolean => [...text].some((char) => {
  const code = char.charCodeAt(0);
  return code < 0x20 || code === 0x7f;
});

export function checkLabelText(value: unknown, path: string, maxChars: number = PACK_LIMITS.labelChars): StylePackIssue[] {
  const valid = typeof value === 'string' && value.length >= 1 && value.length <= maxChars && !/[<>]/.test(value) && !hasControlCharacter(value);
  return valid ? [] : [packIssue(path, 'bad-label', `text must be 1 to ${maxChars} characters with no angle brackets or control characters`)];
}

export function checkLocalizedLabel(value: unknown, path: string): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-label', 'label must be an object with an en text')];
  const languages = Object.keys(value).filter((key) => LANGUAGE_CODE_PATTERN.test(key));
  const translationIssues = languages.filter((code) => code !== FALLBACK_LANGUAGE && value[code] !== undefined)
    .flatMap((code) => checkLabelText(value[code], `${path}.${code}`));
  return [
    ...checkUnknownFields(value, languages, path),
    ...checkLabelText(value[FALLBACK_LANGUAGE], `${path}.${FALLBACK_LANGUAGE}`),
    ...translationIssues,
  ];
}

export function checkNumberIn(value: unknown, range: readonly [number, number], path: string, code: PackIssueCode): StylePackIssue[] {
  const valid = typeof value === 'number' && Number.isFinite(value) && value >= range[0] && value <= range[1];
  return valid ? [] : [packIssue(path, code, `must be a number from ${range[0]} to ${range[1]}`)];
}

export function checkEnum(value: unknown, allowed: readonly string[], path: string, code: PackIssueCode): StylePackIssue[] {
  const valid = typeof value === 'string' && allowed.includes(value);
  return valid ? [] : [packIssue(path, code, `must be one of ${allowed.join(', ')}`)];
}

export function checkArray(
  value: unknown,
  bounds: readonly [number, number],
  path: string,
  code: PackIssueCode,
  checkItem: (item: unknown, itemPath: string) => StylePackIssue[],
): StylePackIssue[] {
  if (!Array.isArray(value) || value.length < bounds[0] || value.length > bounds[1]) {
    return [packIssue(path, code, `must be a list of ${bounds[0]} to ${bounds[1]} items`)];
  }
  return value.flatMap((item, index) => checkItem(item, `${path}[${index}]`));
}
