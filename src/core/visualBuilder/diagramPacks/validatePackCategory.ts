import {
  PACK_CATEGORY_FIELDS,
  PACK_CATEGORY_FORMAT_VERSION,
  PACK_CATEGORY_ID_MAX_CHARS,
  PACK_CATEGORY_ORDER_MAX,
  type PackCategoryFile,
} from './packCategoryFormat';
import { PACK_ID_PATTERN, PACK_LIMITS, type StylePackIssue } from './stylePackFormat';
import { checkLocalizedLabel, checkUnknownFields, isRecord, packIssue } from './validatePackPrimitives';
import { validatePackSvg } from './validatePackSvg';

export type PackCategoryValidation = { ok: true; category: PackCategoryFile } | { ok: false; errors: StylePackIssue[] };

// Pure and total, like validateStylePack: a hostile category file becomes an issue, never a throw.
export function validatePackCategory(raw: unknown): PackCategoryValidation {
  try {
    const issues = collectIssues(raw);
    if (issues.length === 0) return { ok: true, category: raw as PackCategoryFile };
    return { ok: false, errors: issues };
  } catch {
    return { ok: false, errors: [packIssue('category', 'bad-value', 'category could not be read')] };
  }
}

function collectIssues(raw: unknown): StylePackIssue[] {
  if (!isRecord(raw)) return [packIssue('category', 'bad-value', 'category must be an object')];
  return [
    ...checkUnknownFields(raw, PACK_CATEGORY_FIELDS, 'category'),
    ...formatIssues(raw.format),
    ...idIssues(raw.id),
    ...checkLocalizedLabel(raw.label, 'category.label'),
    ...orderIssues(raw.order),
    ...iconIssues(raw.icon),
    ...descriptionIssues(raw.description),
  ];
}

function formatIssues(format: unknown): StylePackIssue[] {
  return format === PACK_CATEGORY_FORMAT_VERSION
    ? []
    : [packIssue('category.format', 'bad-value', `format must be ${PACK_CATEGORY_FORMAT_VERSION}`)];
}

function idIssues(id: unknown): StylePackIssue[] {
  const { min } = PACK_LIMITS.idChars;
  const valid = typeof id === 'string' && id.length >= min && id.length <= PACK_CATEGORY_ID_MAX_CHARS && PACK_ID_PATTERN.test(id);
  return valid ? [] : [packIssue('category.id', 'bad-id', `id must be kebab-case, ${min} to ${PACK_CATEGORY_ID_MAX_CHARS} characters`)];
}

function orderIssues(order: unknown): StylePackIssue[] {
  const valid = typeof order === 'number' && Number.isInteger(order) && order >= 0 && order <= PACK_CATEGORY_ORDER_MAX;
  return valid ? [] : [packIssue('category.order', 'bad-value', `order must be a whole number from 0 to ${PACK_CATEGORY_ORDER_MAX}`)];
}

// The icon is an svg template under the same rules as pack objects, so a category cannot smuggle markup past the pack boundary.
function iconIssues(icon: unknown): StylePackIssue[] {
  if (typeof icon !== 'string' || icon.trim() === '') return [packIssue('category.icon', 'bad-value', 'icon must be an svg template')];
  return validatePackSvg(icon, 'category.icon');
}

function descriptionIssues(description: unknown): StylePackIssue[] {
  return description === undefined ? [] : checkLocalizedLabel(description, 'category.description');
}
