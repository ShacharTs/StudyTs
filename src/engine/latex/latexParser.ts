// src/engine/latex/latexParser.ts
import { isValidLatex } from './latexDialect';

export interface LatexSegment {
  type: 'text' | 'math' | 'display';
  content: string;
}

interface DelimiterMatch {
  idx: number;
  type: 'dollar_display' | 'bracket_display' | 'paren_inline' | 'dollar_inline';
  len: number;
}

function findNextOpeningDelimiter(text: string, start: number): DelimiterMatch | null {
  const ddIdx = text.indexOf('$$', start);
  const bdIdx = text.indexOf('\\[', start);
  const piIdx = text.indexOf('\\(', start);

  // Find single '$' that is not '$$'
  let siIdx = -1;
  let p = start;
  while (p < text.length) {
    const idx = text.indexOf('$', p);
    if (idx === -1) break;
    if (text.startsWith('$$', idx)) {
      p = idx + 2;
    } else {
      siIdx = idx;
      break;
    }
  }

  const candidates: DelimiterMatch[] = [];
  if (ddIdx !== -1) candidates.push({ idx: ddIdx, type: 'dollar_display', len: 2 });
  if (bdIdx !== -1) candidates.push({ idx: bdIdx, type: 'bracket_display', len: 2 });
  if (piIdx !== -1) candidates.push({ idx: piIdx, type: 'paren_inline', len: 2 });
  if (siIdx !== -1) candidates.push({ idx: siIdx, type: 'dollar_inline', len: 1 });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.idx - b.idx);
  return candidates[0];
}

const FIXED_CLOSERS: Record<Exclude<DelimiterMatch['type'], 'dollar_inline'>, string> = {
  dollar_display: '$$',
  bracket_display: '\\]',
  paren_inline: '\\)',
};

/** A single '$' that is not half of a '$$'. */
function findSingleDollar(text: string, from: number): number {
  let p = from;
  while (p < text.length) {
    const idx = text.indexOf('$', p);
    if (idx === -1) return -1;
    if (!text.startsWith('$$', idx)) return idx;
    p = idx + 2;
  }
  return -1;
}

function findMatchingClosingDelimiter(
  text: string,
  open: DelimiterMatch
): { closeIdx: number; closeLen: number } | null {
  const searchStart = open.idx + open.len;
  if (open.type === 'dollar_inline') {
    const idx = findSingleDollar(text, searchStart);
    return idx !== -1 ? { closeIdx: idx, closeLen: 1 } : null;
  }
  const closer = FIXED_CLOSERS[open.type];
  const idx = text.indexOf(closer, searchStart);
  return idx !== -1 ? { closeIdx: idx, closeLen: closer.length } : null;
}

/** Text with no delimiters: a whole-string TeX expression, or prose with inline TeX commands. */
function parseBareTex(text: string): LatexSegment[] {
  if (!text.includes('\\')) return [{ type: 'text', content: text }];
  if (isValidLatex(text)) return [{ type: 'math', content: text }];
  const parts = text.split(/(\\text\{[^}]*\}|\\[a-zA-Z]+(?:\{[^}]*\})*(?:_[a-zA-Z0-9{}]+)?)/g);
  const segments = parts
    .filter((part) => part)
    .map((part): LatexSegment => (part.startsWith(String.fromCharCode(92)) && isValidLatex(part) ? { type: 'math', content: part } : { type: 'text', content: part }));
  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
}

export function parseLatexSegments(text: string): LatexSegment[] {
  if (!text) return [];

  const segments: LatexSegment[] = [];
  let currentPos = 0;
  let hasDelimiters = false;

  while (currentPos < text.length) {
    const open = findNextOpeningDelimiter(text, currentPos);
    if (!open) {
      if (currentPos < text.length) {
        const remaining = text.slice(currentPos);
        segments.push({ type: 'text', content: remaining });
      }
      break;
    }

    const close = findMatchingClosingDelimiter(text, open);
    if (!close) {
      // Unclosed delimiter: treat rest of string as text
      const remaining = text.slice(currentPos);
      segments.push({ type: 'text', content: remaining });
      break;
    }

    hasDelimiters = true;
    if (open.idx > currentPos) {
      segments.push({ type: 'text', content: text.slice(currentPos, open.idx) });
    }

    const isDisplay = open.type === 'dollar_display' || open.type === 'bracket_display';
    const mathContent = text.slice(open.idx + open.len, close.closeIdx).trim();

    segments.push({
      type: isDisplay ? 'display' : 'math',
      content: mathContent,
    });

    currentPos = close.closeIdx + close.closeLen;
  }

  if (hasDelimiters) {
    return segments.filter((s) => s.content.length > 0);
  }

  return parseBareTex(text);
}
