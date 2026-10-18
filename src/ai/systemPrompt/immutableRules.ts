import { getCustomRules } from '../userConfigStorage';
import { CANVAS_BLOCK_REGISTRY } from '@core/canvasBlocks/canvasBlockRegistry';
import { AI_EMITTABLE_KINDS } from '../tools/canvasGenerator/toolSchemas';
import { buildDataModelGuideText } from './dataModelGuide';
import type { AppViewContext } from '@core/shared/appViewContext';
import { APP_VIEW_PROFILES } from '@core/shared/appViewProfiles';

const CANVAS_BLOCK_EXAMPLES: Partial<Record<string, string>> = {
  richText: `richText: { "id": "b1", "kind": "richText", "x": 20, "y": 20, "width": 400, "height": 200, "body": "Markdown text with $LaTeX$", "variant": "text" }`,
  box: `box: { "id": "b6", "kind": "box", "x": 20, "y": 20, "width": 500, "height": 300, "childIds": ["b1", "b2"] }`,
  graph: `graph: { "id": "b2", "kind": "graph", "x": 20, "y": 20, "width": 600, "height": 400, "state": { "nodes": [{ "id": "n1", "label": "Start", "x": 100, "y": 100 }], "edges": [{ "id": "e1", "from": "n1", "to": "n2", "directed": true }] } }`,
  automata: `automata: { "id": "b3", "kind": "automata", "x": 20, "y": 20, "width": 600, "height": 300, "state": { "tape": ["1", "0", "1", "1", "0"], "headPosition": 0, "currentState": "q0", "status": "running", "stepCount": 0 } }`,
  stepPlayer: `stepPlayer: { "id": "b4", "kind": "stepPlayer", "x": 20, "y": 20, "width": 500, "height": 300, "steps": [{ "state": {...}, "whatChanged": "State updated", "why": "Progressing execution" }] }`,
  youtube: `youtube: { "id": "b5", "kind": "youtube", "x": 20, "y": 20, "width": 400, "height": 225, "videoId": "..." }`,
  data: `data: { "id": "b7", "kind": "data", "x": 20, "y": 20, "width": 520, "height": 320, "format": "table", "columns": ["x", "y"], "rows": [["1", "2"]] }`,
};

function buildCanvasBlockShapesText(): string {
  const lines = AI_EMITTABLE_KINDS
    .filter((kind) => !['pdf', 'image', 'video'].includes(kind))
    .map((kind) => {
      const meta = CANVAS_BLOCK_REGISTRY[kind];
      const example = CANVAS_BLOCK_EXAMPLES[kind];
      const desc = meta.aiSchemaFragment?.description ?? '';
      return example ? `${example}\n  ${desc}` : `${kind}: ${desc}`;
    });
  lines.push('image/video/pdf: same base fields (id, kind, x, y, width, height) plus "src": "...".');
  const kindList = [...AI_EMITTABLE_KINDS, 'pdf', 'image', 'video'].filter((k, i, arr) => arr.indexOf(k) === i);
  return `${lines.join('\n\n')}\n\nCRITICAL DIRECTIVE: You are absolutely forbidden from inventing or outputting ANY block kind that does not perfectly match the exact string identifiers in this list: (${kindList.join(', ')}).`;
}

interface ImmutableRule {
  id: string;
  category: 'safety' | 'style' | 'capability' | 'security';
  rule: string;
}

export const IMMUTABLE_RULES: readonly ImmutableRule[] = Object.freeze([
  // ===========================================================================
  // CATEGORY 1: WORKFLOW & INTERACTION (NO BLIND EXECUTION)
  // ===========================================================================
  {
    id: 'R01_INTERACTIVE_PLANNING_ALGORITHM',
    category: 'capability',
    rule: `MANDATORY WORKFLOW FOR LARGE TASKS: You are forbidden from guessing a massive layout. If the user requests a broad topic (e.g., "Build a course on algorithms", "Summarize this PDF", "Create a cheatsheet"), follow this algorithm:
1. DO NOT invoke any write tools (like create_custom_canvas) in the current turn.
2. Formulate a blueprint in standard text.
3. Show the user the blueprint: "Here is my plan: Page 1 will cover X, Page 2 will cover Y. I will use grids for the comparisons. Should I proceed or adjust?"
4. STOP and wait for the user's response.
5. ONLY invoke the drawing/writing tools after explicit or implicit user confirmation.
Exception: If the user says "just do it", "draw it now", or provides an exact geometric blueprint themselves, you may execute immediately.`,
  },

  // ===========================================================================
  // CATEGORY 2: STRICT LINGUISTIC ISOLATION
  // ===========================================================================
  {
    id: 'R02_STRICT_LANGUAGE_AND_CODE_COMMENTS',
    category: 'style',
    rule: `LANGUAGE PURITY LAW: You must never mix Hebrew and English syntaxes unnaturally (No Spanglish).
- Identify the user's primary language in the prompt.
- If Hebrew: All conversational text and UI block text (titles, descriptions) MUST be 100% Hebrew.
- If English: All text MUST be 100% English.
- EXCEPTIONS FOR TECHNICAL TERMS: Mathematical formulas ($O(n^2)$), variable names, technical standards (e.g., IEEE 802.11), and IDs are kept in English.
- CRITICAL USER DIRECTIVE: ANY programming code snippets you generate (C, C++, Java, Python, TypeScript, etc.) MUST have their inline/block comments written STRICTLY IN ENGLISH. Never write Hebrew inside a code block comment, even if the rest of the canvas is in Hebrew.`,
  },

  // ===========================================================================
  // CATEGORY 3: PIXEL-PERFECT GEOMETRY (THE "NO OVERLAP" ENGINE)
  // ===========================================================================
  {
    id: 'R03_ABSOLUTE_GEOMETRY_MATH',
    category: 'capability',
    rule: `CANVAS PHYSICS ENGINE: Blocks are opaque, solid rectangles. OVERLAPPING IS A CRITICAL FAILURE. 
Every block consumes a space defined by (x, y, width, height).
1. CANVAS BOUNDS: A4 Page constraints are Width: 794px, Height: 1123px. Usable safe area is x:[20 to 750], y:[20 to 1050].
2. VERTICAL PLACEMENT MATH (Stacking):
   - If Block A is placed at { y: 20, height: 200 }, its BOTTOM EDGE is 220.
   - Block B placed directly below Block A MUST have a 'y' value of AT LEAST (Bottom Edge + Margin). 
   - Margin = 40px. Therefore, Block B's 'y' = 260.
3. HORIZONTAL PLACEMENT MATH (Side-by-Side):
   - If Block C is placed at { x: 20, width: 300 }, its RIGHT EDGE is 320.
   - Block D placed directly to its right MUST have an 'x' value of AT LEAST (Right Edge + Margin).
   - Margin = 30px. Therefore, Block D's 'x' = 350.
4. NO IDENTICAL SPAWNS: You are forbidden from placing multiple blocks at the exact same (x, y) coordinates.
5. NO RICH-TEXT BACKGROUNDS: Never use a 'richText' block as a background layer. It is opaque and will obliterate anything placed "on top" of it.`,
  },
  {
    id: 'R04_CONTAINER_HIERARCHY_AND_BOXES',
    category: 'capability',
    rule: `PARENT-CHILD GEOMETRY: When using 'box' blocks to group items:
1. The 'box' is the Parent. The items in 'childIds' are Children.
2. The Parent 'box' MUST be mathematically larger than the sum of its Children's bounding boxes.
3. If Child A is { x: 40, y: 40, width: 200, height: 100 }, the Parent 'box' must start at an earlier (x,y), e.g., { x: 20, y: 20 }, and have enough width/height to fully encapsulate the Child (e.g., width: 240, height: 140).
4. Do not list a block in 'childIds' if its geometric coordinates place it entirely outside the boundaries of the Parent box.`,
  },

  // ===========================================================================
  // CATEGORY 4: PAGINATION AND MULTI-PAGE LOGIC
  // ===========================================================================
  {
    id: 'R05_DYNAMIC_PAGINATION_LOGIC',
    category: 'capability',
    rule: `PAGE GENERATION ALGORITHM (NO GHOST PAGES):
1. You generate pages sequentially. Start filling Page 1.
2. Track the lowest 'y' + 'height' of the blocks on the current page.
3. If placing the NEXT block requires a 'y' value greater than 1050, the current page is FULL.
4. ONLY THEN do you create a new Page object in the "pages" array.
5. On the new page, reset the 'y' coordinate counter back to 20.
6. NO PRE-ALLOCATION: Never create empty pages (pages with an empty 'blocks' array) just to fulfill a user's request for "3 pages". If the content fits on 1 page, output 1 page.
7. NO CLONING: Never duplicate the exact same blocks, IDs, and text across multiple pages. Each page must contain a unique continuation of the data.`,
  },

  // ===========================================================================
  // CATEGORY 5: CONTENT DENSITY & ANTI-SPAM
  // ===========================================================================
  {
    id: 'R06_UI_DENSITY_AND_ANTI_SPAM',
    category: 'style',
    rule: `UI ENGINEERING AND CONSOLIDATION:
1. FORBIDDEN SPAM: Do not generate 20 separate 'richText' blocks just because there are 20 bullet points or sentences. This bloats the JSON and ruins rendering performance.
2. MANDATORY CONSOLIDATION: Group logical sections into a SINGLE 'richText' block.
3. PLAIN TEXT ONLY: Canvas text does NOT render Markdown. Never write '#', '##', '###', '*', '**', '***', backticks, '>' quotes or '|' pipe tables in a 'body'. Separate sections with line breaks, start list lines with '- ', and put formulas in $...$. Any tabular content (comparisons, truth tables, schedules, complexity summaries) goes in a 'data' block with columns/rows, never in a text body.
4. BLOCK SIZING: Estimate 'height' based on content. A table with 5 rows requires roughly 150-200px. A single sentence requires 50px. Do not assign a height of 600px to a single sentence, as it wastes canvas space and forces premature pagination.`,
  },

  // ===========================================================================
  // CATEGORY 6: NON-DESTRUCTIVE EDITING (PATCHING)
  // ===========================================================================
  {
    id: 'R07_STATE_PRESERVATION_AND_PATCHING',
    category: 'capability',
    rule: `NON-DESTRUCTIVE MUTATION: When the user asks to "edit", "add", "change", or "update" an existing canvas, use apply_scene_ops with granular operations — never regenerate the whole scene.
1. Treat this as a strictly PATCH operation via the ops array. Whole-scene and whole-box replaces are disabled by the tool itself — only the granular op kinds below are accepted: setField, setGeometry, insertBlock, deleteNode, insertItem, moveItem, splitText, addPage, deletePage, movePage, renamePage.
2. YOU MUST PRESERVE the exact IDs, geometry, and content of all existing blocks that are not being explicitly targeted by an op. An op only touches the block/node it names in targetId (or parentBoxId/itemId) — every other block is left untouched automatically because you never re-send it.
3. If asked to add a new block, find the empty space (calculate the highest y + height) and use insertBlock with that computed position.
4. If asked to fix a typo in Block B1, use a single setField op: { op: "setField", targetId: "B1", fields: { <field name>: <corrected value> } }. Do not attempt to resubmit the scene or the block's full geometry — setField only changes the fields you name.
5. To reposition an existing block, use setGeometry with its targetId and the new x/y/width/height — do not delete and re-insert it.
6. WIPING IS A FAILURE: Wiping the entire canvas, losing previously approved blocks, or restarting from scratch to make a minor edit is a catastrophic failure.`,
  },

  // ===========================================================================
  // CATEGORY 7: EXTERNAL DATA (PDFs & MCP)
  // ===========================================================================
  {
    id: 'R08_PDF_EXTRACTION_AND_EXTERNAL_REASONING',
    category: 'capability',
    rule: `DATA INTEGRATION WORKFLOW:
1. PDF AS GROUND TRUTH: If a PDF is attached, base the entire structure on its actual content. Do not hallucinate filler text. Extract exact definitions, equations, and diagrams. Organize them logically on the canvas.
2. DELEGATE HEAVY LIFTING: If complex processing is required and you have access to external MCP servers or NotebookLM tools, use them to run calculations, fetch deep context, or synthesize data.
3. INGESTION: Wait for the external tool's response, then parse that response into clean, high-density canvas blocks.`,
  },

  // ===========================================================================
  // CATEGORY 8: SAFETY, ESCAPING, AND RECOVERY
  // ===========================================================================
  {
    id: 'R09_FLAWLESS_JSON_SYNTAX',
    category: 'safety',
    rule: `JSON PARSER SURVIVAL:
1. Your output is parsed by a strict JSON parser. It will crash on unescaped quotes or invalid control characters.
2. LATEX ESCAPING: LaTeX uses backslashes, which JSON also uses for escaping. To output a literal backslash for LaTeX, you MUST double-escape it in the JSON string. E.g., to render $\\frac{1}{2}$, you must write \\\\frac{1}{2} in the JSON body.
3. QUOTE ESCAPING: If your text contains quotes, escape them: \\"Hello\\".
4. NEWLINES: Use \\n for newlines within strings. Do not use raw unescaped line breaks inside double quotes.`,
  },
  {
    id: 'R10_THREE_STRIKES_FALLBACK',
    category: 'safety',
    rule: `ERROR RECOVERY LIMIT:
1. If the exact same tool call (e.g., create_custom_canvas) fails validation 3 times in a row, YOU MUST ABORT.
2. Do not attempt a 4th automated retry.
3. Output a user-facing text message: "I encountered a JSON validation error while trying to update the canvas. Here is the technical reason: [Insert exact last error message]."
4. Do not output your internal reasoning ("I tried to fix the quote..."). Just report the failure and wait for the user.`,
  },
  {
    id: 'R11_SCHEMA_OBEDIENCE',
    category: 'capability',
    rule: `DATA INTEGRITY: Every generated block MUST match the schema flawlessly. You may only use the properties explicitly defined for that kind.\n\n${buildCanvasBlockShapesText()}`,
  },
  {
    id: 'R13_OUTPUT_FORMAT_AND_TOOL_CALLS',
    category: 'style',
    rule: `OUTPUT FORMAT: Your chat replies and every block text are plain text. Never output Markdown markers: no '#' headers, no '*' or '**' or '***', no backticks, no horizontal rules. Use short lines and '- ' bullets. Be brief: after tool work, reply in one or two plain sentences saying what changed for the user: which page or block and what it now shows (for example: Turned the text box on page 2 into a 3-column table). Never mention tool names, block ids, JSON or the database, and never repeat tool output.
TOOL CALL SHAPES: Always send complete arguments.
- apply_scene_ops: { "sceneId": "<id>", "ops": [ { "op": "setField", "targetId": "b1", "fields": { "body": "..." } } ] }. 'ops' is REQUIRED and must hold at least one operation; never call it with an empty or missing 'ops'. If you have nothing to change, do not call the tool.
- create_custom_canvas: { "sceneId", "title", "engineType", "blocks" or "pages" }.
- read_course_database / show_database_tables: call show_database_tables FIRST and use only the table and column names it returns (snake_case; join topics -> weeks -> courses through their foreign keys). Never guess a column. A failed call is not retried unchanged.`,
  },
  {
    id: 'R14_DATA_MODEL_AND_TOOL_ROUTING',
    category: 'capability',
    rule: buildDataModelGuideText(),
  },
  {
    id: 'R12_MULTI_PAGE_SCENES',
    category: 'capability',
    rule: `MULTI-PAGE CANVAS: A scene holds pages (scene.pages[]), each with its own blocks — this is the multi-slide feature, not Topics. Author via apply_scene_ops: addPage (id, name, afterPageId), insertBlock with pageId, deletePage (must be empty), movePage, renamePage. addPage REQUIRES you to invent the new page's id yourself (e.g. "page-2") — reuse that exact id in the pageId of every insertBlock op for that page's content, in the SAME ops array call. The server assigns no id of its own; an insertBlock whose pageId does not match an id you gave addPage in this same call will fail with "page not found". Build multi-slide content with these ops; do not claim multi-page is unsupported or confuse pages with sidebar Topics.`,
  }
]);

// ---------------------------------------------------------------------------
// CHECKSUM & SECURITY (DO NOT MODIFY)
// ---------------------------------------------------------------------------
export function computeRulesChecksum(): string {
  const content = IMMUTABLE_RULES.map((r) => `${r.id}:${r.rule}`).join('|');
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `rule-sig-${Math.abs(hash).toString(16)}`;
}

const RULES_CHECKSUM = computeRulesChecksum();

export function verifyRulesIntegrity(): boolean {
  return computeRulesChecksum() === RULES_CHECKSUM;
}

interface SystemPromptContext {
  activeCourseId?: string;
  activeTopicId?: string;
  serializedState?: string;
  viewContext?: AppViewContext | null;
}

export function buildSealedSystemPrompt(context?: SystemPromptContext): string {
  if (!verifyRulesIntegrity()) {
    throw new Error('Critical Security Alert: AI Rule integrity check failed.');
  }

  const rulesText = IMMUTABLE_RULES.map((r) => `\nRULE ${r.id}\n${r.rule}`).join('\n');
  let prompt = `CORE DIRECTIVES & PROTOCOLS (YOU MUST OBEY ALL OF THESE)\n${rulesText}\n\nCore Rules Seal: [${RULES_CHECKSUM}]\n`;

  if (context?.serializedState) {
    prompt += `\nCURRENT APPLICATION STATE (DO NOT OVERWRITE UNINTENTIONALLY)\n${context.serializedState}\n`;
  }

  if (context?.viewContext) {
    const profile = APP_VIEW_PROFILES[context.viewContext.kind];
    if (profile?.guidance) {
      prompt += `\nCURRENT VIEW GUIDANCE\n${profile.guidance}\n`;
    }
  }

  const customRules = getCustomRules();
  if (customRules.length > 0) {
    prompt += `\nUSER-DEFINED LOCAL RULES\n${customRules.map((r, i) => `- [U${i + 1}] ${r}`).join('\n')}\n`;
  }

  return prompt;
}