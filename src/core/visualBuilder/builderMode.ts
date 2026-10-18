import type { Point } from '../geometry/geometryPrimitives';
import type { BuilderShape, BuilderSide } from '../types/visualSpec';
import { BUILDER_TEXT } from '../../i18n/dictionary';
import { kindsWord, type ObjectKind } from './effects';

type Return = 'select' | 'connect';

export type BuilderMode =
  | { kind: 'select' }
  | { kind: 'connect'; from: string | null; notice: string | null }
  | { kind: 'drag'; from: string; side: BuilderSide | null; moved: boolean; over: string | null; returnTo: Return }
  | { kind: 'quickAdd'; from: string; side: BuilderSide | null; at: Point; returnTo: Return }
  | { kind: 'walk'; path: string[] }
  | { kind: 'pickSpot'; stepIndex: number; blockIndex: number }
  | { kind: 'pickTarget'; effect: string; kinds: readonly ObjectKind[]; notice: string | null };

export type ModeEvent =
  | { type: 'tool'; tool: 'select' | 'connect' }
  | { type: 'startPick'; stepIndex: number; blockIndex: number }
  | { type: 'startPickTarget'; effect: string; kinds: readonly ObjectKind[] }
  | { type: 'startConnectFrom'; id: string }
  | { type: 'portPressed'; id: string; side: BuilderSide }
  | { type: 'shapePressed'; id: string; isLink: boolean; kind: ObjectKind }
  | { type: 'backgroundPressed' }
  | { type: 'pointerMoved'; over: string | null; moved: boolean }
  | { type: 'released'; point: Point; over: string | null; overSide: BuilderSide | null }
  | { type: 'quickAddChosen'; shape: BuilderShape }
  | { type: 'spotClicked'; point: Point }
  | { type: 'shapeAdded' }
  | { type: 'finish' }
  | { type: 'cancel' };

export type ModeEffect =
  | { type: 'connect'; from: string; to: string; fromPort: BuilderSide | null; toPort: BuilderSide | null }
  | { type: 'connectNew'; from: string; fromPort: BuilderSide | null; at: Point; shape: BuilderShape }
  | { type: 'finishWalk'; path: string[] }
  | { type: 'setSpot'; stepIndex: number; blockIndex: number; point: Point }
  | { type: 'applyEffect'; effect: string; target: string };

export interface ModeResult {
  mode: BuilderMode;
  effect?: ModeEffect;
}

type ConnectMode = Extract<BuilderMode, { kind: 'connect' }>;
type DragMode = Extract<BuilderMode, { kind: 'drag' }>;
type QuickAddMode = Extract<BuilderMode, { kind: 'quickAdd' }>;
type WalkMode = Extract<BuilderMode, { kind: 'walk' }>;
type PickSpotMode = Extract<BuilderMode, { kind: 'pickSpot' }>;
type PickTargetMode = Extract<BuilderMode, { kind: 'pickTarget' }>;

export const SELECT_MODE: BuilderMode = { kind: 'select' };

const stay = (mode: BuilderMode): ModeResult => ({ mode });
const connectWith = (from: string | null, notice: string | null): ModeResult => ({ mode: { kind: 'connect', from, notice } });
const backTo = (returnTo: Return, notice: string | null = null): BuilderMode => (returnTo === 'connect' ? { kind: 'connect', from: null, notice } : SELECT_MODE);
const startDrag = (from: string, side: BuilderSide | null, returnTo: Return): ModeResult => ({ mode: { kind: 'drag', from, side, moved: false, over: null, returnTo } });

// Events that mean the same in every mode; Escape, the tool buttons and adding a shape can always get you out.
function everyMode(event: ModeEvent): ModeResult | null {
  switch (event.type) {
    case 'cancel':
    case 'shapeAdded':
      return stay(SELECT_MODE);
    case 'tool':
      return event.tool === 'select' ? stay(SELECT_MODE) : connectWith(null, null);
    case 'startPick':
      return stay({ kind: 'pickSpot', stepIndex: event.stepIndex, blockIndex: event.blockIndex });
    case 'startPickTarget':
      return stay({ kind: 'pickTarget', effect: event.effect, kinds: event.kinds, notice: null });
    case 'startConnectFrom':
      return connectWith(event.id, null);
    default:
      return null;
  }
}

function connectClick(mode: ConnectMode, event: Extract<ModeEvent, { type: 'shapePressed' }>): ModeResult {
  if (event.isLink) return connectWith(mode.from, 'noticePickShape');
  if (!mode.from) return startDrag(event.id, null, 'connect');
  return {
    mode: SELECT_MODE,
    effect: { type: 'connect', from: mode.from, to: event.id, fromPort: null, toPort: null },
  };
}

function connectEvent(mode: ConnectMode, event: ModeEvent): ModeResult {
  if (event.type === 'shapePressed') return connectClick(mode, event);
  if (event.type === 'portPressed') return startDrag(event.id, event.side, 'connect');
  if (event.type === 'backgroundPressed') return connectWith(mode.from, mode.from ? 'noticeSecond' : 'noticeFirst');
  return stay(mode);
}

function selectEvent(event: ModeEvent): ModeResult {
  return event.type === 'portPressed' ? startDrag(event.id, event.side, 'select') : stay(SELECT_MODE);
}

function release(mode: DragMode, event: Extract<ModeEvent, { type: 'released' }>): ModeResult {
  if (event.over && event.over !== mode.from) {
    return { mode: SELECT_MODE, effect: { type: 'connect', from: mode.from, to: event.over, fromPort: mode.side, toPort: event.overSide } };
  }
  if (event.over === mode.from) return stay(backTo(mode.returnTo));
  if (mode.moved) return stay({ kind: 'quickAdd', from: mode.from, side: mode.side, at: event.point, returnTo: mode.returnTo });
  // A press without a move on a shape in Connect arms the click-then-click flow.
  return stay(mode.side === null && mode.returnTo === 'connect' ? { kind: 'connect', from: mode.from, notice: null } : backTo(mode.returnTo));
}

function dragEvent(mode: DragMode, event: ModeEvent): ModeResult {
  if (event.type === 'pointerMoved') return stay({ ...mode, moved: mode.moved || event.moved, over: event.over });
  return event.type === 'released' ? release(mode, event) : stay(mode);
}

function quickAddEvent(mode: QuickAddMode, event: ModeEvent): ModeResult {
  if (event.type !== 'quickAddChosen') return stay(mode);
  return { mode: SELECT_MODE, effect: { type: 'connectNew', from: mode.from, fromPort: mode.side, at: mode.at, shape: event.shape } };
}

function walkEvent(mode: WalkMode, event: ModeEvent): ModeResult {
  if (event.type === 'shapePressed') {
    const repeated = event.isLink || mode.path[mode.path.length - 1] === event.id;
    return repeated ? stay(mode) : stay({ kind: 'walk', path: [...mode.path, event.id] });
  }
  if (event.type !== 'finish') return stay(mode);
  return mode.path.length >= 2 ? { mode: SELECT_MODE, effect: { type: 'finishWalk', path: mode.path } } : stay(SELECT_MODE);
}

function pickSpotEvent(mode: PickSpotMode, event: ModeEvent): ModeResult {
  if (event.type !== 'spotClicked') return stay(mode);
  return { mode: SELECT_MODE, effect: { type: 'setSpot', stepIndex: mode.stepIndex, blockIndex: mode.blockIndex, point: event.point } };
}

function pickTargetEvent(mode: PickTargetMode, event: ModeEvent): ModeResult {
  if (event.type !== 'shapePressed') return stay(mode);
  if (!mode.kinds.includes(event.kind)) return stay({ ...mode, notice: 'noticeKinds' });
  return { mode: SELECT_MODE, effect: { type: 'applyEffect', effect: mode.effect, target: event.id } };
}

export function reduceMode(mode: BuilderMode, event: ModeEvent): ModeResult {
  const shared = everyMode(event);
  if (shared) return shared;
  switch (mode.kind) {
    case 'connect': return connectEvent(mode, event);
    case 'drag': return dragEvent(mode, event);
    case 'quickAdd': return quickAddEvent(mode, event);
    case 'walk': return walkEvent(mode, event);
    case 'pickSpot': return pickSpotEvent(mode, event);
    case 'pickTarget': return pickTargetEvent(mode, event);
    default: return selectEvent(event);
  }
}

const capitalised = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

// What the pill says, without words: a text key and the things to name. A free-text notice (not a key) is shown as it is.
export type HintKey = 'hintSelect' | 'hintArrow' | 'hintFrom' | 'hintDrag' | 'hintQuickAdd' | 'hintWalkStart' | 'hintWalk' | 'hintPickSpot' | 'hintPickTarget' | 'noticePickShape' | 'noticeSecond' | 'noticeFirst' | 'noticeKinds';

export interface Hint {
  key: HintKey | null;
  raw?: string;
  from?: string;
  path?: string[];
  effect?: string;
  kinds?: readonly ObjectKind[];
}

const isHintKey = (value: string): value is HintKey => Object.prototype.hasOwnProperty.call(BUILDER_TEXT, value) && /^(hint|notice)/.test(value);

function noticeHint(notice: string, mode: BuilderMode): Hint {
  if (!isHintKey(notice)) return { key: null, raw: notice };
  return { key: notice, kinds: mode.kind === 'pickTarget' ? mode.kinds : undefined };
}

const PLAIN_HINTS: Partial<Record<BuilderMode['kind'], HintKey>> = { drag: 'hintDrag', quickAdd: 'hintQuickAdd', pickSpot: 'hintPickSpot', select: 'hintSelect' };

function connectHint(mode: ConnectMode): Hint {
  if (mode.notice) return noticeHint(mode.notice, mode);
  return mode.from ? { key: 'hintFrom', from: mode.from } : { key: 'hintArrow' };
}

export function describeHint(mode: BuilderMode): Hint {
  if (mode.kind === 'connect') return connectHint(mode);
  if (mode.kind === 'walk') return mode.path.length === 0 ? { key: 'hintWalkStart' } : { key: 'hintWalk', path: mode.path };
  if (mode.kind === 'pickTarget') return mode.notice ? noticeHint(mode.notice, mode) : { key: 'hintPickTarget', effect: mode.effect, kinds: mode.kinds };
  return { key: PLAIN_HINTS[mode.kind] ?? 'hintSelect' };
}

export type HintSay = (key: HintKey, values: Record<string, string>) => string;

export interface HintNames {
  say: HintSay;
  nameOf: (id: string) => string;
  effectName: (effect: string) => string;
  kindsName: (kinds: readonly ObjectKind[]) => string;
}

// Writes a hint in whatever language `say` speaks; the names of shapes, effects and kinds come from the caller.
export function renderHint(hint: Hint, names: HintNames): string {
  if (hint.key === null) return hint.raw ?? '';
  const values: Record<string, string> = {
    name: hint.from ? names.nameOf(hint.from) : '',
    path: (hint.path ?? []).map(names.nameOf).join(' → '),
    effect: hint.effect ? names.effectName(hint.effect) : '',
    kinds: hint.kinds ? names.kindsName(hint.kinds) : '',
  };
  return names.say(hint.key, values);
}

const fillPlaceholders = (text: string, values: Record<string, string>): string => text.replace(/\{(\w+)\}/g, (_match, name: string) => values[name] ?? '');

// English default for tests and for code with no language: the same table, its `en` column.
const englishSay: HintSay = (key, values) => fillPlaceholders(BUILDER_TEXT[key].en, values);

export function modeHint(mode: BuilderMode, nameOf: (id: string) => string, labelOf: (effect: string) => string = capitalised): string {
  return renderHint(describeHint(mode), { say: englishSay, nameOf, effectName: labelOf, kindsName: kindsWord });
}
