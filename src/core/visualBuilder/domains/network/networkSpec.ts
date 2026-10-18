import type { StylePackIssue } from '../../diagramPacks/stylePackFormat';
import { checkId, checkNumberIn, checkUnknownFields, isRecord, packIssue } from '../../diagramPacks/validatePackPrimitives';
import { checkTextKey, type TextKey } from '../algorithmText';

export const NETWORK_SPEC_FORMAT = 1;
export const TTL_RANGE: readonly [number, number] = [1, 255];

// Sending a packet as data: the route is what the named search spec finds (breadth-first is fewest hops, Dijkstra follows the
// link costs written on the cables) and `ttl` is how many hops the packet may take before a router drops it.
export interface NetworkSpec {
  format: typeof NETWORK_SPEC_FORMAT;
  id: string;
  model: 'network';
  label: TextKey;
  routeSearch: string;
  ttl: number;
}

const FIELDS = ['format', 'id', 'model', 'label', 'routeSearch', 'ttl'];

export function validateNetworkSpec(value: unknown): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue('', 'bad-value', 'network spec must be an object')];
  return [
    ...checkUnknownFields(value, FIELDS, ''),
    ...(value.format === NETWORK_SPEC_FORMAT ? [] : [packIssue('format', 'bad-value', `format must be ${NETWORK_SPEC_FORMAT}`)]),
    ...checkId(typeof value.id === 'string' ? value.id.replace('/', '-') : value.id, 'id'),
    ...(value.model === 'network' ? [] : [packIssue('model', 'bad-enum', 'model must be network')]),
    ...checkTextKey(value.label, 'label'),
    ...(typeof value.routeSearch === 'string' && value.routeSearch.length > 0 ? [] : [packIssue('routeSearch', 'bad-value', 'routeSearch must name a search algorithm')]),
    ...checkNumberIn(value.ttl, TTL_RANGE, 'ttl', 'bad-size'),
  ];
}
