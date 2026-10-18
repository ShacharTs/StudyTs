// Canvas text objects render plain text and $math$ only, so markdown markers would show up literally.
const MATH_SPAN = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/;

const LINE_RULES: Array<[RegExp, string]> = [
  [/^\s*```.*$/gm, ''],
  [/^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/gm, ''],
  [/^\s{0,3}#{1,6}\s*/gm, ''],
  [/^\s*>\s?/gm, ''],
  [/^(\s*)[-*+]\s+/gm, '$1• '],
  [/^\s*\|\s?/gm, ''],
  [/\s?\|\s*$/gm, ''],
];

const INLINE_RULES: Array<[RegExp, string]> = [
  [/(\*\*\*|\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2'],
  [/(?<![\w*])\*(?=\S)([^*\n]+?)\*(?!\w)/g, '$1'],
  [/`([^`\n]*)`/g, '$1'],
  [/\*{2,}|_{2,}/g, ''],
];

function stripPlainSegment(segment: string): string {
  return [...LINE_RULES, ...INLINE_RULES].reduce((out, [re, rep]) => out.replace(re, rep), segment);
}

/** Removes markdown syntax from prose while leaving $...$ / $$...$$ math untouched. */
export function stripMarkdown(text: string): string {
  return text
    .split(MATH_SPAN)
    .map((part, i) => (i % 2 === 1 ? part : stripPlainSegment(part)))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
