import type { GraphTrace } from '../trace';

export interface TracedPath {
  vertices: string[];
  edges: string[];
}

// The tree path a search built from the source to the sink, read back from the `via` of each visit; null when the sink was not reached.
export function pathFromTrace(trace: GraphTrace, source: string, sink: string): TracedPath | null {
  const came = new Map(trace.flatMap((event) => (event.type === 'visit' ? [[event.vertex, { via: event.via, edge: event.edge }] as const] : [])));
  if (!came.has(sink)) return null;
  const vertices = [sink];
  const edges: string[] = [];
  for (let at = sink; at !== source; ) {
    const step = came.get(at);
    if (!step || !step.via || !step.edge) return null;
    edges.unshift(step.edge);
    vertices.unshift(step.via);
    at = step.via;
  }
  return { vertices, edges };
}

// Every vertex a search visited.
export const visitedIn = (trace: GraphTrace): Set<string> => new Set(trace.flatMap((event) => (event.type === 'visit' ? [event.vertex] : [])));
