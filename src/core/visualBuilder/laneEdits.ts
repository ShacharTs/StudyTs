import type { BuilderBlock, BuilderBlockAction, VisualSpec, VisualTweenSpec } from '../types/visualSpec';
import { blocksOf } from './blocks';
import { blockTimings, type BlockTiming } from './blockTweens';
import { emptyStepSpecMs } from './emptyStepTiming';

export interface Lane extends BlockTiming {
  blockIndex: number;
  action: BuilderBlockAction;
  target?: string;
  effect?: string;
}

const FINE_MS = 10;
const MIN_BAR_MS = 100;



const snapMs = (value: number): number => Math.round(value / FINE_MS) * FINE_MS;

export function lanesOf(spec: VisualSpec, stepIndex: number): Lane[] {
  const step = spec.steps[stepIndex];
  if (!step) return [];
  const timings = blockTimings(spec, step);
  return blocksOf(step).map((block, blockIndex) => ({ blockIndex, action: block.action, target: block.target, ...(block.effect ? { effect: block.effect } : {}), ...timings[blockIndex] }));
}

// Tween-only steps have no blocks, so their play length has to come from the tweens too.
const DEFAULT_TWEEN_MS = 1000;
const numberOr = (value: number | string | undefined, fallback: number): number => (typeof value === 'number' ? value : fallback);
const tweenEnd = (tween: VisualTweenSpec): number => (tween.at ?? 0) + numberOr(tween.params.delay, 0) + numberOr(tween.params.duration, DEFAULT_TWEEN_MS);

export function nextStart(spec: VisualSpec, stepIndex: number): number {
  const step = spec.steps[stepIndex];
  const laneEnd = lanesOf(spec, stepIndex).reduce((end, lane) => Math.max(end, lane.at + lane.duration), 0);
  const tweenEndMs = (step?.tweens ?? []).reduce((end, tween) => Math.max(end, tweenEnd(tween)), 0);
  return Math.max(laneEnd, tweenEndMs);
}

// A narration-only step plays a timer (see emptyStepTiming), so its bar is that length, not 0.
export const stepPlayMs = (spec: VisualSpec, stepIndex: number): number => {
  const emptyMs = stepIndex > 0 && (spec.steps[stepIndex]?.tweens ?? []).length === 0 ? emptyStepSpecMs(spec.speed ?? 1) : 0;
  return Math.max(nextStart(spec, stepIndex), emptyMs);
};
export const stepRulerMs = (spec: VisualSpec, stepIndex: number): number => stepPlayMs(spec, stepIndex) + Math.max(100, Math.round(stepPlayMs(spec, stepIndex) * 0.1));

export function trimmedStart(timing: { at: number; duration: number }, deltaMs: number): { at: number; duration: number } {
  const end = snapMs(timing.at + timing.duration);
  const at = Math.max(0, Math.min(snapMs(timing.at + deltaMs), end - MIN_BAR_MS));
  return { at, duration: Math.max(MIN_BAR_MS, end - at) };
}


export type LaneDrag = 'start' | 'length' | 'trim-start';

// How far the nearest anchor pulls a value that is within the threshold, or 0.
function pullToAnchor(value: number, anchors: readonly number[], thresholdMs: number): number {
  const nearest = anchors.reduce((best, anchor) => (Math.abs(anchor - value) < Math.abs(best - value) ? anchor : best), Infinity);
  return Math.abs(nearest - value) <= thresholdMs ? nearest - value : 0;
}

// A free drag in 10 ms steps; either edge of the bar sticks to a nearby anchor unless the caller passes none.
export function dragTiming(
  kind: LaneDrag,
  base: { at: number; duration: number },
  deltaMs: number,
  anchors: readonly number[],
  thresholdMs: number,
): { at: number; duration: number } {
  if (kind === 'trim-start') {
    const end = base.at + base.duration;
    const trimmed = trimmedStart(base, deltaMs + pullToAnchor(base.at + deltaMs, anchors, thresholdMs));
    return { at: trimmed.at, duration: Math.max(MIN_BAR_MS, snapMs(end) - trimmed.at) };
  }
  if (kind === 'length') {
    const end = base.at + base.duration + deltaMs;
    const duration = base.duration + deltaMs + pullToAnchor(end, anchors, thresholdMs);
    return { at: base.at, duration: Math.max(MIN_BAR_MS, snapMs(duration)) };
  }
  const at = base.at + deltaMs;
  const pull = pullToAnchor(at, anchors, thresholdMs) || pullToAnchor(at + base.duration, anchors, thresholdMs);
  return { at: Math.max(0, snapMs(at + pull)), duration: base.duration };
}

// Arrows nudge the clip by one fine step; Shift+arrows move its end, the same 10 ms grain as the pointer.
export function nudgeTiming(
  timing: { at: number; duration: number },
  key: 'ArrowLeft' | 'ArrowRight',
  shift: boolean,
): { at: number; duration: number } {
  const step = key === 'ArrowRight' ? FINE_MS : -FINE_MS;
  if (shift) return { at: timing.at, duration: Math.max(MIN_BAR_MS, timing.duration + step) };
  return { at: Math.max(0, timing.at + step), duration: timing.duration };
}

// Every block gets its effective timing written out so a later edit never changes the order or the length of the others.
type TimedBlock = BuilderBlock & BlockTiming;

function withExplicitTimings(spec: VisualSpec, stepIndex: number): TimedBlock[] {
  const lanes = lanesOf(spec, stepIndex);
  return blocksOf(spec.steps[stepIndex]).map((block, index) => ({ ...block, at: lanes[index].at, duration: lanes[index].duration }));
}

function withStepBlocks(spec: VisualSpec, stepIndex: number, blocks: BuilderBlock[]): VisualSpec {
  const steps = spec.steps.map((candidate, index) => (index === stepIndex ? { ...candidate, builder: { ...candidate.builder, blocks } } : candidate));
  return { ...spec, steps };
}

export function setBlockTiming(spec: VisualSpec, stepIndex: number, blockIndex: number, timing: Partial<BlockTiming>): VisualSpec {
  const step = spec.steps[stepIndex];
  if (!step || !blocksOf(step)[blockIndex]) return spec;
  const blocks = withExplicitTimings(spec, stepIndex).map((base, index) => {
    if (index !== blockIndex) return base;
    return { ...base, at: Math.max(0, snapMs(timing.at ?? base.at)), duration: Math.max(MIN_BAR_MS, snapMs(timing.duration ?? base.duration)) };
  });
  return withStepBlocks(spec, stepIndex, blocks);
}

// Cuts one clip into two at `atMs`; both halves keep the action, target and parameters.
export function splitBlock(spec: VisualSpec, stepIndex: number, blockIndex: number, atMs: number): VisualSpec {
  const step = spec.steps[stepIndex];
  if (!step || !blocksOf(step)[blockIndex]) return spec;
  const blocks = withExplicitTimings(spec, stepIndex);
  const { at, duration } = blocks[blockIndex];
  const cut = snapMs(atMs);
  if (cut < at + MIN_BAR_MS || cut > at + duration - MIN_BAR_MS) return spec;
  const first = { ...blocks[blockIndex], duration: cut - at };
  const second = { ...blocks[blockIndex], at: cut, duration: at + duration - cut };
  return withStepBlocks(spec, stepIndex, [...blocks.slice(0, blockIndex), first, second, ...blocks.slice(blockIndex + 1)]);
}

// The copy starts where the original ends and sits right after it in the block order.
export function duplicateBlock(spec: VisualSpec, stepIndex: number, blockIndex: number): VisualSpec {
  const step = spec.steps[stepIndex];
  if (!step || !blocksOf(step)[blockIndex]) return spec;
  const blocks = withExplicitTimings(spec, stepIndex);
  const original = blocks[blockIndex];
  const copy = { ...original, at: original.at + original.duration };
  return withStepBlocks(spec, stepIndex, [...blocks.slice(0, blockIndex + 1), copy, ...blocks.slice(blockIndex + 1)]);
}
