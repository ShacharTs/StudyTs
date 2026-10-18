import { PACK_COLORS, PACK_FORMAT_VERSION, type StylePackIssue, type StylePackFile } from './stylePackFormat';
import { checkEnum, checkId, checkLocalizedLabel, checkUnknownFields, isRecord, packIssue } from './validatePackPrimitives';
import { validatePackObjects } from './validatePackObjects';
import { validatePackEffects } from './validatePackEffects';
import { templateContextOf, validatePackTemplates } from './validatePackTemplates';

export const MAX_PACK_ISSUES = 50;

const PACK_FIELDS = ['format', 'id', 'name', 'category', 'color', 'objects', 'effects', 'templates', 'defaultStyle'];

export type StylePackValidation = { ok: true; pack: StylePackFile } | { ok: false; errors: StylePackIssue[] };

// Pure and total: contributor input is untrusted, so a hostile getter or proxy becomes an issue, never a throw.
export function validateStylePack(raw: unknown): StylePackValidation {
  try {
    const issues = collectIssues(raw);
    if (issues.length === 0) return { ok: true, pack: raw as StylePackFile };
    return { ok: false, errors: issues.slice(0, MAX_PACK_ISSUES) };
  } catch {
    return { ok: false, errors: [packIssue('pack', 'bad-value', 'pack could not be read')] };
  }
}

function collectIssues(raw: unknown): StylePackIssue[] {
  if (!isRecord(raw)) return [packIssue('pack', 'bad-value', 'pack must be an object')];
  return [
    ...checkUnknownFields(raw, PACK_FIELDS, 'pack'),
    ...formatIssues(raw.format),
    ...checkId(raw.id, 'pack.id'),
    ...checkLocalizedLabel(raw.name, 'pack.name'),
    ...checkId(raw.category, 'pack.category'),
    ...checkEnum(raw.color, PACK_COLORS, 'pack.color', 'bad-enum'),
    ...objectIssues(raw),
    ...optionalEffectIssues(raw.effects),
    ...optionalTemplateIssues(raw),
    ...optionalDefaultStyleIssues(raw.defaultStyle),
    ...duplicateIdIssues(objectIdSlots(raw.objects)),
    ...duplicateIdIssues(effectIdSlots(raw.effects)),
  ];
}

// A pack of templates only (built from basic presets, 20l) has no objects of its own.
function objectIssues(raw: Record<string, unknown>): StylePackIssue[] {
  const templatesOnly = Array.isArray(raw.objects) && raw.objects.length === 0 && Array.isArray(raw.templates) && raw.templates.length > 0;
  return templatesOnly ? [] : validatePackObjects(raw.objects, 'pack.objects');
}

function formatIssues(format: unknown): StylePackIssue[] {
  return format === PACK_FORMAT_VERSION ? [] : [packIssue('pack.format', 'bad-value', `format must be ${PACK_FORMAT_VERSION}`)];
}

function optionalEffectIssues(effects: unknown): StylePackIssue[] {
  return effects === undefined ? [] : validatePackEffects(effects, 'pack.effects');
}

function optionalTemplateIssues(raw: Record<string, unknown>): StylePackIssue[] {
  return raw.templates === undefined ? [] : validatePackTemplates(raw.templates, 'pack.templates', templateContextOf(raw));
}

function optionalDefaultStyleIssues(defaultStyle: unknown): StylePackIssue[] {
  return defaultStyle === undefined ? [] : checkId(defaultStyle, 'pack.defaultStyle');
}

interface IdSlot {
  id: unknown;
  path: string;
}

// An alias shares the namespace of ids: `pc` must resolve to one object only.
function objectIdSlots(objects: unknown): IdSlot[] {
  if (!Array.isArray(objects)) return [];
  return objects.flatMap((object, index) => {
    if (!isRecord(object)) return [];
    const aliases = Array.isArray(object.aliases) ? object.aliases : [];
    const slots: IdSlot[] = [{ id: object.id, path: `pack.objects[${index}].id` }];
    aliases.forEach((alias, aliasIndex) => slots.push({ id: alias, path: `pack.objects[${index}].aliases[${aliasIndex}]` }));
    return slots;
  });
}

function effectIdSlots(effects: unknown): IdSlot[] {
  if (!Array.isArray(effects)) return [];
  return effects.flatMap((effect, index) => (isRecord(effect) ? [{ id: effect.id, path: `pack.effects[${index}].id` }] : []));
}

function duplicateIdIssues(slots: IdSlot[]): StylePackIssue[] {
  const seen = new Set<string>();
  return slots.flatMap(({ id, path }) => {
    if (typeof id !== 'string') return [];
    if (seen.has(id)) return [packIssue(path, 'duplicate-id', `${id} is already used in this pack`)];
    seen.add(id);
    return [];
  });
}
