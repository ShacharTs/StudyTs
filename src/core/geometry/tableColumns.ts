/** Content-sized table columns ("best fit") and the narrowest table that holds its text on single lines ("min fit"). */
export interface ColumnFitOptions {
  /** Width the table has to lay out in, in px. */
  widthPx: number;
  /** Font size of the cells, in px. */
  fontPx: number;
}

// Average glyph width as a share of the font size, and the cell padding left and right together (TableView.module.css: 1.2mm a side).
const GLYPH_EM = 0.55;
const CELL_PAD_PX = 9;
const MIN_FRACTION = 0.05;

interface ColumnNeed {
  /** Pixels to show the longest cell line without wrapping. */
  widest: number;
  /** Pixels to show the longest word without breaking it. */
  narrowest: number;
}

const longest = (texts: string[]): number => texts.reduce((max, text) => Math.max(max, text.length), 0);

function needOf(grid: string[][], col: number, fontPx: number): ColumnNeed {
  const cells = grid.map((row) => row[col] ?? '');
  const lines = cells.flatMap((cell) => cell.split('\n'));
  const words = lines.flatMap((line) => line.split(/\s+/));
  const toPx = (chars: number) => chars * fontPx * GLYPH_EM + CELL_PAD_PX;
  return { widest: toPx(longest(lines)), narrowest: toPx(longest(words)) };
}

const equal = (cols: number): number[] => Array.from({ length: Math.max(1, cols) }, () => 1 / Math.max(1, cols));

/** Floors every column at 5% and rescales so the fractions sum to 1. */
function normalise(widths: number[]): number[] {
  const total = widths.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return equal(widths.length);
  const floored = widths.map((w) => Math.max(MIN_FRACTION, w / total));
  const sum = floored.reduce((a, b) => a + b, 0);
  return floored.map((w) => w / sum);
}

/**
 * Column widths as fractions of the table width, the way a browser's auto table layout shares them: when every column's
 * longest line fits, by that length; otherwise each column keeps its longest word and the spare width goes to the columns
 * with the most to gain.
 */
export function autoColumnFractions(grid: string[][], cols: number, { widthPx, fontPx }: ColumnFitOptions): number[] {
  if (cols <= 1 || grid.length === 0) return equal(cols);
  const needs = Array.from({ length: cols }, (_, c) => needOf(grid, c, fontPx));
  const widest = needs.reduce((sum, n) => sum + n.widest, 0);
  if (widest <= widthPx) return normalise(needs.map((n) => n.widest));

  const narrowest = needs.reduce((sum, n) => sum + n.narrowest, 0);
  const spare = Math.max(0, widthPx - narrowest);
  const gain = needs.reduce((sum, n) => sum + (n.widest - n.narrowest), 0);
  return normalise(needs.map((n) => n.narrowest + (gain > 0 ? (spare * (n.widest - n.narrowest)) / gain : 0)));
}

/** The smallest table width, in px, that shows every column's longest line on one line. Zero for an empty grid. */
export function minFitWidthPx(grid: string[][], cols: number, fontPx: number): number {
  if (grid.length === 0) return 0;
  return Math.ceil(Array.from({ length: Math.max(1, cols) }, (_, c) => needOf(grid, c, fontPx).widest).reduce((a, b) => a + b, 0));
}
