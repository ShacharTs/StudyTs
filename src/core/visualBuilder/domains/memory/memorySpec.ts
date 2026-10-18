import type { StylePackIssue } from '../../diagramPacks/stylePackFormat';
import { checkEnum, checkId, checkUnknownFields, isRecord, packIssue } from '../../diagramPacks/validatePackPrimitives';
import { checkTextKey, type TextKey } from '../algorithmText';

export const MEMORY_SPEC_FORMAT = 1;
export const MEMORY_MODES = ['leaks', 'chase'] as const;
export type MemoryMode = (typeof MEMORY_MODES)[number];

// A memory analysis as data: 'leaks' sweeps every heap block, 'chase' follows one variable's pointers.
export interface MemorySpec {
  format: typeof MEMORY_SPEC_FORMAT;
  id: string;
  model: 'memory';
  label: TextKey;
  mode: MemoryMode;
}

const FIELDS = ['format', 'id', 'model', 'label', 'mode'];

export function validateMemorySpec(value: unknown): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue('', 'bad-value', 'memory spec must be an object')];
  return [
    ...checkUnknownFields(value, FIELDS, ''),
    ...(value.format === MEMORY_SPEC_FORMAT ? [] : [packIssue('format', 'bad-value', `format must be ${MEMORY_SPEC_FORMAT}`)]),
    ...checkId(typeof value.id === 'string' ? value.id.replace('/', '-') : value.id, 'id'),
    ...checkEnum(value.model, ['memory'], 'model', 'bad-enum'),
    ...checkTextKey(value.label, 'label'),
    ...checkEnum(value.mode, MEMORY_MODES, 'mode', 'bad-enum'),
  ];
}
