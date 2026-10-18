import type { BuilderBlock, BuilderShape, VisualElementKind, VisualElementSpec, VisualSpec } from '../types/visualSpec';
import { addBlock } from './blocks';
import { boxCenter, elementBox } from './builderGeometry';
import { nextStart } from './laneEdits';
import { OBJECT_KINDS, type EffectTone, type ObjectKind } from './objectKinds';
import { packEffects } from './diagramPacks/packEffectSpecs';
import { packObjectByRef } from './diagramPacks/stylePackRegistry';
import type { EffectSpec } from './effectSpec';

export type EffectId = string;

const CORE = 'core';

// Lives in objectKinds.ts so the pack validators can read it without importing this file (the registry is imported here).
export { OBJECT_KINDS, type EffectTone, type ObjectKind } from './objectKinds';

export type { EffectDefaults, EffectSpec } from './effectSpec';
export type EffectDef = EffectSpec;

// Dropping straight down keeps the default destination off the lines that run across a row of shapes.
const moveDestination = (element: VisualElementSpec, dy: number): Partial<BuilderBlock> => {
  const centre = boxCenter(elementBox(element));
  return { to: { x: Math.round(centre.x), y: Math.round(centre.y + dy) } };
};

export const CORE_EFFECTS: EffectSpec[] = [
  { id: 'fill', label: 'Fill', action: 'fill', kinds: ['closed', 'box'], duration: 900, description: 'The shape fills with colour.', icon: '◐', tone: 'fill', source: CORE },
  { id: 'reveal', label: 'Reveal', action: 'show', kinds: OBJECT_KINDS, duration: 500, description: 'The shape fades in.', icon: '◌', tone: 'look', source: CORE },
  { id: 'remove', label: 'Remove', action: 'hide', kinds: OBJECT_KINDS, duration: 500, description: 'The shape fades out and stays gone.', icon: '◍', tone: 'look', source: CORE },
  { id: 'draw', label: 'Draw in', action: 'draw', kinds: ['arrow', 'path'], duration: 700, description: 'The arrow draws from start to end.', icon: '╱', tone: 'fill', source: CORE },
  { id: 'travel', label: 'Travel', action: 'travel', kinds: ['arrow', 'path'], duration: 900, description: 'A token rides along the arrow.', icon: '●', tone: 'zig', source: CORE },
  { id: 'flow', label: 'Flow', action: 'flow', kinds: ['arrow', 'path'], duration: 1200, description: 'Dashes stream along the arrow.', icon: '⇢', tone: 'flow', source: CORE },
  { id: 'spark', label: 'Zigzag', action: 'spark', kinds: ['arrow', 'path'], duration: 800, description: 'A zigzag spark runs along the arrow.', icon: 'ϟ', tone: 'zig', source: CORE },
  { id: 'frame', label: 'Zigzag outline', action: 'frame', kinds: ['box'], duration: 600, description: 'A marching dashed frame, like the swap marker.', icon: '▨', tone: 'zig', source: CORE },
  { id: 'pulse', label: 'Pulse', action: 'pulse', kinds: ['closed', 'box', 'text'], duration: 600, description: 'The shape swells and settles.', icon: '◎', tone: 'look', source: CORE },
  { id: 'glow', label: 'Glow', action: 'highlight', kinds: OBJECT_KINDS, duration: 400, description: 'Glows until the step ends or you calm it down.', icon: '✺', tone: 'look', source: CORE },
  { id: 'sweep', label: 'Highlight sweep', action: 'sweep', kinds: ['closed', 'box'], duration: 700, description: 'A bar of light crosses the shape from left to right.', icon: '▶', tone: 'look', source: CORE },
  { id: 'callout', label: 'Callout', action: 'callout', kinds: OBJECT_KINDS, duration: 400, description: 'A short note appears beside the shape for the step.', icon: '✎', tone: 'look', defaults: { text: 'Look here' }, source: CORE },
  { id: 'fade', label: 'Fade', action: 'fade', kinds: OBJECT_KINDS, duration: 500, description: 'The object dims to make the rest stand out.', icon: '◔', tone: 'look', source: CORE },
  { id: 'tint', label: 'Colour change', action: 'tint', kinds: OBJECT_KINDS, duration: 400, description: 'The object switches to another colour.', icon: '◉', tone: 'look', defaults: { color: 'var(--viz-orange)' }, source: CORE },
  { id: 'outline', label: 'Emphasise outline', action: 'outline', kinds: ['arrow', 'closed', 'box', 'path'], duration: 400, description: 'The outline thickens.', icon: '▢', tone: 'look', source: CORE },
  { id: 'soften', label: 'Soft highlight', action: 'soften', kinds: ['closed', 'box'], duration: 500, description: 'The fill brightens softly.', icon: '◖', tone: 'look', source: CORE },
  { id: 'move', label: 'Move', action: 'move', kinds: ['closed', 'box', 'text'], duration: 900, description: 'The object slides to a new spot.', icon: '➜', tone: 'look', defaults: { moveDy: 120 }, source: CORE },
  { id: 'grow', label: 'Grow or shrink', action: 'grow', kinds: ['closed', 'box'], duration: 500, description: 'The object grows to a larger size.', icon: '⤢', tone: 'look', source: CORE },
  { id: 'bounce', label: 'Bounce', action: 'bounce', kinds: ['closed', 'box', 'text'], duration: 600, description: 'The object hops up and settles back.', icon: '⤒', tone: 'look', source: CORE },
  { id: 'typeIn', label: 'Type in', action: 'typeIn', kinds: ['text'], duration: 800, description: 'The words appear one letter at a time.', icon: 'T|', tone: 'look', source: CORE },
];

export const EFFECTS: EffectSpec[] = [...CORE_EFFECTS, ...packEffects()];

const SHAPE_KIND: Record<Exclude<BuilderShape, 'pack'>, ObjectKind> = {
  circle: 'closed', ellipse: 'closed', diamond: 'closed', triangle: 'closed', pointer: 'closed',
  box: 'box', rounded: 'box',
  line: 'path', arrow: 'path',
  text: 'text', heading: 'text', caption: 'text', note: 'text',
};

// Elements without a builder shape (lecture data) are classed by their SVG kind.
const SVG_KIND: Record<VisualElementKind, ObjectKind> = { circle: 'closed', ellipse: 'closed', rect: 'box', path: 'path', text: 'text', math: 'text', bubble: 'text' };

export function objectKindOf(element: VisualElementSpec): ObjectKind {
  const { link, shape, pack } = element.builder ?? {};
  if (link) return 'arrow';
  if (shape === 'pack') return packObjectByRef(pack)?.kind ?? SVG_KIND[element.kind];
  return (shape && SHAPE_KIND[shape]) || SVG_KIND[element.kind];
}

// An empty or missing allow-list keeps every effect (the Free mode).
export const effectsFor = (kind: ObjectKind, allowedIds: readonly string[] = []): EffectSpec[] =>
  EFFECTS.filter((effect) => effect.kinds.includes(kind) && (allowedIds.length === 0 || allowedIds.includes(effect.id)));

const KIND_PLURAL: Record<ObjectKind, string> = { arrow: 'arrows', closed: 'shapes', box: 'boxes', text: 'text', path: 'lines' };

// Names the objects an effect fits, for gallery cards and pick hints.
export function kindsWord(kinds: readonly ObjectKind[]): string {
  if (kinds.length === OBJECT_KINDS.length) return 'any object';
  return kinds.map((kind) => KIND_PLURAL[kind]).join(' or ');
}

export const effectOf = (id: EffectId): EffectSpec => EFFECTS.find((effect) => effect.id === id) as EffectSpec;

export const effectLabel = (id: string): string => EFFECTS.find((effect) => effect.id === id)?.label ?? id.charAt(0).toUpperCase() + id.slice(1);

export function applyEffect(spec: VisualSpec, stepIndex: number, id: EffectId, target: string): VisualSpec {
  const effect = EFFECTS.find((candidate) => candidate.id === id);
  const element = spec.elements.find((el) => el.id === target);
  if (!effect || !spec.steps[stepIndex] || !element || !effect.kinds.includes(objectKindOf(element))) return spec;
  return addBlock(spec, stepIndex, { action: effect.action, target, at: nextStart(spec, stepIndex), duration: effect.duration, ...blockFields(effect, element) });
}

// A pack block copies its keyframes so playback never depends on the registry.
function blockFields(effect: EffectSpec, element: VisualElementSpec): Partial<BuilderBlock> {
  const { text, color, moveDy } = effect.defaults ?? {};
  return {
    ...(text ? { text } : {}),
    ...(color ? { color } : {}),
    ...(moveDy ? moveDestination(element, moveDy) : {}),
    ...(effect.action === 'pack' ? { effect: effect.id, params: { ...effect.anime } } : {}),
  };
}

export interface LaneLook {
  label: string;
  icon: string;
  tone: EffectTone;
}

const capitalised = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

const effectOfLane = (action: string, effectId?: string): EffectSpec | undefined =>
  EFFECTS.find((candidate) => (action === 'pack' ? candidate.id === effectId : candidate.action === action));

// The id of the effect a lane clip plays, so a caller can name it in its own language.
export const laneEffectId = (action: string, effectId?: string): string | undefined => effectOfLane(action, effectId)?.id;

export function laneLook(action: string, effectId?: string): LaneLook {
  const effect = effectOfLane(action, effectId);
  if (effect) return { label: effect.label, icon: effect.icon, tone: effect.tone };
  return { label: capitalised(action), icon: '•', tone: 'look' };
}
