import { createTimeline, type AnimationParams, type Timeline } from 'animejs';
import type { VisualSpec, VisualTweenSpec } from './visualSpec';
import { morphablePathParams } from './morphablePathParams';
import { emptyStepSpecMs } from '@core/visualBuilder/emptyStepTiming';

export const VISUAL_ID_ATTRIBUTE = 'data-visual-id';

const DEFAULT_TWEEN_MS = 1000;

export interface StepTimeline {
  timeline: Timeline;
  boundaries: number[];
}

interface ScaledTween {
  at: number;
  params: AnimationParams;
}

// Scales in time, not by a playback rate, so boundaries stay exact at any speed.
function scaleTween(tween: VisualTweenSpec, factor: number): ScaledTween {
  const params = tween.params as unknown as AnimationParams;
  const at = (tween.at ?? 0) * factor;
  if (factor === 1) return { at, params };
  const duration = typeof params.duration === 'number' ? params.duration : DEFAULT_TWEEN_MS;
  const scaled: Record<string, unknown> = { ...params, duration: duration * factor };
  if (typeof params.delay === 'number') scaled.delay = params.delay * factor;
  return { at, params: scaled as AnimationParams };
}

// A tween with this marker param types its text in instead of animating a number.
const TYPE_MARKER = 'typeText';

const CSS_VAR = /^var\((--[\w-]+)\)$/;

const tokenValue = (styles: CSSStyleDeclaration, value: string): string => {
  const name = CSS_VAR.exec(value)?.[1];
  return name ? styles.getPropertyValue(name).trim() : '';
};

// The tween engine cannot interpolate var(--token) colours: a token target turns transparent and a token start value
// freezes the tween. Both ends are resolved to concrete colours up front.
function resolveColourTokens(root: Element, targets: Element[], params: AnimationParams): AnimationParams {
  const styles = getComputedStyle(root);
  const resolved: Record<string, unknown> = { ...params };
  const first = targets[0] as SVGElement | undefined;
  for (const [key, value] of Object.entries(resolved)) {
    const to = typeof value === 'string' ? tokenValue(styles, value) : '';
    if (!to) continue;
    const current = first?.style.getPropertyValue(key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)) ?? '';
    const from = CSS_VAR.test(current) ? tokenValue(styles, current) : current;
    resolved[key] = from ? [from, to] : to;
  }
  return resolved as AnimationParams;
}

// Letters appear one by one over the tween. The full text comes from the spec, so a rebuilt timeline still has it.
function addTyping(timeline: Timeline, targets: Element[], spec: VisualSpec, params: AnimationParams, at: number): void {
  const timing: Record<string, unknown> = { ...params };
  delete timing[TYPE_MARKER];
  const duration = typeof timing.duration === 'number' ? timing.duration : DEFAULT_TWEEN_MS;
  for (const el of targets) {
    const node = el.localName === 'text' ? el : (el.querySelector('text') ?? el);
    const id = el.getAttribute(VISUAL_ID_ATTRIBUTE) ?? '';
    const full = spec.elements.find((item) => item.id === id)?.content ?? node.textContent ?? '';
    const letters = { count: 0 };
    node.textContent = '';
    timeline.add(letters, { count: [0, full.length], duration, ease: 'linear', onUpdate: () => { node.textContent = full.slice(0, Math.round(letters.count)); } } as unknown as AnimationParams, at);
  }
}

function resolveTargets(root: Element, ids: string | string[]): Element[] {
  const list = Array.isArray(ids) ? ids : [ids];
  const selector = list.map((id) => `[${VISUAL_ID_ATTRIBUTE}="${id}"]`).join(',');
  return Array.from(root.querySelectorAll(selector));
}

export function buildStepTimeline(root: Element, spec: VisualSpec, onTime?: (ms: number) => void): StepTimeline {
  const boundaries: number[] = [];
  // Spec time is in the builder's units; the timeline runs at 1/speed of it.
  const factor = 1 / (spec.speed ?? 1);
  let lastTime = 0;
  let isClamping = false;

  const timeline = createTimeline({
    autoplay: false,
    onUpdate: (self) => {
      if (isClamping) return;
      const current = self.currentTime;
      if (!self.paused) onTime?.(current);
      if (self.paused) {
        lastTime = current;
        return;
      }

      for (const boundary of boundaries) {
        if (boundary > 0 && lastTime < boundary && current >= boundary) {
          isClamping = true;
          try {
            self.pause();
            self.seek(boundary);
            lastTime = boundary;
          } finally {
            isClamping = false;
          }
          break;
        }
      }
      lastTime = self.currentTime;
    },
  });

  spec.steps.forEach((step, index) => {
    const stepStart = timeline.duration;
    timeline.label(`step-${index}`, stepStart);
    for (const tween of step.tweens) {
      const scaled = scaleTween(tween, factor);
      const targets = resolveTargets(root, tween.targets);
      if (TYPE_MARKER in tween.params) addTyping(timeline, targets, spec, scaled.params, stepStart + scaled.at);
      else timeline.add(targets, morphablePathParams(resolveColourTokens(root, targets, scaled.params)), stepStart + scaled.at);
    }
    // A narration-only step has no tween to give it length; a timer keeps it a real, timed step so Next does not skip it.
    if (index > 0 && step.tweens.length === 0) timeline.add({ duration: emptyStepSpecMs(spec.speed ?? 1) * factor }, stepStart);
    boundaries.push(timeline.duration);
  });

  return { timeline, boundaries };
}
