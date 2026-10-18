import type { BuilderBlock, VisualElementSpec, VisualSpec } from '../types/visualSpec';
import { algorithmText } from './domains/algorithmText';
import { addBlock } from './blocks';
import { childrenOf } from './builderEdits';
import { addBuilderStep, setStepFields } from './builderSteps';
import { applyEffect } from './effects';
import { setBlockTiming } from './laneEdits';

const block = (action: BuilderBlock['action'], target: string): BuilderBlock => ({ action, target, speed: 'normal' });

const find = (spec: VisualSpec, id: string): VisualElementSpec | undefined => spec.elements.find((el) => el.id === id);

function plainLabel(spec: VisualSpec, id: string): string {
  const text = childrenOf(spec, id).find((child) => child.kind === 'math')?.content ?? find(spec, id)?.content ?? id;
  return text.replace(/[*$\\]/g, '').trim() || id;
}

export function appendStep(spec: VisualSpec, title: string, blocks: BuilderBlock[], why = ''): VisualSpec {
  const added = addBuilderStep(spec);
  const index = added.steps.length - 1;
  const titled = setStepFields(added, index, { whatChanged: title, why, together: true });
  return blocks.reduce((current, item) => addBlock(current, index, item), titled);
}

// A link without an arrow head can be walked either way.
const linkBetween = (spec: VisualSpec, from: string, to: string): string | undefined =>
  spec.elements.find((el) => {
    const link = el.builder?.link;
    if (!link) return false;
    return (link.from === from && link.to === to) || (!link.arrow && link.from === to && link.to === from);
  })?.id;

export function addEffectAtStart(spec: VisualSpec, step: number, effect: 'travel' | 'spark', link: string): VisualSpec {
  const added = applyEffect(spec, step, effect, link);
  const lastBlock = (added.steps[step].builder?.blocks?.length ?? 1) - 1;
  return setBlockTiming(added, step, lastBlock, { at: 0 });
}

function hopBlocks(spec: VisualSpec, path: string[], index: number): BuilderBlock[] {
  const [left, entered] = [path[index - 1], path[index]];
  const taken = linkBetween(spec, left, entered) as string;
  const before = index > 1 ? linkBetween(spec, path[index - 2], left) : undefined;
  const calm = [left, before].filter((id): id is string => id !== undefined).map((id) => block('calm', id));
  return [...calm, block('highlight', taken), block('highlight', entered)];
}

function hopStep(spec: VisualSpec, path: string[], index: number, lang: string): VisualSpec {
  const [left, entered] = [path[index - 1], path[index]];
  const taken = linkBetween(spec, left, entered) as string;
  const why = algorithmText('recipeMove', lang, { from: plainLabel(spec, left), to: plainLabel(spec, entered) });
  const stepped = appendStep(spec, algorithmText('recipeGo', lang, { vertex: plainLabel(spec, entered) }), hopBlocks(spec, path, index), why);
  const last = stepped.steps.length - 1;
  return (['travel', 'spark'] as const).reduce((current, effect) => addEffectAtStart(current, last, effect, taken), stepped);
}

export function walkPath(spec: VisualSpec, path: string[], lang = 'en'): VisualSpec {
  const complete = path.length >= 2 && path.every((id) => find(spec, id)) && path.slice(1).every((id, i) => linkBetween(spec, path[i], id));
  if (!complete) return spec;
  const started = appendStep(spec, algorithmText('recipeStart', lang, { vertex: plainLabel(spec, path[0]) }), [block('highlight', path[0])]);
  return path.slice(1).reduce((current, _id, offset) => hopStep(current, path, offset + 1, lang), started);
}
