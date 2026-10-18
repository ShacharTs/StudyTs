import type { VisualElementSpec, VisualSpec } from '../../../types/visualSpec';
import { isOwner } from '../../builderEdits';
import { readGraph, type GraphModel, type Neighbour } from '../graph/graphModel';

export const STACK_CELL_PACK = 'memory/stack-cell';
export const NULL_CELL_PACK = 'memory/null-cell';
export const HEAP_BLOCK_PACK = 'memory/heap-block';

export interface MemoryPointer {
  id: string;
  from: string;
  to: string;
}

export interface MemoryModel {
  cells: string[];
  nulls: string[];
  blocks: string[];
  // Every link leaving a variable or block, including one that points at something that is neither; that is what 'dangling' means.
  pointers: MemoryPointer[];
  // Directed: a pointer only leads from its owner to its target, never back.
  graph: GraphModel;
}

const packOf = (el: VisualElementSpec): string | undefined => el.builder?.pack;

const isMemoryObject = (el: VisualElementSpec): boolean =>
  isOwner(el) && el.builder?.fx !== true && [STACK_CELL_PACK, NULL_CELL_PACK, HEAP_BLOCK_PACK].includes(packOf(el) ?? '');

// A pointer is a link whose owner is a variable or block; it is kept even when its target is not a memory object.
function pointersFrom(spec: VisualSpec, owners: Set<string>): MemoryPointer[] {
  return spec.elements.flatMap((el) => (el.builder?.link && owners.has(el.builder.link.from) ? [{ id: el.id, from: el.builder.link.from, to: el.builder.link.to }] : []));
}

function directed(graph: GraphModel): GraphModel {
  const neighbours = (vertex: string): Neighbour[] =>
    graph.edges.filter((edge) => edge.from === vertex).map((edge) => ({ vertex: edge.to, edge: edge.id, weight: edge.weight }));
  return { ...graph, directed: true, neighbours };
}

// Reads the drawing as memory: variables and heap blocks are the vertices, and a link out of either is a pointer.
export function readMemory(spec: VisualSpec): MemoryModel {
  const objects = spec.elements.filter(isMemoryObject);
  const idsOf = (pack: string[]): string[] => objects.filter((el) => pack.includes(packOf(el) ?? '')).map((el) => el.id);
  const cells = idsOf([STACK_CELL_PACK, NULL_CELL_PACK]);
  const nulls = idsOf([NULL_CELL_PACK]);
  const blocks = idsOf([HEAP_BLOCK_PACK]);
  const pointers = pointersFrom(spec, new Set([...cells, ...blocks]));
  return { cells, nulls, blocks, pointers, graph: directed(readGraph(spec, isMemoryObject)) };
}
