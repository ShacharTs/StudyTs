import automataSeed from './automataSeed.pack.json';
import basicTemplates from './basicTemplates.pack.json';
import flowchart from './flowchart.pack.json';
import memory from './memory.pack.json';
import network from './network.pack.json';
import sets from './sets.pack.json';
import shapes from './shapes.pack.json';
import system from './system.pack.json';
import uml from './uml.pack.json';
import type { ObjectKind } from '../objectKinds';
import type { PackObjectDef, StylePackFile, StylePackIssue } from './stylePackFormat';
import { validateStylePack } from './validateStylePack';

export interface PackSource {
  file: string;
  raw: unknown;
}

export interface StylePackRegistry {
  listPacks(): readonly StylePackFile[];
  packById(packId: string): StylePackFile | undefined;
  packObject(packId: string, objectId: string): PackObjectDef | undefined;
}

export interface StylePackLoadIssue extends StylePackIssue {
  file: string;
}

// Every built-in pack is imported explicitly so Vite, tsx and Vitest bundle the same set; a new pack needs its import line here.
export const BUILT_IN_PACK_SOURCES: readonly PackSource[] = [
  { file: 'automataSeed.pack.json', raw: automataSeed },
  { file: 'basicTemplates.pack.json', raw: basicTemplates },
  { file: 'flowchart.pack.json', raw: flowchart },
  { file: 'memory.pack.json', raw: memory },
  { file: 'network.pack.json', raw: network },
  { file: 'sets.pack.json', raw: sets },
  { file: 'shapes.pack.json', raw: shapes },
  { file: 'system.pack.json', raw: system },
  { file: 'uml.pack.json', raw: uml },
];

// Validation runs in every environment: a bad built-in pack must stop the app at startup, not render a half-empty gallery.
export class StylePackRegistryError extends Error {
  readonly issues: readonly StylePackLoadIssue[];

  constructor(issues: readonly StylePackLoadIssue[]) {
    super(formatLoadIssues(issues));
    this.name = 'StylePackRegistryError';
    this.issues = issues;
  }
}

export function createStylePackRegistry(sources: readonly PackSource[]): StylePackRegistry {
  const packs = loadPacks(sources);
  const packsById = new Map(packs.map((pack) => [pack.id, pack] as const));
  return {
    listPacks: () => packs,
    packById: (packId) => packsById.get(packId),
    packObject: (packId, objectId) => packsById.get(packId)?.objects.find((object) => object.id === objectId || object.aliases?.includes(objectId)),
  };
}

function loadPacks(sources: readonly PackSource[]): StylePackFile[] {
  const issues: StylePackLoadIssue[] = [];
  const fileByPackId = new Map<string, string>();
  const packs: StylePackFile[] = [];
  for (const { file, raw } of sources) {
    const result = validateStylePack(raw);
    if (!result.ok) {
      issues.push(...result.errors.map((error) => ({ ...error, file })));
      continue;
    }
    const declaringFile = fileByPackId.get(result.pack.id);
    if (declaringFile !== undefined) {
      issues.push({ file, path: 'pack.id', code: 'duplicate-id', message: `${result.pack.id} is already declared by ${declaringFile}` });
      continue;
    }
    fileByPackId.set(result.pack.id, file);
    packs.push(result.pack);
  }
  if (issues.length > 0) throw new StylePackRegistryError(issues);
  return packs;
}

function formatLoadIssues(issues: readonly StylePackLoadIssue[]): string {
  const lines = issues.map((issue) => `  ${issue.file} ${issue.path}: ${issue.message}`);
  return [`Invalid style pack${issues.length === 1 ? '' : 's'} (${issues.length}):`, ...lines].join('\n');
}

const builtInRegistry = createStylePackRegistry(BUILT_IN_PACK_SOURCES);

export const listPacks = builtInRegistry.listPacks;
export const packById = builtInRegistry.packById;
export const packObject = builtInRegistry.packObject;

// A ref is '<packId>/<objectId>', the form stored in builder.pack; the object part may be an alias (a stored canvas id or an MCP name).
export function packObjectByRef(ref: string | undefined): PackObjectDef | undefined {
  const [packId = '', objectId = ''] = (ref ?? '').split('/');
  return packObject(packId, objectId);
}

export interface PackObjectListing {
  ref: string;
  label: string;
  kind: ObjectKind;
  category: string;
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// What an AI tool or an error message names: sorted by pack id, then object id, so the list is the same on every run.
export function listPackObjects(): PackObjectListing[] {
  return listPacks()
    .flatMap((pack) => pack.objects.map((object) => ({ packId: pack.id, objectId: object.id, label: object.label.en, kind: object.kind, category: object.category ?? pack.category })))
    .sort((a, b) => byText(a.packId, b.packId) || byText(a.objectId, b.objectId))
    .map(({ packId, objectId, label, kind, category }) => ({ ref: `${packId}/${objectId}`, label, kind, category }));
}
