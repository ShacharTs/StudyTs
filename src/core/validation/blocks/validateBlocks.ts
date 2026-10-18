/**
 * Per-kind CanvasBlock shape validation (validateBlocks), plus the
 * cross-reference pass for connector anchor ids. Split out of
 * canvasValidators.ts (see that file for the shared entry point).
 */
import { VALID_BLOCK_KINDS, isLocalizedValue } from './validBlockKinds';
import { validateSceneNodes } from '../sceneNodes/validateSceneNodes';
import type { CanvasBlock } from '../../types/canvasScene';
import { NETWORK_DEVICES, SHAPE_BLOCK_SHAPES, isNetworkDevice } from '../../canvasBlocks/networkDevices';

/**
 * Per-kind CanvasBlock validators, dispatched from a lookup table in
 * blockKindValidators.ts.
 */

function validateRichTextBlock(b: Record<string, unknown>, index: number): string | null {
  if (!isLocalizedValue(b.body)) {
    return `Block ${index} ("${b.id}"): richText requires "body" as string or { he: string, en: string } — got ${JSON.stringify(b.body)}`;
  }
  return null;
}

function validateBoxBlock(b: Record<string, unknown>, index: number, nodes?: unknown): string | null {
  if (!Array.isArray(b.childIds) || !b.childIds.every((cid) => typeof cid === 'string')) {
    return `Block ${index} ("${b.id}"): box requires "childIds" as string[]`;
  }
  if (nodes && typeof nodes === 'object' && !Array.isArray(nodes)) {
    const nodeMap = nodes as Record<string, unknown>;
    for (const cid of b.childIds) {
      if (!nodeMap[cid]) {
        return `Block ${index} ("${b.id}"): box childId "${cid}" does not exist in scene.nodes`;
      }
    }
  }
  return null;
}

function validateGraphBlock(b: Record<string, unknown>, index: number): string | null {
  const state = b.state as Record<string, unknown> | undefined;
  if (!state || typeof state !== 'object') {
    return `Block ${index} ("${b.id}"): graph requires a "state" object (not top-level fields)`;
  }
  if (!Array.isArray(state.nodes) || !Array.isArray(state.edges)) {
    return `Block ${index} ("${b.id}"): graph "state" requires "nodes" and "edges" arrays`;
  }
  return validateGraphDevices(b, state, index);
}

/** Optional additions to a graph: a node's network `device`, and the `zones` frames behind them. */
function validateGraphDevices(b: Record<string, unknown>, state: Record<string, unknown>, index: number): string | null {
  for (const node of state.nodes as Array<Record<string, unknown>>) {
    if (node?.device !== undefined && !isNetworkDevice(node.device)) {
      return `Block ${index} ("${b.id}"): graph node "${node.id}" has device ${JSON.stringify(node.device)}; use one of: ${NETWORK_DEVICES.join(', ')}`;
    }
  }
  if (state.zones !== undefined && !Array.isArray(state.zones)) return `Block ${index} ("${b.id}"): graph "zones" must be an array`;
  return null;
}

function validateAutomataBlock(b: Record<string, unknown>, index: number): string | null {
  const state = b.state as Record<string, unknown> | undefined;
  if (!state || typeof state !== 'object') {
    return `Block ${index} ("${b.id}"): automata requires a "state" object — a display snapshot with tape/headPosition/currentState/status/stepCount, not a transition-table definition`;
  }
  if (!Array.isArray(state.tape)) {
    return `Block ${index} ("${b.id}"): automata "state" requires "tape" as an array (not a string, not "states"/"transitions")`;
  }
  if (typeof state.headPosition !== 'number') {
    return `Block ${index} ("${b.id}"): automata "state" requires numeric "headPosition" (not "head")`;
  }
  if (typeof state.currentState !== 'string') {
    return `Block ${index} ("${b.id}"): automata "state" requires string "currentState" (not "startState")`;
  }
  if (!['running', 'accepted', 'rejected', 'looping'].includes(state.status as string)) {
    return `Block ${index} ("${b.id}"): automata "state" requires "status" to be one of running/accepted/rejected/looping (not "halted")`;
  }
  if (typeof state.stepCount !== 'number') {
    return `Block ${index} ("${b.id}"): automata "state" requires numeric "stepCount"`;
  }
  return null;
}

function validateMediaSrcBlock(b: Record<string, unknown>, index: number): string | null {
  if (typeof b.src !== 'string') return `Block ${index} ("${b.id}"): ${b.kind} requires a string "src"`;
  return null;
}

function validateYoutubeBlock(b: Record<string, unknown>, index: number): string | null {
  if (typeof b.videoId !== 'string') return `Block ${index} ("${b.id}"): youtube requires a string "videoId"`;
  return null;
}

function validateStepPlayerBlock(b: Record<string, unknown>, index: number): string | null {
  if (!Array.isArray(b.steps) || b.steps.length === 0) {
    return `Block ${index} ("${b.id}"): stepPlayer requires a non-empty "steps" array`;
  }
  for (const [si, rawStep] of b.steps.entries()) {
    const step = rawStep as Record<string, unknown>;
    if (!isLocalizedValue(step?.whatChanged) || !isLocalizedValue(step?.why)) {
      return `Block ${index} ("${b.id}"), step ${si}: requires "whatChanged" and "why" as string or { he, en } (not "narration"/"description")`;
    }
  }
  return null;
}

function hasCircularReference(v: unknown, seen: WeakSet<object>): boolean {
  if (v !== null && typeof v === 'object') {
    if (seen.has(v as object)) return true;
    seen.add(v as object);
    for (const child of Array.isArray(v) ? v : Object.values(v as Record<string, unknown>)) {
      if (hasCircularReference(child, seen)) return true;
    }
  }
  return false;
}

function validateDataBlockJson(b: Record<string, unknown>, index: number): string | null {
  if ('data' in b && hasCircularReference(b.data, new WeakSet<object>())) {
    return `Block ${index} ("${b.id}"): data.json contains circular references`;
  }
  return null;
}

function validateDataBlockTable(b: Record<string, unknown>, index: number): string | null {
  const cols = Array.isArray(b.columns) ? b.columns.length : 0;
  if (Array.isArray(b.rows)) {
    for (let r = 0; r < b.rows.length; r++) {
      const rowCells = (b.rows[r] as unknown[]).length;
      if (rowCells !== cols && cols > 0) {
        return `Block ${index} ("${b.id}"): data.table row ${r} has ${rowCells} cells, expected ${cols}`;
      }
    }
  }
  return null;
}

function validateDataBlock(b: Record<string, unknown>, index: number): string | null {
  const fmt = b.format as unknown;
  if (fmt !== 'table' && fmt !== 'json') {
    return `Block ${index} ("${b.id}"): data requires format 'table' | 'json', got ${JSON.stringify(fmt)}`;
  }
  if (fmt === 'json') return validateDataBlockJson(b, index);
  return validateDataBlockTable(b, index);
}

function validateConnectorBlock(b: Record<string, unknown>, index: number): string | null {
  if (typeof b.fromBlockId !== 'string' || typeof b.toBlockId !== 'string') {
    return `Block ${index} ("${b.id}"): connector requires string "fromBlockId" and "toBlockId"`;
  }
  return null;
}

function validateShapeBlock(b: Record<string, unknown>, index: number): string | null {
  if (!SHAPE_BLOCK_SHAPES.includes(b.shape as string)) {
    return `Block ${index} ("${b.id}"): shape requires "shape" to be one of ${SHAPE_BLOCK_SHAPES.join('/')}, got ${JSON.stringify(b.shape)}`;
  }
  if (typeof b.label !== 'string') {
    return `Block ${index} ("${b.id}"): shape requires a string "label"`;
  }
  return null;
}

type KindValidator = (b: Record<string, unknown>, index: number, nodes?: unknown) => string | null;

const KIND_VALIDATORS: Partial<Record<CanvasBlock['kind'], KindValidator>> = {
  richText: validateRichTextBlock,
  box: validateBoxBlock,
  graph: validateGraphBlock,
  automata: validateAutomataBlock,
  pdf: validateMediaSrcBlock,
  image: validateMediaSrcBlock,
  video: validateMediaSrcBlock,
  youtube: validateYoutubeBlock,
  stepPlayer: validateStepPlayerBlock,
  data: validateDataBlock,
  connector: validateConnectorBlock,
  shape: validateShapeBlock,
};

export function validateBlock(raw: unknown, index: number = 0, nodes?: unknown): string | null {
  const b = raw as Record<string, unknown>;
  if (!b || typeof b !== 'object') return `Block ${index} is not an object`;
  if (typeof b.id !== 'string') return `Block ${index} is missing a string "id"`;
  if (typeof b.kind !== 'string' || !VALID_BLOCK_KINDS.has(b.kind as CanvasBlock['kind'])) {
    return `Block ${index} ("${b.id}") has invalid kind "${b.kind}". Valid kinds: ${[...VALID_BLOCK_KINDS].join(', ')}`;
  }
  if (![b.x, b.y, b.width, b.height].every((n) => typeof n === 'number')) {
    return `Block ${index} ("${b.id}") is missing numeric x/y/width/height`;
  }

  const kind = b.kind as CanvasBlock['kind'];
  const validator = KIND_VALIDATORS[kind];
  if (!validator) {
    const _exhaustive: never = kind as never;
    return `Block ${index} ("${b.id}"): unhandled block kind "${_exhaustive}"`;
  }
  return validator(b, index, nodes);
}

export function validateBlocks(blocks: unknown[], nodes?: unknown): string | null {
  if (!Array.isArray(blocks)) {
    return 'Blocks must be an array';
  }

  for (const [i, raw] of blocks.entries()) {
    const error = validateBlock(raw, i, nodes);
    if (error) return error;
  }

  // Cross-reference connectors' anchor ids against the actual block set
  const blockIds = new Set(blocks.map((raw) => (raw as Record<string, unknown>).id));
  for (const [i, raw] of blocks.entries()) {
    const b = raw as Record<string, unknown>;
    if (b.kind !== 'connector') continue;
    if (!blockIds.has(b.fromBlockId)) return `Block ${i} ("${b.id}"): connector's fromBlockId "${b.fromBlockId}" does not match any block in this scene`;
    if (!blockIds.has(b.toBlockId)) return `Block ${i} ("${b.id}"): connector's toBlockId "${b.toBlockId}" does not match any block in this scene`;
  }

  if (nodes) {
    const nodeError = validateSceneNodes(nodes, blocks);
    if (nodeError) return nodeError;
  }

  return null;
}
