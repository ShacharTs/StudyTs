import type { VisualElementSpec } from '@core/types/visualSpec';
import type { Lifecycle } from '@core/visualBuilder/lifecycle';

const FAINT_OPACITY = 0.35;

// While editing, shapes that a later step reveals or draws stay visible, faintly.
// With a lifecycle state the step decides how faint a shape is, so the builder's hidden-until-reveal opacity is dropped.
export function editingView(el: VisualElementSpec, state?: Lifecycle): VisualElementSpec {
  const style = { ...el.style };
  if (state && el.builder?.autoHidden) delete style.opacity;
  if (typeof style.opacity === 'number' && style.opacity < FAINT_OPACITY) style.opacity = FAINT_OPACITY;
  if (el.builder?.autoDrawn) {
    delete style.strokeDasharray;
    delete style.strokeDashoffset;
  }
  return { ...el, style };
}

// The compiled say bubble is Preview-only; Build edits the caption through the inline callout input.
export const editingElements = (elements: VisualElementSpec[]): VisualElementSpec[] => elements.filter((el) => !el.builder?.say).map((el) => editingView(el));
