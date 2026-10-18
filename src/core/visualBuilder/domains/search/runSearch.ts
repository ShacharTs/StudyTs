import type { GraphModel, Neighbour } from '../graph/graphModel';
import type { GraphTrace } from '../trace';
import type { SearchSpec } from './searchSpec';

interface Candidate {
  vertex: string;
  via: string | null;
  edge: string | null;
  priority: number;
  seq: number;
}

interface RunState {
  frontier: Candidate[];
  closed: Set<string>;
  visited: Set<string>;
  distance: Map<string, number>;
  trace: GraphTrace;
  seq: number;
}

type Policy = SearchSpec['frontier']['policy'];

// Which candidate leaves the frontier next: the oldest, the newest, or the smallest priority (ties by discovery number).
function takeNext(frontier: Candidate[], policy: Policy): Candidate {
  if (policy === 'fifo') return frontier.shift() as Candidate;
  if (policy === 'lifo') return frontier.pop() as Candidate;
  const best = frontier.reduce((chosen, item) => (item.priority < chosen.priority || (item.priority === chosen.priority && item.seq < chosen.seq) ? item : chosen));
  frontier.splice(frontier.indexOf(best), 1);
  return best;
}

// Labels in the order they would leave the frontier, for the queue strip.
function snapshot(frontier: Candidate[], policy: Policy, labelOf: (vertex: string) => string): string[] {
  const ordered = [...frontier];
  if (policy === 'lifo') ordered.reverse();
  if (policy === 'priority') ordered.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
  return ordered.map((item) => labelOf(item.vertex));
}

// One neighbour of the vertex just taken: skip it, relax it, or put it on the frontier.
function consider(state: RunState, model: GraphModel, spec: SearchSpec, from: string, next: Neighbour): void {
  if (state.visited.has(next.vertex) || (spec.mark === 'discover' && state.closed.has(next.vertex))) return;
  state.closed.add(next.vertex);
  const cost = (state.distance.get(from) ?? 0) + next.weight;
  if (spec.relax) {
    const improved = cost < (state.distance.get(next.vertex) ?? Infinity);
    state.trace.push({ type: 'relax', edge: next.edge, from, to: next.vertex, distance: cost, improved });
    if (!improved) return;
    state.distance.set(next.vertex, cost);
  }
  const priority = spec.frontier.priority === 'edge' ? next.weight : cost;
  state.frontier.push({ vertex: next.vertex, via: from, edge: next.edge, priority, seq: state.seq });
  state.seq += 1;
  state.trace.push({ type: 'discover', vertex: next.vertex, via: from, edge: next.edge, frontier: snapshot(state.frontier, spec.frontier.policy, model.labelOf) });
}

// The one engine: every search is this loop with a different spec. Pure; a missing start returns an empty trace.
export function runSearch(model: GraphModel, spec: SearchSpec, start: string): GraphTrace {
  if (!model.vertices.some((vertex) => vertex.id === start)) return [];
  const state: RunState = {
    frontier: [{ vertex: start, via: null, edge: null, priority: 0, seq: 0 }],
    closed: new Set(spec.mark === 'discover' ? [start] : []),
    visited: new Set(),
    distance: new Map([[start, 0]]),
    trace: [{ type: 'start', vertex: start }],
    seq: 1,
  };
  while (state.frontier.length > 0) {
    const item = takeNext(state.frontier, spec.frontier.policy);
    if (state.visited.has(item.vertex)) continue;
    state.visited.add(item.vertex);
    const frontier = snapshot(state.frontier, spec.frontier.policy, model.labelOf);
    state.trace.push({ type: 'visit', vertex: item.vertex, order: state.visited.size, frontier, via: item.via, edge: item.edge });
    const around = model.neighbours(item.vertex);
    (spec.pushOrder === 'label-desc' ? [...around].reverse() : around).forEach((next) => consider(state, model, spec, item.vertex, next));
  }
  return state.trace;
}
