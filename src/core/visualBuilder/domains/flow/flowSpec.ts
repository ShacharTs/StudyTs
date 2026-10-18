import type { StylePackIssue } from '../../diagramPacks/stylePackFormat';
import { checkId, checkUnknownFields, isRecord, packIssue } from '../../diagramPacks/validatePackPrimitives';
import { checkTextKey, type TextKey } from '../algorithmText';

export const FLOW_SPEC_FORMAT = 1;

// A max-flow run as data: the augmenting paths are found by a search spec of the same registry, so
// breadth-first gives Edmonds-Karp and depth-first gives Ford-Fulkerson with no flow code of its own.
export interface FlowSpec {
  format: typeof FLOW_SPEC_FORMAT;
  id: string;
  model: 'flow';
  label: TextKey;
  pathSearch: string;
}

const FIELDS = ['format', 'id', 'model', 'label', 'pathSearch'];

export function validateFlowSpec(value: unknown): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue('', 'bad-value', 'flow spec must be an object')];
  return [
    ...checkUnknownFields(value, FIELDS, ''),
    ...(value.format === FLOW_SPEC_FORMAT ? [] : [packIssue('format', 'bad-value', `format must be ${FLOW_SPEC_FORMAT}`)]),
    ...checkId(typeof value.id === 'string' ? value.id.replace('/', '-') : value.id, 'id'),
    ...(value.model === 'flow' ? [] : [packIssue('model', 'bad-enum', 'model must be flow')]),
    ...checkTextKey(value.label, 'label'),
    ...(typeof value.pathSearch === 'string' && value.pathSearch.length > 0 ? [] : [packIssue('pathSearch', 'bad-value', 'pathSearch must name a search algorithm')]),
  ];
}
