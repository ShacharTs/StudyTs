import type { VisualSpec } from '../../../types/visualSpec';
import { isOwner } from '../../builderEdits';
import { readGraph, type GraphModel, type GraphVertex } from '../graph/graphModel';

export interface PipelineStage {
  id: string;
  label: string;
  capacity: number;
}

export interface PipelineModel {
  stages: PipelineStage[];
  ok: boolean;
}

const STAGE_SHAPES: readonly string[] = ['rounded', 'box'];
// The pipeline template's captions are pack objects too, so pack objects are stages only when they are not captions.
const CAPTION_PACK = 'caption';
const CAPACITY_SUFFIX = /\s+x(\d+)\s*$/i;

const isStage = (el: VisualSpec['elements'][number]): boolean => {
  if (!isOwner(el) || el.builder?.fx === true || el.builder?.say === true) return false;
  const pack = el.builder?.pack;
  return pack !== undefined ? !pack.includes(CAPTION_PACK) : STAGE_SHAPES.includes(el.builder?.shape ?? '');
};

function stageOf(vertex: GraphVertex): PipelineStage {
  const match = CAPACITY_SUFFIX.exec(vertex.label);
  return { id: vertex.id, label: vertex.label.replace(CAPACITY_SUFFIX, ''), capacity: Math.max(1, Number(match?.[1] ?? 1)) };
}

// Walks from the one stage nothing enters, following each link; any branch, merge, cycle or loose stage makes it not a chain.
function chainOrder(graph: GraphModel): { order: string[]; ok: boolean } {
  const inbound = (vertex: string) => graph.edges.filter((edge) => edge.to === vertex).length;
  const outbound = (vertex: string) => graph.edges.filter((edge) => edge.from === vertex).length;
  const starts = graph.vertices.filter((vertex) => inbound(vertex.id) === 0);
  const branched = graph.vertices.some((vertex) => inbound(vertex.id) > 1 || outbound(vertex.id) > 1);
  const order: string[] = [];
  let current: string | undefined = starts.length === 1 ? starts[0].id : undefined;
  while (current !== undefined && !order.includes(current)) {
    order.push(current);
    const link = graph.edges.find((edge) => edge.from === current);
    current = link?.to;
  }
  return { order, ok: !branched && starts.length === 1 && order.length === graph.vertices.length };
}

// Reads the drawing as a pipeline: stages in chain order, each with the capacity written as "x2" after its name.
export function readPipeline(spec: VisualSpec): PipelineModel {
  const graph = readGraph(spec, isStage);
  const { order, ok } = chainOrder(graph);
  const byId = new Map(graph.vertices.map((vertex) => [vertex.id, vertex]));
  const stages = order.map((id) => stageOf(byId.get(id)!));
  return { stages, ok: ok && stages.length > 0 };
}
