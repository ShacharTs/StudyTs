import { autoColumnFractions, minFitWidthPx } from './tableColumns';

/** Fixes overlaps and empty gaps on one page by moving blocks vertically; text boxes are also sized to their words. */
export interface TidyBlock {
  id: string;
  kind?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [field: string]: unknown;
}

export interface TidyOptions {
  /** Space kept between a block and the one above it. */
  gap?: number;
  /** Space above the first block of a column. */
  margin?: number;
  /** Size text boxes to their text (default true). */
  fitText?: boolean;
  /** Pull blocks up to close empty gaps (default true); false only pushes overlapping blocks down. */
  closeGaps?: boolean;
  /** 'newPage': a block that no longer fits above the page bottom is moved to the top of the next page (default 'none'). */
  overflow?: 'newPage' | 'none';
  /** Page height the blocks must fit in when overflow is 'newPage' (default A4, 1123). */
  pageHeight?: number;
}

export interface TidyChange {
  y: number;
  height: number;
  width: number;
  /** Set when the block leaves this page: y/width/height are then its place on the next page. */
  overflow?: boolean;
}

const DEFAULT_GAP = 12;
const DEFAULT_MARGIN = 24;
// Text box typography as the editor draws it (ObjectViews.module.css): font in pt, line-height 1.35, 2px/4px padding + 1px border.
const DEFAULT_FONT_PT = 12;
const PT_TO_PX = 96 / 72;
const LINE_HEIGHT = 1.35;
const PAD_X = 10;
const PAD_Y = 6;
// Average glyph width as a share of the font size, plus slack so a fitted box does not wrap its own longest line.
const GLYPH_EM = 0.55;
const WIDTH_SLACK = 1.08;
const MATH_LINE_FACTOR = 1.8;
const MIN_FIT_WIDTH = 40;
// A stored height up to this much over the estimate is left alone: the estimate is not exact.
const HEIGHT_TOLERANCE = 1.2;
// Table cells as the editor draws them (TableView.module.css): 0.6mm/1.2mm padding, minimum row height 8mm.
const TABLE_CELL_PAD_X = 9;
const TABLE_CELL_PAD_Y = 4.5;
const TABLE_MIN_ROW = 30;
const TABLE_DEFAULT_PT = 11;
// Blocks count as one column when their horizontal spans share at least this much of the narrower one.
const COLUMN_OVERLAP = 0.25;

function bodyText(block: TidyBlock): string {
  const body = block.body;
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object') {
    const localized = body as Record<string, unknown>;
    return String(localized.en ?? localized.he ?? '');
  }
  return '';
}

const fontPx = (block: TidyBlock): number => (typeof block.fontSize === 'number' ? block.fontSize : DEFAULT_FONT_PT) * PT_TO_PX;

/**
 * How tall a text box really is once its words are laid out at its width: the stored height can be smaller than the text
 * (the next block then looks like it sits on top of it) or much larger (empty space inside the box).
 * ponytail: character-count estimate, not measured glyphs; swap for real measurement if it misjudges RTL or wide fonts.
 */
export function estimateTextHeight(block: TidyBlock): number {
  const px = fontPx(block);
  const perLine = Math.max(1, Math.floor((block.width - PAD_X) / (px * GLYPH_EM)));
  const lines = bodyText(block).split('\n').reduce((sum, line) => {
    const rows = Math.max(1, Math.ceil(line.length / perLine));
    return sum + rows * (line.includes('$') ? MATH_LINE_FACTOR : 1);
  }, 0);
  return Math.ceil(lines * px * LINE_HEIGHT) + PAD_Y;
}

/**
 * A text box ("hello world") is only as wide as its longest line, not the full-page width the AI picks out of habit.
 * A paragraph longer than the box keeps its width and wraps. Never widens a box.
 */
export function fitTextWidth(block: TidyBlock): number {
  if (block.kind !== 'richText' || block.autoFit === false) return block.width;
  const longest = Math.max(1, ...bodyText(block).split('\n').map((line) => line.length));
  const natural = Math.ceil(longest * fontPx(block) * GLYPH_EM * WIDTH_SLACK) + PAD_X;
  return Math.max(MIN_FIT_WIDTH, Math.min(block.width, natural));
}

const cellText = (cell: unknown): string => {
  if (typeof cell === 'string') return cell;
  if (cell && typeof cell === 'object') {
    const localized = cell as Record<string, unknown>;
    return String(localized.en ?? localized.he ?? '');
  }
  return cell === undefined || cell === null ? '' : String(cell);
};

const tableFontPx = (block: TidyBlock): number => (typeof block.fontSize === 'number' ? block.fontSize : TABLE_DEFAULT_PT) * PT_TO_PX;

function tableGrid(block: TidyBlock): unknown[][] {
  const header = Array.isArray(block.columns) ? [block.columns as unknown[]] : [];
  const body = Array.isArray(block.rows) ? (block.rows as unknown[][]) : [];
  return [...header, ...body].filter(Array.isArray);
}

const tableCols = (grid: unknown[][]): number => Math.max(1, ...grid.map((row) => row.length));

function storedColumnFractions(block: TidyBlock, cols: number): number[] | null {
  const given = block.colWidths;
  const valid = Array.isArray(given) && given.length === cols && given.every((n) => typeof n === 'number' && n > 0);
  return valid ? (given as number[]) : null;
}

/** Column widths in px: the stored fractions, else content-sized (best fit) while auto-fit is on, else equal. */
function columnWidths(block: TidyBlock, grid: unknown[][], cols: number): number[] {
  const stored = storedColumnFractions(block, cols);
  const texts = grid.map((row) => row.map(cellText));
  const fractions = stored ?? (block.autoFit === false ? Array.from({ length: cols }, () => 1) : autoColumnFractions(texts, cols, { widthPx: block.width, fontPx: tableFontPx(block) }));
  const total = fractions.reduce((a, b) => a + b, 0);
  return fractions.map((w) => (block.width * w) / total);
}

/** Min fit: the narrowest table that holds every column's longest line on one line, never wider than the box it was given. */
function fitTableWidth(block: TidyBlock): number {
  const grid = tableGrid(block);
  const cols = tableCols(grid);
  if (block.autoFit === false || storedColumnFractions(block, cols)) return block.width;
  const natural = minFitWidthPx(grid.map((row) => row.map(cellText)), cols, tableFontPx(block));
  return natural > 0 ? Math.max(MIN_FIT_WIDTH, Math.min(block.width, natural)) : block.width;
}

/** The width a text box or table gets when auto-fit is on (its own width when it is off or the kind does not fit). */
export function fitBlockWidth(block: TidyBlock): number {
  if (block.kind === 'data' && block.format === 'table') return fitTableWidth(block);
  return fitTextWidth(block);
}

/** How tall a table is once every cell has wrapped at its column width: rows grow with their longest cell. */
export function estimateTableHeight(block: TidyBlock): number {
  const grid = tableGrid(block);
  const cols = tableCols(grid);
  const widths = columnWidths(block, grid, cols);
  const px = tableFontPx(block);
  return Math.ceil(grid.reduce((sum, row) => {
    const lines = Math.max(1, ...row.map((cell, c) => {
      const perLine = Math.max(1, Math.floor((widths[c] - TABLE_CELL_PAD_X) / (px * GLYPH_EM)));
      return cellText(cell).split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / perLine)), 0);
    }));
    return sum + Math.max(TABLE_MIN_ROW, lines * px * LINE_HEIGHT + TABLE_CELL_PAD_Y);
  }, 0));
}

function fittedSize(block: TidyBlock, fitText: boolean): { width: number; height: number } {
  if (block.kind === 'data' && block.format === 'table') {
    const width = fitText ? fitTableWidth(block) : block.width;
    return { width, height: estimateTableHeight({ ...block, width }) };
  }
  if (block.kind !== 'richText' || block.autoFit === false) return { width: block.width, height: block.height };
  const width = fitText ? fitTextWidth(block) : block.width;
  const needed = estimateTextHeight({ ...block, width });
  const keep = block.height >= needed && block.height <= needed * HEIGHT_TOLERANCE;
  return { width, height: keep ? block.height : needed };
}

function sameColumn(a: TidyBlock, b: TidyBlock): boolean {
  const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  return overlap >= Math.min(a.width, b.width) * COLUMN_OVERLAP;
}

function isLaidOut(block: TidyBlock): boolean {
  return block.kind !== 'connector' && [block.x, block.y, block.width, block.height].every((n) => typeof n === 'number');
}

interface Placed {
  block: TidyBlock;
  change: TidyChange;
}

/** Where a block's top goes: below everything above it in its column, closing gaps unless told not to. */
function topOf(block: TidyBlock, above: Placed[], options: Required<Pick<TidyOptions, 'gap' | 'margin' | 'closeGaps'>>): number {
  if (above.length === 0) return options.closeGaps ? Math.min(block.y, options.margin) : block.y;
  const clear = Math.max(...above.map((p) => p.change.y + p.change.height + options.gap));
  return options.closeGaps ? clear : Math.max(block.y, clear);
}

const DEFAULT_PAGE_HEIGHT = 1123;

/**
 * Blocks that sit below the page bottom. A block that is first in its column stays even when too tall (it cannot go
 * anywhere better), so every page keeps something and a cascade over pages always ends.
 */
function spilledBlocks(placed: Placed[], limit: number): Placed[] {
  return placed.filter((p, i) => p.change.y + p.change.height > limit && placed.slice(0, i).some((q) => sameColumn(q.block, p.block)));
}

/** Where blocks that leave the page land on the next one: stacked from the top margin, column by column. */
function layoutOnNextPage(spilled: Placed[], rules: { gap: number; margin: number }): Map<string, TidyChange> {
  const moved = tidyLayout(spilled.map((p) => ({ ...p.block, ...p.change })), { gap: rules.gap, margin: rules.margin, closeGaps: true, fitText: false });
  return new Map(spilled.map((p) => [p.block.id, { ...p.change, ...moved.get(p.block.id), overflow: true }]));
}

/** Returns the new `y`, `height` and `width` of every block that changes. Connectors and unplaced blocks are left alone. */
export function tidyLayout(blocks: TidyBlock[], options: TidyOptions = {}): Map<string, TidyChange> {
  const rules = { gap: options.gap ?? DEFAULT_GAP, margin: options.margin ?? DEFAULT_MARGIN, closeGaps: options.closeGaps ?? true };
  const ordered = blocks.filter(isLaidOut).sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: Placed[] = [];

  for (const block of ordered) {
    const size = fittedSize(block, options.fitText ?? true);
    const above = placed.filter((p) => sameColumn(p.block, block));
    placed.push({ block, change: { y: topOf(block, above, rules), ...size } });
  }

  const leaving = options.overflow === 'newPage' ? movesToNextPage(placed, options.pageHeight ?? DEFAULT_PAGE_HEIGHT, rules) : new Map<string, TidyChange>();
  return collectChanges(placed, leaving);
}

/** Blocks that no longer fit, with their place on the next page; empty when everything fits. */
function movesToNextPage(placed: Placed[], pageHeight: number, rules: { gap: number; margin: number }): Map<string, TidyChange> {
  const spilled = spilledBlocks(placed, pageHeight - rules.margin);
  return spilled.length > 0 ? layoutOnNextPage(spilled, rules) : new Map<string, TidyChange>();
}

/** Only what differs from the input: blocks leaving the page, and blocks whose y, width or height changed. */
function collectChanges(placed: Placed[], leaving: Map<string, TidyChange>): Map<string, TidyChange> {
  const changes = new Map<string, TidyChange>();
  for (const { block, change } of placed) {
    const moved = change.y !== block.y || change.height !== block.height || change.width !== block.width;
    const next = leaving.get(block.id) ?? (moved ? change : undefined);
    if (next) changes.set(block.id, next);
  }
  return changes;
}
