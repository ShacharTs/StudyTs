import { OBJECT_KINDS } from '../objectKinds';
import { SHAPE_PRESETS } from '../shapeCatalog';
import {
  PACK_COLORS,
  PACK_DASHES,
  PACK_LABEL_SLOTS,
  PACK_LIMITS,
  PACK_SECOND_LABEL_SLOTS,
  PACK_STYLE_PAINTS,
  type StylePackIssue,
} from './stylePackFormat';
import { checkAnchors, checkOutline, checkStrokeScaling, checkView } from './validatePackGeometry';
import {
  checkArray,
  checkEnum,
  checkId,
  checkLabelText,
  checkLocalizedLabel,
  checkNumberIn,
  checkUnknownFields,
  isRecord,
  packIssue,
} from './validatePackPrimitives';
import { validatePackSvg } from './validatePackSvg';

const PRESET_SHAPES = SHAPE_PRESETS.map((preset) => preset.shape);
const OBJECT_FIELDS = ['id', 'label', 'category', 'size', 'kind', 'color', 'svg', 'preset', 'view', 'strokeScaling', 'outline', 'anchors', 'labelAt', 'label2At', 'lines', 'labelPrefix', 'aliases', 'defaultStyle', 'endLabels', 'keywords'];
const REQUIRED_FIELDS = ['id', 'label', 'size', 'kind'];
// A line has no height; an arrow may be drawn flat.
const HEIGHTLESS_KINDS: readonly string[] = ['path', 'arrow'];

type FieldCheck = (value: unknown, path: string) => StylePackIssue[];

const FIELD_CHECKS = new Map<string, FieldCheck>([
  ['id', (value, path) => checkId(value, path)],
  ['label', (value, path) => checkLocalizedLabel(value, path)],
  ['category', (value, path) => checkId(value, path)],
  ['kind', (value, path) => checkEnum(value, OBJECT_KINDS, path, 'bad-enum')],
  ['color', (value, path) => checkEnum(value, PACK_COLORS, path, 'bad-enum')],
  ['svg', (value, path) => (typeof value === 'string' ? validatePackSvg(value, path) : [packIssue(path, 'svg-syntax', 'svg must be a string')])],
  ['preset', (value, path) => checkEnum(value, PRESET_SHAPES, path, 'bad-enum')],
  ['view', (value, path) => checkView(value, path)],
  ['strokeScaling', (value, path) => checkStrokeScaling(value, path)],
  ['outline', (value, path) => checkOutline(value, path)],
  ['anchors', (value, path) => checkAnchors(value, path)],
  ['labelAt', (value, path) => checkEnum(value, PACK_LABEL_SLOTS, path, 'bad-enum')],
  ['label2At', (value, path) => checkEnum(value, PACK_SECOND_LABEL_SLOTS, path, 'bad-enum')],
  ['lines', (value, path) => (Number.isInteger(value) ? checkNumberIn(value, PACK_LIMITS.lines, path, 'bad-value') : [packIssue(path, 'bad-value', 'lines must be a whole number')])],
  ['labelPrefix', (value, path) => checkLabelText(value, path, PACK_LIMITS.labelPrefixChars)],
  ['aliases', (value, path) => checkArray(value, [0, PACK_LIMITS.listItems], path, 'bad-value', (item, itemPath) => checkId(item, itemPath))],
  ['defaultStyle', (value, path) => objectStyleIssues(value, path)],
  ['endLabels', (value, path) => (typeof value === 'boolean' ? [] : [packIssue(path, 'bad-value', 'endLabels must be true or false')])],
  ['keywords', (value, path) => checkArray(value, [0, PACK_LIMITS.listItems], path, 'bad-value', (item, itemPath) => checkLabelText(item, itemPath, PACK_LIMITS.keywordChars))],
]);

export function validatePackObjects(value: unknown, path: string): StylePackIssue[] {
  const { min, max } = PACK_LIMITS.objects;
  return checkArray(value, [min, max], path, 'too-many', validatePackObject);
}

export function validatePackObject(value: unknown, path: string): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-value', 'object must be an object')];
  return [
    ...checkUnknownFields(value, OBJECT_FIELDS, path),
    ...requiredIssues(value, path),
    ...presentFieldIssues(value, path),
    ...sizeIssues(value.size, value.kind, `${path}.size`),
    ...shapeSourceIssues(value, path),
    ...endLabelIssues(value, path),
  ];
}

function requiredIssues(value: Record<string, unknown>, path: string): StylePackIssue[] {
  return REQUIRED_FIELDS.filter((field) => value[field] === undefined).map((field) => packIssue(`${path}.${field}`, 'bad-value', `${field} is required`));
}

function presentFieldIssues(value: Record<string, unknown>, path: string): StylePackIssue[] {
  return Object.entries(value).flatMap(([key, field]) => FIELD_CHECKS.get(key)?.(field, `${path}.${key}`) ?? []);
}

function sizeIssues(size: unknown, kind: unknown, path: string): StylePackIssue[] {
  if (!isRecord(size)) return [packIssue(path, 'bad-size', 'size must be an object with w and h')];
  const [min, max] = PACK_LIMITS.objectSize;
  const range: readonly [number, number] = [min, max];
  const heightless = size.h === 0 && typeof kind === 'string' && HEIGHTLESS_KINDS.includes(kind);
  return [
    ...checkUnknownFields(size, ['w', 'h'], path),
    ...checkNumberIn(size.w, range, `${path}.w`, 'bad-size'),
    ...(heightless ? [] : checkNumberIn(size.h, range, `${path}.h`, 'bad-size')),
  ];
}

// Exactly one of svg or preset: a preset is an alias of a TS shape, an svg is drawn from the validated template.
function shapeSourceIssues(value: Record<string, unknown>, path: string): StylePackIssue[] {
  const hasSvg = value.svg !== undefined;
  const hasPreset = value.preset !== undefined;
  return hasSvg === hasPreset ? [packIssue(path, 'bad-shape', 'an object has exactly one of svg or preset')] : [];
}

function endLabelIssues(value: Record<string, unknown>, path: string): StylePackIssue[] {
  return value.endLabels === true && value.kind !== 'arrow' ? [packIssue(`${path}.endLabels`, 'bad-value', 'endLabels is only for arrow objects')] : [];
}

const STYLE_FIELD_CHECKS: Record<string, FieldCheck> = {
  fill: (value, path) => checkEnum(value, PACK_STYLE_PAINTS, path, 'bad-enum'),
  stroke: (value, path) => checkEnum(value, PACK_STYLE_PAINTS, path, 'bad-enum'),
  strokeWidth: (value, path) => checkNumberIn(value, PACK_LIMITS.strokeWidth, path, 'bad-value'),
  dash: (value, path) => checkEnum(value, PACK_DASHES, path, 'bad-enum'),
};

function objectStyleIssues(value: unknown, path: string): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-value', 'defaultStyle must be an object')];
  const fieldIssues = Object.entries(value).flatMap(([key, field]) => STYLE_FIELD_CHECKS[key]?.(field, `${path}.${key}`) ?? []);
  return [...checkUnknownFields(value, Object.keys(STYLE_FIELD_CHECKS), path), ...fieldIssues];
}
