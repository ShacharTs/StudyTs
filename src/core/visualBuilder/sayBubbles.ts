import type { VisualElementSpec, VisualSpec, VisualStepSpec, VisualTweenSpec } from '../types/visualSpec';
import { parseViewBox } from '../shared/stageSize';
import { blocksOf } from './blocks';

// The text of the step's last non-empty Say block, if any.
export function sayTextOf(step: VisualStepSpec): string | null {
  const says = blocksOf(step).filter((block) => block.action === 'say' && block.text && block.text.trim() !== '');
  return says.length > 0 ? (says[says.length - 1].text ?? null) : null;
}

const bubbleId = (index: number): string => `say-${index}`;

const generated = (targets: string, params: Record<string, number | string>, at?: number): VisualTweenSpec => ({
  targets,
  params,
  ...(at === undefined ? {} : { at }),
  builder: { generated: true },
});

export interface SayResult {
  spec: VisualSpec;
  tweensByStep: VisualTweenSpec[][];
}

function bubbleElement(index: number, text: string, size: { w: number; h: number }): VisualElementSpec {
  return {
    id: bubbleId(index),
    kind: 'bubble',
    attrs: { x: 40, y: size.h - 108, width: size.w - 80, height: 96 },
    style: { opacity: index === 0 ? 1 : 0, '--bubble-color': 'var(--accent)' },
    content: text,
    builder: { say: true },
  };
}

// The old bubble is fully gone (250ms) before the new one starts, so captions never overlap. The one wanted now fades in (the first step starts with its bubble shown).
function fadeTweens(index: number, visible: string | null, wanted: string | null): VisualTweenSpec[] {
  const tweens: VisualTweenSpec[] = [];
  if (visible && visible !== wanted) tweens.push(generated(visible, { opacity: 0, duration: 250, ease: 'outQuad' }));
  if (wanted && wanted !== visible && index > 0) tweens.push(generated(wanted, { opacity: 1, duration: 450, ease: 'outCubic' }, 250));
  return tweens;
}

// Rebuilds every speech bubble from the steps' Say text, plus the tweens that fade the previous one out and the next in.
export function rebuildSayBubbles(spec: VisualSpec): SayResult {
  const size = parseViewBox(spec.viewBox);
  const texts = spec.steps.map(sayTextOf);
  const wantedIds = texts.map((text, index) => (text ? bubbleId(index) : null));
  const bubbles = texts.flatMap((text, index) => (text ? [bubbleElement(index, text, size)] : []));
  const tweensByStep = wantedIds.map((wanted, index) => fadeTweens(index, wantedIds[index - 1] ?? null, wanted));
  return { spec: { ...spec, elements: [...spec.elements.filter((el) => !el.builder?.say), ...bubbles] }, tweensByStep };
}
