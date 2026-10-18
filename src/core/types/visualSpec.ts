export const VISUAL_ELEMENT_KINDS = ['ellipse', 'circle', 'rect', 'path', 'text', 'math', 'bubble'] as const;

export type VisualElementKind = (typeof VISUAL_ELEMENT_KINDS)[number];

// Shapes the builder can place. The player never reads this; it only guides what the builder writes.
export type BuilderShape =
  | 'circle' | 'ellipse' | 'box' | 'rounded' | 'diamond' | 'triangle' | 'pointer'
  | 'line' | 'arrow' | 'text' | 'heading' | 'caption' | 'note' | 'pack';

export type BuilderSide = 'n' | 'e' | 's' | 'w';

export type LinkRoute = 'straight' | 'elbow' | 'curve';

// Editor-only data on an element. The player and the validator ignore it.
export interface VisualElementBuilder {
  shape?: BuilderShape;
  // '<packId>/<objectId>' of the style-pack object this element is the main part of; set with shape 'pack'.
  pack?: string;
  // A short human name shown in animation lists and the edit popover; the id stays the technical handle.
  name?: string;
  // Bounding box for shapes drawn as paths (diamond, triangle, free lines).
  box?: { x: number; y: number; w: number; h: number };
  // A free line runs bottom-left to top-right instead of top-left to bottom-right.
  flip?: boolean;
  // Group identifier for compound objects (e.g. tape-<n>) that move, delete, duplicate together.
  group?: string;
  // An element that belongs to another (a node's text label); it moves and resizes with its parent.
  parent?: string;
  // A connector between two elements; its path is recomputed when either moves.
  link?: { from: string; to: string; arrow: boolean; route?: LinkRoute; fromPort?: BuilderSide; toPort?: BuilderSide; bend?: number; labelStart?: string; labelEnd?: string; head?: 'solid' | 'open' | 'notched' };
  // Generated from a step's Say block; never edited by hand.
  say?: boolean;
  // Set when the builder hid this element at the start because a Show block reveals it later.
  autoHidden?: boolean;
  // Set when the builder prepared this element to be drawn in by a Draw block.
  autoDrawn?: boolean;
  // An overlay or token made for an animation effect; rebuilt from the blocks on every edit, never edited by hand.
  fx?: true;
}

export interface VisualElementSpec {
  id: string;
  kind: VisualElementKind;
  attrs: Record<string, number | string>;
  style?: Record<string, number | string>;
  content?: string;
  builder?: VisualElementBuilder;
}

export type BuilderBlockAction = 'show' | 'hide' | 'highlight' | 'dim' | 'draw' | 'move' | 'say' | 'calm' | 'fill' | 'pulse' | 'flow' | 'spark' | 'frame' | 'travel' | 'sweep' | 'callout' | 'fade' | 'tint' | 'outline' | 'soften' | 'grow' | 'bounce' | 'typeIn' | 'pack';

// Keyframes a pack effect tweens, copied into the block at insert so playback never reads the pack registry.
export interface BuilderBlockParams {
  translateX?: number[];
  translateY?: number[];
  rotate?: number[];
  scale?: number[];
  opacity?: number[];
  easing?: string;
}

// One Scratch-style block of a step. The builder turns the list of blocks into tweens.
export interface BuilderBlock {
  action: BuilderBlockAction;
  // Element id the block acts on (not used by Say).
  target?: string;
  speed?: 'fast' | 'normal' | 'slow';
  // Start of this block in milliseconds from the start of its step; without it the step's own rule applies.
  at?: number;
  // Length in milliseconds; wins over `speed`.
  duration?: number;
  // Destination (centre) for a Move block.
  to?: { x: number; y: number };
  // Theme token a Colour change block switches to.
  color?: string;
  // Text of a Say block.
  text?: string;
  // '<packId>/<effectId>' of the pack effect a 'pack' block plays.
  effect?: string;
  params?: BuilderBlockParams;
}

// Marks a tween the builder generated from blocks; it is replaced on every edit.
export interface VisualTweenBuilder {
  generated: true;
}

export interface VisualTweenSpec {
  targets: string | string[];
  params: Record<string, number | string>;
  at?: number;
  builder?: VisualTweenBuilder;
}

export interface VisualStepBuilder {
  blocks?: BuilderBlock[];
  // Run the blocks all at once instead of one after another.
  together?: boolean;
}

export interface VisualStepSpec {
  id: string;
  title?: string;
  whatChanged: string;
  why: string;
  concept?: string;
  activeStage?: string;
  // Elements that appear when this step starts; an element listed in no step's enter is drawn from the start.
  enter?: string[];
  // Elements removed when this step starts.
  exit?: string[];
  tweens: VisualTweenSpec[];
  builder?: VisualStepBuilder;
}

export interface VisualPipelineSpec {
  stages: Array<{ id: string; label: string; description?: string; color?: string }>;
}

export interface VisualSpec {
  specVersion?: number;
  id: string;
  viewBox: string;
  // 1 is normal; 2 plays twice as fast
  speed?: number;
  elements: VisualElementSpec[];
  steps: VisualStepSpec[];
  pipeline?: VisualPipelineSpec;
  // The storyboard this spec was compiled from; the player and the validator ignore it.
  source?: unknown;
}
