import type { VisualElementSpec } from '../types/visualSpec';

const TEXT_LIKE_SHAPES = ['text', 'heading', 'caption', 'note'];

// Arrows attach to real shapes; text, notes, labels, speech bubbles, effect overlays and other arrows have no ports.
export function hasPorts(el: VisualElementSpec): boolean {
  const { builder } = el;
  if (el.kind === 'text') return false;
  if (!builder) return true;
  if (builder.link !== undefined || builder.parent !== undefined || builder.say === true || builder.fx === true) return false;
  return !TEXT_LIKE_SHAPES.includes(String(builder.shape));
}
