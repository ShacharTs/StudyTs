import type { BuilderBlock, VisualElementBuilder, VisualElementSpec, VisualSpec } from '../types/visualSpec';
import { blocksOf } from './blocks';
import { blockTweens, expandTargets } from './blockTweens';
import { effectOffTweens, rebuildEffectOverlays } from './effectOverlays';
import { rebuildSayBubbles } from './sayBubbles';

function withoutKeys<T>(record: Record<string, T> | undefined, keys: string[]): Record<string, T> {
  return Object.fromEntries(Object.entries(record ?? {}).filter(([key]) => !keys.includes(key)));
}

function withoutFlag(builder: VisualElementBuilder, flag: 'autoHidden' | 'autoDrawn'): VisualElementBuilder {
  const copy = { ...builder };
  delete copy[flag];
  return copy;
}

const isAction = (block: BuilderBlock): block is BuilderBlock & { target: string } => Boolean(block.target) && block.action !== 'say';

const isArrow = (spec: VisualSpec, id: string): boolean => spec.elements.some((el) => el.id === id && el.builder?.link !== undefined);

// For each element, the first action (in step and block order) that touches it.
function firstActions(spec: VisualSpec): Map<string, string> {
  const first = new Map<string, string>();
  const blocks = spec.steps.flatMap((step) => blocksOf(step)).filter(isAction);
  for (const block of blocks) {
    const ids = expandTargets(spec, block.target, block.action !== 'draw' || isArrow(spec, block.target));
    ids.filter((id) => !first.has(id)).forEach((id) => first.set(id, block.action));
  }
  return first;
}

// A label is hidden by its parent's first action when that is a show, or a draw on an arrow.
function stageHidden(el: VisualElementSpec, first: string | undefined): VisualElementSpec {
  if (first === 'show' || (first === 'draw' && el.builder?.parent !== undefined)) return { ...el, style: { ...el.style, opacity: 0 }, builder: { ...el.builder, autoHidden: true } };
  if (!el.builder?.autoHidden) return el;
  return { ...el, style: withoutKeys(el.style, ['opacity']), builder: withoutFlag(el.builder, 'autoHidden') };
}

function stageDrawn(el: VisualElementSpec, first: string | undefined): VisualElementSpec {
  if (first === 'draw' && !el.builder?.parent) {
    return {
      ...el,
      attrs: { ...el.attrs, pathLength: 1 },
      style: { ...el.style, strokeDasharray: 1, strokeDashoffset: 1 },
      builder: { ...el.builder, autoDrawn: true },
    };
  }
  if (!el.builder?.autoDrawn) return el;
  const style = withoutKeys(el.style, ['strokeDasharray', 'strokeDashoffset']);
  return { ...el, attrs: withoutKeys(el.attrs, ['pathLength']), style, builder: withoutFlag(el.builder, 'autoDrawn') };
}

const stageElement = (el: VisualElementSpec, first: string | undefined): VisualElementSpec => stageDrawn(stageHidden(el, first), first);

/**
 * Brings a spec edited with blocks into its playable form: shapes revealed later start hidden, shapes drawn in start
 * undrawn, speech bubbles match the Say text, and every step's generated tweens are rebuilt from its blocks. Tweens
 * made by hand (not generated) are kept untouched.
 */
export function finalizeBuilderSpec(spec: VisualSpec): VisualSpec {
  const first = firstActions(spec);
  const staged: VisualSpec = { ...spec, elements: spec.elements.map((el) => (el.builder?.say ? el : stageElement(el, first.get(el.id)))) };
  const { spec: withBubbles, tweensByStep } = rebuildSayBubbles(rebuildEffectOverlays(staged));
  const validIds = new Set(withBubbles.elements.map((el) => el.id));
  const steps = withBubbles.steps.map((step, index) => {
    const blocks = step.builder?.blocks;
    const cleanStep = blocks && blocks.some((b) => b.target && !validIds.has(b.target))
      ? { ...step, builder: { ...step.builder, blocks: blocks.filter((b) => !b.target || validIds.has(b.target)) } }
      : step;
    return {
      ...cleanStep,
      tweens: [...cleanStep.tweens.filter((tween) => !tween.builder?.generated), ...blockTweens(withBubbles, cleanStep), ...tweensByStep[index], ...effectOffTweens(withBubbles, index)],
    };
  });
  return { ...withBubbles, steps };
}
