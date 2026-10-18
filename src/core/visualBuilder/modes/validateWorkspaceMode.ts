import type { StylePackIssue } from '../diagramPacks/stylePackFormat';
import { checkArray, checkEnum, checkId, checkLabelText, checkLocalizedLabel, checkUnknownFields, isRecord, packIssue } from '../diagramPacks/validatePackPrimitives';
import { SHAPE_PRESETS } from '../shapeCatalog';
import { INSPECTOR_SECTIONS, MODE_ACTION_IDS, MODE_INPUT_KEYS, STARTER_ACTION_PREFIX, WORKSPACE_MODE_FORMAT, type ModeToolId, type WorkspaceMode } from './workspaceMode';

export type WorkspaceModeValidation =
  | { ok: true; mode: WorkspaceMode; warnings: StylePackIssue[] }
  | { ok: false; errors: StylePackIssue[] };

// Mode text may be a key into src/i18n/modes instead of an inline en/he pair.
const checkModeText = (value: unknown, path: string) =>
  isRecord(value) && typeof value.key === "string" ? [] : checkLocalizedLabel(value, path);

const MODE_FIELDS = ['format', 'id', 'label', 'note', 'icon', 'filters', 'templates', 'starter', 'starterLabel', 'tools', 'inspector', 'view'];
const FILTER_FIELDS = ['categories', 'presets', 'effects'];
const PRESETS = SHAPE_PRESETS.map((preset) => preset.shape);
const LIST_LIMIT: readonly [number, number] = [0, 100];
const TOOL_LIMIT: readonly [number, number] = [1, 24];

const TOOL_FIELDS: Record<ModeToolId, readonly string[]> = {
  select: ['id'],
  place: ['id', 'label', 'object'],
  placePicker: ['id', 'label', 'objects'],
  connect: ['id', 'label', 'arrow', 'labelCycle', 'autoLabel'],
  stepper: ['id', 'label', 'action', 'min', 'max', 'object'],
  toggle: ['id', 'label', 'key'],
  action: ['id', 'label', 'run', 'primary'],
  input: ['id', 'label', 'key', 'pattern'],
  autoRun: ['id', 'label'],
  algorithm: ['id', 'label', 'algorithms'],
  chart: ['id', 'label', 'charts'],
};

const TOOL_ENUMS: Partial<Record<ModeToolId, Record<string, readonly string[]>>> = {
  connect: { arrow: ['directed', 'undirected', 'both'] },
  stepper: { action: ['setCount'] },
  toggle: { key: ['directed', 'weighted'] },
  action: { run: MODE_ACTION_IDS },
  input: { key: MODE_INPUT_KEYS },
};

const TOOL_IDS = Object.keys(TOOL_FIELDS);

// Pure and total: a custom mode file is untrusted, so a hostile getter becomes an issue, never a throw.
export function validateWorkspaceMode(raw: unknown, knownCategoryIds?: readonly string[]): WorkspaceModeValidation {
  try {
    const errors = collectErrors(raw);
    if (errors.length > 0) return { ok: false, errors };
    const mode = raw as WorkspaceMode;
    return { ok: true, mode, warnings: unknownCategoryWarnings(mode, knownCategoryIds) };
  } catch {
    return { ok: false, errors: [packIssue('mode', 'bad-value', 'mode could not be read')] };
  }
}

function collectErrors(raw: unknown): StylePackIssue[] {
  if (!isRecord(raw)) return [packIssue('mode', 'bad-value', 'mode must be an object')];
  return [
    ...checkUnknownFields(raw, MODE_FIELDS, 'mode'),
    ...(raw.format === WORKSPACE_MODE_FORMAT ? [] : [packIssue('mode.format', 'bad-value', `format must be ${WORKSPACE_MODE_FORMAT}`)]),
    ...checkId(raw.id, 'mode.id'),
    ...(typeof raw.label === 'string' ? checkLabelText(raw.label, 'mode.label') : checkModeText(raw.label, 'mode.label')),
    ...(raw.note === undefined ? [] : checkModeText(raw.note, 'mode.note')),
    ...(typeof raw.icon === 'string' && raw.icon.length > 0 ? [] : [packIssue('mode.icon', 'bad-value', 'icon must be a non-empty string')]),
    ...filterIssues(raw.filters),
    ...checkArray(raw.templates, LIST_LIMIT, 'mode.templates', 'too-many', checkRef),
    ...starterIssues(raw.starter),
    ...(raw.starterLabel === undefined ? [] : checkModeText(raw.starterLabel, 'mode.starterLabel')),
    ...checkArray(raw.tools, TOOL_LIMIT, 'mode.tools', 'too-many', checkTool),
    ...inspectorIssues(raw.inspector),
  ];
}

function checkRef(value: unknown, path: string): StylePackIssue[] {
  const valid = typeof value === 'string' && /^[a-z0-9][a-z0-9/_-]*$/.test(value);
  return valid ? [] : [packIssue(path, 'bad-id', 'must be a pack or template reference such as sets/set')];
}

function starterIssues(starter: unknown): StylePackIssue[] {
  if (starter === undefined) return [];
  if (typeof starter === 'string' && starter.startsWith(STARTER_ACTION_PREFIX)) {
    return MODE_ACTION_IDS.includes(starter.slice(STARTER_ACTION_PREFIX.length)) ? [] : [packIssue('mode.starter', 'bad-enum', `action must be one of ${MODE_ACTION_IDS.join(', ')}`)];
  }
  return checkRef(starter, 'mode.starter');
}

function filterIssues(filters: unknown): StylePackIssue[] {
  if (!isRecord(filters)) return [packIssue('mode.filters', 'bad-value', 'filters must be an object')];
  return [
    ...checkUnknownFields(filters, FILTER_FIELDS, 'mode.filters'),
    ...nullableList(filters.categories, 'mode.filters.categories', checkId),
    ...checkArray(filters.effects, LIST_LIMIT, 'mode.filters.effects', 'too-many', checkId),
    ...nullableList(filters.presets, 'mode.filters.presets', (item, path) => checkEnum(item, PRESETS, path, 'bad-enum')),
  ];
}

const nullableList = (value: unknown, path: string, check: (item: unknown, itemPath: string) => StylePackIssue[]): StylePackIssue[] =>
  value === null ? [] : checkArray(value, LIST_LIMIT, path, 'too-many', check);

function inspectorIssues(inspector: unknown): StylePackIssue[] {
  if (!isRecord(inspector)) return [packIssue('mode.inspector', 'bad-value', 'inspector must be an object')];
  const flagIssues = Object.entries(inspector)
    .filter(([, flag]) => typeof flag !== 'boolean')
    .map(([key]) => packIssue(`mode.inspector.${key}`, 'bad-value', 'must be true or false'));
  return [...checkUnknownFields(inspector, INSPECTOR_SECTIONS, 'mode.inspector'), ...flagIssues];
}

function checkTool(tool: unknown, path: string): StylePackIssue[] {
  if (!isRecord(tool)) return [packIssue(path, 'bad-value', 'tool must be an object')];
  const idIssues = checkEnum(tool.id, TOOL_IDS, `${path}.id`, 'bad-enum');
  if (idIssues.length > 0) return idIssues;
  const id = tool.id as ModeToolId;
  return [
    ...checkUnknownFields(tool, TOOL_FIELDS[id], path),
    ...(id === 'select' ? [] : checkModeText(tool.label, `${path}.label`)),
    ...enumIssues(tool, id, path),
    ...(id === 'chart' ? checkArray(tool.charts, [1, 8], `${path}.charts`, 'too-many', (item, itemPath) => checkChart(item, itemPath)) : []),
    ...(id === 'algorithm' ? checkArray(tool.algorithms, [1, 12], `${path}.algorithms`, 'too-many', (item, itemPath) => (typeof item === 'string' && item.length > 0 ? [] : [packIssue(itemPath, 'bad-value', 'algorithm id must be a text')])) : []),
  ];
}

function checkChart(chart: unknown, path: string): StylePackIssue[] {
  if (!isRecord(chart)) return [packIssue(path, 'bad-value', 'chart must be an object')];
  const starterIssues = typeof chart.starter === 'string' && chart.starter.length > 0 ? [] : [packIssue(`${path}.starter`, 'bad-value', 'starter must be a template ref')];
  return [
    ...checkUnknownFields(chart, ['id', 'label', 'note', 'starter'], path),
    ...checkId(chart.id, `${path}.id`),
    ...checkModeText(chart.label, `${path}.label`),
    ...checkModeText(chart.note, `${path}.note`),
    ...starterIssues,
  ];
}

function enumIssues(tool: Record<string, unknown>, id: ModeToolId, path: string): StylePackIssue[] {
  const enums = TOOL_ENUMS[id] ?? {};
  return Object.entries(enums).flatMap(([field, allowed]) => checkEnum(tool[field], allowed, `${path}.${field}`, 'bad-enum'));
}

function unknownCategoryWarnings(mode: WorkspaceMode, known?: readonly string[]): StylePackIssue[] {
  if (!known) return [];
  return (mode.filters.categories ?? [])
    .filter((id) => !known.includes(id))
    .map((id) => packIssue('mode.filters.categories', 'bad-value', `category ${id} does not exist; the mode shows what exists`));
}
