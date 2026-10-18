import type { StylePackIssue } from '../../diagramPacks/stylePackFormat';
import { checkEnum, checkId, checkUnknownFields, isRecord, packIssue } from '../../diagramPacks/validatePackPrimitives';
import { checkTextKey, type TextKey } from '../algorithmText';

export const AUTOMATON_SPEC_FORMAT = 1;
export const CHOICES = ['first', 'all'] as const;

// A word run as data: `first` takes the first move that reads each symbol (a deterministic machine), `all` follows every
// enabled move and epsilon move at once (the subset run of a nondeterministic machine; on a deterministic one it is the same run).
export interface AutomatonSpec {
  format: typeof AUTOMATON_SPEC_FORMAT;
  id: string;
  model: 'automaton';
  label: TextKey;
  choice: (typeof CHOICES)[number];
}

const FIELDS = ['format', 'id', 'model', 'label', 'choice'];

export function validateAutomatonSpec(value: unknown): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue('', 'bad-value', 'automaton spec must be an object')];
  return [
    ...checkUnknownFields(value, FIELDS, ''),
    ...(value.format === AUTOMATON_SPEC_FORMAT ? [] : [packIssue('format', 'bad-value', `format must be ${AUTOMATON_SPEC_FORMAT}`)]),
    ...checkId(typeof value.id === 'string' ? value.id.replace('/', '-') : value.id, 'id'),
    ...(value.model === 'automaton' ? [] : [packIssue('model', 'bad-enum', 'model must be automaton')]),
    ...checkTextKey(value.label, 'label'),
    ...checkEnum(value.choice, CHOICES, 'choice', 'bad-enum'),
  ];
}
