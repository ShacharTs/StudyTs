import type { BuilderBlock, BuilderBlockAction, VisualSpec, VisualStepSpec } from '../types/visualSpec';

export interface BlockDef {
  action: BuilderBlockAction;
  label: string;
  category: 'looks' | 'motion' | 'pen' | 'say' | 'fx';
  // Theme token for the block colour, as in Scratch categories.
  color: string;
  needsTarget: boolean;
}

export const BLOCK_DEFS: BlockDef[] = [
  { action: 'show', label: 'show', category: 'looks', color: 'var(--viz-purple)', needsTarget: true },
  { action: 'hide', label: 'hide', category: 'looks', color: 'var(--viz-purple)', needsTarget: true },
  { action: 'highlight', label: 'highlight', category: 'looks', color: 'var(--viz-purple)', needsTarget: true },
  { action: 'dim', label: 'dim', category: 'looks', color: 'var(--viz-purple)', needsTarget: true },
  { action: 'calm', label: 'calm down', category: 'looks', color: 'var(--viz-purple)', needsTarget: true },
  { action: 'fill', label: 'fill', category: 'fx', color: 'var(--accent-green)', needsTarget: true },
  { action: 'pulse', label: 'pulse', category: 'fx', color: 'var(--viz-purple)', needsTarget: true },
  { action: 'flow', label: 'flow', category: 'fx', color: 'var(--viz-blue)', needsTarget: true },
  { action: 'spark', label: 'zigzag', category: 'fx', color: 'var(--viz-orange)', needsTarget: true },
  { action: 'frame', label: 'outline', category: 'fx', color: 'var(--viz-orange)', needsTarget: true },
  { action: 'sweep', label: 'sweep', category: 'fx', color: 'var(--viz-blue)', needsTarget: true },
  { action: 'callout', label: 'callout', category: 'fx', color: 'var(--viz-orange)', needsTarget: true },
  { action: 'fade', label: 'fade', category: 'fx', color: 'var(--viz-purple)', needsTarget: true },
  { action: 'tint', label: 'colour', category: 'fx', color: 'var(--viz-orange)', needsTarget: true },
  { action: 'outline', label: 'emphasise', category: 'fx', color: 'var(--viz-blue)', needsTarget: true },
  { action: 'soften', label: 'soft light', category: 'fx', color: 'var(--viz-blue)', needsTarget: true },
  { action: 'grow', label: 'grow', category: 'fx', color: 'var(--viz-purple)', needsTarget: true },
  { action: 'bounce', label: 'bounce', category: 'fx', color: 'var(--viz-orange)', needsTarget: true },
  { action: 'typeIn', label: 'type in', category: 'fx', color: 'var(--viz-blue)', needsTarget: true },
  { action: 'draw', label: 'draw in', category: 'pen', color: 'var(--accent-green)', needsTarget: true },
  { action: 'travel', label: 'travel', category: 'motion', color: 'var(--viz-blue)', needsTarget: true },
  { action: 'move', label: 'move to', category: 'motion', color: 'var(--viz-blue)', needsTarget: true },
  { action: 'say', label: 'say', category: 'say', color: 'var(--viz-orange)', needsTarget: false },
];

// Not in BLOCK_DEFS: the palette lists what a user can add by hand, and a pack block only comes from the Animate gallery.
export const blocksOf = (step: VisualStepSpec): BuilderBlock[] => step.builder?.blocks ?? [];

export function defaultBlock(action: BuilderBlockAction, target?: string): BuilderBlock {
  if (action === 'say') return { action, text: '**Title** — explain what happens here.' };
  return { action, target, speed: 'normal' };
}

function withBlocks(spec: VisualSpec, stepIndex: number, change: (blocks: BuilderBlock[]) => BuilderBlock[]): VisualSpec {
  if (!spec.steps[stepIndex]) return spec;
  const steps = spec.steps.map((step, index) => (index === stepIndex ? { ...step, builder: { ...step.builder, blocks: change(blocksOf(step)) } } : step));
  return { ...spec, steps };
}

export const addBlock = (spec: VisualSpec, stepIndex: number, block: BuilderBlock): VisualSpec =>
  withBlocks(spec, stepIndex, (blocks) => [...blocks, block]);

export const updateBlock = (spec: VisualSpec, stepIndex: number, blockIndex: number, patch: Partial<BuilderBlock>): VisualSpec =>
  withBlocks(spec, stepIndex, (blocks) => blocks.map((block, index) => (index === blockIndex ? { ...block, ...patch } : block)));

export const removeBlock = (spec: VisualSpec, stepIndex: number, blockIndex: number): VisualSpec =>
  withBlocks(spec, stepIndex, (blocks) => blocks.filter((_block, index) => index !== blockIndex));

export function moveBlock(spec: VisualSpec, stepIndex: number, from: number, to: number): VisualSpec {
  return withBlocks(spec, stepIndex, (blocks) => {
    if (from < 0 || from >= blocks.length || to < 0 || to >= blocks.length) return blocks;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  });
}
