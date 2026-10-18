import type { VisualElementSpec, VisualSpec } from '../../types/visualSpec';

// The text a shape shows: its label child when it has one, else its own content, without the math markers.
export function shapeText(spec: VisualSpec, el: VisualElementSpec): string {
  const label = spec.elements.find((child) => child.builder?.parent === el.id && child.kind === 'math');
  return (label?.content ?? el.content ?? '').replace(/[$\\]/g, '');
}
