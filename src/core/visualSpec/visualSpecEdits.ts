/**
 * Pure, immutable edit operations on a VisualSpec. The form editor calls these and writes the result back as JSON
 * text; nothing here knows about React, the DOM or Anime.js, so a form can never become a second animation engine.
 */
import type { VisualElementKind, VisualElementSpec, VisualSpec, VisualStepSpec, VisualTweenSpec } from '../types/visualSpec';

export type Scalar = number | string;
export type ScalarRecord = Record<string, Scalar>;

const SHAPE_STYLE: ScalarRecord = { fill: 'none', stroke: 'currentColor', color: 'var(--accent)', strokeWidth: 3 };

const DEFAULT_ATTRS: Record<VisualElementKind, ScalarRecord> = {
  ellipse: { cx: 400, cy: 260, rx: 100, ry: 60 },
  circle: { cx: 400, cy: 260, r: 40 },
  rect: { x: 340, y: 220, width: 120, height: 80 },
  path: { d: 'M 100 100 L 300 100' },
  text: { x: 400, y: 260 },
  math: { x: 340, y: 240, width: 120, height: 34 },
  bubble: { x: 60, y: 420, width: 680, height: 90 },
};

const DEFAULT_STYLE: Record<VisualElementKind, ScalarRecord> = {
  ellipse: SHAPE_STYLE,
  circle: SHAPE_STYLE,
  rect: SHAPE_STYLE,
  path: SHAPE_STYLE,
  text: { fill: 'currentColor' },
  math: {},
  bubble: {},
};

const DEFAULT_CONTENT: Partial<Record<VisualElementKind, string>> = {
  text: 'Label',
  math: '$x$',
  bubble: '**Title** — explain what happens here.',
};

export function parseScalar(raw: string): Scalar {
  const trimmed = raw.trim();
  const asNumber = Number(trimmed);
  return trimmed !== '' && Number.isFinite(asNumber) ? asNumber : raw;
}

export function setEntry(record: ScalarRecord | undefined, key: string, value: Scalar): ScalarRecord {
  return { ...record, [key]: value };
}

export function removeEntry(record: ScalarRecord | undefined, key: string): ScalarRecord {
  return Object.fromEntries(Object.entries(record ?? {}).filter(([entryKey]) => entryKey !== key));
}

const replaceAt = <T>(list: T[], index: number, item: T): T[] => list.map((existing, i) => (i === index ? item : existing));

const targetsOf = (tween: VisualTweenSpec): string[] => (Array.isArray(tween.targets) ? tween.targets : [tween.targets]);

function nextId(prefix: string, taken: string[]): string {
  let number = taken.length + 1;
  while (taken.includes(`${prefix}-${number}`)) number += 1;
  return `${prefix}-${number}`;
}

const defaultTween = (targetId: string): VisualTweenSpec => ({ targets: targetId, params: { opacity: 1, duration: 500 } });

export function addElement(spec: VisualSpec, kind: VisualElementKind): VisualSpec {
  const content = DEFAULT_CONTENT[kind];
  const element: VisualElementSpec = {
    id: nextId(kind, spec.elements.map((existing) => existing.id)),
    kind,
    attrs: { ...DEFAULT_ATTRS[kind] },
    style: { ...DEFAULT_STYLE[kind] },
    ...(content === undefined ? {} : { content }),
  };
  return { ...spec, elements: [...spec.elements, element] };
}

function withoutTarget(tween: VisualTweenSpec, id: string): VisualTweenSpec | null {
  const targets = targetsOf(tween);
  if (!targets.includes(id)) return tween;
  const remaining = targets.filter((target) => target !== id);
  return remaining.length > 0 ? { ...tween, targets: remaining } : null;
}

export function removeElement(spec: VisualSpec, id: string): VisualSpec {
  const steps = spec.steps.map((step) => ({
    ...step,
    tweens: step.tweens.flatMap((tween) => {
      const kept = withoutTarget(tween, id);
      return kept ? [kept] : [];
    }),
  }));
  return { ...spec, elements: spec.elements.filter((element) => element.id !== id), steps };
}

export function renameElement(spec: VisualSpec, id: string, newId: string): VisualSpec {
  if (newId === '' || newId === id || spec.elements.some((element) => element.id === newId)) return spec;
  const rename = (target: string): string => (target === id ? newId : target);
  const steps = spec.steps.map((step) => ({
    ...step,
    tweens: step.tweens.map((tween) => ({
      ...tween,
      targets: Array.isArray(tween.targets) ? tween.targets.map(rename) : rename(tween.targets),
    })),
  }));
  const elements = spec.elements.map((element) => (element.id === id ? { ...element, id: newId } : element));
  return { ...spec, elements, steps };
}

export function updateElement(spec: VisualSpec, id: string, patch: Partial<Omit<VisualElementSpec, 'id'>>): VisualSpec {
  return { ...spec, elements: spec.elements.map((element) => (element.id === id ? { ...element, ...patch } : element)) };
}

export function addStep(spec: VisualSpec): VisualSpec {
  const first = spec.elements[0];
  const step: VisualStepSpec = {
    id: nextId('step', spec.steps.map((existing) => existing.id)),
    whatChanged: 'New step',
    why: '',
    tweens: first ? [defaultTween(first.id)] : [],
  };
  return { ...spec, steps: [...spec.steps, step] };
}

export function removeStep(spec: VisualSpec, index: number): VisualSpec {
  // A spec needs at least one step, so the last one stays.
  if (spec.steps.length <= 1) return spec;
  return { ...spec, steps: spec.steps.filter((_step, i) => i !== index) };
}

export function updateStep(spec: VisualSpec, index: number, patch: Partial<VisualStepSpec>): VisualSpec {
  return { ...spec, steps: spec.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)) };
}

function updateTweens(spec: VisualSpec, stepIndex: number, change: (tweens: VisualTweenSpec[]) => VisualTweenSpec[]): VisualSpec {
  const step = spec.steps[stepIndex];
  if (!step) return spec;
  return { ...spec, steps: replaceAt(spec.steps, stepIndex, { ...step, tweens: change(step.tweens) }) };
}

export function addTween(spec: VisualSpec, stepIndex: number): VisualSpec {
  const first = spec.elements[0];
  if (!first) return spec;
  return updateTweens(spec, stepIndex, (tweens) => [...tweens, defaultTween(first.id)]);
}

export function removeTween(spec: VisualSpec, stepIndex: number, tweenIndex: number): VisualSpec {
  return updateTweens(spec, stepIndex, (tweens) => tweens.filter((_tween, i) => i !== tweenIndex));
}

export function updateTween(spec: VisualSpec, stepIndex: number, tweenIndex: number, patch: Partial<VisualTweenSpec>): VisualSpec {
  return updateTweens(spec, stepIndex, (tweens) =>
    tweens.map((tween, i) => (i === tweenIndex ? { ...tween, ...patch } : tween)),
  );
}
