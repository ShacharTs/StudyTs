// src/core/canvasBlocks/canvasBlockRegistry.ts
import { CanvasBlockKind } from './canvasBlockTypes';

export interface BlockKindMeta {
  kind: CanvasBlockKind;
  defaultSize: { width: number; height: number };
  badge: string;
  iconName: string;
  menuGroup: 'content' | 'visual' | 'media' | 'interactive';
  labelKey: string;
  /**
   * Kind-specific JSON-schema properties + a one-line AI-facing description, used to
   * generate both the create_custom_canvas tool schema (canvasBlockKindSchemas.ts) and the
   * R09_CANVAS_BLOCK_SHAPES prompt rule (identity/rules.ts) — the single source of truth for
   * what the AI is told it can emit. Absent means the kind is editor-only (e.g. `connector`,
   * built by dragging between two existing blocks — not something a single generation call
   * can address reliably) and must never be listed to the AI.
   */
  aiSchemaFragment?: {
    description: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const CANVAS_BLOCK_REGISTRY: Record<CanvasBlockKind, BlockKindMeta> = {
  richText: {
    kind: 'richText',
    defaultSize: { width: 498, height: 180 },
    badge: 'Text',
    iconName: 'Type',
    menuGroup: 'content',
    labelKey: 'kinds.richText',
    aiSchemaFragment: {
      description: 'body: string REQUIRED. Natural single-language or mixed text with Markdown/LaTeX math ($...$ / $$...$$). variant is "text" | "proof" | "code" (proof is a SEMANTIC marker for real formal proofs/theorems only — never use it just to make a block look nicer, use style:"card" for that). style is "plain" | "card", pure visual chrome.',
      properties: {
        body: {
          type: 'string',
          description: 'Markdown content string with LaTeX formulas',
        },
        variant: { type: 'string', enum: ['text', 'proof', 'code'] },
        style: { type: 'string', enum: ['plain', 'card'] },
        fontSize: { type: 'number', description: 'Font size in pt. Body text is 12 (the default); a section heading is its own short block at 16.' },
        fill: { type: 'string', description: 'Background color of the text box, e.g. "#fef3c7". Omit for none.' },
        autoFit: { type: 'boolean', description: 'Default true: the box shrinks to its words and grows with them, never wider than the width you give. Set false only to keep exactly your width and height.' },
      },
      required: ['body'],
    },
  },
  box: {
    kind: 'box',
    defaultSize: { width: 498, height: 200 },
    badge: 'Area',
    iconName: 'Square',
    menuGroup: 'content',
    labelKey: 'kinds.box',
    aiSchemaFragment: {
      description: 'A container that groups other blocks by their id via childIds. style is "plain" | "card".',
      properties: {
        childIds: { type: 'array', items: { type: 'string' } },
        variant: { type: 'string' },
        style: { type: 'string', enum: ['plain', 'card'] },
      },
      required: ['childIds'],
    },
  },
  graph: {
    kind: 'graph',
    defaultSize: { width: 522, height: 284 },
    badge: 'Graph',
    iconName: 'Network',
    menuGroup: 'visual',
    labelKey: 'kinds.graph',
    aiSchemaFragment: {
      description: 'state REQUIRED. nodes/edges live INSIDE state, never at the top level. Only include a graph block if the request needs one, and only with real nodes/edges — never an empty graph as a placeholder. A node may carry device (router|switch|firewall|server|pc|cloud|hub|database) to draw a network icon, and state.zones frames groups of nodes; prefer generate_uml_diagram (diagramType topology) for network diagrams.',
      properties: {
        state: {
          type: 'object',
          properties: { nodes: { type: 'array' }, edges: { type: 'array' } },
          required: ['nodes', 'edges'],
        },
      },
      required: ['state'],
    },
  },
  automata: {
    kind: 'automata',
    defaultSize: { width: 522, height: 300 },
    badge: 'Automata',
    iconName: 'Cpu',
    menuGroup: 'interactive',
    labelKey: 'kinds.automata',
    aiSchemaFragment: {
      description: 'state REQUIRED. A display SNAPSHOT of a machine mid-run (tape/headPosition/currentState/status/stepCount) — NOT a transition-table definition. Never emit "states", "transitions", "startState", "acceptState", "tapeSymbols", "inputAlphabet", "halted", or "head". tape is an array of single-character strings, never a string. Never emit an automata block without real values for all five fields.',
      properties: {
        state: {
          type: 'object',
          properties: {
            tape: { type: 'array' },
            headPosition: { type: 'number' },
            currentState: { type: 'string' },
            status: { type: 'string', enum: ['running', 'accepted', 'rejected', 'looping'] },
            stepCount: { type: 'number' },
          },
          required: ['tape', 'headPosition', 'currentState', 'status', 'stepCount'],
        },
      },
      required: ['state'],
    },
  },
  stepPlayer: {
    kind: 'stepPlayer',
    defaultSize: { width: 1084, height: 430 },
    badge: 'Player',
    iconName: 'PlaySquare',
    menuGroup: 'interactive',
    labelKey: 'kinds.stepPlayer',
    aiSchemaFragment: {
      description: 'steps REQUIRED. Each step needs state, whatChanged:{he,en}, why:{he,en} — NOT "narration", NOT "description". Only add a stepPlayer when the request calls for a step-by-step walkthrough — never bundle one into every canvas by default.',
      properties: {
        steps: { type: 'array' },
      },
      required: ['steps'],
    },
  },
  image: {
    kind: 'image',
    defaultSize: { width: 498, height: 284 },
    badge: 'Image',
    iconName: 'Image',
    menuGroup: 'media',
    labelKey: 'kinds.image',
    aiSchemaFragment: {
      description: 'src REQUIRED (image URL).',
      properties: { src: { type: 'string' } },
      required: ['src'],
    },
  },
  video: {
    kind: 'video',
    defaultSize: { width: 498, height: 284 },
    badge: 'Video',
    iconName: 'Film',
    menuGroup: 'media',
    labelKey: 'kinds.video',
    aiSchemaFragment: {
      description: 'src REQUIRED (video URL).',
      properties: { src: { type: 'string' } },
      required: ['src'],
    },
  },
  youtube: {
    kind: 'youtube',
    defaultSize: { width: 498, height: 284 },
    badge: 'YouTube',
    iconName: 'Youtube',
    menuGroup: 'media',
    labelKey: 'kinds.youtube',
    aiSchemaFragment: {
      description: 'videoId REQUIRED.',
      properties: { videoId: { type: 'string' } },
      required: ['videoId'],
    },
  },
  pdf: {
    kind: 'pdf',
    defaultSize: { width: 498, height: 284 },
    badge: 'PDF',
    iconName: 'FileText',
    menuGroup: 'media',
    labelKey: 'kinds.pdf',
    aiSchemaFragment: {
      description: 'src REQUIRED (PDF URL).',
      properties: { src: { type: 'string' } },
      required: ['src'],
    },
  },
  connector: {
    kind: 'connector',
    defaultSize: { width: 0, height: 0 },
    badge: 'Connector',
    iconName: 'ArrowRight',
    menuGroup: 'visual',
    labelKey: 'kinds.connector',
    // No aiSchemaFragment: editor-only. Created by dragging between two existing blocks'
    // ids — a single generation call can't place these reliably, so the AI is never told
    // this kind exists (see the exclusion note on BlockKindMeta.aiSchemaFragment above).
  },
  shape: {
    kind: 'shape',
    defaultSize: { width: 64, height: 64 },
    badge: 'Shape',
    iconName: 'Circle',
    menuGroup: 'visual',
    labelKey: 'kinds.shape',
    // No aiSchemaFragment: matches connector's editor-only treatment —
    // confirmed decision, not deferred, see spec Non-goals.
  },
  data: {
    kind: 'data',
    defaultSize: { width: 520, height: 320 },
    badge: 'Data',
    iconName: 'Table',
    menuGroup: 'content',
    labelKey: 'kinds.data',
    aiSchemaFragment: {
      description: 'Use this kind whenever the content is a table (comparisons, schedules, truth tables, complexity summaries). It renders as an editable canvas table: columns is the header row, so keep cells short (a few words or a $formula$), at most 12 columns and 30 rows; give it enough width (about 100px per column) and leave room below it so later blocks do not overlap. format is "table" | "json". For "table": columns (array of string or {he,en}) and rows (array of arrays of string or {he,en}). For "json": data holds the raw value.',
      properties: {
        format: { type: 'string', enum: ['table', 'json'] },
        columns: { type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'object', properties: { he: { type: 'string' }, en: { type: 'string' } } }] } },
        rows: { type: 'array', items: { type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'object', properties: { he: { type: 'string' }, en: { type: 'string' } } }] } } },
        data: {},
        fontSize: { type: 'number', description: 'Table font size in pt (default 11).' },
        autoFit: { type: 'boolean', description: 'Default true: columns are sized to their content and the table is only as wide as its text needs, never wider than the width you give. Set false only to keep exactly your width and equal columns.' },
        colWidths: { type: 'array', items: { type: 'number' }, description: 'Optional column widths as fractions of the table width (one per column). Leave out so the columns fit their content.' },
      },
      required: ['format'],
    },
  },
};
