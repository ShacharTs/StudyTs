import type { VisualSpec, VisualStepSpec } from '../types/visualSpec';
import { nextId } from './builderIds';

// Appends a step that starts with an empty block list.
export function addBuilderStep(spec: VisualSpec): VisualSpec {
  const id = nextId('step', spec.steps.map((step) => step.id), spec.steps.length + 1);
  const step: VisualStepSpec = { id, whatChanged: `Step ${spec.steps.length + 1}`, why: '', tweens: [], builder: { blocks: [] } };
  return { ...spec, steps: [...spec.steps, step] };
}

export interface StepFields {
  whatChanged?: string;
  why?: string;
  together?: boolean;
}

export function setStepFields(spec: VisualSpec, index: number, fields: StepFields): VisualSpec {
  if (!spec.steps[index]) return spec;
  const steps = spec.steps.map((step, i) => {
    if (i !== index) return step;
    const { together, ...text } = fields;
    return { ...step, ...text, ...(together === undefined ? {} : { builder: { ...step.builder, together } }) };
  });
  return { ...spec, steps };
}
