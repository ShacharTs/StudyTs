import { presetOfRef } from '../shapeCatalog';
import { categoryById } from './categoryRegistry';
import {
  PACK_ID_PATTERN,
  PACK_LIMITS,
  PACK_TEMPLATE_COLORS,
  PACK_TEMPLATE_CORE_EFFECTS,
  PACK_TEMPLATE_LINK_ROUTES,
  PACK_TEMPLATE_LINK_SIDES,
  type StylePackIssue,
} from './stylePackFormat';
import { checkArray, checkEnum, checkId, checkLocalizedLabel, checkNumberIn, checkUnknownFields, isRecord, packIssue } from './validatePackPrimitives';

const TEMPLATE_FIELDS = ['id', 'name', 'category', 'description', 'objects', 'links', 'steps'];
const OBJECT_FIELDS = ['key', 'ref', 'at', 'label', 'color', 'width'];
const LINK_FIELDS = ['from', 'to', 'label', 'route', 'fromPort', 'toPort', 'arrow'];
const STEP_FIELDS = ['caption', 'show', 'effects'];
const EFFECT_FIELDS = ['effect', 'target'];
const FRACTION: readonly [number, number] = [0, 1];

// What a template may name: objects and effects of its own pack, so a pack file is judged without the registry.
export interface TemplateContext {
  packId: string;
  objectIds: ReadonlySet<string>;
  effectIds: ReadonlySet<string>;
}

interface TemplateKeys {
  objects: ReadonlySet<string>;
  links: ReadonlySet<string>;
}

type Limit = { min: number; max: number };

export function templateContextOf(pack: Record<string, unknown>): TemplateContext {
  const idsOf = (list: unknown): string[] =>
    Array.isArray(list) ? list.flatMap((item) => (isRecord(item) && typeof item.id === 'string' ? [item.id] : [])) : [];
  const packId = typeof pack.id === 'string' ? pack.id : '';
  return {
    packId,
    objectIds: new Set(idsOf(pack.objects)),
    effectIds: new Set([...PACK_TEMPLATE_CORE_EFFECTS, ...idsOf(pack.effects).map((id) => `${packId}/${id}`)]),
  };
}

export function validatePackTemplates(value: unknown, path: string, context: TemplateContext): StylePackIssue[] {
  const items = listIssues(value, PACK_LIMITS.templates, path, (item, itemPath) => validateTemplate(item, itemPath, context));
  return [...items, ...duplicateSlots(templateIdSlots(value, path), 'template of this pack')];
}

const listIssues = (value: unknown, limit: Limit, path: string, check: (item: unknown, itemPath: string) => StylePackIssue[]): StylePackIssue[] =>
  checkArray(value, [limit.min, limit.max], path, 'too-many', check);

function validateTemplate(value: unknown, path: string, context: TemplateContext): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-value', 'template must be an object')];
  const keys: TemplateKeys = { objects: stringSet(value.objects, 'key'), links: linkTargets(value.links) };
  return [
    ...checkUnknownFields(value, TEMPLATE_FIELDS, path),
    ...checkId(value.id, `${path}.id`),
    ...checkLocalizedLabel(value.name, `${path}.name`),
    ...checkLocalizedLabel(value.description, `${path}.description`),
    ...categoryIssues(value.category, `${path}.category`),
    ...listIssues(value.objects, PACK_LIMITS.templateObjects, `${path}.objects`, (item, p) => objectIssues(item, p, context)),
    ...listIssues(value.links, PACK_LIMITS.templateLinks, `${path}.links`, (item, p) => linkIssues(item, p, keys.objects)),
    ...listIssues(value.steps, PACK_LIMITS.templateSteps, `${path}.steps`, (item, p) => stepIssues(item, p, keys, context)),
    ...duplicateSlots(keySlots(value.objects, `${path}.objects`), 'object key'),
    ...showCoverageIssues(value.steps, keys.objects, `${path}.steps`),
  ];
}

function stringSet(list: unknown, field: string): Set<string> {
  const items = Array.isArray(list) ? list : [];
  return new Set(items.flatMap((item) => (isRecord(item) && typeof item[field] === 'string' ? [item[field] as string] : [])));
}

function linkTargets(links: unknown): Set<string> {
  const items = Array.isArray(links) ? links : [];
  return new Set(items.flatMap((item) => (isRecord(item) && typeof item.from === 'string' && typeof item.to === 'string' ? [`${item.from}->${item.to}`] : [])));
}

function categoryIssues(value: unknown, path: string): StylePackIssue[] {
  const idIssues = checkId(value, path);
  if (idIssues.length > 0) return idIssues;
  return categoryById(value as string) ? [] : [packIssue(path, 'bad-value', `category ${String(value)} does not exist`)];
}

function checkKey(value: unknown, path: string): StylePackIssue[] {
  const { min, max } = PACK_LIMITS.templateKeyChars;
  const valid = typeof value === 'string' && value.length >= min && value.length <= max && PACK_ID_PATTERN.test(value);
  return valid ? [] : [packIssue(path, 'bad-id', `key must be kebab-case, ${min} to ${max} characters`)];
}

function objectIssues(value: unknown, path: string, context: TemplateContext): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-value', 'template object must be an object')];
  return [
    ...checkUnknownFields(value, OBJECT_FIELDS, path),
    ...checkKey(value.key, `${path}.key`),
    ...refIssues(value.ref, `${path}.ref`, context),
    ...atIssues(value.at, `${path}.at`),
    ...(value.label === undefined ? [] : checkLocalizedLabel(value.label, `${path}.label`)),
    ...(value.color === undefined ? [] : checkEnum(value.color, PACK_TEMPLATE_COLORS, `${path}.color`, 'bad-enum')),
    ...(value.width === undefined ? [] : checkNumberIn(value.width, [0.02, 0.5], `${path}.width`, 'bad-size')),
  ];
}

function refIssues(value: unknown, path: string, context: TemplateContext): StylePackIssue[] {
  const prefix = `${context.packId}/`;
  const text = typeof value === 'string' ? value : '';
  const known = (text.startsWith(prefix) && context.objectIds.has(text.slice(prefix.length))) || presetOfRef(text) !== undefined;
  return known ? [] : [packIssue(path, 'bad-value', `ref must name an object of pack ${context.packId} as ${prefix}<objectId>, or a basic shape as preset/<shape>`)];
}

function atIssues(value: unknown, path: string): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-size', 'at must be an object with x and y')];
  return [
    ...checkUnknownFields(value, ['x', 'y'], path),
    ...checkNumberIn(value.x, FRACTION, `${path}.x`, 'bad-size'),
    ...checkNumberIn(value.y, FRACTION, `${path}.y`, 'bad-size'),
  ];
}

function keyRefIssue(value: unknown, path: string, keys: ReadonlySet<string>): StylePackIssue[] {
  return typeof value === 'string' && keys.has(value) ? [] : [packIssue(path, 'bad-value', 'must name an object key of this template')];
}

function linkIssues(value: unknown, path: string, keys: ReadonlySet<string>): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-value', 'link must be an object')];
  return [
    ...checkUnknownFields(value, LINK_FIELDS, path),
    ...keyRefIssue(value.from, `${path}.from`, keys),
    ...keyRefIssue(value.to, `${path}.to`, keys),
    ...(value.label === undefined ? [] : checkLocalizedLabel(value.label, `${path}.label`)),
    ...(value.route === undefined ? [] : checkEnum(value.route, PACK_TEMPLATE_LINK_ROUTES, `${path}.route`, 'bad-enum')),
    ...(value.fromPort === undefined ? [] : checkEnum(value.fromPort, PACK_TEMPLATE_LINK_SIDES, `${path}.fromPort`, 'bad-enum')),
    ...(value.toPort === undefined ? [] : checkEnum(value.toPort, PACK_TEMPLATE_LINK_SIDES, `${path}.toPort`, 'bad-enum')),
    ...(value.arrow === undefined || typeof value.arrow === 'boolean' ? [] : [packIssue(`${path}.arrow`, 'bad-value', 'arrow must be true or false')]),
  ];
}

function stepIssues(value: unknown, path: string, keys: TemplateKeys, context: TemplateContext): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-value', 'step must be an object')];
  const showLimit = { min: 0, max: PACK_LIMITS.templateObjects.max };
  return [
    ...checkUnknownFields(value, STEP_FIELDS, path),
    ...checkLocalizedLabel(value.caption, `${path}.caption`),
    ...listIssues(value.show, showLimit, `${path}.show`, (item, p) => keyRefIssue(item, p, keys.objects)),
    ...listIssues(value.effects, PACK_LIMITS.templateEffects, `${path}.effects`, (item, p) => effectIssues(item, p, keys, context)),
  ];
}

function effectIssues(value: unknown, path: string, keys: TemplateKeys, context: TemplateContext): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-effect', 'effect must be an object')];
  const effectKnown = typeof value.effect === 'string' && context.effectIds.has(value.effect);
  const targetKnown = typeof value.target === 'string' && (keys.objects.has(value.target) || keys.links.has(value.target));
  return [
    ...checkUnknownFields(value, EFFECT_FIELDS, path),
    ...(effectKnown ? [] : [packIssue(`${path}.effect`, 'bad-effect', 'effect must be a built-in effect id or <packId>/<effectId> of this pack')]),
    ...(targetKnown ? [] : [packIssue(`${path}.target`, 'bad-value', 'target must be an object key or fromKey->toKey of a link')]),
  ];
}

interface Slot {
  value: unknown;
  path: string;
}

function templateIdSlots(templates: unknown, path: string): Slot[] {
  const items = Array.isArray(templates) ? templates : [];
  return items.map((item, index) => ({ value: isRecord(item) ? item.id : undefined, path: `${path}[${index}].id` }));
}

function keySlots(objects: unknown, path: string): Slot[] {
  const items = Array.isArray(objects) ? objects : [];
  return items.map((item, index) => ({ value: isRecord(item) ? item.key : undefined, path: `${path}[${index}].key` }));
}

function duplicateSlots(slots: Slot[], what: string): StylePackIssue[] {
  const seen = new Set<unknown>();
  return slots.flatMap(({ value, path }) => {
    if (typeof value !== 'string') return [];
    if (!seen.has(value)) {
      seen.add(value);
      return [];
    }
    return [packIssue(path, 'duplicate-id', `${value} is already a ${what}`)];
  });
}

// Every object appears at exactly one step, so the lifecycle never leaves one hidden for good or shown twice.
function showCoverageIssues(steps: unknown, keys: ReadonlySet<string>, path: string): StylePackIssue[] {
  if (!Array.isArray(steps)) return [];
  const shown = steps.flatMap((step) => (isRecord(step) && Array.isArray(step.show) ? step.show.filter((key): key is string => typeof key === 'string') : []));
  const missing = [...keys].filter((key) => !shown.includes(key));
  const repeated = shown.filter((key, index) => shown.indexOf(key) !== index);
  return [...missing, ...repeated].map((key) => packIssue(path, 'bad-value', `object ${key} must be shown in exactly one step`));
}
