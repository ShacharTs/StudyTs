import type { VisualSpec } from '../../../types/visualSpec';
import { readPipeline } from './pipelineModel';
import { pipelineStyle, presentPipelineTrace } from './pipelinePresenter';
import type { PipelineSpec } from './pipelineSpec';
import { runPipeline } from './runPipeline';

// Reads the drawing as a pipeline, simulates it and appends the run; a drawing that is not a chain comes back unchanged.
export function runPipelineAlgorithm(spec: VisualSpec, algorithm: PipelineSpec, lang: string): VisualSpec {
  const model = readPipeline(spec);
  const trace = runPipeline(model, algorithm);
  if (trace.length === 0) return spec;
  return presentPipelineTrace({ spec, stages: model.stages, trace, tokens: algorithm.tokens, style: pipelineStyle(), lang });
}
