import type { VisualSpec } from './visualSpec';

// Element ids drawn at a step, from the declared enter and exit lists alone; no timeline or DOM involved.
export function stateAtStep(spec: VisualSpec, index: number): Set<string> {
  const declared = new Set(spec.steps.flatMap((step) => step.enter ?? []));
  const present = new Set(spec.elements.map((element) => element.id).filter((id) => !declared.has(id)));
  for (const step of spec.steps.slice(0, Math.max(0, index) + 1)) {
    for (const id of step.enter ?? []) present.add(id);
    for (const id of step.exit ?? []) present.delete(id);
  }
  return present;
}
