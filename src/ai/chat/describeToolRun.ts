import { AI_TEXT } from '../../i18n/dictionary';
import type { LocalizedText } from '../../i18n/localizedValue';
import { toolLabel, plainReason } from './toolLabels';

type Translate = (input?: unknown) => string;
type Args = Record<string, unknown>;
type Fields = Record<string, string | number>;

interface ToolRun {
  name: string;
  args: Args;
  data: unknown;
}

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** A tool's own answer: MCP tools wrap their JSON in `{content:[{text}]}`, built-in tools return it directly. */
function unwrap(data: unknown): Record<string, unknown> {
  const text = asRecord(asArray(asRecord(data).content)[0]).text;
  if (typeof text !== 'string') return asRecord(data);
  try {
    return asRecord(JSON.parse(text));
  } catch {
    return {};
  }
}

const fill = (template: string, fields: Fields): string =>
  Object.entries(fields).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);

/** The table a SELECT reads from, for "Looked up topics: 12 rows". */
function tableOf(sql: unknown): string {
  const match = typeof sql === 'string' ? /\bfrom\s+"?([a-z_]+)"?/i.exec(sql) : null;
  return match?.[1] ?? 'data';
}

type Summarizer = (run: ToolRun, val: Translate) => string;

const say = (text: LocalizedText, val: Translate, fields: Fields = {}): string => fill(val(text), fields);

function summarizeSchema({ data }: ToolRun, val: Translate): string {
  return say(AI_TEXT.toolDoneSchema, val, { n: asArray(unwrap(data).tables).length });
}

function summarizeQuery({ args, data }: ToolRun, val: Translate): string {
  const rows = asArray(unwrap(data).rows).length;
  const table = tableOf(args.sql);
  return rows === 0 ? say(AI_TEXT.toolDoneQueryNone, val, { table }) : say(AI_TEXT.toolDoneQuery, val, { table, n: rows });
}

function summarizeTopics({ data }: ToolRun, val: Translate): string {
  return say(AI_TEXT.toolDoneTopics, val, { n: asArray(unwrap(data).topics).length });
}

const OP_PHRASES: Record<string, LocalizedText> = {
  replaceBlock: AI_TEXT.toolOpConverted,
  tidyLayout: AI_TEXT.toolOpTidied,
  insertBlock: AI_TEXT.toolOpAdded,
  deleteNode: AI_TEXT.toolOpRemoved,
  setField: AI_TEXT.toolOpChanged,
  setGeometry: AI_TEXT.toolOpChanged,
};

/** "converted 1 block, tidied layout": the ops the AI sent, grouped by what they do. */
function describeOps(ops: unknown[], val: Translate): string {
  const counts = new Map<LocalizedText, number>();
  for (const op of ops) {
    const phrase = OP_PHRASES[String(asRecord(op).op)];
    if (phrase) counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }
  return [...counts].map(([phrase, n]) => say(phrase, val, { n })).join(', ');
}

function summarizeSceneEdit({ args }: ToolRun, val: Translate): string {
  const what = describeOps(asArray(args.ops), val);
  return say(AI_TEXT.toolDoneEdit, val, { scene: String(args.sceneId ?? ''), what: what || say(AI_TEXT.toolOpChanged, val, { n: 1 }) });
}

function summarizeBuild({ args }: ToolRun, val: Translate): string {
  const blocks = asArray(args.blocks).length || asArray(args.pages).reduce<number>((sum, page) => sum + asArray(asRecord(page).blocks).length, 0);
  return say(AI_TEXT.toolDoneBuild, val, { title: String(args.title ?? args.sceneId ?? ''), n: blocks });
}

function summarizeDiagram({ args }: ToolRun, val: Translate): string {
  return say(AI_TEXT.toolDoneDiagram, val, { type: String(args.diagramType ?? ''), scene: String(args.sceneId ?? '') });
}

const ACTION_WORDS: Record<string, LocalizedText> = {
  create: AI_TEXT.toolActionCreated,
  update: AI_TEXT.toolActionUpdated,
  delete: AI_TEXT.toolActionDeleted,
  move: AI_TEXT.toolActionMoved,
};

function summarizeContentEdit({ name, args }: ToolRun, val: Translate): string {
  const target = asRecord(args.topic).id ?? args.weekKey ?? asRecord(args.course).id ?? args.courseId ?? '';
  const action = ACTION_WORDS[String(args.action)];
  return `${toolLabel(name, val)}: ${action ? val(action) : String(args.action ?? '')} "${String(target)}"`;
}

const SUMMARIZERS: Record<string, Summarizer> = {
  show_database_tables: summarizeSchema,
  read_course_database: summarizeQuery,
  list_lectures: summarizeTopics,
  apply_scene_ops: summarizeSceneEdit,
  create_custom_canvas: summarizeBuild,
  generate_uml_diagram: summarizeDiagram,
  content_editor_course: summarizeContentEdit,
  content_editor_week: summarizeContentEdit,
  content_editor_topic: summarizeContentEdit,
};

const baseName = (name: string): string => name.split('__').pop() ?? name;

/** One line saying what the tool did and what came of it, e.g. "Looked up topics: 12 rows". */
export function describeSuccess(run: ToolRun, val: Translate): string {
  const summarize = SUMMARIZERS[baseName(run.name)];
  return summarize ? summarize(run, val) : `${toolLabel(run.name, val)}: ${val(AI_TEXT.toolSuccess)}`;
}

// Raw error text to the plain meaning a user can act on; the first match wins.
const ERROR_MEANINGS: Array<[RegExp, LocalizedText]> = [
  [/no such (table|column)|unknown column|syntax error/i, AI_TEXT.toolErrWrongName],
  [/not found|no such (block|page|scene)/i, AI_TEXT.toolErrNotFound],
  [/invalid block|requires a valid block|invalid parameters|needs /i, AI_TEXT.toolErrBadInput],
  [/timed? ?out|econn|network|fetch failed/i, AI_TEXT.toolErrConnection],
];

const MAX_REASON_CHARS = 110;

/** A failure as "what failed: what it means (detail)". The raw message is kept short, never the only thing shown. */
export function describeFailure(name: string, error: string | undefined, val: Translate): string {
  const reason = plainReason(error || val(AI_TEXT.toolFailed));
  const meaning = ERROR_MEANINGS.find(([pattern]) => pattern.test(reason));
  const detail = reason.length > MAX_REASON_CHARS ? `${reason.slice(0, MAX_REASON_CHARS)}…` : reason;
  return meaning ? `${toolLabel(name, val)}: ${val(meaning[1])} (${detail})` : `${toolLabel(name, val)}: ${detail}`;
}
