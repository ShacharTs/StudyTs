import { pathFromTrace } from '../search/pathFromTrace';
import { runSearch } from '../search/runSearch';
import type { SearchSpec } from '../search/searchSpec';
import type { GraphModel } from '../graph/graphModel';
import type { NetworkSpec } from './networkSpec';

export type RouteEvent =
  | { type: 'start'; device: string; ttl: number }
  | { type: 'hop'; from: string; to: string; edge: string; number: number; ttlLeft: number }
  | { type: 'verdict'; verdict: 'delivered' | 'unreachable' | 'expired'; device: string; hops: number };

export type RouteTrace = RouteEvent[];

// Pure send: the route is whatever the search spec reaches; every hop costs one TTL and a packet that runs out is dropped where it stands.
export function runRoute(model: GraphModel, spec: NetworkSpec, search: SearchSpec, from: string, to: string): RouteTrace {
  const known = new Set(model.vertices.map((vertex) => vertex.id));
  if (!known.has(from) || !known.has(to) || from === to) return [];
  const trace: RouteTrace = [{ type: 'start', device: from, ttl: spec.ttl }];
  const path = pathFromTrace(runSearch(model, search, from), from, to);
  if (!path) return [...trace, { type: 'verdict', verdict: 'unreachable', device: from, hops: 0 }];
  let at = from;
  for (let index = 0; index < path.edges.length; index += 1) {
    if (index >= spec.ttl) return [...trace, { type: 'verdict', verdict: 'expired', device: at, hops: index }];
    const next = path.vertices[index + 1];
    trace.push({ type: 'hop', from: at, to: next, edge: path.edges[index], number: index + 1, ttlLeft: spec.ttl - index - 1 });
    at = next;
  }
  return [...trace, { type: 'verdict', verdict: 'delivered', device: at, hops: path.edges.length }];
}
