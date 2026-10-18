/**
 * Executes content editor tools with automatic error recovery:
 * - Automatically normalizes slugs, colors, icons, and localized structures.
 * - Automatically detects casing mismatches against registered courses via live /api/registry.
 * - If adding a topic fails because the week does not exist yet, creates the week silently and retries.
 * - If creating a course fails because it already exists, automatically updates it.
 */
import type { ToolExecutionResult } from '../../toolExecutionResult';
import { validateToolParameters } from '../validation/toolParameterValidator';
import { sendContentEditorRequest, RECOVERIES } from './contentEditorRequest';

export type { ToolExecutionResult };

const CONTENT_EDITOR_ENDPOINTS: Record<string, string> = {
  content_editor_course: '/api/content-editor/course',
  content_editor_week: '/api/content-editor/week',
  content_editor_topic: '/api/content-editor/topic',
};

export async function executeContentEditorTool(
  toolName: string,
  args: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch
): Promise<ToolExecutionResult> {
  try {
    const safeArgs = args && typeof args === 'object' ? args : {};
    const validationResult = validateToolParameters(toolName, safeArgs);
    const sanitizedArgs = { ...(validationResult.sanitized || safeArgs) };

    const endpoint = CONTENT_EDITOR_ENDPOINTS[toolName];
    if (!endpoint) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    const ctx = { toolName, endpoint, args: sanitizedArgs, fetchImpl };
    let res = await sendContentEditorRequest(endpoint, sanitizedArgs, fetchImpl);
    for (const recover of RECOVERIES) res = await recover(ctx, res);

    return res.ok ? { success: true, data: res.data } : { success: false, error: res.error };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
