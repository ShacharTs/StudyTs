import { validateBlocks, validateBlock } from '../../src/core/validation/blocks/index.js';
import type { ManualSceneOp, SceneNode } from '../../src/core/types/canvasScene.js';
import { clampSize, type BlockRect, resolveNonOverlappingPosition } from '../../src/core/geometry/blockPlacement.js';
import { fitBlockWidth, type TidyBlock } from '../../src/core/geometry/tidyLayout.js';
import { settlePages, settleUnpaged, moveBlockToPage } from './scenePagination.js';
import crypto from 'crypto';

interface SceneMutationState {
  blocks: Record<string, unknown>[];
  sceneNodes: Record<string, SceneNode>;
  pages?: Record<string, unknown>[];
}

function applyAddPage(op: Extract<ManualSceneOp, { op: 'addPage' }>, state: SceneMutationState): string | null {
  if (!state.pages) state.pages = [];
  const newPageId = op.id || `page-${crypto.randomUUID()}`;
  const newPageName = op.name || `Page ${state.pages.length + 1}`;
  if (state.pages.some((p) => p.id === newPageId)) return `page "${newPageId}" already exists`;
  const newPage = { id: newPageId, name: newPageName, blocks: [] } as Record<string, unknown>;
  if (op.afterPageId) {
    const idx = state.pages.findIndex((p) => p.id === op.afterPageId);
    if (idx >= 0) { state.pages.splice(idx + 1, 0, newPage); return null; }
  }
  state.pages.push(newPage);
  return null;
}

function applyDeletePage(op: Extract<ManualSceneOp, { op: 'deletePage' }>, state: SceneMutationState): string | null {
  if (!state.pages || state.pages.length === 0) return 'no pages to delete';
  if (state.pages.length <= 1) return 'cannot delete the only remaining page';
  const idx = state.pages.findIndex((p) => p.id === op.pageId);
  if (idx === -1) return `page "${op.pageId}" not found`;
  const page = state.pages[idx];
  if (Array.isArray(page.blocks) && page.blocks.length > 0) {
    return `page "${op.pageId}" is not empty (${page.blocks.length} block(s)) — delete or move its blocks first`;
  }
  state.pages.splice(idx, 1);
  return null;
}

function applyMovePage(op: Extract<ManualSceneOp, { op: 'movePage' }>, state: SceneMutationState): string | null {
  if (!state.pages || state.pages.length === 0) return 'no pages';
  const idx = state.pages.findIndex((p) => p.id === op.pageId);
  if (idx === -1) return `page "${op.pageId}" not found`;
  if (op.toIndex < 0 || op.toIndex >= state.pages.length) return `toIndex ${op.toIndex} out of range`;
  const [removed] = state.pages.splice(idx, 1);
  state.pages.splice(op.toIndex, 0, removed);
  return null;
}

function applyRenamePage(op: Extract<ManualSceneOp, { op: 'renamePage' }>, state: SceneMutationState): string | null {
  if (!state.pages || state.pages.length === 0) return 'no pages';
  const page = state.pages.find((p) => p.id === op.pageId);
  if (!page) return `page "${op.pageId}" not found`;
  if (!op.newName || !op.newName.trim()) return 'page name cannot be empty';
  page.name = op.newName.trim();
  return null;
}

type Loose = Record<string, unknown>;
type BoxLike = { childIds?: string[] };
type TextBody = string | Record<string, string | undefined> | null | undefined;

function findBox(state: SceneMutationState, id: string): BoxLike | null {
  const block = state.blocks.find((b) => b.id === id && b.kind === 'box');
  if (block) return block as BoxLike;
  const node = state.sceneNodes[id];
  return node?.kind === 'box' ? node : null;
}

function findParentOf(state: SceneMutationState, id: string): { childIds: string[] } | null {
  const holds = (n: Loose | SceneNode | undefined) => n?.kind === 'box' && Array.isArray(n.childIds) && (n.childIds as string[]).includes(id);
  const found = state.blocks.find(holds) ?? Object.values(state.sceneNodes).find(holds);
  return (found as { childIds: string[] } | undefined) ?? null;
}

function applyInsertItem(op: Extract<ManualSceneOp, { op: 'insertItem' }>, state: SceneMutationState): string | null {
  const { parentBoxId, index, item } = op;
  if (!parentBoxId || typeof index !== 'number' || !item) return 'insertItem needs parentBoxId, a numeric index and an item object';
  const parent = findBox(state, parentBoxId);
  if (!parent) return `parent box "${parentBoxId}" not found`;
  if (!Array.isArray(parent.childIds)) parent.childIds = [];
  state.sceneNodes[item.id] = item;
  const insertPos = Math.max(0, Math.min(index, parent.childIds.length));
  parent.childIds.splice(insertPos, 0, item.id);
  return null;
}

function removeNodeFromParents(state: SceneMutationState, itemId: string) {
  for (const b of state.blocks) if (b.kind === 'box' && Array.isArray(b.childIds)) b.childIds = (b.childIds as string[]).filter((c) => c !== itemId);
  for (const n of Object.values(state.sceneNodes)) if (n?.kind === 'box' && Array.isArray(n.childIds)) n.childIds = n.childIds.filter((c) => c !== itemId);
}

function applyMoveItem(op: Extract<ManualSceneOp, { op: 'moveItem' }>, state: SceneMutationState): string | null {
  const { itemId, toParentBoxId, toIndex } = op;
  if (!itemId || !toParentBoxId || typeof toIndex !== 'number') return 'moveItem needs itemId, toParentBoxId and a numeric toIndex';
  const targetParent = findBox(state, toParentBoxId);
  if (!targetParent) return `destination box "${toParentBoxId}" not found`;
  removeNodeFromParents(state, itemId);
  if (!Array.isArray(targetParent.childIds)) targetParent.childIds = [];
  const insertPos = Math.max(0, Math.min(toIndex, targetParent.childIds.length));
  targetParent.childIds.splice(insertPos, 0, itemId);
  return null;
}

function mapTexts(body: Record<string, string | undefined>, transform: (text: string) => string): Record<string, string> {
  const mapped: Record<string, string> = { en: '' };
  for (const [language, text] of Object.entries(body)) mapped[language] = transform(text ?? '');
  return mapped;
}

function splitTextBody(oldBody: TextBody, caretOffset: number) {
  if (typeof oldBody === 'string') {
    const nextAfterBody = oldBody.slice(caretOffset);
    return { nextBeforeBody: oldBody.slice(0, caretOffset), nextAfterBody, hasAfter: Boolean(nextAfterBody.trim()) };
  }
  const body = oldBody ?? {};
  const nextBeforeBody = mapTexts(body, (text) => text.slice(0, caretOffset));
  const nextAfterBody = mapTexts(body, (text) => text.slice(caretOffset));
  const hasAfter = Object.values(nextAfterBody).some((text) => text.trim() !== '');
  return { nextBeforeBody, nextAfterBody, hasAfter };
}

function applySplitText(op: Extract<ManualSceneOp, { op: 'splitText' }>, state: SceneMutationState): string | null {
  const { targetId, caretOffset, insertItem } = op;
  if (!targetId || typeof caretOffset !== 'number' || !insertItem) return 'splitText needs targetId, a numeric caretOffset and an insertItem object';
  const targetNode = state.sceneNodes[targetId];
  if (!targetNode || targetNode.kind !== 'text') return `target text node "${targetId}" not found`;
  const parent = findParentOf(state, targetId);
  if (!parent) return `parent box of "${targetId}" not found`;

  const idx = parent.childIds.indexOf(targetId);
  const { nextBeforeBody, nextAfterBody, hasAfter } = splitTextBody(targetNode.body, caretOffset);

  targetNode.body = nextBeforeBody;
  state.sceneNodes[insertItem.id] = insertItem;
  const nextChildIds = [...parent.childIds];
  let insertIndex = idx + 1;
  nextChildIds.splice(insertIndex, 0, insertItem.id);
  insertIndex++;

  if (hasAfter) {
    const afterNodeId = `${targetId}-after-${Date.now()}`;
    state.sceneNodes[afterNodeId] = { id: afterNodeId, kind: 'text' as const, body: nextAfterBody };
    nextChildIds.splice(insertIndex, 0, afterNodeId);
  }
  parent.childIds = nextChildIds;
  return null;
}

function cleanSubtreeNodes(targetBox: BoxLike, newNodes: Record<string, SceneNode>, state: SceneMutationState) {
  const oldReachable = new Set<string>();
  const getOldSubtreeIds = (cid: string) => {
    oldReachable.add(cid);
    const node = state.sceneNodes[cid];
    if (node?.kind === 'box' && Array.isArray(node.childIds)) node.childIds.forEach(getOldSubtreeIds);
  };
  if (Array.isArray(targetBox.childIds)) targetBox.childIds.forEach(getOldSubtreeIds);
  for (const oldId of oldReachable) if (!newNodes[oldId]) delete state.sceneNodes[oldId];
}

function validateNewChildIds(newChildIds: string[], newNodes: Record<string, SceneNode>, state: SceneMutationState): boolean {
  for (const cid of newChildIds) {
    if (!newNodes[cid] && !state.sceneNodes[cid]) return false;
  }
  return true;
}

function applyReplaceBoxContent(op: Extract<ManualSceneOp, { op: 'replaceBoxContent' }>, state: SceneMutationState): string | null {
  const { boxId, nodes: newNodes, childIds: newChildIds } = op;
  if (!boxId || !newNodes || !Array.isArray(newChildIds)) return 'replaceBoxContent needs boxId, nodes and childIds';
  const targetBox = findBox(state, boxId);
  if (!targetBox) return `box "${boxId}" not found`;
  if (!validateNewChildIds(newChildIds, newNodes, state)) return 'childId not found in nodes';

  cleanSubtreeNodes(targetBox, newNodes, state);
  Object.assign(state.sceneNodes, newNodes);
  targetBox.childIds = newChildIds;
  return null;
}

const CANVAS_BOUNDS = { width: 794, height: 1123 };

export type { SceneMutationState };

/** Every list that holds blocks: the top-level mirror and each page. A page scene is saved from its pages, so edits must reach them. */
function blockLists(state: SceneMutationState): Loose[][] {
  const pageLists = (state.pages ?? []).map((p) => p.blocks).filter(Array.isArray) as Loose[][];
  return [state.blocks as Loose[], ...pageLists];
}

function blockCopies(state: SceneMutationState, id: string): Loose[] {
  return blockLists(state).flatMap((list) => list.filter((b) => b.id === id));
}

function applySetField(op: Extract<ManualSceneOp, { op: 'setField' }>, state: SceneMutationState): string | null {
  const { targetId, fields: patchFields } = op;
  if (!targetId || !patchFields || typeof patchFields !== 'object') return 'setField needs targetId and a fields object, e.g. {"op":"setField","targetId":"b1","fields":{"body":"text"}}';
  const copies = blockCopies(state, targetId);
  if (copies.length > 0) copies.forEach((block) => Object.assign(block, patchFields));
  else if (state.sceneNodes[targetId]) Object.assign(state.sceneNodes[targetId], patchFields);
  else return `target "${targetId}" not found in blocks or nodes`;
  return null;
}

function otherRects(state: SceneMutationState, excludeId?: string): BlockRect[] {
  return state.blocks
    .filter((b) => b.id !== excludeId && [b.x, b.y, b.width, b.height].every((n) => typeof n === 'number'))
    .map((b) => ({ x: b.x as number, y: b.y as number, width: b.width as number, height: b.height as number }));
}

function applySetGeometry(op: Extract<ManualSceneOp, { op: 'setGeometry' }>, state: SceneMutationState): string | null {
  const { targetId, x, y, width, height } = op;
  if (!targetId || ![x, y, width, height].every((n) => typeof n === 'number')) return 'setGeometry needs targetId and numeric x, y, width, height';
  const copies = blockCopies(state, targetId);
  if (copies.length === 0) return `block "${targetId}" not found`;
  const size = clampSize({ x, y, width, height }, CANVAS_BOUNDS);
  const pos = resolveNonOverlappingPosition({ x, y, ...size }, CANVAS_BOUNDS, otherRects(state, targetId));
  copies.forEach((block) => Object.assign(block, { ...size, ...pos }));
  return null;
}

function findOrCreateTargetPage(state: SceneMutationState, pageId: string): Loose | string {
  if (!Array.isArray(state.pages)) {
    state.pages = [{ id: pageId, name: 'Page 1', blocks: [] }];
  }
  const targetPage = state.pages.find((p) => p.id === pageId);
  if (targetPage) return targetPage as Loose;
  if (state.pages.length === 1 && (!state.pages[0].blocks || (state.pages[0].blocks as unknown[]).length === 0)) {
    state.pages[0].id = pageId;
    return state.pages[0] as Loose;
  }
  return `page "${pageId}" not found`;
}

function insertIntoList(list: Loose[], blockRecord: Loose, afterId?: string): void {
  const idx = afterId ? list.findIndex((b) => b.id === afterId) : -1;
  if (idx >= 0) list.splice(idx + 1, 0, blockRecord);
  else list.push(blockRecord);
}

function defaultPageId(state: SceneMutationState, afterId?: string): string | undefined {
  const pages = state.pages ?? [];
  const holder = afterId ? pages.find((p) => Array.isArray(p.blocks) && (p.blocks as Loose[]).some((b) => b.id === afterId)) : undefined;
  return ((holder ?? pages[0])?.id as string | undefined) ?? undefined;
}

function applyInsertBlock(op: Extract<ManualSceneOp, { op: 'insertBlock' }>, state: SceneMutationState): string | null {
  const { block, afterId, pageId } = op;
  const err = validateBlock(block, 0, state.sceneNodes);
  if (err) return `invalid block: ${err}`;
  const clamped = clampSize(block as BlockRect, CANVAS_BOUNDS);
  // A short text box is only as wide as its words, whatever width the AI picked.
  const size = { ...clamped, width: fitBlockWidth({ ...(block as unknown as TidyBlock), ...clamped }) };
  const pos = resolveNonOverlappingPosition({ x: block.x, y: block.y, ...size }, CANVAS_BOUNDS, otherRects(state));
  // The width the AI gave is the most an auto-fit text box may grow to in the editor, so it is kept once the box shrinks.
  const cap = isAutoFitBlock(block as unknown as TidyBlock) ? { maxWidth: clamped.width } : {};
  const blockRecord = { ...block, ...size, ...pos, ...cap } as unknown as Loose;

  // A scene with pages is saved from its pages, so a block without a pageId goes to afterId's page, else the first page.
  const targetPageId = pageId ?? defaultPageId(state, afterId);
  if (targetPageId) {
    const res = findOrCreateTargetPage(state, targetPageId);
    if (typeof res === 'string') return res;
    if (!Array.isArray(res.blocks)) res.blocks = [];
    insertIntoList(res.blocks as Loose[], blockRecord, afterId);
    clearOverlapsAround(state, String(blockRecord.id));
    return null;
  }

  insertIntoList(state.blocks as Loose[], blockRecord, afterId);
  clearOverlapsAround(state, String(blockRecord.id));
  return null;
}

/** Text boxes and tables follow their content unless the block says `autoFit: false`. */
function isAutoFitBlock(block: TidyBlock): boolean {
  const fits = block.kind === 'richText' || (block.kind === 'data' && block.format === 'table');
  return fits && block.autoFit !== false;
}

/** After the AI adds or swaps a block, pushes anything it now overlaps down (a table grows past its stored height). Gaps are left as they are. */
function clearOverlapsAround(state: SceneMutationState, blockId: string): void {
  const options = { closeGaps: false, fitText: false };
  const pageIdx = (state.pages ?? []).findIndex((p) => ((p.blocks ?? []) as Loose[]).some((b) => b.id === blockId));
  // Flow overflow blocks to the top of the subsequent page.
  if (pageIdx >= 0) settlePages(state, pageIdx, true, options);
  else settleUnpaged(state, options);
}

/** Swaps a block for a new one in place (same page, same z-order); position and size carry over unless the new block sets them. */
function applyReplaceBlock(op: Extract<ManualSceneOp, { op: 'replaceBlock' }>, state: SceneMutationState): string | null {
  const { targetId, block } = op;
  if (!targetId || !block || typeof block !== 'object') return 'replaceBlock needs targetId and a block object, e.g. {"op":"replaceBlock","targetId":"b1","block":{"kind":"data","format":"table","columns":["A"],"rows":[["1"]]}}';
  const old = blockCopies(state, targetId)[0];
  if (!old) return `block "${targetId}" not found`;
  const { x, y, width, height } = old;
  const next = { x, y, width, height, ...block, id: targetId } as unknown as Loose;
  const err = validateBlock(next, 0, state.sceneNodes);
  if (err) return `invalid block: ${err}`;
  if (isAutoFitBlock(next as unknown as TidyBlock)) Object.assign(next, { maxWidth: next.width, width: fitBlockWidth(next as unknown as TidyBlock) });
  for (const list of blockLists(state)) {
    const at = list.findIndex((b) => b.id === targetId);
    if (at >= 0) list[at] = { ...next };
  }
  clearOverlapsAround(state, targetId);
  return null;
}

/** Moves blocks so none overlap and no big empty gaps remain, on one page (or every page). */
function applyTidyLayout(op: Extract<ManualSceneOp, { op: 'tidyLayout' }>, state: SceneMutationState): string | null {
  const options = { gap: op.gap, overflow: op.overflow ?? 'newPage' } as const;
  if (!state.pages || state.pages.length === 0) {
    settleUnpaged(state, options);
    return null;
  }
  const from = op.pageId ? state.pages.findIndex((p) => p.id === op.pageId) : 0;
  if (from < 0) return `page "${op.pageId}" not found`;
  settlePages(state, from, Boolean(op.pageId), options);
  return null;
}

function applyMoveBlockToPage(op: Extract<ManualSceneOp, { op: 'moveBlockToPage' }>, state: SceneMutationState): string | null {
  return moveBlockToPage(op, state);
}

function applyDeleteNode(op: Extract<ManualSceneOp, { op: 'deleteNode' }>, state: SceneMutationState): string | null {
  const { targetId } = op;
  if (!targetId) return 'missing targetId';
  state.blocks = state.blocks.filter((b) => b.id !== targetId && (b.kind !== 'connector' || (b.fromBlockId !== targetId && b.toBlockId !== targetId)));
  delete state.sceneNodes[targetId];
  removeNodeFromParents(state, targetId);
  if (Array.isArray(state.pages)) {
    for (const page of state.pages) {
      if (Array.isArray(page.blocks)) {
        page.blocks = (page.blocks as Loose[]).filter((b) => b.id !== targetId);
      }
    }
  }
  return null;
}

function applyReplaceScene(op: Extract<ManualSceneOp, { op: 'replaceScene' }>, state: SceneMutationState): string | null {
  const err = validateBlocks(op.blocks, state.sceneNodes);
  if (err) return `invalid blocks: ${err}`;
  state.blocks = op.blocks as unknown as Record<string, unknown>[];
  return null;
}

// Method-shorthand bivariance lets each handler keep its narrowed op type.
type SceneOpHandler = { bivarianceHack(op: ManualSceneOp, state: SceneMutationState): string | null }['bivarianceHack'];

const OP_HANDLERS: Record<string, SceneOpHandler> = {
  setField: applySetField,
  setGeometry: applySetGeometry,
  insertBlock: applyInsertBlock,
  replaceBlock: applyReplaceBlock,
  tidyLayout: applyTidyLayout,
  moveBlockToPage: applyMoveBlockToPage,
  deleteNode: applyDeleteNode,
  insertItem: applyInsertItem,
  moveItem: applyMoveItem,
  splitText: applySplitText,
  replaceBoxContent: applyReplaceBoxContent,
  replaceScene: applyReplaceScene,
  addPage: applyAddPage,
  deletePage: applyDeletePage,
  movePage: applyMovePage,
  renamePage: applyRenamePage,
};

export function applySingleSceneOp(op: ManualSceneOp, state: SceneMutationState): string | null {
  const opName = (op as { op: string }).op;
  const handler = OP_HANDLERS[opName];
  if (!handler) return `unrecognized op "${opName}"`;
  return handler(op, state);
}

export function pruneDanglingConnectors(blocks: Record<string, unknown>[]): Record<string, unknown>[] {
  const existingIds = new Set(blocks.filter((b) => b && b.kind !== 'connector' && typeof b.id === 'string').map((b) => b.id));
  return blocks.filter((b) => {
    if (b && b.kind === 'connector') {
      return typeof b.fromBlockId === 'string' && typeof b.toBlockId === 'string' && existingIds.has(b.fromBlockId) && existingIds.has(b.toBlockId);
    }
    return true;
  });
}
