import { visitedIn } from '../search/pathFromTrace';
import { runSearch } from '../search/runSearch';
import type { SearchSpec } from '../search/searchSpec';
import type { MemoryModel, MemoryPointer } from './memoryModel';

export type LeakEvent =
  | { type: 'root'; cell: string }
  | { type: 'reach'; block: string; via: string[] }
  | { type: 'leak'; block: string }
  | { type: 'verdict'; leaks: string[]; reachable: string[] };

export type LeakTrace = LeakEvent[];

export type ChaseResult = 'block' | 'null' | 'cycle' | 'dangling';

export type ChaseEvent =
  | { type: 'follow'; from: string; to: string; edge: string; number: number }
  | { type: 'verdict'; result: ChaseResult; at: string };

export type ChaseTrace = ChaseEvent[];

// For each block, the variables whose pointer chain reaches it; the search spec only sets the walk order, not the answer.
function reachingCells(model: MemoryModel, search: SearchSpec): Map<string, string[]> {
  const reaching = new Map<string, string[]>(model.blocks.map((block) => [block, []]));
  for (const cell of model.cells) {
    for (const vertex of visitedIn(runSearch(model.graph, search, cell))) {
      reaching.get(vertex)?.push(cell);
    }
  }
  return reaching;
}

// Blocks no variable reaches are leaks: nothing can free them, because nothing can name them.
export function runLeaks(model: MemoryModel, search: SearchSpec): LeakTrace {
  const reaching = reachingCells(model, search);
  const reachable = model.blocks.filter((block) => (reaching.get(block) ?? []).length > 0);
  const leaks = model.blocks.filter((block) => !reachable.includes(block));
  return [
    ...model.cells.map((cell): LeakEvent => ({ type: 'root', cell })),
    ...reachable.map((block): LeakEvent => ({ type: 'reach', block, via: reaching.get(block) ?? [] })),
    ...leaks.map((block): LeakEvent => ({ type: 'leak', block })),
    { type: 'verdict', leaks, reachable },
  ];
}

// The pointer a node holds, if any; a null variable holds none even if a link was drawn from it.
function pointerOf(model: MemoryModel, at: string): MemoryPointer | undefined {
  return model.nulls.includes(at) ? undefined : model.pointers.find((pointer) => pointer.from === at);
}

// Follows one pointer at a time from the start until a node holds no pointer, a target is not memory, or a node repeats.
export function runChase(model: MemoryModel, start: string): ChaseTrace {
  const trace: ChaseTrace = [];
  const seen = new Set([start]);
  const memory = new Set([...model.cells, ...model.blocks]);
  let at = start;
  for (let number = 1; ; number += 1) {
    const pointer = pointerOf(model, at);
    if (!pointer) return [...trace, { type: 'verdict', result: model.blocks.includes(at) ? 'block' : 'null', at }];
    trace.push({ type: 'follow', from: at, to: pointer.to, edge: pointer.id, number });
    if (!memory.has(pointer.to)) return [...trace, { type: 'verdict', result: 'dangling', at: pointer.to }];
    if (seen.has(pointer.to)) return [...trace, { type: 'verdict', result: 'cycle', at: pointer.to }];
    seen.add(pointer.to);
    at = pointer.to;
  }
}
