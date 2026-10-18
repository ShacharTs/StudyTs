import type { VisualSpec } from '../../../types/visualSpec';
import type { GraphModel } from '../graph/graphModel';
import type { SearchSpec } from '../search/searchSpec';
import type { MemorySpec } from './memorySpec';
import { readMemory, type MemoryModel } from './memoryModel';
import { memoryStyle, presentChaseTrace, presentLeakTrace } from './memoryPresenter';
import { runChase, runLeaks } from './runMemory';

// The chase starts at the selected variable, else the first variable by label.
function chaseStart(model: MemoryModel, graph: GraphModel, selectedId: string | null): string {
  if (model.cells.includes(selectedId ?? '')) return selectedId as string;
  return [...model.cells].sort((a, b) => graph.labelOf(a).localeCompare(graph.labelOf(b)))[0];
}

// Runs a memory analysis on the drawing and appends its steps; a drawing with no variable is returned as it is.
export function runMemoryAlgorithm(spec: VisualSpec, memorySpec: MemorySpec, searchSpec: SearchSpec, selectedId: string | null, lang = 'en'): VisualSpec {
  const model = readMemory(spec);
  if (model.cells.length === 0) return spec;
  const input = { spec, graph: model.graph, style: memoryStyle(), lang };
  if (memorySpec.mode === 'leaks') return presentLeakTrace(input, runLeaks(model, searchSpec));
  return presentChaseTrace(input, runChase(model, chaseStart(model, model.graph, selectedId)));
}
