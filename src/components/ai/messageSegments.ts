// src/components/ai/messageSegments.ts
export type MessageSegment =
  | { kind: 'text'; text: string }
  | { kind: 'code'; language: string; code: string; closed: boolean };

interface ParserState {
  inFence: boolean;
  language: string;
  codeBuffer: string[];
  textBuffer: string;
  segments: MessageSegment[];
}

function handleOutsideFence(line: string, isLastLine: boolean, state: ParserState) {
  if (line.startsWith('```')) {
    if (state.textBuffer.length > 0) {
      state.segments.push({ kind: 'text', text: state.textBuffer });
      state.textBuffer = '';
    }
    state.inFence = true;
    state.language = line.slice(3).trim();
    state.codeBuffer = [];
  } else {
    state.textBuffer += isLastLine ? line : `${line}\n`;
  }
}

function handleInsideFence(line: string, state: ParserState) {
  if (line.trim() === '```') {
    state.inFence = false;
    state.segments.push({
      kind: 'code',
      language: state.language,
      code: state.codeBuffer.join('\n'),
      closed: true,
    });
    state.codeBuffer = [];
  } else {
    state.codeBuffer.push(line);
  }
}

/** Splits markdown message stream into text and fenced code segments. */
export function splitFencedCode(content: string): MessageSegment[] {
  if (!content) return [];

  const lines = content.split('\n');
  const state: ParserState = {
    inFence: false,
    language: '',
    codeBuffer: [],
    textBuffer: '',
    segments: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLastLine = i === lines.length - 1;

    if (!state.inFence) {
      handleOutsideFence(line, isLastLine, state);
    } else {
      handleInsideFence(line, state);
    }
  }

  if (state.inFence) {
    state.segments.push({
      kind: 'code',
      language: state.language,
      code: state.codeBuffer.join('\n'),
      closed: false,
    });
  } else if (state.textBuffer.length > 0) {
    state.segments.push({ kind: 'text', text: state.textBuffer });
  }

  return state.segments;
}
