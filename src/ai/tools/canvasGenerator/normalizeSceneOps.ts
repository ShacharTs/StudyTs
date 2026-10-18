import type { SceneOp, ManualSceneOp } from '@core/types/canvasScene';

type LooseOp = Record<string, unknown>;
type AnyOp = SceneOp | ManualSceneOp;

const OP_ALIASES: Record<string, string> = {
  removeBlock: 'deleteNode',
  deleteBlock: 'deleteNode',
  removeNode: 'deleteNode',
  remove: 'deleteNode',
  delete: 'deleteNode',
  updateBlock: 'setField',
  update: 'setField',
  addBlock: 'insertBlock',
  insert: 'insertBlock',
  convertBlock: 'replaceBlock',
  convert: 'replaceBlock',
  fixOverlaps: 'tidyLayout',
  fixLayout: 'tidyLayout',
  relayout: 'tidyLayout',
  tidy: 'tidyLayout',
  compactLayout: 'tidyLayout',
  closeGaps: 'tidyLayout',
  moveToPage: 'moveBlockToPage',
  transferBlock: 'moveBlockToPage',
  sendToPage: 'moveBlockToPage',
  moveBlock: 'moveBlockToPage',
};

const first = (op: LooseOp, keys: string[]): unknown => keys.map((k) => op[k]).find((v) => v !== undefined);

const asObject = (value: unknown): LooseOp | undefined => {
  if (typeof value === 'string') {
    try {
      return asObject(JSON.parse(value));
    } catch {
      return undefined;
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as LooseOp) : undefined;
};

const BLOCK_KEYS = ['block', 'value', 'newBlock'];
const OP_ONLY_KEYS = new Set(['op', 'afterId', 'pageId', 'targetId']);

/** The block an op carries: under any usual key, as a JSON string, or spread inline on the op itself. */
function blockOf(op: LooseOp): LooseOp | undefined {
  const named = asObject(first(op, BLOCK_KEYS));
  if (named) return named;
  if (typeof op.kind !== 'string') return undefined;
  return Object.fromEntries(Object.entries(op).filter(([k]) => !OP_ONLY_KEYS.has(k)));
}

let counter = 0;
const freshId = () => `blk-${Date.now().toString(36)}-${counter++}`;

function normalizeInsert(op: LooseOp): LooseOp {
  const block = blockOf(op);
  if (!block) return op;
  return { op: 'insertBlock', block: { ...block, id: block.id ?? freshId() }, afterId: op.afterId, pageId: op.pageId };
}

function normalizeReplace(op: LooseOp): LooseOp {
  const block = blockOf(op);
  return { op: 'replaceBlock', targetId: first(op, ['targetId', 'id', 'blockId']), ...(block ? { block } : {}) };
}

function normalizeSetField(op: LooseOp): LooseOp {
  return { ...op, fields: asObject(first(op, ['fields', 'patch', 'value', 'changes'])) ?? op.fields };
}

const NORMALIZERS: Record<string, (op: LooseOp) => LooseOp> = {
  insertBlock: normalizeInsert,
  replaceBlock: normalizeReplace,
  setField: normalizeSetField,
};

// insertBlock and addPage use `id` for the new thing, so it must not be read as a target.
const KEEPS_OWN_ID = new Set(['insertBlock', 'addPage']);

function normalizeOne(raw: unknown): AnyOp {
  const op = asObject(raw);
  if (!op) return raw as AnyOp;
  const name = typeof op.op === 'string' ? (OP_ALIASES[op.op] ?? op.op) : op.op;
  const targetId = first(op, ['targetId', 'id', 'blockId']);
  const withTarget = targetId !== undefined && !KEEPS_OWN_ID.has(String(name)) ? { targetId } : {};
  const base: LooseOp = { ...op, op: name, ...withTarget };
  return (NORMALIZERS[String(name)]?.(base) ?? base) as unknown as AnyOp;
}

/** Fixes the near-misses models make (alias op names, `value` for `block`, inline blocks, missing ids) so a good intent is not rejected. */
export function normalizeSceneOps(ops: unknown[]): AnyOp[] {
  return ops.map(normalizeOne);
}
