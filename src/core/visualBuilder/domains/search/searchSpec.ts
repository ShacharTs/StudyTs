import { checkEnum, checkId, checkUnknownFields, isRecord, packIssue } from '../../diagramPacks/validatePackPrimitives';
import type { StylePackIssue } from '../../diagramPacks/stylePackFormat';
import { checkTextKey, type TextKey } from '../algorithmText';

export const SEARCH_SPEC_FORMAT = 1;
export const FRONTIER_POLICIES = ['fifo', 'lifo', 'priority'] as const;
export const PRIORITY_KEYS = ['distance', 'edge'] as const;
export const MARK_MODES = ['discover', 'visit'] as const;
export const PUSH_ORDERS = ['label', 'label-desc'] as const;

// One graph search as data: the engine in runSearch.ts runs every algorithm, none is hand-written.
export interface SearchSpec {
  format: typeof SEARCH_SPEC_FORMAT;
  id: string;
  model: 'graph';
  label: TextKey;
  frontier: { policy: (typeof FRONTIER_POLICIES)[number]; priority?: (typeof PRIORITY_KEYS)[number] };
  mark: (typeof MARK_MODES)[number];
  relax?: { cost: 'weight' };
  pushOrder?: (typeof PUSH_ORDERS)[number];
}

const FIELDS = ['format', 'id', 'model', 'label', 'frontier', 'mark', 'relax', 'pushOrder'];

function frontierIssues(value: unknown): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue('frontier', 'bad-value', 'frontier must be an object')];
  const priority = value.policy === 'priority';
  return [
    ...checkUnknownFields(value, ['policy', 'priority'], 'frontier'),
    ...checkEnum(value.policy, FRONTIER_POLICIES, 'frontier.policy', 'bad-enum'),
    ...(priority ? checkEnum(value.priority, PRIORITY_KEYS, 'frontier.priority', 'bad-enum') : []),
    ...(!priority && value.priority !== undefined ? [packIssue('frontier.priority', 'bad-value', 'priority needs the priority policy')] : []),
  ];
}

export function validateSearchSpec(value: unknown): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue('', 'bad-value', 'search spec must be an object')];
  const relax = value.relax;
  return [
    ...checkUnknownFields(value, FIELDS, ''),
    ...(value.format === SEARCH_SPEC_FORMAT ? [] : [packIssue('format', 'bad-value', `format must be ${SEARCH_SPEC_FORMAT}`)]),
    ...checkId(typeof value.id === 'string' ? value.id.replace('/', '-') : value.id, 'id'),
    ...checkEnum(value.model, ['graph'], 'model', 'bad-enum'),
    ...checkTextKey(value.label, 'label'),
    ...frontierIssues(value.frontier),
    ...checkEnum(value.mark, MARK_MODES, 'mark', 'bad-enum'),
    ...(relax === undefined || (isRecord(relax) && relax.cost === 'weight') ? [] : [packIssue('relax', 'bad-value', 'relax must be { "cost": "weight" }')]),
    ...(value.pushOrder === undefined ? [] : checkEnum(value.pushOrder, PUSH_ORDERS, 'pushOrder', 'bad-enum')),
  ];
}
