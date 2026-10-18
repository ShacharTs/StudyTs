export type EffectTone = 'fill' | 'flow' | 'zig' | 'look';

// What an animation can act on: an arrow, a closed outline (circle, diamond), a rectangle, text or a free line.
export type ObjectKind = 'arrow' | 'closed' | 'box' | 'text' | 'path';

export const OBJECT_KINDS: readonly ObjectKind[] = ['arrow', 'closed', 'box', 'text', 'path'];
