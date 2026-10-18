import type { VisualElementSpec, VisualSpec, VisualTweenSpec } from '../../types/visualSpec';
import { pathSegments, type PathSegment } from '../../geometry/pathSegments';
import { parseViewBox } from '../../shared/stageSize';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// An element as it looks at the end of one step: tweened attributes applied, shifted by translateX/Y, hidden at opacity 0.
interface Placed {
  el: VisualElementSpec;
  opacity: number;
  dx: number;
  dy: number;
}

// `ids` are the elements to outline in the editor; `message` is the sentence for lists and for the AI.
export type LayoutIssueKind = 'outline' | 'crossed' | 'overlap' | 'outside' | 'partlyOutside' | 'orphan';

export interface LayoutIssue {
  ids: string[];
  // What kind of problem it is, so a screen can word it in its own language; `message` is the English sentence.
  kind: LayoutIssueKind;
  // The shape or line the text collides with, when there is one.
  other?: string;
  message: string;
}

const TEXT_KINDS = ['math', 'bubble'];
const SLOT_GROUP = /^(bubble|strip)-\d+$/;

const num = (value: number | string | undefined): number => Number(value ?? 0);

const viewBoxSize = (viewBox: string) => parseViewBox(viewBox);

const frameOf = (a: VisualElementSpec['attrs']): Box => ({ x: num(a.x), y: num(a.y), w: num(a.width), h: num(a.height) });

const BOX_READERS: Record<string, (a: VisualElementSpec['attrs']) => Box> = {
  circle: (a) => ({ x: num(a.cx) - num(a.r), y: num(a.cy) - num(a.r), w: num(a.r) * 2, h: num(a.r) * 2 }),
  ellipse: (a) => ({ x: num(a.cx) - num(a.rx), y: num(a.cy) - num(a.ry), w: num(a.rx) * 2, h: num(a.ry) * 2 }),
  rect: frameOf,
  math: frameOf,
  bubble: frameOf,
};

function placedBox(placed: Placed): Box | null {
  const box = BOX_READERS[placed.el.kind]?.(placed.el.attrs);
  return box ? { ...box, x: box.x + placed.dx, y: box.y + placed.dy } : null;
}

const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const areaOf = (box: Box): number => box.w * box.h;

const insideAreaOf = (box: Box, frame: Box): number => {
  const width = Math.min(box.x + box.w, frame.x + frame.w) - Math.max(box.x, frame.x);
  const height = Math.min(box.y + box.h, frame.y + frame.h) - Math.max(box.y, frame.y);
  return Math.max(0, width) * Math.max(0, height);
};

// Half or less outside is a warning-only straddle; more than half, or no visible area at all, is outside.
const isPartlyOutside = (box: Box, frame: Box): boolean => {
  const inside = insideAreaOf(box, frame);
  return inside > 0 && inside * 2 >= areaOf(box);
};

const contains = (outer: Box, inner: Box): boolean =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

// The outline of a circle or ellipse crosses a box when the box holds points both inside and outside it.
function crossesEllipse(box: Box, shape: Box): boolean {
  const rx = shape.w / 2;
  const ry = shape.h / 2;
  const left = (box.x - (shape.x + rx)) / rx;
  const right = (box.x + box.w - (shape.x + rx)) / rx;
  const top = (box.y - (shape.y + ry)) / ry;
  const bottom = (box.y + box.h - (shape.y + ry)) / ry;
  const nearest = Math.hypot(Math.max(left, 0, -right), Math.max(top, 0, -bottom));
  const farthest = Math.hypot(Math.max(Math.abs(left), Math.abs(right)), Math.max(Math.abs(top), Math.abs(bottom)));
  return nearest <= 1 && farthest >= 1;
}

const crossesRect = (box: Box, shape: Box): boolean => overlaps(box, shape) && !contains(shape, box) && !contains(box, shape);

const OUTLINE_CROSSERS: Record<string, (box: Box, shape: Box) => boolean> = {
  circle: crossesEllipse,
  ellipse: crossesEllipse,
  rect: crossesRect,
};

// Liang-Barsky clip of a segment against a box.
function segmentHitsBox([x1, y1, x2, y2]: PathSegment, box: Box): boolean {
  const checks: Array<[number, number]> = [
    [x1 - x2, x1 - box.x],
    [x2 - x1, box.x + box.w - x1],
    [y1 - y2, y1 - box.y],
    [y2 - y1, box.y + box.h - y1],
  ];
  let enter = 0;
  let leave = 1;
  for (const [p, q] of checks) {
    if (p === 0 && q < 0) return false;
    if (p === 0) continue;
    if (p < 0) enter = Math.max(enter, q / p);
    else leave = Math.min(leave, q / p);
  }
  return enter <= leave;
}

const slotGroup = (id: string): string | null => (SLOT_GROUP.test(id) ? id.replace(/-\d+$/, '') : null);

function sameSlotGroup(a: string, b: string): boolean {
  const group = slotGroup(a);
  return group !== null && group === slotGroup(b);
}

// A shape drawn without a stroke (a filled strip or shadow) has no outline for text to sit on.
const hasOutline = (el: VisualElementSpec): boolean => el.style?.stroke !== undefined && el.style.stroke !== 'none';

function sitsOnOutline(box: Box, other: Placed): boolean {
  const shape = hasOutline(other.el) ? placedBox(other) : null;
  return shape !== null && OUTLINE_CROSSERS[other.el.kind]?.(box, shape) === true;
}

function crossedByLine(box: Box, other: Placed): boolean {
  if (other.el.kind !== 'path') return false;
  return pathSegments(String(other.el.attrs.d ?? ''), other.dx, other.dy).some((segment) => segmentHitsBox(segment, box));
}

// A label and its owner, or two members of one group, are drawn together on purpose; their contact is not a layout fault.
const isRelated = (a: VisualElementSpec, b: VisualElementSpec): boolean =>
  a.builder?.parent === b.id || b.builder?.parent === a.id || (a.builder?.group !== undefined && a.builder.group === b.builder?.group);

function crossingIssue(text: Placed, box: Box, other: Placed): LayoutIssue | null {
  if (other.el.builder?.fx === true || isRelated(text.el, other.el)) return null;
  if (sitsOnOutline(box, other)) return { ids: [text.el.id], other: other.el.id, kind: 'outline', message: `"${text.el.id}" sits on the outline of "${other.el.id}"` };
  return crossedByLine(box, other) ? { ids: [text.el.id], other: other.el.id, kind: 'crossed', message: `"${text.el.id}" is crossed by the line "${other.el.id}"` } : null;
}

function outlineIssues(texts: Placed[], shown: Placed[]): LayoutIssue[] {
  return texts.flatMap((text) => {
    const box = placedBox(text) as Box;
    return shown.map((other) => crossingIssue(text, box, other)).filter((issue): issue is LayoutIssue => issue !== null);
  });
}

function overlapIssues(texts: Placed[]): LayoutIssue[] {
  return texts.flatMap((first, index) =>
    texts
      .slice(index + 1)
      .filter((second) => !sameSlotGroup(first.el.id, second.el.id) && !isRelated(first.el, second.el) && overlaps(placedBox(first) as Box, placedBox(second) as Box))
      .map((second) => ({ ids: [first.el.id, second.el.id], kind: 'overlap' as const, message: `"${first.el.id}" overlaps "${second.el.id}"` })),
  );
}

function boundsIssues(shown: Placed[], viewBox: string): LayoutIssue[] {
  const frame: Box = { x: 0, y: 0, ...viewBoxSize(viewBox) };
  return shown.flatMap((placed): LayoutIssue[] => {
    const box = placedBox(placed);
    if (box === null || contains(frame, box)) return [];
    const id = placed.el.id;
    return isPartlyOutside(box, frame)
      ? [{ ids: [id], kind: 'partlyOutside' as const, message: `"${id}" partly leaves the viewBox` }]
      : [{ ids: [id], kind: 'outside' as const, message: `"${id}" leaves the viewBox` }];
  });
}

const isOrphan = (el: VisualElementSpec, ids: Set<string>): boolean => {
  const builder = el.builder;
  if (builder === undefined) return false;
  if (builder.parent !== undefined && !ids.has(builder.parent)) return true;
  return builder.link !== undefined && (!ids.has(builder.link.from) || !ids.has(builder.link.to));
};

// A label or link whose owner was deleted; nothing draws it in a meaningful place any more.
function orphanIssues(spec: VisualSpec): LayoutIssue[] {
  const ids = new Set(spec.elements.map((el) => el.id));
  return spec.elements
    .filter((el) => isOrphan(el, ids))
    .map((el) => ({ ids: [el.id], kind: 'orphan' as const, message: `"${el.id}" has a missing parent or link end` }));
}

const PARAM_SETTERS: Record<string, (state: Placed, value: number) => void> = {
  opacity: (state, value) => void (state.opacity = value),
  translateX: (state, value) => void (state.dx = value),
  translateY: (state, value) => void (state.dy = value),
};

function applyParams(state: Placed, params: VisualTweenSpec['params']): Placed {
  const next = { ...state, el: { ...state.el, attrs: { ...state.el.attrs } } };
  for (const [key, value] of Object.entries(params)) {
    if (PARAM_SETTERS[key]) PARAM_SETTERS[key](next, num(value));
    else if (typeof value === 'number' && key in next.el.attrs) next.el.attrs[key] = value;
  }
  return next;
}

function applyTween(states: Map<string, Placed>, tween: VisualTweenSpec): void {
  const targets = Array.isArray(tween.targets) ? tween.targets : [tween.targets];
  for (const id of targets) {
    const state = states.get(id);
    if (state) states.set(id, applyParams(state, tween.params));
  }
}

function startingStates(spec: VisualSpec): Map<string, Placed> {
  return new Map(spec.elements.map((el) => [el.id, { el, opacity: num(el.style?.opacity ?? 1), dx: 0, dy: 0 }]));
}

function stepIssues(states: Map<string, Placed>, viewBox: string): LayoutIssue[] {
  const shown = [...states.values()].filter((placed) => placed.opacity > 0);
  const texts = shown.filter((placed) => TEXT_KINDS.includes(placed.el.kind));
  return [...outlineIssues(texts, shown), ...overlapIssues(texts), ...boundsIssues(shown, viewBox)];
}

// Geometry check for authored specs, run on what each step shows after its tweens: text boxes must not sit on shape
// outlines or lines, must not overlap each other (bubble-N and strip-N slots may share a spot), and everything visible
// stays inside the viewBox. Orphans are checked once against the spec, not per step. Each issue is reported once.
export function findLayoutIssues(spec: VisualSpec): LayoutIssue[] {
  const states = startingStates(spec);
  const issues = spec.steps.flatMap((step) => {
    step.tweens.forEach((tween) => applyTween(states, tween));
    return stepIssues(states, spec.viewBox);
  });
  return [...new Map([...orphanIssues(spec), ...issues].map((issue) => [issue.message, issue])).values()];
}

export const checkVisualSpecLayout = (spec: VisualSpec): string[] => findLayoutIssues(spec).map((issue) => issue.message);
