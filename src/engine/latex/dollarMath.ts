// Splits text that mixes prose with $...$ and $$...$$ math into segments, and lays out display math.

export type DollarMathSegment = { type: 'text' | 'math'; content: string; display?: boolean };

/** A $$display$$ or $inline$ span starting at i, if it closes (an empty $$ pair is not inline math). */
function matchMath(source: string, i: number): { segment: DollarMathSegment; next: number } | null {
  if (source.startsWith('$$', i)) {
    const end = source.indexOf('$$', i + 2);
    if (end !== -1) return { segment: { type: 'math', content: source.slice(i + 2, end), display: true }, next: end + 2 };
  }
  if (source[i] === '$') {
    const end = source.indexOf('$', i + 1);
    if (end !== -1 && end > i + 1) return { segment: { type: 'math', content: source.slice(i + 1, end), display: false }, next: end + 1 };
  }
  return null;
}

export function splitDollarMathSegments(source: string): DollarMathSegment[] {
  const segments: DollarMathSegment[] = [];
  let i = 0;
  let textBuffer = '';
  const flushText = () => {
    if (textBuffer) segments.push({ type: 'text', content: textBuffer });
    textBuffer = '';
  };

  while (i < source.length) {
    if (source[i] === '\\' && source[i + 1] === '$') {
      textBuffer += '$';
      i += 2;
      continue;
    }
    const math = matchMath(source, i);
    if (math) {
      flushText();
      segments.push(math.segment);
      i = math.next;
      continue;
    }
    textBuffer += source[i];
    i++;
  }

  flushText();
  return segments;
}

const isBlockMath = (seg: DollarMathSegment | undefined): boolean => seg?.type === 'math' && seg.display === true;

/** What shares the line on one side of a segment: '' when that side is empty, otherwise a non-blank marker. */
function neighbourOnLine(seg: DollarMathSegment | undefined, side: 'before' | 'after'): string {
  if (!seg || isBlockMath(seg)) return '';
  if (seg.type === 'math') return 'x';
  const lines = seg.content.split('\n');
  return (side === 'before' ? lines[lines.length - 1] : lines[0]).trim();
}

/**
 * Text boxes flow math with the prose: $$..$$ stays a centred display block only when it is alone on its line.
 * Next to a bullet or words it renders inline, so "- $$a=b$$" is one bullet line, not an empty bullet plus a block.
 * Newlines touching a real block are dropped (the block already breaks the line) and runs of blank lines collapse,
 * so no gap appears that the author did not type.
 */
export function layoutMathSegments(segments: DollarMathSegment[]): DollarMathSegment[] {
  const placed = segments.map((seg, i): DollarMathSegment => {
    if (!isBlockMath(seg)) return seg;
    const alone = neighbourOnLine(segments[i - 1], 'before') === '' && neighbourOnLine(segments[i + 1], 'after') === '';
    return alone ? seg : { ...seg, display: false };
  });
  return placed
    .map((seg, i): DollarMathSegment => {
      if (seg.type !== 'text') return seg;
      let content = seg.content.replace(/\n{3,}/g, '\n\n');
      if (isBlockMath(placed[i - 1])) content = content.replace(/^[ \t]*\n/, '');
      if (isBlockMath(placed[i + 1])) content = content.replace(/\n[ \t]*$/, '');
      return { ...seg, content };
    })
    .filter((seg) => seg.type !== 'text' || seg.content !== '');
}
