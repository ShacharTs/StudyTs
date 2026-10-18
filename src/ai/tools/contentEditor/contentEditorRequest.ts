
interface ContentEditorSendResult {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
}

export async function sendContentEditorRequest(
  endpoint: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch
): Promise<ContentEditorSendResult> {
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const resJson = await res.json().catch(() => ({}));
    if (!res.ok) {
      let errorMsg = resJson?.error || `Request failed with status ${res.status}`;
      if (res.status === 405) {
        errorMsg = 'AST content editing requires Vite Dev Mode (npm run dev). Static Docker preview cannot write source files.';
      }
      return {
        ok: false,
        status: res.status,
        error: errorMsg,
      };
    }
    return { ok: true, status: res.status, data: resJson };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

type EditorResponse = Awaited<ReturnType<typeof sendContentEditorRequest>>;

export interface RecoveryContext {
  toolName: string;
  endpoint: string;
  /** Mutated by recoveries that fix the request (course id casing, create → update, topic id suffix). */
  args: Record<string, unknown>;
  fetchImpl: typeof fetch;
}

export type Recovery = (ctx: RecoveryContext, res: EditorResponse) => Promise<EditorResponse>;

const retry = (ctx: RecoveryContext) => sendContentEditorRequest(ctx.endpoint, ctx.args, ctx.fetchImpl);
const alreadyExists = (res: EditorResponse) => !res.ok && Boolean(res.error?.includes('already exists'));

export function isCourseNotFound(error?: string): boolean {
  const e = error?.toLowerCase() ?? '';
  return e.includes('no course') || (e.includes('course') && e.includes('not found'));
}

const squash = (id: string) => id.toLowerCase().replace(/[-_]/g, '');

/** Finds the registry key for a course id that only differs in case or `-`/`_` separators. */
export function matchCourseKey(registry: Record<string, unknown>, rawId: string): string | undefined {
  const wanted = squash(rawId);
  return Object.keys(registry).find((k) => k.toLowerCase() === rawId.toLowerCase() || squash(k) === wanted);
}

// Recovery 1: course id has the wrong casing/separators -> look it up in the live registry and retry.
export const recoverCourseCasing: Recovery = async (ctx, res) => {
  const rawCourseId = (ctx.args.courseId || ctx.args.id) as string | undefined;
  if (res.ok || !isCourseNotFound(res.error) || !rawCourseId) return res;
  try {
    const regRes = await ctx.fetchImpl('/api/registry');
    if (!regRes.ok) return res;
    const matchedKey = matchCourseKey(await regRes.json(), rawCourseId);
    if (!matchedKey) return res;
    if (ctx.args.courseId) ctx.args.courseId = matchedKey;
    if (ctx.args.id) ctx.args.id = matchedKey;
    return await retry(ctx);
  } catch {
    return res; // live registry fetch failure ignored, keeping the original response
  }
};

// Recovery 2: adding a topic to a week that does not exist yet -> create the week silently and retry.
export const recoverMissingWeek: Recovery = async (ctx, res) => {
  const weekMissing = res.error?.includes('not found') || res.error?.includes('Week') || res.status === 404;
  if (res.ok || ctx.toolName !== 'content_editor_topic' || !weekMissing) return res;
  const courseId = (ctx.args.courseId as string) || 'complexity';
  const weekKey = (ctx.args.weekKey as string) || 'week1';
  const weekRes = await sendContentEditorRequest(
    '/api/content-editor/week',
    { courseId, weekKey, action: 'create', title: `Week: ${weekKey}` },
    ctx.fetchImpl,
  );
  return weekRes.ok || weekRes.error?.includes('already exists') ? retry(ctx) : res;
};

// Recovery 3: creating a course that already exists -> switch to update.
export const recoverCourseExists: Recovery = async (ctx, res) => {
  if (ctx.toolName !== 'content_editor_course' || ctx.args.action !== 'create' || !alreadyExists(res)) return res;
  ctx.args.action = 'update';
  return retry(ctx);
};

// Recovery 4: creating a topic that already exists -> give it a non-conflicting id suffix.
export const recoverTopicExists: Recovery = async (ctx, res) => {
  if (ctx.toolName !== 'content_editor_topic' || ctx.args.action !== 'create' || !alreadyExists(res)) return res;
  const topic = ctx.args.topic as Record<string, unknown> | undefined;
  if (!topic || typeof topic.id !== 'string') return res;
  topic.id = `${topic.id}-${Math.floor(10 + Math.random() * 90)}`;
  return retry(ctx);
};

/** Applied in order; each sees the previous response. */
export const RECOVERIES: Recovery[] = [recoverCourseCasing, recoverMissingWeek, recoverCourseExists, recoverTopicExists];
