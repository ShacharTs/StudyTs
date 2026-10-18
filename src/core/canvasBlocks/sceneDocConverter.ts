import { convertSingleBlock, type ConvertedSceneObject, type BlockRecord } from './blockToSceneObject.js';

export type { ConvertedSceneObject };

export interface ConvertedPage {
  id: string;
  orientation: 'portrait' | 'landscape';
  paperSize: 'A4' | 'Letter' | 'Legal' | 'A3';
  margin: number;
  objects: string[];
}

export interface ConvertedDocState {
  pages: ConvertedPage[];
  objects: Record<string, ConvertedSceneObject>;
}

interface PageData {
  id?: string;
  name?: string;
  blocks?: BlockRecord[];
}

function appendPageBlocks(
  blocks: BlockRecord[],
  prefix: string,
  objects: Record<string, ConvertedSceneObject>
): string[] {
  const ids: string[] = [];
  for (let idx = 0; idx < blocks.length; idx++) {
    const list = convertSingleBlock(blocks[idx], `${prefix}-${idx}`);
    for (const obj of list) {
      objects[obj.id] = obj;
      ids.push(obj.id);
    }
  }
  return ids;
}

export function convertSceneToDocState(scene: Record<string, unknown>): ConvertedDocState {
  const paperSize = (scene.pageSize as ConvertedPage['paperSize']) || 'A4';
  const objects: Record<string, ConvertedSceneObject> = {};
  const rawPages = Array.isArray(scene.pages) && scene.pages.length > 0 ? (scene.pages as PageData[]) : null;

  if (rawPages) {
    const pages = rawPages.map((pageData, pIdx) => {
      const pageId = pageData.id || `page-${pIdx + 1}`;
      const pageBlocks = Array.isArray(pageData.blocks) ? pageData.blocks : [];
      const objIds = appendPageBlocks(pageBlocks, `blk-${pIdx}`, objects);
      return { id: pageId, orientation: 'portrait' as const, paperSize, margin: 20, objects: objIds };
    });
    return { pages, objects };
  }

  const rawBlocks = Array.isArray(scene.blocks) ? (scene.blocks as BlockRecord[]) : [];
  const objIds = appendPageBlocks(rawBlocks, 'blk', objects);
  return {
    pages: [{ id: 'page-1', orientation: 'portrait', paperSize, margin: 20, objects: objIds }],
    objects,
  };
}

const MM_TO_PX = 96 / 25.4;

function toPx(mm: number): number {
  return Math.round(mm * MM_TO_PX);
}

interface ObjectBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  props: Record<string, unknown>;
}

type ObjectToBlockFn = (b: ObjectBounds) => Record<string, unknown>;

const OBJECT_TO_BLOCK_MAP: Record<string, ObjectToBlockFn> = {
  text: (b) => ({
    id: b.id,
    kind: 'richText',
    x: b.x, y: b.y, width: b.width, height: b.height,
    body: String(b.props.text || ''),
    variant: String(b.props.variant || 'text'),
    style: 'card',
    ...(typeof b.props.fontSize === 'number' ? { fontSize: b.props.fontSize } : {}),
    ...(typeof b.props.fill === 'string' ? { fill: b.props.fill } : {}),
    ...(b.props.autoFit === false ? { autoFit: false } : {}),
    ...(typeof b.props.maxWidth === 'number' ? { maxWidth: toPx(b.props.maxWidth) } : {}),
  }),
  formula: (b) => ({
    id: b.id,
    kind: 'richText',
    x: b.x, y: b.y, width: b.width, height: b.height,
    body: String(b.props.latex || ''),
    variant: 'formula',
  }),
  image: (b) => ({
    id: b.id,
    kind: 'image',
    x: b.x, y: b.y, width: b.width, height: b.height,
    src: String(b.props.src || ''),
  }),
  table: (b) => {
    const cells = Array.isArray(b.props.cells) ? (b.props.cells as string[][]) : [];
    const hasHeader = b.props.headerRow !== false && cells.length > 0;
    return {
      id: b.id,
      kind: 'data',
      x: b.x, y: b.y, width: b.width, height: b.height,
      format: 'table',
      columns: hasHeader ? cells[0] : [],
      rows: hasHeader ? cells.slice(1) : cells,
      ...(typeof b.props.fontSize === 'number' ? { fontSize: b.props.fontSize } : {}),
      ...(Array.isArray(b.props.colWidths) ? { colWidths: b.props.colWidths } : {}),
      ...(b.props.autoFit === false ? { autoFit: false } : {}),
      ...(typeof b.props.maxWidth === 'number' ? { maxWidth: toPx(b.props.maxWidth) } : {}),
    };
  },
  'uml-class': (b) => ({
    id: b.id,
    kind: 'umlClass',
    x: b.x, y: b.y, width: b.width, height: b.height,
    className: String(b.props.className || 'Class'),
    fields: Array.isArray(b.props.fields) ? b.props.fields : [],
    methods: Array.isArray(b.props.methods) ? b.props.methods : [],
  }),
};

function objectToCanvasBlock(obj: ConvertedSceneObject, original?: Record<string, unknown>): Record<string, unknown> {
  const b: ObjectBounds = {
    id: obj.id,
    x: toPx(obj.x),
    y: toPx(obj.y),
    width: toPx(obj.w),
    height: toPx(obj.h),
    props: obj.props || {},
  };
  const convert = OBJECT_TO_BLOCK_MAP[obj.type];
  const fresh = convert ? convert(b) : { id: b.id, kind: obj.type, x: b.x, y: b.y, width: b.width, height: b.height, ...b.props };
  if (!original || original.kind !== fresh.kind) return fresh;
  return { ...original, ...fresh, variant: original.variant ?? fresh.variant, style: original.style ?? fresh.style };
}

function blocksById(scene: Record<string, unknown>): Map<string, Record<string, unknown>> {
  const pages = Array.isArray(scene.pages) ? (scene.pages as Array<{ blocks?: Array<Record<string, unknown>> }>) : [];
  const all = [...pages.flatMap((p) => p.blocks ?? []), ...(Array.isArray(scene.blocks) ? (scene.blocks as Array<Record<string, unknown>>) : [])];
  return new Map(all.map((block) => [String(block.id), block]));
}

export function convertDocStateToCanvasScene(
  doc: ConvertedDocState,
  existingScene?: Record<string, unknown>
): Record<string, unknown> {
  const existing = existingScene ?? {};
  const originals = blocksById(existing);
  const pagesData = (doc.pages || []).map((page, pIdx) => {
    const pageBlocks = (page.objects || [])
      .map((id) => doc.objects[id])
      .filter(Boolean)
      .map((obj) => objectToCanvasBlock(obj, originals.get(obj.id)));
    return {
      id: page.id || `page-${pIdx + 1}`,
      name: `Page ${pIdx + 1}`,
      blocks: pageBlocks,
    };
  });

  const allBlocks = pagesData.flatMap((p) => p.blocks);

  return {
    ...existing,
    pageSize: doc.pages?.[0]?.paperSize || existing.pageSize || 'A4',
    canvasSize: existing.canvasSize || { width: 794, height: 1123 },
    blocks: allBlocks,
    ...(pagesData.length > 1 || Array.isArray(existing.pages) ? { pages: pagesData } : {}),
    version: (typeof existing.version === 'number' ? existing.version : 0) + 1,
    updatedAt: new Date().toISOString(),
  };
}
