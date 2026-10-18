import type { VisualSpec } from '../../types/visualSpec';
import { algorithmById, flowAlgorithmById, memoryAlgorithmById, networkAlgorithmById, pipelineAlgorithmById } from './algorithmRegistry';
import { runPipelineAlgorithm } from './pipeline/runPipelineAlgorithm';
import { runMemoryAlgorithm } from './memory/runMemoryAlgorithm';
import { presentFlowTrace, flowStyle } from './flowPresenter';
import { runFlow } from './flow/runFlow';
import { readGraph, type GraphModel } from './graph/graphModel';
import { CLIENT_REF, SERVER_REF, readNetwork } from './network/networkModel';
import { networkStyle, presentRouteTrace } from './network/networkPresenter';
import { runRoute } from './network/runRoute';
import { runSearch } from './search/runSearch';
import { presentGraphTrace } from './tracePresenter';
import { DEFAULT_TRACE_STYLE, traceStyleById } from './traceStyle';

const firstByLabel = (model: GraphModel, ids: string[]): string | undefined => [...ids].sort((a, b) => model.labelOf(a).localeCompare(model.labelOf(b)))[0];

// The start is the selected vertex, else the first vertex by label.
function startOf(model: GraphModel, selectedId: string | null): string {
  const all = model.vertices.map((vertex) => vertex.id);
  return all.includes(selectedId ?? '') ? (selectedId as string) : (firstByLabel(model, all) as string);
}

// A flow runs from a vertex nothing enters (or the selected one) to a vertex nothing leaves.
function endsOf(model: GraphModel, selectedId: string | null): { source: string; sink: string } {
  const all = model.vertices.map((vertex) => vertex.id);
  const entered = new Set(model.edges.map((edge) => edge.to));
  const left = new Set(model.edges.map((edge) => edge.from));
  const source = all.includes(selectedId ?? '') ? (selectedId as string) : (firstByLabel(model, all.filter((id) => !entered.has(id))) ?? (firstByLabel(model, all) as string));
  const sink = firstByLabel(model, all.filter((id) => !left.has(id) && id !== source)) ?? (firstByLabel(model, all.filter((id) => id !== source)) as string);
  return { source, sink };
}

function runFlowAlgorithm(spec: VisualSpec, algorithmId: string, selectedId: string | null, lang: string): VisualSpec {
  const flow = flowAlgorithmById(algorithmId);
  const search = flow ? algorithmById(flow.pathSearch) : undefined;
  const model = readGraph(spec);
  if (!flow || !search || model.vertices.length < 2) return spec;
  const { source, sink } = endsOf(model, selectedId);
  const trace = runFlow(model, search, source, sink);
  return trace.length === 0 ? spec : presentFlowTrace({ spec, model, trace, source, sink, style: flowStyle(), lang });
}

// A packet goes from the selected device, else the first client, to the first server (else the last device by label).
function runNetworkAlgorithm(spec: VisualSpec, algorithmId: string, selectedId: string | null, lang: string): VisualSpec {
  const send = networkAlgorithmById(algorithmId);
  const search = send ? algorithmById(send.routeSearch) : undefined;
  const network = readNetwork(spec);
  const { graph } = network;
  if (!send || !search || graph.vertices.length < 2) return spec;
  const ids = graph.vertices.map((vertex) => vertex.id);
  const ofPack = (ref: string): string[] => ids.filter((id) => network.packOf(id) === ref);
  const from = ids.includes(selectedId ?? '') ? (selectedId as string) : (firstByLabel(graph, ofPack(CLIENT_REF)) ?? (firstByLabel(graph, ids) as string));
  const to = firstByLabel(graph, ofPack(SERVER_REF).filter((id) => id !== from)) ?? ([...ids].filter((id) => id !== from).sort((a, b) => graph.labelOf(b).localeCompare(graph.labelOf(a)))[0] as string);
  const trace = runRoute(graph, send, search, from, to);
  return trace.length === 0 ? spec : presentRouteTrace({ spec, model: graph, trace, ttl: send.ttl, style: networkStyle(), lang });
}

// Runs any algorithm a mode names on the drawing and appends the steps; an unknown id or an empty drawing leaves it alone.
export function runGraphAlgorithm(spec: VisualSpec, algorithmId: string, selectedId: string | null, lang = 'en'): VisualSpec {
  if (flowAlgorithmById(algorithmId)) return runFlowAlgorithm(spec, algorithmId, selectedId, lang);
  if (networkAlgorithmById(algorithmId)) return runNetworkAlgorithm(spec, algorithmId, selectedId, lang);
  const pipeline = pipelineAlgorithmById(algorithmId);
  if (pipeline) return runPipelineAlgorithm(spec, pipeline, lang);
  const memory = memoryAlgorithmById(algorithmId);
  const memorySearch = algorithmById('graph/bfs');
  if (memory && memorySearch) return runMemoryAlgorithm(spec, memory, memorySearch, selectedId, lang);
  const search = algorithmById(algorithmId);
  const style = traceStyleById(DEFAULT_TRACE_STYLE);
  const model = readGraph(spec);
  if (!search || !style || model.vertices.length === 0) return spec;
  const trace = runSearch(model, search, startOf(model, selectedId));
  return trace.length === 0 ? spec : presentGraphTrace({ spec, model, trace, search, style, lang });
}
