import type { GraphModel, Neighbour } from '../graph/graphModel';
import { pathFromTrace, visitedIn } from '../search/pathFromTrace';
import { runSearch } from '../search/runSearch';
import type { SearchSpec } from '../search/searchSpec';
import type { FlowTrace } from '../trace';

const MAX_AUGMENTS = 200;
const FORWARD = '|f';
const BACKWARD = '|b';

interface Arc {
  edge: string;
  forward: boolean;
  to: string;
  residual: number;
}

// The residual network of the current flow, as a graph the search engine can walk: one arc per direction with room left.
function residualModel(model: GraphModel, flow: Map<string, number>): { graph: GraphModel; arcs: Map<string, Arc> } {
  const arcs = new Map<string, Arc>();
  const out = new Map<string, Neighbour[]>(model.vertices.map((vertex) => [vertex.id, []]));
  model.edges.forEach((edge) => {
    const used = flow.get(edge.id) ?? 0;
    const forward = { edge: edge.id, forward: true, to: edge.to, residual: edge.weight - used };
    const backward = { edge: edge.id, forward: false, to: edge.from, residual: used };
    [[edge.from, forward, FORWARD], [edge.to, backward, BACKWARD]].forEach(([from, arc, suffix]) => {
      const typed = arc as Arc;
      if (typed.residual <= 0) return;
      const id = `${typed.edge}${suffix as string}`;
      arcs.set(id, typed);
      out.get(from as string)?.push({ vertex: typed.to, edge: id, weight: 1 });
    });
  });
  const neighbours = (vertex: string): Neighbour[] => [...(out.get(vertex) ?? [])].sort((a, b) => model.labelOf(a.vertex).localeCompare(model.labelOf(b.vertex)) || a.edge.localeCompare(b.edge));
  return { graph: { ...model, edges: [], directed: true, neighbours }, arcs };
}

interface Found {
  vertices: string[];
  arcs: Arc[];
}

// The augmenting path the search reached, as residual arcs; null when the sink is not reached.
function pathTo(graph: GraphModel, arcs: Map<string, Arc>, spec: SearchSpec, source: string, sink: string): { found: Found | null; reached: Set<string> } {
  const trace = runSearch(graph, spec, source);
  const path = pathFromTrace(trace, source, sink);
  const reached = visitedIn(trace);
  return { found: path ? { vertices: path.vertices, arcs: path.edges.map((id) => arcs.get(id) as Arc) } : null, reached };
}

// Pure max flow: augment along the paths the search spec finds until the sink is unreachable, then report the cut.
export function runFlow(model: GraphModel, pathSearch: SearchSpec, source: string, sink: string): FlowTrace {
  const known = new Set(model.vertices.map((vertex) => vertex.id));
  if (!known.has(source) || !known.has(sink) || source === sink) return [];
  const flow = new Map<string, number>();
  const trace: FlowTrace = [];
  let total = 0;
  for (let round = 0; round < MAX_AUGMENTS; round += 1) {
    const { graph, arcs } = residualModel(model, flow);
    const { found, reached } = pathTo(graph, arcs, pathSearch, source, sink);
    if (!found) {
      const cut = model.edges.filter((edge) => reached.has(edge.from) && !reached.has(edge.to)).map((edge) => edge.id);
      trace.push({ type: 'cut', sourceSide: [...reached], edges: cut, value: total });
      return trace;
    }
    const pushed = Math.min(...found.arcs.map((arc) => arc.residual));
    found.arcs.forEach((arc) => flow.set(arc.edge, (flow.get(arc.edge) ?? 0) + (arc.forward ? pushed : -pushed)));
    total += pushed;
    trace.push({ type: 'augment', vertices: found.vertices, edges: found.arcs.map((arc) => arc.edge), pushed, total, flows: Object.fromEntries(flow) });
  }
  return trace;
}
