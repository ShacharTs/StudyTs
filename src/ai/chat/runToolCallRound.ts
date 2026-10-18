// src/ai/chat/runToolCallRound.ts
/**
 * Executes one round of tool calls returned by the AI provider: parses each
 * call's JSON arguments, confirms source-editing calls with the user, runs
 * the tool, and
 * appends the resulting messages to displayMessages/activeMessages.
 */
import { AI_TEXT } from '../../i18n/dictionary';
import { log } from '../../core/logger';
import { AiMessage } from '@core/shared/aiTypes';
import { executeUnifiedTool } from '@ai/tools';
import { toolLabel } from './toolLabels';
import { describeSuccess, describeFailure } from './describeToolRun';
import type { DisplayMessage, ToolDetail } from './aiConnectionDefaults';

export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

const WRITE_TOOL_PREFIXES = ['content_editor_', 'source_editor_'];
// Every tool that changes content. One missing here made a turn that edited a canvas read as "no change made".
const WRITE_TOOL_NAMES = ['create_custom_canvas', 'apply_scene_ops', 'generate_uml_diagram'];
export const isWriteTool = (name: string) => WRITE_TOOL_NAMES.includes(name) || WRITE_TOOL_PREFIXES.some((p) => name.startsWith(p));

interface RunToolCallRoundParams {
  toolCalls: ToolCall[];
  activeMessages: AiMessage[];
  statusId: string;
  val: (input?: unknown) => string;
  sourceEditingEnabled: boolean;
  sourceEditConfirmed: boolean;
  setSourceEditConfirmed: (v: boolean) => void;
  setDisplayMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  refreshRegistry: () => Promise<void>;
  onContentChanged?: () => void;
  stopRef: React.RefObject<boolean>;
}

interface RunToolCallRoundResult {
  calledAnyTool: boolean;
  calledWriteTool: boolean;
  successfulWriteToolNames: string[];
}

type Round = RunToolCallRoundResult;

function parseArguments(toolCall: ToolCall): { args: Record<string, unknown>; error: string | null } {
  try {
    return { args: JSON.parse(toolCall.function.arguments || '{}'), error: null };
  } catch (err) {
    // Log raw string on parse failure to make malformed JSON from models diagnosable.
    log.error('AI tool call failed to parse arguments JSON', {
      tool: toolCall.function.name,
      raw: toolCall.function.arguments,
      error: String(err),
    });
    return { args: {}, error: err instanceof Error ? err.message : String(err) };
  }
}

function showToolLine(p: RunToolCallRoundParams, toolCall: ToolCall, content: string, toolDetail?: ToolDetail): void {
  p.setDisplayMessages((prev) => [
    ...prev,
    { id: `tool-${Date.now()}-${toolCall.id}`, role: 'tool', toolCallName: toolCall.function.name, content, toolDetail },
  ]);
}

function tellModel(p: RunToolCallRoundParams, toolCall: ToolCall, content: unknown): void {
  p.activeMessages.push({ role: 'tool', name: toolCall.function.name, tool_call_id: toolCall.id, content: JSON.stringify(content) });
}

function reportMalformedArguments(p: RunToolCallRoundParams, round: Round, toolCall: ToolCall, error: string): void {
  const name = toolCall.function.name;
  const toolDetail: ToolDetail = { toolName: name, error: `Invalid JSON: ${error}`, rawArgs: {} };
  showToolLine(p, toolCall, `✗ ${toolLabel(name, p.val)}: ${p.val(AI_TEXT.toolArgsInvalidJson)} (${error})`, toolDetail);
  round.calledAnyTool = true;
  tellModel(p, toolCall, {
    success: false,
    error: `Your tool call arguments were not valid JSON: ${error}. Raw arguments received: ${toolCall.function.arguments?.slice(0, 500)}`,
  });
}

/** Source edits modify the app's own code, so the first one needs the user's OK. Returns whether to proceed. */
function confirmSourceEdit(p: RunToolCallRoundParams, toolCall: ToolCall, args: Record<string, unknown>): boolean {
  if (!toolCall.function.name.startsWith('source_editor_') || p.sourceEditConfirmed) return true;
  const confirmed = window.confirm(
    `AI wants to edit source code files. This will modify the app's own code.

File: ${args.filePath}
Reason: ${args.reason}

Continue?`
  );
  if (!confirmed) {
    const toolDetail: ToolDetail = { toolName: toolCall.function.name, rawArgs: args, error: 'User declined' };
    showToolLine(p, toolCall, `✗ ${toolLabel(toolCall.function.name, p.val)}: User declined source code editing`, toolDetail);
    tellModel(p, toolCall, { success: false, error: 'User declined' });
    return false;
  }
  p.setSourceEditConfirmed(true);
  return true;
}

// Scene and UML edits change what the open page shows too, so every write tool refreshes the view.
const affectsRegistry = isWriteTool;

async function runTool(p: RunToolCallRoundParams, round: Round, toolCall: ToolCall, args: Record<string, unknown>): Promise<void> {
  const name = toolCall.function.name;
  const start = performance.now();
  const toolResult = await executeUnifiedTool(name, args, { sourceEditingEnabled: p.sourceEditingEnabled });
  const durationMs = Math.round(performance.now() - start);

  if (toolResult.success) {
    if (isWriteTool(name)) round.successfulWriteToolNames.push(name);
    if (affectsRegistry(name)) {
      // Clear the cached registry before onContentChanged's retry re-fetches — otherwise
      // the retry re-reads the stale cache and never sees what this tool just created.
      await p.refreshRegistry();
      p.onContentChanged?.();
    }
  }

  const toolDetail: ToolDetail = {
    toolName: name,
    rawArgs: args,
    resultData: toolResult.data,
    error: toolResult.error,
    durationMs,
    sqlQuery: typeof args.sql === 'string' ? args.sql : undefined,
    sceneId: typeof args.sceneId === 'string' ? args.sceneId : undefined,
    topicId: typeof args.topicId === 'string' ? args.topicId : undefined,
  };

  p.setDisplayMessages((prev) => prev.map((m) => (m.id === p.statusId ? { ...m, content: '__status__executing' } : m)));
  showToolLine(
    p,
    toolCall,
    toolResult.success
      ? `✓ ${describeSuccess({ name, args, data: toolResult.data }, p.val)}`
      : `✗ ${describeFailure(name, toolResult.error, p.val)}`,
    toolDetail
  );
  tellModel(p, toolCall, toolResult);
}

async function runOne(p: RunToolCallRoundParams, round: Round, toolCall: ToolCall): Promise<void> {
  const { args, error } = parseArguments(toolCall);
  if (error) return reportMalformedArguments(p, round, toolCall, error);

  round.calledAnyTool = true;
  if (isWriteTool(toolCall.function.name)) round.calledWriteTool = true;
  p.setDisplayMessages((prev) =>
    prev.map((m) => (m.id === p.statusId ? { ...m, content: `__status__calling:${toolCall.function.name}` } : m))
  );
  if (confirmSourceEdit(p, toolCall, args)) await runTool(p, round, toolCall, args);
}

export async function runToolCallRound(params: RunToolCallRoundParams): Promise<RunToolCallRoundResult> {
  const round: Round = { calledAnyTool: false, calledWriteTool: false, successfulWriteToolNames: [] };
  for (const toolCall of params.toolCalls) {
    if (params.stopRef.current) break;
    await runOne(params, round, toolCall);
  }
  return round;
}
