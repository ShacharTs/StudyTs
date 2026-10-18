export interface SvgNode {
  tag: string;
  attrs: [string, string][];
  children: SvgNode[];
}

export type SvgParseResult = { ok: true; nodes: SvgNode[] } | { ok: false; error: string };

// Double-quoted attributes only: one quoting style keeps the grammar small enough to audit.
const TAG_PATTERN = /^<(\/?)([A-Za-z][\w-]*)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>/;
const ATTR_PATTERN = /([\w:.-]+)="([^"]*)"/g;

// No DOMParser: the same result on the server, in tests and in the browser.
export function parseSvgTemplate(svg: string): SvgParseResult {
  const root: SvgNode = { tag: '', attrs: [], children: [] };
  const open: SvgNode[] = [root];
  let cursor = 0;
  while (cursor < svg.length) {
    const next = svg.indexOf('<', cursor);
    const textEnd = next === -1 ? svg.length : next;
    if (svg.slice(cursor, textEnd).trim() !== '') return { ok: false, error: 'text is not allowed outside elements' };
    if (next === -1) break;
    const match = TAG_PATTERN.exec(svg.slice(next));
    if (!match) return { ok: false, error: `malformed tag at offset ${next}` };
    const error = applyTag(match, open);
    if (error) return { ok: false, error };
    cursor = next + match[0].length;
  }
  if (open.length !== 1) return { ok: false, error: 'an element is not closed' };
  if (root.children.length === 0) return { ok: false, error: 'svg is empty' };
  return { ok: true, nodes: root.children };
}

function applyTag(match: RegExpExecArray, open: SvgNode[]): string | null {
  const [, closing = '', tag = '', attrText = '', selfClosing = ''] = match;
  const top = open[open.length - 1];
  if (closing) {
    if (open.length < 2 || top.tag !== tag) return `unexpected closing tag </${tag}>`;
    open.pop();
    return null;
  }
  const node: SvgNode = {
    tag,
    attrs: [...attrText.matchAll(ATTR_PATTERN)].map((attr): [string, string] => [attr[1] ?? '', attr[2] ?? '']),
    children: [],
  };
  top.children.push(node);
  if (!selfClosing) open.push(node);
  return null;
}
