import type { VisualTweenSpec } from '../types/visualSpec';

export const STORYBOARD_NODE_SHAPES = ['circle', 'box', 'ellipse', 'label', 'note'] as const;
export const STORYBOARD_LAYOUTS = ['row', 'column', 'circle', 'grid'] as const;
export const STORYBOARD_SAY_LIMIT = 260;

export type StoryboardNodeShape = (typeof STORYBOARD_NODE_SHAPES)[number];
export type StoryboardLayout = (typeof STORYBOARD_LAYOUTS)[number];

export interface StoryboardNode {
  id: string;
  shape?: StoryboardNodeShape;
  // '<packId>/<objectId>' of a style-pack object; takes the place of `shape`.
  pack?: string;
  label?: string;
  // A colour token such as var(--viz-pink); defaults to the builder blue.
  color?: string;
  // Both or neither; nodes without a position are placed by the storyboard layout.
  x?: number;
  y?: number;
}

export interface StoryboardLink {
  from: string;
  to: string;
  // Arrow head on the `to` end; defaults to true.
  directed?: boolean;
  dashed?: boolean;
}

export interface LinkRef {
  from: string;
  to: string;
}

export type StoryboardAction =
  | { do: 'show' | 'hide' | 'highlight' | 'dim'; ids: string[] }
  | { do: 'draw'; links: LinkRef[] }
  | { do: 'move'; id: string; to: { x: number; y: number } };

export interface StoryboardStep {
  title?: string;
  why?: string;
  // Speech bubble text for this step.
  say?: string;
  // Run the actions of this step all at once (default) or one after another.
  together?: boolean;
  actions?: StoryboardAction[];
  // Escape hatch: tweens written by hand, kept as they are.
  raw?: VisualTweenSpec[];
}

export interface Storyboard {
  id: string;
  viewBox?: string;
  layout?: StoryboardLayout;
  // Bubble text shown before the first step.
  intro?: string;
  nodes: StoryboardNode[];
  links?: StoryboardLink[];
  steps: StoryboardStep[];
}
