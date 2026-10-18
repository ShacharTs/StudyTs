import { VISUAL_ID_ATTRIBUTE } from './buildStepTimeline';
import { stateAtStep } from './stateAtStep';
import type { VisualSpec } from './visualSpec';

// Presence comes from the declared step state, so a seek or a scrub can never leave an element in the wrong state.
export function applyStepPresence(root: Element, spec: VisualSpec, index: number): void {
  const present = stateAtStep(spec, index);
  for (const element of spec.elements) {
    const node = root.querySelector<SVGElement>(`[${VISUAL_ID_ATTRIBUTE}="${element.id}"]`);
    if (node) node.style.display = present.has(element.id) ? '' : 'none';
  }
}
