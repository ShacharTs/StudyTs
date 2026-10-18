import { flattenPath, pointsAlong } from '../geometry/pathSegments';
import type { Point } from '../geometry/geometryPrimitives';
import type { BuilderBlock, VisualElementSpec, VisualSpec, VisualTweenSpec } from '../types/visualSpec';
import { blocksOf } from './blocks';
import { elementBox } from './builderGeometry';
import { parseViewBox } from '../shared/stageSize';

export const OVERLAY_ACTIONS = ['flow', 'spark', 'frame', 'sweep', 'callout'];
// Travel tokens also switch off at the next step, or each one would stay parked on its arrow.
const SWITCHED_OFF_ACTIONS = [...OVERLAY_ACTIONS, 'travel'];
const LINK_OVERLAY_ACTIONS = ['flow', 'spark', 'callout', 'travel'];
const SWEEP_BAR_SHARE = 0.22;
const CALLOUT_W = 160;
const CALLOUT_H = 56;
const CALLOUT_GAP = 8;
const TOKEN_RADIUS = 9;
const ZIG_STEP_PX = 14;
const ZIG_AMPLITUDE = 7;
const FRAME_GAP = 9;

export const overlayId = (action: string, target: string): string => `fx-${action}-${target}`;

const shaftOf = (spec: VisualSpec, linkId: string): Point[] => flattenPath(String(spec.elements.find((el) => el.id === linkId)?.attrs.d ?? ''))[0] ?? [];

function zigzagPoints(shaft: Point[]): Point[] {
  const length = shaft.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - shaft[i].x, point.y - shaft[i].y), 0);
  const along = pointsAlong(shaft, Math.max(6, Math.round(length / ZIG_STEP_PX)));
  return along.map((point, i) => {
    if (i === 0 || i === along.length - 1) return point;
    const ahead = along[i + 1];
    const behind = along[i - 1];
    const span = Math.hypot(ahead.x - behind.x, ahead.y - behind.y) || 1;
    const side = (i % 2 === 0 ? 1 : -1) * ZIG_AMPLITUDE;
    return { x: point.x - ((ahead.y - behind.y) / span) * side, y: point.y + ((ahead.x - behind.x) / span) * side };
  });
}

const polylineD = (points: Point[]): string => points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`).join(' ');

const shaftD = (spec: VisualSpec, linkId: string): string => String(spec.elements.find((el) => el.id === linkId)?.attrs.d ?? '').split(' M ')[0];

const fxBuilder = { fx: true as const };

const flowOverlay = (spec: VisualSpec, target: string): VisualElementSpec => ({
  id: overlayId('flow', target), kind: 'path', attrs: { d: shaftD(spec, target) },
  style: { fill: 'none', stroke: 'var(--viz-blue)', strokeWidth: 4, strokeDasharray: '8 10', strokeDashoffset: 0, opacity: 0 }, builder: fxBuilder,
});

const sparkOverlay = (spec: VisualSpec, target: string): VisualElementSpec => ({
  id: overlayId('spark', target), kind: 'path', attrs: { d: polylineD(zigzagPoints(shaftOf(spec, target))), pathLength: 1 },
  style: { fill: 'none', stroke: 'var(--viz-orange)', strokeWidth: 3, strokeDasharray: 1, strokeDashoffset: 1, opacity: 0 }, builder: fxBuilder,
});

const frameOverlay = (spec: VisualSpec, target: string): VisualElementSpec => {
  const box = elementBox(spec.elements.find((el) => el.id === target) as VisualElementSpec);
  return {
    id: overlayId('frame', target), kind: 'rect', attrs: { x: box.x - FRAME_GAP, y: box.y - FRAME_GAP, width: box.w + FRAME_GAP * 2, height: box.h + FRAME_GAP * 2, rx: 10 },
    style: { fill: 'none', stroke: 'var(--viz-orange)', strokeWidth: 2.5, strokeDasharray: '3 4 8 4', strokeDashoffset: 0, opacity: 0 }, builder: fxBuilder,
  };
};

const targetBox = (spec: VisualSpec, target: string) => elementBox(spec.elements.find((el) => el.id === target) as VisualElementSpec);

const sweepOverlay = (spec: VisualSpec, target: string): VisualElementSpec => {
  const box = targetBox(spec, target);
  return {
    id: overlayId('sweep', target), kind: 'rect', attrs: { x: box.x, y: box.y, width: Math.max(8, Math.round(box.w * SWEEP_BAR_SHARE)), height: box.h },
    style: { fill: 'var(--text-primary)', opacity: 0 }, builder: fxBuilder,
  };
};

const calloutOverlay = (spec: VisualSpec, target: string, block: BuilderBlock): VisualElementSpec => {
  const box = targetBox(spec, target);
  const view = parseViewBox(spec.viewBox);
  const above = box.y - CALLOUT_H - CALLOUT_GAP;
  const x = Math.min(Math.max(0, Math.round(box.x + box.w / 2 - CALLOUT_W / 2)), Math.max(0, view.w - CALLOUT_W));
  return {
    id: overlayId('callout', target), kind: 'bubble', attrs: { x, y: above >= 0 ? above : box.y + box.h + CALLOUT_GAP, width: CALLOUT_W, height: CALLOUT_H },
    style: { opacity: 0, '--bubble-color': 'var(--accent)' }, content: block.text ?? '', builder: fxBuilder,
  };
};

type OverlayMaker = (spec: VisualSpec, target: string, block: BuilderBlock) => VisualElementSpec;

const OVERLAY_MAKERS: Record<string, OverlayMaker> = { flow: flowOverlay, spark: sparkOverlay, frame: frameOverlay, sweep: sweepOverlay, callout: calloutOverlay };

function tokenOverlay(spec: VisualSpec, linkId: string): VisualElementSpec {
  const start = shaftOf(spec, linkId)[0] ?? { x: 0, y: 0 };
  return {
    id: overlayId('travel', linkId), kind: 'circle', attrs: { cx: start.x, cy: start.y, r: TOKEN_RADIUS },
    style: { fill: 'var(--viz-orange)', stroke: 'var(--bg-secondary)', strokeWidth: 2, opacity: 0 }, builder: { fx: true, name: 'Token' },
  };
}

const isFx = (el: VisualElementSpec): boolean => el.builder?.fx === true;

const MAKERS_BY_ACTION: Record<string, OverlayMaker> = { ...OVERLAY_MAKERS, travel: tokenOverlay };

function wantedOverlays(spec: VisualSpec): VisualElementSpec[] {
  const blocks = spec.steps.flatMap((step) => blocksOf(step)).filter((block): block is BuilderBlock & { target: string } => Boolean(block.target) && spec.elements.some((el) => el.id === block.target));
  const made = new Map<string, VisualElementSpec>();
  for (const block of blocks) {
    const maker: OverlayMaker | undefined = MAKERS_BY_ACTION[block.action];
    const id = overlayId(block.action, block.target);
    if (maker && !made.has(id)) made.set(id, maker(spec, block.target, block));
  }
  return [...made.values()];
}

// The overlays an arrow can carry, for a hide to switch off along with the arrow.
export function overlayIdsOfLink(spec: VisualSpec, linkId: string): string[] {
  return LINK_OVERLAY_ACTIONS.map((action) => overlayId(action, linkId)).filter((id) => spec.elements.some((el) => el.id === id));
}

export function rebuildEffectOverlays(spec: VisualSpec): VisualSpec {
  const base = spec.elements.filter((el) => !isFx(el));
  const overlays = wantedOverlays({ ...spec, elements: base });
  return overlays.length === 0 && base.length === spec.elements.length ? spec : { ...spec, elements: [...base, ...overlays] };
}

export function effectOffTweens(spec: VisualSpec, stepIndex: number): VisualTweenSpec[] {
  const previous = spec.steps[stepIndex - 1];
  if (!previous) return [];
  const ids = new Set(blocksOf(previous).filter((block) => block.target && SWITCHED_OFF_ACTIONS.includes(block.action)).map((block) => overlayId(block.action, block.target as string)));
  return [...ids].filter((id) => spec.elements.some((el) => el.id === id)).map((id) => ({ targets: id, at: 0, params: { opacity: 0, duration: 200, ease: 'outQuad' }, builder: { generated: true as const } }));
}
