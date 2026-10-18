import { stripMarkdown } from './stripMarkdown.js';
import { isNetworkDevice } from './networkDevices.js';
import { toMm, type ConvertedSceneObject } from './convertedSceneObject.js';
import { minFitWidthPx } from '../geometry/tableColumns.js';
import { convertDeviceNode, convertGraphZone, convertShapeBlock } from './networkDeviceObjects.js';

export type { ConvertedSceneObject };

export type BlockRecord = Record<string, unknown>;

export interface BlockDimensions {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function readLocalizedText(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object') {
    const loc = val as { en?: string; he?: string };
    return loc.en || loc.he || '';
  }
  return '';
}

function resolveBlockText(block: BlockRecord): string {
  const body = readLocalizedText(block.body);
  const title = readLocalizedText(block.title);
  const combined = title && body && !body.includes(title) ? `${title}\n\n${body}` : body || title;
  return block.variant === 'code' ? combined : stripMarkdown(combined);
}

function blockFontSize(block: BlockRecord, fallback: number): number {
  const size = block.fontSize;
  return typeof size === 'number' && size >= 6 && size <= 72 ? size : fallback;
}

function validColWidths(raw: unknown, cols: number): raw is number[] {
  return Array.isArray(raw) && raw.length === cols && raw.every((n) => typeof n === 'number' && n > 0);
}

function convertGraphNode(node: Record<string, unknown>, startX: number, startY: number): ConvertedSceneObject {
  if (isNetworkDevice(node.device)) return convertDeviceNode(node, node.device, startX, startY);
  const id = String(node.id || `node-${Math.random().toString(36).slice(2, 7)}`);
  return {
    id,
    type: 'node',
    x: startX + toMm(node.x, 0),
    y: startY + toMm(node.y, 0),
    w: 18,
    h: 18,
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      label: String(node.label || id),
      shape: 'circle',
      fill: (node.color as string) || 'transparent',
      stroke: 'var(--text-1)',
      strokeWidth: 0.4,
      textColor: 'var(--text-1)',
      fontSize: 11,
      start: Boolean(node.start),
      accept: Boolean(node.accept),
    },
  };
}

function convertGraphEdge(edge: Record<string, unknown>): ConvertedSceneObject {
  const id = String(edge.id || `edge-${Math.random().toString(36).slice(2, 7)}`);
  return {
    id,
    type: 'edge',
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    rotation: 0,
    zIndex: 4,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      sourceId: String(edge.from || ''),
      targetId: String(edge.to || ''),
      sourcePort: null,
      targetPort: null,
      directed: edge.directed !== false,
      curvature: 0,
      label: (edge.label as string) || '',
      stroke: 'var(--text-1)',
      strokeWidth: 0.5,
      dash: false,
    },
  };
}

function convertGraphBlock(block: BlockRecord, startX: number, startY: number): ConvertedSceneObject[] {
  const state = (block.state as { nodes?: Array<Record<string, unknown>>; edges?: Array<Record<string, unknown>>; zones?: Array<Record<string, unknown>> } | undefined) ?? {};
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];
  const edges = Array.isArray(state.edges) ? state.edges : [];
  const zones = Array.isArray(state.zones) ? state.zones : [];
  return [
    ...zones.map((z) => convertGraphZone(z, String(block.id ?? 'graph'), startX, startY)),
    ...nodes.map((n) => convertGraphNode(n, startX, startY)),
    ...edges.map(convertGraphEdge),
  ];
}

function convertUmlBlock(block: BlockRecord, d: BlockDimensions): ConvertedSceneObject {
  return {
    ...d,
    type: 'uml-class',
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      className: String(block.className || block.name || 'Class'),
      fields: Array.isArray(block.fields) ? block.fields : [],
      methods: Array.isArray(block.methods) ? block.methods : [],
    },
  };
}

const asBool = (v: unknown): boolean => v === true;
const stringOr = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);
const numberOr = (v: unknown, fallback: number): number => (typeof v === 'number' ? v : fallback);

function convertNodeBlock(block: BlockRecord, d: BlockDimensions): ConvertedSceneObject {
  return {
    ...d,
    type: 'node',
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      label: String(block.label ?? d.id),
      shape: block.shape === 'rect' ? 'rect' : 'circle',
      fill: stringOr(block.fill, 'transparent'),
      stroke: stringOr(block.stroke, 'var(--text-1)'),
      strokeWidth: numberOr(block.strokeWidth, 0.4),
      textColor: stringOr(block.textColor, 'var(--text-1)'),
      fontSize: blockFontSize(block, 11),
      start: asBool(block.start),
      accept: asBool(block.accept),
    },
  };
}

function convertEdgeBlock(block: BlockRecord, d: BlockDimensions): ConvertedSceneObject {
  return {
    ...d,
    type: 'edge',
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    rotation: 0,
    zIndex: 4,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      sourceId: String(block.sourceId ?? block.from ?? ''),
      targetId: String(block.targetId ?? block.to ?? ''),
      sourcePort: block.sourcePort ?? null,
      targetPort: block.targetPort ?? null,
      directed: block.directed !== false,
      curvature: numberOr(block.curvature, 0),
      label: String(block.label ?? ''),
      stroke: stringOr(block.stroke, 'var(--text-1)'),
      strokeWidth: numberOr(block.strokeWidth, 0.5),
      dash: asBool(block.dash),
    },
  };
}

function convertConnectorBlock(block: BlockRecord, d: BlockDimensions): ConvertedSceneObject {
  return convertEdgeBlock(
    { ...block, sourceId: block.fromBlockId, targetId: block.toBlockId, directed: block.style !== 'line' },
    d
  );
}

function convertMediaBlock(block: BlockRecord, d: BlockDimensions): ConvertedSceneObject {
  return {
    ...d,
    type: 'image',
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: { src: String(block.src || ''), fit: 'contain', opacity: 1 },
  };
}

function convertFormulaBlock(block: BlockRecord, d: BlockDimensions): ConvertedSceneObject {
  return {
    ...d,
    type: 'formula',
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: { latex: String(block.latex || block.body || ''), display: true, fontSize: 16 },
  };
}

function convertTextBlock(block: BlockRecord, d: BlockDimensions): ConvertedSceneObject {
  return {
    ...d,
    type: 'text',
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      text: resolveBlockText(block),
      fontSize: blockFontSize(block, 12),
      color: 'var(--text-1)',
      align: 'left',
      variant: block.variant === 'sticky' ? 'sticky' : 'text',
      ...(typeof block.fill === 'string' && block.fill ? { fill: block.fill } : {}),
      ...(block.autoFit === false ? { autoFit: false } : {}),
      ...(typeof block.maxWidth === 'number' ? { maxWidth: toMm(block.maxWidth, 0) } : {}),
    },
  };
}

const MAX_TABLE_ROWS = 30;
const MAX_TABLE_COLS = 12;

const PT_TO_PX = 96 / 72;
const MIN_TABLE_W_MM = 8;

function tableFit(block: BlockRecord, cells: string[][], cols: number, givenW: number): Record<string, unknown> & { w: number } {
  const fits = block.autoFit !== false && !validColWidths(block.colWidths, cols);
  if (!fits) return { w: givenW };
  const cap = typeof block.maxWidth === 'number' ? toMm(block.maxWidth, 0) : givenW;
  const natural = toMm(minFitWidthPx(cells, cols, blockFontSize(block, 11) * PT_TO_PX), 0);
  return { w: natural > 0 ? Math.max(MIN_TABLE_W_MM, Math.min(cap, natural)) : givenW, maxWidth: cap };
}

function convertTableBlock(block: BlockRecord, d: BlockDimensions): ConvertedSceneObject {
  const header = Array.isArray(block.columns) ? block.columns.map(readLocalizedText) : [];
  const body = Array.isArray(block.rows)
    ? (block.rows as unknown[]).map((row) => (Array.isArray(row) ? row.map(readLocalizedText) : []))
    : [];
  const grid = (header.length > 0 ? [header, ...body] : body).slice(0, MAX_TABLE_ROWS);
  const cols = Math.min(MAX_TABLE_COLS, Math.max(1, ...grid.map((row) => row.length)));
  const cells = grid.map((row) => Array.from({ length: cols }, (_, c) => row[c] ?? ''));
  const { w, ...fit } = tableFit(block, cells, cols, d.w);
  return {
    ...d,
    w,
    type: 'table',
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      rows: Math.max(1, cells.length),
      cols,
      cells,
      headerRow: header.length > 0,
      ...(validColWidths(block.colWidths, cols) ? { colWidths: block.colWidths } : {}),
      ...fit,
      ...(block.autoFit === false ? { autoFit: false } : {}),
      fontSize: blockFontSize(block, 11),
      color: 'var(--text-1)',
      fill: 'var(--ac-18)',
      stroke: 'var(--text-1)',
      strokeWidth: 0.3,
    },
  };
}

type BlockConverter = (block: BlockRecord, d: BlockDimensions) => ConvertedSceneObject;

const BLOCK_CONVERTERS: Record<string, BlockConverter> = {
  umlClass: convertUmlBlock,
  'uml-class': convertUmlBlock,
  image: convertMediaBlock,
  pdf: convertMediaBlock,
  video: convertMediaBlock,
  formula: convertFormulaBlock,
  node: convertNodeBlock,
  shape: convertShapeBlock,
  edge: convertEdgeBlock,
  connector: convertConnectorBlock,
  data: (block, d) => (block.format === 'json' ? convertTextBlock(block, d) : convertTableBlock(block, d)),
};

export function convertSingleBlock(block: BlockRecord, fallbackId: string): ConvertedSceneObject[] {
  const kind = String(block.kind || 'richText');
  const d: BlockDimensions = {
    id: String(block.id || fallbackId),
    x: toMm(block.x, 20),
    y: toMm(block.y, 20),
    w: Math.max(10, toMm(block.width, 100)),
    h: Math.max(10, toMm(block.height, 50)),
  };

  if (kind === 'graph') return convertGraphBlock(block, d.x, d.y);
  const convert = BLOCK_CONVERTERS[kind] ?? convertTextBlock;
  return [convert(block, d)];
}
