import { parseViewBox } from '../../shared/stageSize';
import type { BuilderBlock, VisualElementSpec, VisualSpec } from '../../types/visualSpec';
import { addBlock } from '../blocks';
import { addShape, deleteElements, isOwner, moveElements, moveInOrder, renameBuilderElement, resizeElement, setElementStyle, setShapeText } from '../builderEdits';
import { addBuilderStep, setStepFields } from '../builderSteps';
import { POINTER_HEIGHT, POINTER_WIDTH, boxCenter, elementBox } from '../builderGeometry';
import { moveAtStep } from '../sceneEdits';
import { algorithmText, isNamedAs, textVariants } from '../domains/algorithmText';
import { shapeText } from './shapeText';

// A tape is built from a list of symbols, never drawn by hand: the symbols fix the cells, the cells fix the scale, and every part
// carries a name the model reads back (`Cell 3`, `Index 3`, `Head`), so the user edits the text of the tape and nothing else.
// The names come from the language tables; reading them back accepts every language's wording, so switching language never loses a tape.

export const MAX_TAPE_CELLS = 24;
const MIN_CELL = 28;
const MAX_CELL = 72;
const CELL_GAP = 4;
const SIDE_MARGIN = 32;
const ROW_Y = 0.4;
// The strip reaches 8 px below the cells; the head sits just under it, pointing at its cell, and the indices ride above the strip.
const HEAD_GAP = 16;
const HEAD_LABEL_GAP = 8;
const HEAD_LABEL_WIDTH = 56;
const STARTER_SYMBOLS = ['1', '0', '0', '1', '0'];

export interface TapeModel {
  symbols: string[];
  head: number;
}

const nameOf = (el: VisualElementSpec): string => el.builder?.name ?? '';
const owners = (spec: VisualSpec): VisualElementSpec[] => spec.elements.filter(isOwner);

// The number after a numbered name (`Cell 3`) in any language, or -1.
function numberedIn(name: string, key: 'tapeCellName' | 'tapeIndexName'): number {
  const word = textVariants(key).find((variant) => name.startsWith(`${variant} `));
  return word === undefined ? -1 : Number(name.slice(word.length + 1));
}

const cellNumber = (el: VisualElementSpec): number => numberedIn(nameOf(el), 'tapeCellName');
const isFixedPart = (el: VisualElementSpec): boolean => ['tapeHeadName', 'tapeHeadLabelName', 'tapeStripName'].some((key) => isNamedAs(nameOf(el), key as 'tapeHeadName'));
const isTapePart = (el: VisualElementSpec): boolean => cellNumber(el) >= 0 || numberedIn(nameOf(el), 'tapeIndexName') >= 0 || isFixedPart(el);

const cellsOf = (spec: VisualSpec): VisualElementSpec[] => owners(spec).filter((el) => cellNumber(el) >= 0).sort((a, b) => cellNumber(a) - cellNumber(b));
const byKey = (spec: VisualSpec, key: 'tapeHeadName' | 'tapeHeadLabelName' | 'tapeStripName'): VisualElementSpec | undefined => owners(spec).find((el) => isNamedAs(nameOf(el), key));
const centreX = (el: VisualElementSpec): number => boxCenter(elementBox(el)).x;

const labelText = shapeText;

export function readTape(spec: VisualSpec): TapeModel | null {
  const cells = cellsOf(spec);
  if (cells.length === 0) return null;
  const head = byKey(spec, 'tapeHeadName');
  const distance = (index: number): number => (head ? Math.abs(centreX(cells[index]) - centreX(head)) : index);
  const nearest = cells.reduce((best, _cell, index) => (distance(index) < distance(best) ? index : best), 0);
  return { symbols: cells.map((cell) => labelText(spec, cell)), head: nearest };
}

// "1001", "1 0 0 1" and "a,b,c" all work: with a space or comma the tokens are the symbols, otherwise each character is.
export function parseTapeInput(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed === '') return [];
  const tokens = /[\s,]/.test(trimmed) ? trimmed.split(/[\s,]+/).filter(Boolean) : [...trimmed];
  return tokens.slice(0, MAX_TAPE_CELLS).map((token) => token.slice(0, 3));
}

export const tapeText = (spec: VisualSpec): string => {
  const model = readTape(spec);
  if (!model) return '';
  return model.symbols.every((symbol) => symbol.length === 1) ? model.symbols.join('') : model.symbols.join(' ');
};

interface Layout {
  size: number;
  pitch: number;
  first: number;
  row: number;
  viewWidth: number;
}

// A tape can sit higher or be smaller when it rides along another drawing (the input of an automaton).
export interface TapeOptions {
  row?: number;
  maxCell?: number;
}

function layoutFor(spec: VisualSpec, count: number, options: TapeOptions = {}): Layout {
  const view = parseViewBox(spec.viewBox);
  const fitted = Math.floor((view.w - SIDE_MARGIN * 2) / count) - CELL_GAP;
  const size = Math.max(MIN_CELL, Math.min(options.maxCell ?? MAX_CELL, fitted));
  const pitch = size + CELL_GAP;
  const total = count * pitch - CELL_GAP;
  return { size, pitch, first: (view.w - total) / 2 + size / 2, row: view.h * (options.row ?? ROW_Y), viewWidth: view.w };
}

type Say = (key: Parameters<typeof algorithmText>[0], values?: Record<string, string>) => string;

interface Part {
  shape: 'box' | 'caption' | 'pointer' | 'rounded';
  name: string;
  at: { x: number; y: number };
  w: number;
  h: number;
  text?: string;
  group?: string;
}

function place(spec: VisualSpec, part: Part): VisualSpec {
  const added = addShape(spec, part.shape, part.at);
  const sized = resizeElement(added.spec, added.id, { x: part.at.x - part.w / 2, y: part.at.y - part.h / 2, w: part.w, h: part.h });
  const named = renameBuilderElement(sized, added.id, part.name);
  const grouped: VisualSpec = {
    ...named,
    elements: named.elements.map((el) => (el.id === added.id ? { ...el, builder: { ...el.builder, group: part.group ?? 'tape-0' } } : el)),
  };
  return part.text === undefined ? grouped : setShapeText(grouped, added.id, part.text);
}

function withStrip(spec: VisualSpec, layout: Layout, count: number, say: Say): VisualSpec {
  const width = count * layout.pitch + CELL_GAP * 2;
  const drawn = place(spec, { shape: 'rounded', name: say('tapeStripName'), at: { x: layout.viewWidth / 2, y: layout.row }, w: width, h: layout.size + 16 });
  const strip = byKey(drawn, 'tapeStripName');
  if (!strip) return drawn;
  return moveInOrder(setElementStyle(drawn, strip.id, { fill: 'none', stroke: 'var(--text-3)' }), strip.id, 'back');
}

function withCell(spec: VisualSpec, layout: Layout, symbol: string, index: number, say: Say): VisualSpec {
  const x = layout.first + index * layout.pitch;
  const cell = place(spec, { shape: 'caption', name: `${say('tapeCellName')} ${index}`, at: { x, y: layout.row }, w: layout.size, h: layout.size, text: symbol });
  const above = { x, y: layout.row - layout.size / 2 - 22 };
  return place(cell, { shape: 'caption', name: `${say('tapeIndexName')} ${index}`, at: above, w: Math.max(24, layout.size * 0.6), h: 22, text: String(index) });
}

function withHead(spec: VisualSpec, layout: Layout, head: number, say: Say): VisualSpec {
  const x = layout.first + head * layout.pitch;
  const top = layout.row + layout.size / 2 + HEAD_GAP;
  const drawn = place(spec, { shape: 'pointer', name: say('tapeHeadName'), at: { x, y: top + POINTER_HEIGHT / 2 }, w: POINTER_WIDTH, h: POINTER_HEIGHT });
  // Beside the arrow, not above the tape: above it the caption ran off the top of a drawing that starts near the top edge.
  const beside = { x: x + POINTER_WIDTH / 2 + HEAD_LABEL_GAP + HEAD_LABEL_WIDTH / 2, y: top + POINTER_HEIGHT / 2 };
  return place(drawn, { shape: 'caption', name: say('tapeHeadLabelName'), at: beside, w: HEAD_LABEL_WIDTH, h: 22, text: say('tapeHeadText') });
}

// Replaces the whole tape (cells, indices, head, strip) from the symbols; the head keeps its cell number when it still exists.
export function setTape(spec: VisualSpec, symbols: string[], headIndex?: number, lang = 'en', options: TapeOptions = {}): VisualSpec {
  const say: Say = (key, values) => algorithmText(key, lang, values);
  const kept = symbols.slice(0, MAX_TAPE_CELLS);
  const previous = readTape(spec);
  const stripped = deleteElements(spec, spec.elements.filter(isTapePart).map((el) => el.id));
  if (kept.length === 0) return stripped;
  const head = Math.min(kept.length - 1, Math.max(0, headIndex ?? previous?.head ?? Math.floor(kept.length / 2)));
  const layout = layoutFor(stripped, kept.length, options);
  const cells = kept.reduce((acc, symbol, index) => withCell(acc, layout, symbol, index, say), withStrip(stripped, layout, kept.length, say));
  return withHead(cells, layout, head, say);
}

// The drawn parts of the tape, in cell order, so another run can light and move them in its own steps.
export function tapeParts(spec: VisualSpec): { cells: VisualElementSpec[]; head?: VisualElementSpec; headLabel?: VisualElementSpec } {
  return { cells: cellsOf(spec), head: byKey(spec, 'tapeHeadName'), headLabel: byKey(spec, 'tapeHeadLabelName') };
}

export const newTape = (spec: VisualSpec, lang = 'en'): VisualSpec => setTape(spec, STARTER_SYMBOLS, 2, lang);

// The head and its caption move together, one cell at a time, and stay on the tape.
export function moveHead(spec: VisualSpec, delta: number): VisualSpec {
  const model = readTape(spec);
  const head = byKey(spec, 'tapeHeadName');
  const caption = byKey(spec, 'tapeHeadLabelName');
  const cells = cellsOf(spec);
  if (!model || !head) return spec;
  const target = Math.min(cells.length - 1, Math.max(0, model.head + delta));
  const dx = centreX(cells[target]) - centreX(head);
  return Math.abs(dx) < 0.5 ? spec : moveElements(spec, [head.id, ...(caption ? [caption.id] : [])], dx, 0);
}

const block = (action: BuilderBlock['action'], target: string): BuilderBlock => ({ action, target, speed: 'normal' });

// One step per cell from the head to the right end: the head slides onto the cell and the cell lights up, the previous one calms.
export function scanTape(spec: VisualSpec, lang = 'en'): VisualSpec {
  const model = readTape(spec);
  const head = byKey(spec, 'tapeHeadName');
  const caption = byKey(spec, 'tapeHeadLabelName');
  const cells = cellsOf(spec);
  if (!model || !head) return spec;
  const movers = [head.id, ...(caption ? [caption.id] : [])];
  return cells.slice(model.head).reduce((current, cell, offset) => {
    const added = addBuilderStep(current);
    const step = added.steps.length - 1;
    const symbol = labelText(current, cell) || algorithmText('tapeBlank', lang);
    const why = algorithmText('tapeWhy', lang, { number: String(model.head + offset) });
    const titled = setStepFields(added, step, { whatChanged: algorithmText('tapeRead', lang, { symbol }), why, together: true });
    const previous = offset > 0 ? [block('calm', cells[model.head + offset - 1].id)] : [];
    const lit = [...previous, block('highlight', cell.id)].reduce((acc, item) => addBlock(acc, step, item), titled);
    if (offset === 0) return lit;
    return moveAtStep(lit, step, movers, centreX(cell) - centreX(cells[model.head + offset - 1]), 0);
  }, spec);
}
