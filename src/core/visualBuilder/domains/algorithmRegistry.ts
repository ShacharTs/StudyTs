import { labelOfKey } from './algorithmText';
import bfs from './algorithms/graph-bfs.json';
import dfs from './algorithms/graph-dfs.json';
import dijkstra from './algorithms/graph-dijkstra.json';
import edmondsKarp from './algorithms/graph-edmonds-karp.json';
import fordFulkerson from './algorithms/graph-ford-fulkerson.json';
import prim from './algorithms/graph-prim.json';
import { validateAutomatonSpec, type AutomatonSpec } from './automaton/automatonSpec';
import automataRun from './algorithms/automata-run.json';
import pipelineRun from './algorithms/pipeline-run.json';
import memoryChase from './algorithms/memory-chase.json';
import memoryLeaks from './algorithms/memory-leaks.json';
import networkSend from './algorithms/network-send.json';
import networkSendCost from './algorithms/network-send-cost.json';
import { validateFlowSpec, type FlowSpec } from './flow/flowSpec';
import { validateMemorySpec, type MemorySpec } from './memory/memorySpec';
import { validatePipelineSpec, type PipelineSpec } from './pipeline/pipelineSpec';
import { validateNetworkSpec, type NetworkSpec } from './network/networkSpec';
import { validateSearchSpec, type SearchSpec } from './search/searchSpec';

export class AlgorithmRegistryError extends Error {}

function load<T>(file: unknown, validate: (value: unknown) => { path: string; message: string }[]): T {
  const issues = validate(file);
  if (issues.length > 0) throw new AlgorithmRegistryError(`Algorithm spec rejected: ${issues.map((issue) => `${issue.path} ${issue.message}`).join('; ')}`);
  return file as T;
}

const SEARCHES: SearchSpec[] = [bfs, dfs, dijkstra, prim].map((file) => load<SearchSpec>(file, validateSearchSpec));
const FLOWS: FlowSpec[] = [edmondsKarp, fordFulkerson].map((file) => load<FlowSpec>(file, validateFlowSpec));
const AUTOMATA: AutomatonSpec[] = [automataRun].map((file) => load<AutomatonSpec>(file, validateAutomatonSpec));
const PIPELINES: PipelineSpec[] = [pipelineRun].map((file) => load<PipelineSpec>(file, validatePipelineSpec));
const MEMORIES: MemorySpec[] = [memoryLeaks, memoryChase].map((file) => load<MemorySpec>(file, validateMemorySpec));
const NETWORKS: NetworkSpec[] = [networkSend, networkSendCost].map((file) => load<NetworkSpec>(file, validateNetworkSpec));

// A spec may only name a search that exists, so a typo in a data file fails at load, not at the first run.
[...FLOWS.map((flow) => [flow.id, flow.pathSearch]), ...NETWORKS.map((send) => [send.id, send.routeSearch])].forEach(([id, search]) => {
  if (!SEARCHES.some((known) => known.id === search)) throw new AlgorithmRegistryError(`${id} names an unknown search ${search}`);
});

export const listAlgorithms = (): readonly SearchSpec[] => SEARCHES;
export const algorithmById = (id: string): SearchSpec | undefined => SEARCHES.find((spec) => spec.id === id);
export const listFlowAlgorithms = (): readonly FlowSpec[] => FLOWS;
export const flowAlgorithmById = (id: string): FlowSpec | undefined => FLOWS.find((spec) => spec.id === id);

export const automatonAlgorithmById = (id: string): AutomatonSpec | undefined => AUTOMATA.find((spec) => spec.id === id);

export const pipelineAlgorithmById = (id: string): PipelineSpec | undefined => PIPELINES.find((spec) => spec.id === id);
export const memoryAlgorithmById = (id: string): MemorySpec | undefined => MEMORIES.find((spec) => spec.id === id);
export const listNetworkAlgorithms = (): readonly NetworkSpec[] => NETWORKS;
export const networkAlgorithmById = (id: string): NetworkSpec | undefined => NETWORKS.find((spec) => spec.id === id);

export function algorithmLabelById(id: string) {
  const spec = algorithmById(id) ?? flowAlgorithmById(id) ?? automatonAlgorithmById(id) ?? networkAlgorithmById(id) ?? memoryAlgorithmById(id) ?? pipelineAlgorithmById(id);
  return spec ? labelOfKey(spec.label) : undefined;
}
