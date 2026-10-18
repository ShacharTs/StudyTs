import type { StylePackIssue } from '../../diagramPacks/stylePackFormat';
import { checkId, checkNumberIn, checkUnknownFields, isRecord, packIssue } from '../../diagramPacks/validatePackPrimitives';
import { checkTextKey, type TextKey } from '../algorithmText';

export const PIPELINE_SPEC_FORMAT = 1;
export const TOKENS_RANGE: readonly [number, number] = [1, 20];
export const TICKS_RANGE: readonly [number, number] = [1, 60];

// A pipeline run as data: how many items enter the first stage, and a cap so a run that never finishes still ends.
export interface PipelineSpec {
  format: typeof PIPELINE_SPEC_FORMAT;
  id: string;
  model: 'pipeline';
  label: TextKey;
  tokens: number;
  ticks: number;
}

const FIELDS = ['format', 'id', 'model', 'label', 'tokens', 'ticks'];

export function validatePipelineSpec(value: unknown): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue('', 'bad-value', 'pipeline spec must be an object')];
  return [
    ...checkUnknownFields(value, FIELDS, ''),
    ...(value.format === PIPELINE_SPEC_FORMAT ? [] : [packIssue('format', 'bad-value', `format must be ${PIPELINE_SPEC_FORMAT}`)]),
    ...checkId(typeof value.id === 'string' ? value.id.replace('/', '-') : value.id, 'id'),
    ...(value.model === 'pipeline' ? [] : [packIssue('model', 'bad-enum', 'model must be pipeline')]),
    ...checkTextKey(value.label, 'label'),
    ...checkNumberIn(value.tokens, TOKENS_RANGE, 'tokens', 'bad-size'),
    ...checkNumberIn(value.ticks, TICKS_RANGE, 'ticks', 'bad-size'),
  ];
}
