import type { EffectTone, ObjectKind } from '../objectKinds';
import type { BuilderShape } from '../../types/visualSpec';

// The only copy of the pack contract. The validator reads these tables; a later loader or import UI reuses them.

export const PACK_FORMAT_VERSION = 1;

export const PACK_COLORS = ['blue', 'purple', 'orange', 'green', 'pink'] as const;
export type PackColor = (typeof PACK_COLORS)[number];

// A pack names a colour role; the svg never carries a colour value of its own.
export const PACK_COLOR_TOKENS: Record<PackColor, string> = {
  blue: 'var(--viz-blue)',
  purple: 'var(--viz-purple)',
  orange: 'var(--viz-orange)',
  green: 'var(--accent-green)',
  pink: 'var(--viz-pink)',
};

export const PACK_LABEL_SLOTS = ['center', 'below', 'top', 'left', 'right', 'none'] as const;
export const PACK_SECOND_LABEL_SLOTS = ['below', 'left'] as const;

export const PACK_EFFECT_TONES: readonly EffectTone[] = ['fill', 'flow', 'zig', 'look'];

export const PACK_EASINGS = ['linear', 'easeInQuad', 'easeOutQuad', 'easeInOutQuad', 'easeInOutSine'] as const;
export type PackEasing = (typeof PACK_EASINGS)[number];

// Property ranges an effect may tween; anything outside these is rejected at validation.
export const PACK_ANIME_RANGES = {
  translateX: [-400, 400],
  translateY: [-400, 400],
  rotate: [-360, 360],
  scale: [0, 4],
  opacity: [0, 1],
} as const;
export const PACK_LIMITS = {
  idChars: { min: 2, max: 40 },
  labelChars: 40,
  iconChars: 40,
  objects: { min: 1, max: 64 },
  effects: { min: 0, max: 16 },
  objectSize: [0.02, 0.95] as const,
  lines: [1, 4] as const,
  strokeWidth: [0, 8] as const,
  labelPrefixChars: 8,
  listItems: 8,
  keywordChars: 40,
  duration: [100, 5000] as const,
  animeValues: { min: 2, max: 5 },
  outlinePoints: { min: 3, max: 32 },
  anchors: { min: 0, max: 8 },
  viewUnits: [1, 1000] as const,
  svgChars: 2000,
  svgPrimitives: 12,
  svgDepth: 2,
  pathChars: 600,
  templates: { min: 0, max: 16 },
  templateObjects: { min: 1, max: 24 },
  templateLinks: { min: 0, max: 32 },
  templateSteps: { min: 1, max: 8 },
  templateEffects: { min: 0, max: 8 },
  templateKeyChars: { min: 1, max: 24 },
} as const;

// Names of the builder's colour choices; a template picks one by name so the theme still decides the value.
export const PACK_TEMPLATE_COLORS = ['blue', 'purple', 'cyan', 'green', 'yellow', 'orange', 'pink', 'red'] as const;
export const PACK_TEMPLATE_LINK_ROUTES = ['straight', 'elbow', 'curve', 'loop'] as const;
export const PACK_TEMPLATE_LINK_SIDES = ['n', 'e', 's', 'w'] as const;

// Ids of the effects built into effects.ts; a template names these bare and a pack effect as '<packId>/<effectId>'. A test keeps this list equal to CORE_EFFECTS.
export const PACK_TEMPLATE_CORE_EFFECTS: readonly string[] = [
  'fill', 'reveal', 'remove', 'draw', 'travel', 'flow', 'spark', 'frame', 'pulse', 'glow',
  'sweep', 'callout', 'fade', 'tint', 'outline', 'soften', 'move', 'grow', 'bounce', 'typeIn',
];

export const PACK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const PACK_ISSUE_CODES = [
  'bad-id',
  'duplicate-id',
  'unknown-field',
  'too-many',
  'bad-label',
  'bad-size',
  'bad-enum',
  'bad-shape',
  'bad-value',
  'bad-effect',
  'svg-syntax',
  'svg-too-big',
  'svg-tag',
  'svg-attr',
  'svg-forbidden',
  'svg-path',
  'svg-token',
  'svg-colour',
] as const;
export type PackIssueCode = (typeof PACK_ISSUE_CODES)[number];

export interface StylePackIssue {
  path: string;
  code: PackIssueCode;
  message: string;
}

export type LocalizedLabel = { en: string } & Record<string, string | undefined>;

export interface PackObjectSize {
  w: number;
  h: number;
}

export const PACK_STROKE_SCALINGS = ['fixed', 'scaled'] as const;
export type PackStrokeScaling = (typeof PACK_STROKE_SCALINGS)[number];

// Natural drawing size in the svg's own units; the host scales it to the placed box.
export interface PackView {
  w: number;
  h: number;
}

// Hit and boundary geometry in 0..1 of the placed box. A polygon's points are in the same space.
export type PackOutline = 'rect' | 'ellipse' | { polygon: [number, number][] };

// A connector port on the box: (x, y) in 0..1 of the box, (nx, ny) the outward normal.
export interface PackAnchor {
  id: string;
  x: number;
  y: number;
  nx: number;
  ny: number;
}

export const PACK_DASHES = ['none', 'dashed', 'dotted'] as const;
// Colour roles plus none; a token name, never a colour value.
export const PACK_STYLE_PAINTS = [...PACK_COLORS, 'none'] as const;

export interface PackObjectStyle {
  fill?: PackColor | 'none';
  stroke?: PackColor | 'none';
  strokeWidth?: number;
  dash?: (typeof PACK_DASHES)[number];
}

export interface PackObjectDef {
  id: string;
  label: LocalizedLabel;
  category?: string;
  size: PackObjectSize;
  kind: ObjectKind;
  color?: PackColor;
  // Template drawn around (0,0). Tokens: {w} {h} {hw} {hh} {y3a} {y3b} {x4b} {inner}.
  svg?: string;
  // Alias of an existing TS preset; a preset object is never redrawn from svg.
  preset?: BuilderShape;
  // Natural drawing size in svg units; the placed box is used when absent.
  view?: PackView;
  // 'fixed' keeps the stroke width at its set value however the box is scaled.
  strokeScaling?: PackStrokeScaling;
  outline?: PackOutline;
  anchors?: PackAnchor[];
  labelAt?: (typeof PACK_LABEL_SLOTS)[number];
  label2At?: (typeof PACK_SECOND_LABEL_SLOTS)[number];
  // Number of label slots (1 to 4), 20l.
  lines?: number;
  // Prefix drawn in the label, not in the svg (for example the guillemets of an interface), 20l.
  labelPrefix?: string;
  // Canvas ids and MCP names that resolve to this object, 20l.
  aliases?: string[];
  // Look this object starts with; it replaces the pack's base style, an svg attribute still wins.
  defaultStyle?: PackObjectStyle;
  // Arrow objects take a start and an end label, 20l F7.
  endLabels?: boolean;
  keywords?: string[];
}

export interface PackAnime {
  translateX?: number[];
  translateY?: number[];
  rotate?: number[];
  scale?: number[];
  opacity?: number[];
  easing?: PackEasing;
}

export interface PackEffectDef {
  id: string;
  label: LocalizedLabel;
  description: LocalizedLabel;
  kinds: ObjectKind[];
  duration: number;
  icon: string;
  tone: EffectTone;
  anime: PackAnime;
}

export interface PackTemplateObject {
  key: string;
  // '<packId>/<objectId>' of an object in the same pack.
  ref: string;
  // Fractions of the view width and height.
  at: { x: number; y: number };
  label?: LocalizedLabel;
  color?: (typeof PACK_TEMPLATE_COLORS)[number];
  // Fraction of the view width; narrows a caption so it can sit tight against a shape. Height stays as is.
  width?: number;
}

export interface PackTemplateLink {
  from: string;
  to: string;
  label?: LocalizedLabel;
  route?: (typeof PACK_TEMPLATE_LINK_ROUTES)[number];
  // Which side of each end the link leaves and enters; two links between one pair use opposite sides to arc apart.
  fromPort?: (typeof PACK_TEMPLATE_LINK_SIDES)[number];
  toPort?: (typeof PACK_TEMPLATE_LINK_SIDES)[number];
  // Default true; false draws a plain undirected line.
  arrow?: boolean;
}

export interface PackTemplateEffect {
  effect: string;
  // An object key, or 'fromKey->toKey' for a link.
  target: string;
}

export interface PackTemplateStep {
  caption: LocalizedLabel;
  // Keys of the objects that first appear at this step.
  show: string[];
  effects: PackTemplateEffect[];
}

export interface PackTemplateDef {
  id: string;
  name: LocalizedLabel;
  category: string;
  description: LocalizedLabel;
  objects: PackTemplateObject[];
  links: PackTemplateLink[];
  steps: PackTemplateStep[];
}

export interface StylePackFile {
  format: typeof PACK_FORMAT_VERSION;
  id: string;
  name: LocalizedLabel;
  // Id of a shipped category file; resolved by the category registry, not here.
  category: string;
  color: PackColor;
  objects: PackObjectDef[];
  effects?: PackEffectDef[];
  templates?: PackTemplateDef[];
  // Style variant id applied when an object does not name one, 20l.
  defaultStyle?: string;
}
