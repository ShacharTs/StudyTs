// src/ai/chat/buildTurnReply.ts
/** Turns a finished tool loop into the assistant message to show, plus what the success-example recorder needs. */
import type { ToolLoopOutcome } from './runToolLoop';
import { AI_TEXT } from '../../i18n/dictionary';
import { AiProviderError, AiErrorCategory } from '@core/shared/aiTypes';
import { log } from '../../core/logger';

/** Pure text-derivation helpers for useAiChatSend.ts's send loop. */

const ERROR_CATEGORY_TEXT_KEY: Record<AiErrorCategory, keyof typeof AI_TEXT> = {
  timeout: 'errorTimeout',
  'rate-limit': 'errorRateLimit',
  auth: 'errorAuth',
  'bad-request': 'errorBadRequest',
  provider: 'errorProvider',
  network: 'errorNetwork',
};

export type SendFailureKind = 'abort' | 'fetch-failed' | 'provider';

/** Names what actually failed so the log can tell an interrupted request from an unreachable server. */
export function classifySendFailure(err: unknown): { kind: SendFailureKind; name: string; message: string } {
  const name = err instanceof Error ? err.name : typeof err;
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof DOMException && err.name === 'AbortError') return { kind: 'abort', name, message };
  if (err instanceof TypeError && /fetch/i.test(err.message)) return { kind: 'fetch-failed', name, message };
  return { kind: 'provider', name, message };
}

/** Classifies a caught send error into student-safe display text (never the raw vendor message). */
export function describeSendError(err: unknown, val: (input?: unknown) => string): { displayText: string } {
  if (err instanceof AiProviderError) {
    log.error('AI provider request failed', { category: err.category, status: err.status, providerMessage: err.providerMessage });
    // Category text (AI_TEXT.errorTimeout etc.) already carries its own ⚠️ prefix.
    return { displayText: val(AI_TEXT[ERROR_CATEGORY_TEXT_KEY[err.category]]) };
  }
  const text = err instanceof Error ? `${val(AI_TEXT.requestFailed)}: ${err.message}` : val(AI_TEXT.requestFailed);
  return { displayText: `⚠️ ${text}` };
}

interface ReplyOutcome {
  stopped: boolean;
  responseText: string;
  calledAnyTool: boolean;
  calledWriteTool: boolean;
  successfulWriteToolNames?: string[];
}

function fallbackToolText(calledAnyTool: boolean, calledWriteTool: boolean, hadSuccessfulWrite: boolean, val: (input?: unknown) => string): string {
  if (calledWriteTool && !hadSuccessfulWrite) return val(AI_TEXT.toolFailed);
  return calledAnyTool && !calledWriteTool ? val(AI_TEXT.emptyReplyAfterTools) : val(AI_TEXT.actionCompleted);
}

/** Picks the final assistant bubble text from how the tool-calling loop ended. */
export function buildReplyContent(outcome: ReplyOutcome, val: (input?: unknown) => string): string {
  const { stopped, responseText, calledAnyTool, calledWriteTool, successfulWriteToolNames } = outcome;
  if (stopped) return responseText || val(AI_TEXT.stopped);
  if (responseText) return responseText;
  const hadSuccessfulWrite = (successfulWriteToolNames?.length ?? 0) > 0;
  return fallbackToolText(calledAnyTool, calledWriteTool, hadSuccessfulWrite, val);
}

/** The assistant message to show for a finished turn. */
export function buildTurnReply(outcome: ToolLoopOutcome, stopped: boolean, _prompt: string, val: (input?: unknown) => string) {
  const { response, calledAnyTool, calledWriteTool, successfulWriteToolNames } = outcome;
  const content = buildReplyContent(
    { stopped, responseText: response.text, calledAnyTool, calledWriteTool, successfulWriteToolNames },
    val
  );
  return { content };
}
