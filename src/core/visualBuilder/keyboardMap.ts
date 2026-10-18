import type { BuilderShape } from '../types/visualSpec';
import type { BuilderMode } from './builderMode';

export type BuilderCommand =
  | { type: 'tool'; tool: 'select' | 'connect' }
  | { type: 'add'; shape: BuilderShape }
  | { type: 'delete' }
  | { type: 'cancel' }
  | { type: 'finish' }
  | { type: 'edit' }
  | { type: 'duplicate' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'nudge'; dx: number; dy: number }
  | { type: 'newStep' }
  | { type: 'stepPrev' }
  | { type: 'stepNext' }
  | { type: 'playToggle' }
  | { type: 'animate' }
  | { type: 'help' };

export interface KeyInput {
  key: string;
  ctrl: boolean;
  shift: boolean;
  typing: boolean;
}

export interface KeyContext {
  hasSelection: boolean;
  mode: BuilderMode['kind'];
}

const SHAPE_KEYS: Record<string, BuilderShape> = { '1': 'circle', '2': 'box', '3': 'diamond', '4': 'text', '5': 'heading', '6': 'caption', '7': 'note' };

const PLAIN_KEYS: Record<string, BuilderCommand> = {
  v: { type: 'tool', tool: 'select' },
  l: { type: 'tool', tool: 'connect' },
  n: { type: 'newStep' },
  a: { type: 'animate' },
  ' ': { type: 'playToggle' },
  '[': { type: 'stepPrev' },
  ']': { type: 'stepNext' },
  '?': { type: 'help' },
  Delete: { type: 'delete' },
  Backspace: { type: 'delete' },
  Escape: { type: 'cancel' },
  F2: { type: 'edit' },
};

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const NUDGE = 2;
const NUDGE_FAST = 10;

// Ctrl+Left/Right moves between steps even while a shape is selected, where plain arrows nudge it.
function ctrlCommand({ key, shift }: KeyInput): BuilderCommand | null {
  if (key === 'ArrowLeft') return { type: 'stepPrev' };
  if (key === 'ArrowRight') return { type: 'stepNext' };
  const letter = key.toLowerCase();
  if (letter === 'z') return { type: shift ? 'redo' : 'undo' };
  if (letter === 'y') return { type: 'redo' };
  return letter === 'd' ? { type: 'duplicate' } : null;
}

function arrowCommand({ key, shift }: KeyInput, ctx: KeyContext): BuilderCommand | null {
  const direction = ARROWS[key];
  if (!direction) return null;
  if (ctx.hasSelection) {
    const distance = shift ? NUDGE_FAST : NUDGE;
    return { type: 'nudge', dx: direction[0] * distance, dy: direction[1] * distance };
  }
  if (direction[0] === 0) return null;
  return { type: direction[0] > 0 ? 'stepNext' : 'stepPrev' };
}

function enterCommand(ctx: KeyContext): BuilderCommand | null {
  if (ctx.mode === 'walk') return { type: 'finish' };
  return ctx.hasSelection ? { type: 'edit' } : null;
}

export function commandForKey(input: KeyInput, ctx: KeyContext): BuilderCommand | null {
  if (input.typing) return null;
  if (input.ctrl) return ctrlCommand(input);
  if (input.key === 'Enter') return enterCommand(ctx);
  const shape = SHAPE_KEYS[input.key];
  if (shape) return { type: 'add', shape };
  const plain = PLAIN_KEYS[input.key] ?? PLAIN_KEYS[input.key.toLowerCase()];
  if (plain) return plain.type === 'animate' && !ctx.hasSelection ? null : plain;
  return arrowCommand(input, ctx);
}
