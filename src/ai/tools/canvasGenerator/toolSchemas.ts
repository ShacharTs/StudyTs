import type { AiTool } from '@core/shared/aiTypes';

import { GENERATE_UML_DIAGRAM_TOOL } from '../umlDiagram/executeGenerateUmlDiagram';
import { CANVAS_BLOCK_REGISTRY, BlockKindMeta } from '@core/canvasBlocks/canvasBlockRegistry';
import type { CanvasBlockKind } from '@core/canvasBlocks/canvasBlockTypes';

/**
 * Per-block-kind JSON schemas for create_custom_canvas's `blocks` array items —
 * generated from CANVAS_BLOCK_REGISTRY's aiSchemaFragment (single source of truth), so a
 * kind's shape can't drift between the tool schema and the registry the rest of the editor
 * uses. pdf/image/video share one schema (MEDIA_BLOCK_SCHEMA) since they're identical
 * (id/kind/x/y/width/height/src) — that collapse is deliberate, not a gap.
 */

const BASE_PROPERTIES = {
  id: { type: 'string' },
  x: { type: 'number' },
  y: { type: 'number' },
  width: { type: 'number' },
  height: { type: 'number' },
};
const BASE_REQUIRED = ['id', 'kind', 'x', 'y', 'width', 'height'];

function schemaForKind(meta: BlockKindMeta & { aiSchemaFragment: NonNullable<BlockKindMeta['aiSchemaFragment']> }) {
  const { description, properties, required } = meta.aiSchemaFragment;
  return {
    type: 'object',
    properties: {
      ...BASE_PROPERTIES,
      kind: { const: meta.kind },
      ...properties,
    },
    description,
    required: [...BASE_REQUIRED, ...required],
  };
}

const MEDIA_KINDS: CanvasBlockKind[] = ['pdf', 'image', 'video'];

const MEDIA_BLOCK_SCHEMA = {
  type: 'object',
  properties: {
    ...BASE_PROPERTIES,
    kind: { type: 'string', enum: MEDIA_KINDS },
    src: { type: 'string', description: `REQUIRED for ${MEDIA_KINDS.join('/')}.` },
  },
  required: [...BASE_REQUIRED, 'src'],
};

function isAiEmittable(meta: BlockKindMeta): meta is BlockKindMeta & { aiSchemaFragment: NonNullable<BlockKindMeta['aiSchemaFragment']> } {
  return Boolean(meta.aiSchemaFragment);
}

export const CANVAS_BLOCK_KIND_SCHEMAS: Array<Record<string, unknown>> = [
  ...Object.values(CANVAS_BLOCK_REGISTRY)
    .filter(isAiEmittable)
    .filter((meta) => !MEDIA_KINDS.includes(meta.kind))
    .map(schemaForKind),
  MEDIA_BLOCK_SCHEMA,
];

/** Kinds the AI is allowed to emit — everything with an aiSchemaFragment (excludes editor-only kinds like connector). */
export const AI_EMITTABLE_KINDS: CanvasBlockKind[] = Object.values(CANVAS_BLOCK_REGISTRY)
  .filter((meta) => meta.aiSchemaFragment)
  .map((meta) => meta.kind);

const APPLY_SCENE_OPS_TOOL: AiTool = {
  type: 'function',
  function: {
    name: 'apply_scene_ops',
    description: 'Edit an existing canvas scene in place. This is the FIRST tool to reach for when the user asks to change, convert, move or delete something on a page you already know the sceneId and block id of; do not query the database first. Ops: setField, setGeometry, insertBlock, replaceBlock (turn a block into another kind, e.g. text box to table, keeping its position), tidyLayout (fix overlaps and empty gaps; content that no longer fits goes to the next page), moveBlockToPage (send a block to another page when this one is full), deleteNode, insertItem, moveItem, splitText, addPage, deletePage, movePage, renamePage. Whole-scene and whole-box replaces are disabled for safety.',
    parameters: {
      type: 'object',
      properties: {
        sceneId: {
          type: 'string',
          description: 'Topic ID / scene ID to patch (e.g. "first-reason", "lecture-1")',
        },
        ops: {
          type: 'array',
          description: 'Granular operations to apply in order.',
          items: {
            oneOf: [
              {
                type: 'object',
                properties: {
                  op: { const: 'setField' },
                  targetId: { type: 'string', description: 'ID of target block or scene node' },
                  fields: { type: 'object', description: 'Key-value map of fields to update' },
                },
                required: ['op', 'targetId', 'fields'],
              },
              {
                type: 'object',
                properties: {
                  op: { const: 'setGeometry' },
                  targetId: { type: 'string', description: 'ID of target top-level block' },
                  x: { type: 'number' },
                  y: { type: 'number' },
                  width: { type: 'number' },
                  height: { type: 'number' },
                },
                required: ['op', 'targetId', 'x', 'y', 'width', 'height'],
              },
              {
                type: 'object',
                properties: {
                  op: { const: 'insertBlock' },
                  block: { type: 'object', description: 'New CanvasBlock to insert' },
                  afterId: { type: 'string', description: 'Optional ID of existing block to insert after' },
                  pageId: { type: 'string', description: 'Optional page ID to insert this block into' },
                },
                required: ['op', 'block'],
              },
              {
                type: 'object',
                description: 'Turn one block into a different kind in place (text box to table, text to graph...). Position and size are kept unless the new block sets them.',
                properties: {
                  op: { const: 'replaceBlock' },
                  targetId: { type: 'string', description: 'ID of the existing block to replace' },
                  block: { type: 'object', description: "The new block: kind plus that kind's fields (id/x/y/width/height optional). Example table: {\"kind\":\"data\",\"format\":\"table\",\"columns\":[\"A\",\"B\"],\"rows\":[[\"1\",\"2\"]]}" },
                },
                required: ['op', 'targetId', 'block'],
              },
              {
                type: 'object',
                description: 'Fix overlapping blocks and big empty gaps on a page in one op: stacks blocks in each column with even spacing and grows text boxes to fit their text. What no longer fits on the page moves to the top of the next page (a new page is added when there is none). Use this instead of computing coordinates yourself.',
                properties: {
                  op: { const: 'tidyLayout' },
                  pageId: { type: 'string', description: 'Page to tidy (default: every page)' },
                  gap: { type: 'number', description: 'Space between stacked blocks (default 12)' },
                  overflow: { type: 'string', enum: ['newPage', 'none'], description: 'newPage (default) moves what does not fit to the next page; none keeps everything on its page' },
                },
                required: ['op'],
              },
              {
                type: 'object',
                description: 'Move one block to another page, e.g. the next text box after a table filled the page. It lands at the top of that page and the blocks already there are pushed down (and on to the following page if they no longer fit). Never shrink content to squeeze it in: move it.',
                properties: {
                  op: { const: 'moveBlockToPage' },
                  targetId: { type: 'string', description: 'ID of the block to move' },
                  pageId: { type: 'string', description: 'Destination page id' },
                  afterId: { type: 'string', description: 'Optional block id on the destination page to place it after' },
                  y: { type: 'number', description: 'Optional top position on the destination page (default: the top margin)' },
                  create: { type: 'boolean', description: 'Create the destination page (after the current one) when it does not exist yet' },
                },
                required: ['op', 'targetId', 'pageId'],
              },
              {
                type: 'object',
                properties: {
                  op: { const: 'deleteNode' },
                  targetId: { type: 'string', description: 'ID of block or scene node to delete' },
                },
                required: ['op', 'targetId'],
              },
              {
                type: 'object',
                properties: {
                  op: { const: 'insertItem' },
                  parentBoxId: { type: 'string', description: 'ID of parent box block or node' },
                  index: { type: 'number', description: 'Array index in parent childIds' },
                  item: { type: 'object', description: 'SceneNode (text, blockRef, box) to insert' },
                },
                required: ['op', 'parentBoxId', 'index', 'item'],
              },
              {
                type: 'object',
                properties: {
                  op: { const: 'moveItem' },
                  itemId: { type: 'string', description: 'ID of item to move' },
                  toParentBoxId: { type: 'string', description: 'Destination parent box ID' },
                  toIndex: { type: 'number', description: 'Destination index in childIds' },
                },
                required: ['op', 'itemId', 'toParentBoxId', 'toIndex'],
              },
              {
                type: 'object',
                properties: {
                  op: { const: 'splitText' },
                  targetId: { type: 'string', description: 'ID of target text node' },
                  caretOffset: { type: 'number', description: 'Character offset to split at' },
                  insertItem: { type: 'object', description: 'SceneNode to insert between the split text parts' },
                },
                required: ['op', 'targetId', 'caretOffset', 'insertItem'],
              },
              {
                type: 'object',
                properties: {
                  op: { const: 'addPage' },
                  id: { type: 'string', description: 'ID to assign the new page (e.g. "page-2") — reuse this same id in insertBlock ops later in this same ops array to add blocks to it' },
                  name: { type: 'string', description: 'Optional name for the new page' },
                  afterPageId: { type: 'string', description: 'Optional page ID to insert after' },
                },
                required: ['op', 'id'],
              },
              {
                type: 'object',
                properties: {
                  op: { const: 'deletePage' },
                  pageId: { type: 'string', description: 'ID of the page to delete (must be empty)' },
                },
                required: ['op', 'pageId'],
              },
              {
                type: 'object',
                properties: {
                  op: { const: 'movePage' },
                  pageId: { type: 'string', description: 'ID of the page to move' },
                  toIndex: { type: 'number', description: 'Target 0-based page index' },
                },
                required: ['op', 'pageId', 'toIndex'],
              },
              {
                type: 'object',
                properties: {
                  op: { const: 'renamePage' },
                  pageId: { type: 'string', description: 'ID of the page to rename' },
                  newName: { type: 'string', description: 'New name for the page' },
                },
                required: ['op', 'pageId', 'newName'],
              },
            ],
          },
        },
      },
      required: ['sceneId', 'ops'],
    },
  },
};

const CREATE_CUSTOM_CANVAS_TOOL: AiTool = {
  type: 'function',
  function: {
    name: 'create_custom_canvas',
    description: 'Generate and save interactive canvas blocks (richText, proofs, graphs, automata) to a topic scene.ts file on disk.',
    parameters: {
      type: 'object',
      properties: {
        sceneId: {
          type: 'string',
          description: 'Topic ID / scene ID to attach blocks to (e.g. "first-reason", "lecture-1")',
        },
        title: {
          type: 'string',
          description: 'Topic / Scene title (Hebrew, English, or mixed)',
        },
        engineType: {
          type: 'string',
          enum: ['graph', 'multimodal'],
          description: 'Primary visualization engine type',
        },
        blocks: {
          type: 'array',
          description:
            'List of canvas blocks for a single-page canvas. Each block MUST include id, kind, x, y, width, height (placed within standard A4 bounds: 794x1123), ' +
            'PLUS the field(s) required for its specific kind below.',
          items: {
            oneOf: CANVAS_BLOCK_KIND_SCHEMAS,
          },
        },
        pages: {
          type: 'array',
          description:
            'Optional list of pages for a multi-page canvas document. When provided, each page contains { id, name, blocks } where blocks fit within standard A4 bounds (794x1123).',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique page ID (e.g. "page-1", "overview-page")' },
              name: { type: 'string', description: 'Page name / title' },
              blocks: {
                type: 'array',
                items: {
                  oneOf: CANVAS_BLOCK_KIND_SCHEMAS,
                },
              },
            },
            required: ['id', 'blocks'],
          },
        },
      },
      required: ['sceneId', 'title', 'engineType'],
    },
  },
};

export const CANVAS_GENERATOR_TOOLS: AiTool[] = [APPLY_SCENE_OPS_TOOL, CREATE_CUSTOM_CANVAS_TOOL, GENERATE_UML_DIAGRAM_TOOL];
