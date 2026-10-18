import type { VisualSpec } from '../types/visualSpec';
import { nextId } from './builderIds';

const inRange = (spec: VisualSpec, index: number): boolean => Number.isInteger(index) && index >= 0 && index < spec.steps.length;

export const clampStepIndex = (spec: VisualSpec, index: number): number => Math.max(0, Math.min(index, spec.steps.length - 1));

export function moveStep(spec: VisualSpec, from: number, to: number): VisualSpec {
  if (from === to || !inRange(spec, from) || !inRange(spec, to)) return spec;
  const steps = [...spec.steps];
  const [moved] = steps.splice(from, 1);
  steps.splice(to, 0, moved);
  return { ...spec, steps };
}

export function duplicateStep(spec: VisualSpec, index: number): VisualSpec {
  const source = spec.steps[index];
  if (!source) return spec;
  const id = nextId('step', spec.steps.map((step) => step.id), spec.steps.length + 1);
  const copy = { ...structuredClone(source), id, whatChanged: `${source.whatChanged} copy` };
  return { ...spec, steps: [...spec.steps.slice(0, index + 1), copy, ...spec.steps.slice(index + 1)] };
}

export function removeStepAt(spec: VisualSpec, index: number): VisualSpec {
  if (spec.steps.length <= 1 || !inRange(spec, index)) return spec;
  return { ...spec, steps: spec.steps.filter((_step, position) => position !== index) };
}

export function setStepCaption(spec: VisualSpec, index: number, text: string): VisualSpec {
  const step = spec.steps[index];
  if (!step) return spec;
  const others = (step.builder?.blocks ?? []).filter((block) => block.action !== 'say');
  const blocks = text.trim() ? [...others, { action: 'say' as const, text }] : others;
  return { ...spec, steps: spec.steps.map((candidate, i) => (i === index ? { ...candidate, builder: { ...candidate.builder, blocks } } : candidate)) };
}
