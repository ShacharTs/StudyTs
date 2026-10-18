import type { BuilderBlock, BuilderBlockAction, VisualElementSpec, VisualSpec, VisualStepSpec, VisualTweenSpec } from '../types/visualSpec';
import { DIMMED_OPACITY, GLOW_OFF, GLOW_ON } from './builderColors';
import { boxCenter, elementBox } from './builderGeometry';
import { flattenPath, pointsAlong } from '../geometry/pathSegments';
import { blocksOf } from './blocks';
import { overlayId, overlayIdsOfLink } from './effectOverlays';
import { sceneSpecAt } from './scene';
import { animeToTweens, packEffectByRef } from './diagramPacks/packEffectSpecs';

const SPEED_MS = { fast: 250, normal: 500, slow: 900 } as const;

const durationOf = (block: BuilderBlock): number => block.duration ?? SPEED_MS[block.speed ?? 'normal'];

// The shape plus its text label (drawing is the shape's own outline, so draw does not include labels).
export function expandTargets(spec: VisualSpec, id: string, includeChildren: boolean): string[] {
  const children = includeChildren ? spec.elements.filter((el) => el.builder?.parent === id).map((el) => el.id) : [];
  return [id, ...children];
}

function tween(targets: string[], params: Record<string, number | string>, block: BuilderBlock, at: number): VisualTweenSpec {
  return {
    targets: targets.length === 1 ? targets[0] : targets,
    params: { ...params, duration: durationOf(block), ease: 'outQuad' },
    at,
    builder: { generated: true },
  };
}

type Maker = (spec: VisualSpec, element: VisualElementSpec, block: BuilderBlock, at: number) => VisualTweenSpec[];

const withChildren = (spec: VisualSpec, element: VisualElementSpec) => expandTargets(spec, element.id, true);

const setParam = (name: string, value: number): Maker => (spec, element, block, at) => [tween(withChildren(spec, element), { [name]: value }, block, at)];
const setOpacity = (opacity: number): Maker => setParam('opacity', opacity);

const FADED_OPACITY = 0.3;
const OUTLINE_WIDTH = 4;
const SOFT_FILL_OPACITY = 0.25;
const SOFT_FILL_RISE = 0.6;
const GROW_SCALE = 1.3;
const BOUNCE_HEIGHT = 24;

// A closed shape is tinted on outline and fill, text on fill, a line on stroke only.
function tintProperties(element: VisualElementSpec): string[] {
  if (element.kind === 'text' || TEXT_SHAPES.includes(element.builder?.shape ?? '')) return ['fill'];
  return element.kind === 'path' ? ['stroke'] : ['stroke', 'fill'];
}

// Mirrors the text shapes in effects.ts; importing effects here would close an import cycle.
const TEXT_SHAPES = ['text', 'heading', 'caption', 'note'];

// Colour change is a step, not a fade: a colour token cannot be interpolated, so it switches at the block's start.
const tint: Maker = (_spec, element, block, at) => {
  if (!block.color) return [];
  const params = Object.fromEntries(tintProperties(element).map((property) => [property, block.color as string]));
  return [tween([element.id], params, { ...block, duration: 1 }, at)];
};

// Rises from a faint fill and falls from a strong one, so the change is always visible.
const soften: Maker = (_spec, element, block, at) => {
  const start = Number(element.style?.fillOpacity ?? 1);
  const target = start <= SOFT_FILL_OPACITY ? SOFT_FILL_RISE : SOFT_FILL_OPACITY;
  return [tween([element.id], { fillOpacity: target }, block, at)];
};

const emphasis = (opacity: number, filter: string): Maker => (spec, element, block, at) => {
  const children = withChildren(spec, element).slice(1);
  const own = tween([element.id], { opacity, filter }, block, at);
  return children.length > 0 ? [own, tween(children, { opacity }, block, at)] : [own];
};

// A drawn arrow's label is hidden until the draw starts, so the draw also fades it in.
const draw: Maker = (spec, element, block, at) => {
  const labelIds = element.builder?.link ? withChildren(spec, element).slice(1) : [];
  const reveal = labelIds.length > 0 ? [tween(labelIds, { opacity: 1 }, block, at)] : [];
  return [tween([element.id], { strokeDashoffset: 0 }, block, at), ...reveal];
};

// An arrow's overlays switch off with it, so a flow or token cannot outlive the line it rides.
const hide: Maker = (spec, element, block, at) => {
  const overlays = element.builder?.link ? overlayIdsOfLink(spec, element.id) : [];
  return [tween([...withChildren(spec, element), ...overlays], { opacity: 0 }, block, at)];
};

const move: Maker = (spec, element, block, at) => {
  if (!block.to) return [];
  const center = boxCenter(elementBox(element));
  const params = { translateX: Math.round(block.to.x - center.x), translateY: Math.round(block.to.y - center.y) };
  return [tween(withChildren(spec, element), params, block, at)];
};

// Up and back down in two halves, like pulse; the label rides with its shape.
const bounce: Maker = (spec, element, block, at) => {
  const half = Math.round(durationOf(block) / 2);
  const targets = withChildren(spec, element);
  return [tween(targets, { translateY: -BOUNCE_HEIGHT }, { ...block, duration: half }, at), tween(targets, { translateY: 0 }, { ...block, duration: half }, at + half)];
};

// The player types the text in: the marker param tells it to animate the letters, not a number.
const typeIn: Maker = (_spec, element, block, at) => [tween([element.id], { typeText: 1 }, block, at)];

const fill: Maker = (_spec, element, block, at) => [tween([element.id], { fillOpacity: 0.9 }, block, at)];

function pulse(_spec: VisualSpec, element: VisualElementSpec, block: BuilderBlock, at: number): VisualTweenSpec[] {
  const half = Math.round(durationOf(block) / 2);
  return [tween([element.id], { scale: 1.2 }, { ...block, duration: half }, at), tween([element.id], { scale: 1 }, { ...block, duration: half }, at + half)];
}

const overlayEffect = (params: Record<string, number | string>): Maker => (spec, element, block, at) => {
  const overlay = overlayId(block.action, element.id);
  return spec.elements.some((el) => el.id === overlay) ? [tween([overlay], params, block, at)] : [];
};

const SWEEP_GLOSS = 0.55;
const SWEEP_FADE_MS = 120;

// The bar jumps back to the left edge, becomes visible, crosses the shape, then fades.
function sweep(spec: VisualSpec, element: VisualElementSpec, block: BuilderBlock, at: number): VisualTweenSpec[] {
  const bar = spec.elements.find((el) => el.id === overlayId('sweep', element.id));
  if (!bar) return [];
  const id = bar.id;
  const distance = Math.round(elementBox(element).w - Number(bar.attrs.width));
  const instant = { ...block, duration: 1 };
  return [
    tween([id], { opacity: SWEEP_GLOSS, translateX: 0 }, instant, at),
    tween([id], { translateX: distance }, block, at + 1),
    tween([id], { opacity: 0 }, { ...block, duration: SWEEP_FADE_MS }, at + durationOf(block)),
  ];
}

const TRAVEL_STEPS = 10;

function travel(spec: VisualSpec, element: VisualElementSpec, block: BuilderBlock, at: number): VisualTweenSpec[] {
  const tokenId = overlayId('travel', element.id);
  const token = spec.elements.find((el) => el.id === tokenId);
  const [shaft] = flattenPath(String(element.attrs.d ?? ''));
  if (!token || !shaft) return [];
  const slice = Math.max(1, Math.round(durationOf(block) / TRAVEL_STEPS));
  const base = { x: Number(token.attrs.cx), y: Number(token.attrs.cy) };
  const show = tween([tokenId], { opacity: 1 }, { ...block, duration: 1 }, at);
  const moves = pointsAlong(shaft, TRAVEL_STEPS).slice(1).map((stop, i) => ({
    ...tween([tokenId], {}, block, at + i * slice),
    params: { translateX: Math.round(stop.x - base.x), translateY: Math.round(stop.y - base.y), duration: slice, ease: 'linear' },
  }));
  return [show, ...moves];
}

// Reads the keyframes stored on the block; the registry is only a fallback for blocks written before they were copied.
const packEffectTween: Maker = (spec, element, block, at) => {
  const anime = block.params ?? packEffectByRef(block.effect)?.anime;
  return anime ? animeToTweens(anime, withChildren(spec, element), at, durationOf(block)) : [];
};

const MAKERS: Partial<Record<BuilderBlockAction, Maker>> = {
  show: setOpacity(1),
  hide,
  highlight: emphasis(1, GLOW_ON),
  dim: emphasis(DIMMED_OPACITY, GLOW_OFF),
  calm: emphasis(1, GLOW_OFF),
  fill,
  pulse,
  flow: overlayEffect({ opacity: 1, strokeDashoffset: -90 }),
  spark: overlayEffect({ opacity: 1, strokeDashoffset: 0 }),
  frame: overlayEffect({ opacity: 1, strokeDashoffset: -60 }),
  sweep,
  callout: overlayEffect({ opacity: 1 }),
  travel,
  draw,
  move,
  fade: setParam('opacity', FADED_OPACITY),
  tint,
  outline: setParam('strokeWidth', OUTLINE_WIDTH),
  soften,
  grow: setParam('scale', GROW_SCALE),
  bounce,
  typeIn,
  pack: packEffectTween,
};

const attrOf = (el: VisualElementSpec | undefined, name: string): number => Number(el?.attrs[name] ?? 0);

// A connector is drawn at its base route, so a moved end needs its own tween: the path and its label glide to the
// scene's rerouted geometry, which keeps the arrow glued to the shape instead of ending in empty space.
function linkFollowTweens(spec: VisualSpec, stepIndex: number, element: VisualElementSpec, block: BuilderBlock, at: number): VisualTweenSpec[] {
  if (block.action !== 'move' || stepIndex < 1) return [];
  const before = sceneSpecAt(spec, stepIndex - 1).elements;
  const after = sceneSpecAt(spec, stepIndex).elements;
  const links = after.filter((el) => el.builder?.link && (el.builder.link.from === element.id || el.builder.link.to === element.id));
  return links.flatMap((link) => {
    const previous = before.find((el) => el.id === link.id);
    if (previous?.attrs.d === link.attrs.d) return [];
    const flow = overlayId('flow', link.id);
    const flowTween = spec.elements.some((el) => el.id === flow) ? [tween([flow], { d: String(link.attrs.d).split(' M ')[0] }, block, at)] : [];
    const labels = after.filter((el) => el.builder?.parent === link.id).flatMap((label) => {
      const base = spec.elements.find((el) => el.id === label.id);
      return [tween([label.id], { translateX: Math.round(attrOf(label, 'x') - attrOf(base, 'x')), translateY: Math.round(attrOf(label, 'y') - attrOf(base, 'y')) }, block, at)];
    });
    return [tween([link.id], { d: String(link.attrs.d) }, block, at), ...flowTween, ...labels];
  });
}

function blockToTweens(spec: VisualSpec, stepIndex: number, block: BuilderBlock, at: number): VisualTweenSpec[] {
  const element = spec.elements.find((el) => el.id === block.target);
  const make = MAKERS[block.action];
  if (!element || !make) return [];
  return [...make(spec, element, block, at), ...linkFollowTweens(spec, stepIndex, element, block, at)];
}

export interface BlockTiming {
  at: number;
  duration: number;
}

interface Scheduled {
  timing: BlockTiming;
  tweens: VisualTweenSpec[];
}

// One pass over a step's blocks: where each starts, how long it runs and which tweens it makes. Both exports use it,
// so what the lanes show is what plays.
function schedule(spec: VisualSpec, step: VisualStepSpec): Scheduled[] {
  const together = step.builder?.together === true;
  const stepIndex = spec.steps.indexOf(step);
  let cursor = 0;
  return blocksOf(step).map((block) => {
    const duration = durationOf(block);
    const at = block.at ?? (together ? 0 : cursor);
    const tweens = blockToTweens(spec, stepIndex, block, at);
    // A pinned block moves the cursor too, so an animation added after edited clips follows them instead of piling up at 0.
    if (!together && tweens.length > 0) cursor = Math.max(cursor, at + Math.round(duration * 0.8));
    return { timing: { at, duration }, tweens };
  });
}

export const blockTimings = (spec: VisualSpec, step: VisualStepSpec): BlockTiming[] => schedule(spec, step).map((item) => item.timing);

export const blockTweens = (spec: VisualSpec, step: VisualStepSpec): VisualTweenSpec[] => schedule(spec, step).flatMap((item) => item.tweens);
