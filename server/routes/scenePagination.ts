import crypto from 'crypto';
import { tidyLayout, type TidyBlock, type TidyOptions } from '../../src/core/geometry/tidyLayout.js';

type Loose = Record<string, unknown>;

export interface PagedState {
  blocks: Loose[];
  pages?: Loose[];
}

// A4 portrait in px, the same bounds the other scene ops clamp to.
// ponytail: one page size for every page; read it per page once scenes can mix paper sizes.
const PAGE_HEIGHT = 1123;
const TOP_MARGIN = 24;
// Safety stop for a cascade of spills over pages.
const MAX_PAGES_TOUCHED = 50;

const blocksOf = (page: Loose): Loose[] => {
  if (!Array.isArray(page.blocks)) page.blocks = [];
  return page.blocks as Loose[];
};

/** A scene that has no pages yet is one page: turn it into page-1 (a copy of its blocks) so there is somewhere to move things from. */
function ensurePages(state: PagedState): Loose[] {
  if (!state.pages || state.pages.length === 0) state.pages = [{ id: 'page-1', name: 'Page 1', blocks: [...state.blocks] }];
  return state.pages;
}

/** Applies a tidy pass to one page's block list in place and returns the blocks that no longer fit (already removed from the list). */
function settleList(list: Loose[], options: TidyOptions): Loose[] {
  const changes = tidyLayout(list as unknown as TidyBlock[], options);
  const spilled: Loose[] = [];
  for (const block of list) {
    const change = changes.get(String(block.id));
    if (!change) continue;
    const { overflow, ...geometry } = change;
    Object.assign(block, geometry);
    if (overflow) spilled.push(block);
  }
  spilled.forEach((block) => list.splice(list.indexOf(block), 1));
  return spilled;
}

/** Puts blocks at the very top of a page's list, lifted just above anything that sits higher so they stay first in their column. */
function placeAtTop(list: Loose[], moved: Loose[]): void {
  const tops = list.map((b) => b.y).filter((y): y is number => typeof y === 'number');
  const minY = Math.min(TOP_MARGIN, ...tops);
  const lift = minY < TOP_MARGIN ? TOP_MARGIN - minY + 1 : 0;
  moved.forEach((block) => { if (typeof block.y === 'number') block.y -= lift; });
  list.unshift(...moved);
}

function pushToNextPage(pages: Loose[], from: number, spilled: Loose[]): void {
  if (!pages[from + 1]) pages.push({ id: `page-${crypto.randomUUID()}`, name: `Page ${pages.length + 1}`, blocks: [] });
  placeAtTop(blocksOf(pages[from + 1]), spilled);
}

/**
 * Lays out page `from`, moving whatever no longer fits to the top of the next page (made when missing) and laying that out too.
 * With `only`, it stops at the first page that spills nothing (later pages were not touched); otherwise it goes on to the last page.
 */
export function settlePages(state: PagedState, from: number, only: boolean, options: TidyOptions): void {
  const pages = state.pages ?? [];
  const settle = { ...options, overflow: options.overflow ?? 'newPage', pageHeight: PAGE_HEIGHT } as const;
  for (let i = from; i < pages.length && i < from + MAX_PAGES_TOUCHED; i++) {
    const spilled = settleList(blocksOf(pages[i]), settle);
    if (spilled.length > 0) pushToNextPage(pages, i, spilled);
    else if (only) return;
  }
}

/** Same for a scene without pages: it only becomes a paged scene when something really overflows. */
export function settleUnpaged(state: PagedState, options: TidyOptions): void {
  const probe = tidyLayout(state.blocks as unknown as TidyBlock[], { ...options, overflow: options.overflow ?? 'newPage', pageHeight: PAGE_HEIGHT });
  if ([...probe.values()].some((change) => change.overflow)) {
    ensurePages(state);
    settlePages(state, 0, true, options);
    return;
  }
  settleList(state.blocks, { ...options, overflow: 'none' });
}

export interface MoveToPageOp {
  targetId?: string;
  pageId?: string;
  afterId?: string;
  y?: number;
  create?: boolean;
}

/** Moves a block to another page (top margin unless `y`), then pushes that page's own blocks down and onwards if they no longer fit. */
export function moveBlockToPage(op: MoveToPageOp, state: PagedState): string | null {
  const { targetId, pageId } = op;
  if (!targetId || !pageId) return 'moveBlockToPage needs targetId and pageId, e.g. {"op":"moveBlockToPage","targetId":"b1","pageId":"page-2"}';
  const pages = ensurePages(state);
  const fromIdx = pages.findIndex((page) => blocksOf(page).some((b) => b.id === targetId));
  if (fromIdx < 0) return `block "${targetId}" not found`;
  let toIdx = pages.findIndex((page) => page.id === pageId);
  if (toIdx < 0) {
    if (!op.create) return `page "${pageId}" not found: add it first with addPage, or pass create:true`;
    pages.splice(fromIdx + 1, 0, { id: pageId, name: `Page ${pages.length + 1}`, blocks: [] });
    toIdx = fromIdx + 1;
  }
  if (toIdx === fromIdx) return null;

  const source = blocksOf(pages[fromIdx]);
  const [block] = source.splice(source.findIndex((b) => b.id === targetId), 1);
  block.y = typeof op.y === 'number' ? op.y : TOP_MARGIN;
  const target = blocksOf(pages[toIdx]);
  const after = op.afterId ? target.findIndex((b) => b.id === op.afterId) : -1;
  if (after >= 0) target.splice(after + 1, 0, block);
  else placeAtTop(target, [block]);
  settlePages(state, toIdx, true, { closeGaps: false, fitText: false });
  return null;
}
