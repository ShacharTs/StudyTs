import katex from 'katex';

// One LaTeX dialect for the canvas and the lessons: the same shortcuts, macros and error look everywhere.
interface RenderResult {
  html: string;
  error: string | null;
}

const SHORTCUTS: [RegExp, string][] = [
  [/<=>/g, ' \\iff '],
  [/<->/g, ' \\leftrightarrow '],
  [/-->/g, ' \\longrightarrow '],
  [/<--/g, ' \\longleftarrow '],
  [/\|->/g, ' \\mapsto '],
  [/->/g, ' \\to '],
  [/<-/g, ' \\gets '],
  [/=>/g, ' \\Rightarrow '],
];

const MACROS: Record<string, string> = {
  '\\implies': '\\Rightarrow',
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
  '\\F': '\\mathbb{F}',
};

export function preprocessLatex(latex: string): string {
  let out = latex;
  for (const [re, rep] of SHORTCUTS) out = out.replace(re, rep);
  return out;
}

// Shared by every KaTeX call so a formula renders the same in a lesson and on the canvas.
export function dialectOptions(display: boolean) {
  return {
    displayMode: display,
    throwOnError: false,
    errorColor: 'var(--accent-danger)',
    strict: 'ignore' as const,
    macros: MACROS,
    output: 'html' as const,
  };
}

export function isValidLatex(latex: string): boolean {
  try {
    katex.renderToString(preprocessLatex(latex), { throwOnError: true, strict: 'ignore', macros: MACROS });
    return true;
  } catch {
    return false;
  }
}

export function renderLatex(latex: string, display: boolean): RenderResult {
  try {
    return { html: katex.renderToString(preprocessLatex(latex), dialectOptions(display)), error: null };
  } catch (e) {
    return { html: '', error: e instanceof Error ? e.message : 'Invalid LaTeX' };
  }
}
