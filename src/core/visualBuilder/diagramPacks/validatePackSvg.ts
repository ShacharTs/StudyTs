import { parseSvgTemplate, type SvgNode } from './parseSvgTemplate';
import { PACK_LIMITS, type StylePackIssue, type PackIssueCode } from './stylePackFormat';
import { packIssue } from './validatePackPrimitives';

const SVG_TAGS = new Set(['rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'line', 'g']);
const SVG_TOKENS = new Set(['w', 'h', 'hw', 'hh', 'y3a', 'y3b', 'x4b', 'inner']);

// Checked on the raw text before parsing, so a hostile construct is named as such rather than as a syntax error.
const FORBIDDEN_PATTERNS: readonly { pattern: RegExp; message: string }[] = [
  { pattern: /<\s*\/?\s*(script|foreignObject|image|use|style)\b/i, message: 'script, foreignObject, image, use and style are not allowed' },
  { pattern: /<\s*[!?]/, message: 'comments, doctype and processing instructions are not allowed' },
  { pattern: /\son[a-z]+\s*=/i, message: 'event handler attributes are not allowed' },
  { pattern: /\sstyle\s*=/i, message: 'style attributes are not allowed' },
  { pattern: /\b(?:xlink:)?href\s*=\s*"(?!#)/i, message: 'external references are not allowed' },
  { pattern: /url\s*\(/i, message: 'url() is not allowed' },
  { pattern: /javascript:|data:/i, message: 'javascript: and data: URLs are not allowed' },
  { pattern: /&/, message: 'entities are not allowed' },
];

const NUMBER_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?$/i;
const TOKEN_PATTERN = /^\{(\w+)\}$/;
const POINTS_PATTERN = /^\s*-?[\d.]+(?:[\s,]+-?[\d.]+)*\s*$/;
const DASH_PATTERN = /^\s*\d+(?:[\s,]+\d+)*\s*$/;
const PATH_CHARS_PATTERN = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.e-]+$/;
const TRANSFORM_CALL = /(translate|scale|rotate)\(\s*(-?[\d.]+(?:[\s,]+-?[\d.]+){0,2})\s*\)/g;
const THEME_COLOUR_PATTERN = /^var\(--[a-z][a-z0-9-]*\)$/;

type AttrCheck = (value: string) => PackIssueCode | null;

const passIf = (valid: boolean, code: PackIssueCode): PackIssueCode | null => (valid ? null : code);

function numericCheck(value: string): PackIssueCode | null {
  const token = TOKEN_PATTERN.exec(value);
  if (token) return passIf(SVG_TOKENS.has(token[1] ?? ''), 'svg-token');
  return passIf(NUMBER_PATTERN.test(value), 'svg-attr');
}

function transformCheck(value: string): PackIssueCode | null {
  const calls = value.match(TRANSFORM_CALL) ?? [];
  const leftover = value.replace(TRANSFORM_CALL, '').replace(/[\s,]/g, '');
  return passIf(calls.length > 0 && leftover === '', 'svg-attr');
}

function pathCheck(value: string): PackIssueCode | null {
  const valid = value.trim() !== '' && value.length <= PACK_LIMITS.pathChars && PATH_CHARS_PATTERN.test(value);
  return passIf(valid, 'svg-path');
}

function colourCheck(value: string): PackIssueCode | null {
  return passIf(value === 'none' || value === 'currentColor' || THEME_COLOUR_PATTERN.test(value), 'svg-colour');
}

const ATTR_CHECKS = new Map<string, AttrCheck>([
  ...['x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'stroke-width'].map((name): [string, AttrCheck] => [name, numericCheck]),
  ['points', (value) => passIf(POINTS_PATTERN.test(value), 'svg-attr')],
  ['stroke-dasharray', (value) => passIf(DASH_PATTERN.test(value), 'svg-attr')],
  ['transform', transformCheck],
  ['d', pathCheck],
  ['fill', colourCheck],
  ['stroke', colourCheck],
  ['data-role', (value) => passIf(['line', 'solid', 'none'].includes(value), 'svg-attr')],
]);

export function validatePackSvg(svg: string, path: string): StylePackIssue[] {
  if (svg.length > PACK_LIMITS.svgChars) return [packIssue(path, 'svg-too-big', `svg is longer than ${PACK_LIMITS.svgChars} characters`)];
  const forbidden = FORBIDDEN_PATTERNS.find(({ pattern }) => pattern.test(svg));
  if (forbidden) return [packIssue(path, 'svg-forbidden', forbidden.message)];
  const parsed = parseSvgTemplate(svg);
  if (!parsed.ok) return [packIssue(path, 'svg-syntax', parsed.error)];
  return [...limitIssues(parsed.nodes, path), ...parsed.nodes.flatMap((node) => nodeIssues(node, path))];
}

function nodeIssues(node: SvgNode, path: string): StylePackIssue[] {
  const tagIssue = SVG_TAGS.has(node.tag) ? [] : [packIssue(path, 'svg-tag', `<${node.tag}> is not allowed`)];
  const attrIssues = node.attrs.flatMap(([name, value]) => attrIssue(name, value, path));
  return [...tagIssue, ...attrIssues, ...node.children.flatMap((child) => nodeIssues(child, path))];
}

function attrIssue(name: string, value: string, path: string): StylePackIssue[] {
  const check = ATTR_CHECKS.get(name);
  if (!check) return [packIssue(path, 'svg-attr', `attribute ${name} is not allowed`)];
  const code = check(value);
  return code ? [packIssue(path, code, `${name} value is not allowed`)] : [];
}

function limitIssues(nodes: SvgNode[], path: string): StylePackIssue[] {
  const tooMany = countPrimitives(nodes) > PACK_LIMITS.svgPrimitives;
  const tooDeep = maxDepth(nodes, 1) > PACK_LIMITS.svgDepth;
  return tooMany || tooDeep ? [packIssue(path, 'svg-too-big', 'svg has too many elements or nests too deep')] : [];
}

function countPrimitives(nodes: SvgNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countPrimitives(node.children), 0);
}

function maxDepth(nodes: SvgNode[], depth: number): number {
  return nodes.reduce((deepest, node) => Math.max(deepest, depth, maxDepth(node.children, depth + 1)), 0);
}
