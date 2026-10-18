import type { AiTool } from '@core/shared/aiTypes';
import { listCategories } from '@core/visualBuilder/diagramPacks/categoryRegistry';
import { compileStoryboard } from '@core/storyboard/compileStoryboard';
import { checkVisualSpecForPublish } from '@core/validation/visualSpec/visualSpecPublishCheck';
import type { ToolExecutionResult } from '../../toolExecutionResult';
import { sendContentEditorRequest } from './contentEditorRequest';

const ALREADY_EXISTS = 'already exists';

// Categories only: the object list would cost a few hundred tokens on every request, so an unknown ref returns it instead.
const PACK_CATEGORIES = listCategories().map((category) => category.id).join(', ');

const DESCRIPTION =
  'Publishes a step-player lecture (an animated diagram) into a course: creates the topic if needed and saves it. PREFER a storyboard: ' +
  '{id, layout: row|column|circle|grid, intro?, nodes: [{id, label?, shape?: circle|box|ellipse|label|note, pack?: <packId>/<objectId>, color?: token, x?, y?}], ' +
  'links?: [{from, to, directed?, dashed?}], steps: [{title?, say?, together?, actions: [...]}]}. Actions: ' +
  '{do: show|hide|highlight|dim, ids: [...]}, {do: draw, links: [{from, to}]} (not for dashed links), {do: move, id, to: {x, y}}. ' +
  'A node with pack draws a style-pack object (for example an accepting state) instead of shape (an empty label draws none; leave an accepting state unlabelled); pack categories: ' + PACK_CATEGORIES + '. ' +
  'An unknown ref is rejected with the list of valid refs. ' +
  'The app lays the nodes out, draws the arrows, writes the animation and the speech bubbles (say text is at most 260 characters per step). ' +
  'Colour tokens: var(--viz-blue), var(--viz-purple), var(--viz-cyan), var(--viz-yellow), var(--viz-orange), var(--viz-pink), ' +
  'var(--accent-green), var(--accent-danger), var(--accent). Only when a storyboard cannot express the lecture, pass a raw VisualSpec ' +
  '{id, viewBox, elements, steps} instead (element kinds circle, ellipse, rect, path with absolute M/L commands, text, math, bubble; ' +
  'tweens [{targets, params, at?}]). Either way the result is validated and layout-checked first (text clear of shape outlines and lines, ' +
  'inside the viewBox); if problems are returned, fix them and call again.';

export const VISUAL_LECTURE_TOOLS: AiTool[] = [
  {
    type: 'function',
    function: {
      name: 'content_editor_visual_lecture',
      description: DESCRIPTION,
      parameters: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Existing course id' },
          weekKey: { type: 'string', description: 'Existing week key' },
          section: { type: 'string', enum: ['lectures', 'practice'], description: 'Defaults to lectures' },
          topicId: { type: 'string', description: 'Lowercase kebab-case topic id' },
          title: { type: 'string', description: 'Lecture title' },
          storyboard: { type: 'object', description: 'The storyboard (preferred)' },
          spec: { type: 'object', description: 'A raw VisualSpec, only when a storyboard cannot express it' },
        },
        required: ['courseId', 'weekKey', 'topicId', 'title'],
      },
    },
  },
];

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

async function failureMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === 'string' ? body.error : `Request failed with status ${res.status}`;
}

async function saveSpec(target: Record<string, string>, spec: unknown, fetchImpl: typeof fetch): Promise<ToolExecutionResult> {
  const res = await fetchImpl('/api/content-editor/topic-visual', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...target, spec }),
  });
  return res.ok ? { success: true, data: await res.json().catch(() => ({})) } : { success: false, error: await failureMessage(res) };
}

interface LectureRequest {
  target: Record<string, string>;
  title: string;
  spec: unknown;
}

function specFrom(args: Record<string, unknown>): { spec: unknown } | { error: string } {
  if (args.storyboard === undefined && args.spec === undefined) return { error: 'Give a storyboard (preferred) or a spec' };
  if (args.storyboard === undefined) return { spec: args.spec };
  const compiled = compileStoryboard(args.storyboard);
  return compiled.spec ? { spec: compiled.spec } : { error: `Invalid storyboard: ${compiled.problems.join('; ')}` };
}

function readRequest(args: Record<string, unknown>): LectureRequest | { error: string } {
  const target = { courseId: text(args.courseId), weekKey: text(args.weekKey), section: text(args.section) || 'lectures', topicId: text(args.topicId) };
  const title = text(args.title);
  if (!target.courseId || !target.weekKey || !target.topicId || !title) return { error: 'courseId, weekKey, topicId and title are required' };
  const built = specFrom(args);
  if ('error' in built) return built;
  const checked = checkVisualSpecForPublish(built.spec);
  if (!checked.spec || checked.problems.length > 0) return { error: `Invalid visual lecture: ${checked.problems.join('; ')}` };
  return { target, title, spec: checked.spec };
}

export async function executeVisualLectureTool(args: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<ToolExecutionResult> {
  const request = readRequest(args);
  if ('error' in request) return { success: false, error: request.error };
  const { target, title, spec } = request;

  const created = await sendContentEditorRequest(
    '/api/content-editor/topic',
    { ...target, action: 'create', topic: { id: target.topicId, title: { en: title }, contentType: 'stepPlayer' } },
    fetchImpl,
  );
  // Publishing again to the same topic is an update, not an error.
  if (!created.ok && !created.error?.includes(ALREADY_EXISTS)) return { success: false, error: created.error };
  return saveSpec(target, spec, fetchImpl);
}
