// src/components/ai/useAiChatSend.ts
/**
 * Multi-round tool-calling send loop for AiSettingsModal: builds prompt/context,
 * sends via active provider, runs tool calls, and reconciles replies.
 */
import { useRef, useEffect } from 'react';
import { AI_TEXT } from '../../i18n/dictionary';
import { DirectProvider, DirectProviderConfig } from '@ai/providers/directProviderCatalog';
import { log } from '../../core/logger';
import { AiMessage } from '@core/shared/aiTypes';
import type { TopicContent, CourseDefinitionAPI } from '../../core/courseDataLoader';
import type { DisplayMessage } from '../../ai/chat/aiConnectionDefaults';
import { buildSendFn } from '../../ai/chat/buildSendFn';
import { describeSendError, buildTurnReply, classifySendFailure, type SendFailureKind } from '../../ai/chat/buildTurnReply';
import { buildChatHistory, userContent } from '../../ai/chat/buildChatHistory';
import { availableTools } from '../../ai/chat/availableTools';
import { runToolLoop } from '../../ai/chat/runToolLoop';
import { savePendingTurn, loadPendingTurn, clearPendingTurn } from '../../ai/chat/pendingTurnStore';
import { useAppViewContextStore } from '../../ai/context/appViewContextStore';

interface UseAiChatSendParams {
  val: (input?: unknown) => string;
  isOmniRoute: boolean;
  activeKey: string | null;
  omniRouteModel: string;
  omniRouteBaseUrl: string;
  directProvider: DirectProvider;
  directModel: string;
  activeProviderConfig: DirectProviderConfig;
  customBaseUrl: string;
  isConnected: boolean;
  sourceEditingEnabled: boolean;
  sourceEditConfirmed: boolean;
  setSourceEditConfirmed: (v: boolean) => void;
  activeCourseId?: string;
  activeTopicId?: string;
  topicContent?: TopicContent | null;
  registry: Record<string, CourseDefinitionAPI>;
  attachments?: Array<{ name: string; content: string }>;
  attachedFile?: { name: string; content: string } | null;
  conversationHistory: AiMessage[];
  setConversationHistory: (h: AiMessage[]) => void;
  setDisplayMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  setChatInput: (v: string) => void;
  setChatError: (v: string | null) => void;
  setIsSending: (v: boolean) => void;
  setAiStatus: (status: 'idle' | 'working' | 'done' | 'error') => void;
  refreshRegistry: () => Promise<void>;
  onContentChanged?: () => void;
}

export function useAiChatSend(params: UseAiChatSendParams) {
  const stopRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
    if (requestIdRef.current) fetch(`/api/ai/chat/${requestIdRef.current}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  const handleStopGenerating = () => {
    stopRef.current = true;
    abortControllerRef.current?.abort();
    if (requestIdRef.current) fetch(`/api/ai/chat/${requestIdRef.current}`, { method: 'DELETE' }).catch(() => {});
  };

  /** Runs one turn to its end. `history` is the model's starting messages: freshly built, or restored after a reload. */
  const runTurn = async (prompt: string, userText: string, restoredHistory: AiMessage[] | null) => {
    const p = params;
    p.setIsSending(true);
    stopRef.current = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    requestIdRef.current = null;

    const statusId = `status-${Date.now()}`;
    p.setDisplayMessages((prev) => [
      ...prev.filter((m) => !m.content.startsWith('__status__')),
      { id: statusId, role: 'assistant', content: '__status__generating' },
    ]);

    try {
      const viewContext = useAppViewContextStore.getState().context;
      const effectiveAttachments = p.attachments ?? (p.attachedFile ? [p.attachedFile] : []);
      const currentHistory = restoredHistory ?? await buildChatHistory({ ...p, attachments: effectiveAttachments, prompt, viewContext });
      savePendingTurn({ prompt, userText, messages: currentHistory });
      const tools = await availableTools(p.sourceEditingEnabled, viewContext?.kind);
      const sendFn = buildSendFn({
        isOmniRoute: p.isOmniRoute, activeKey: p.activeKey, omniRouteModel: p.omniRouteModel, omniRouteBaseUrl: p.omniRouteBaseUrl,
        directProvider: p.directProvider, directModel: p.directModel, activeProviderConfig: p.activeProviderConfig,
        customBaseUrl: p.customBaseUrl, abortSignal: abortController.signal, statusId, setDisplayMessages: p.setDisplayMessages,
        onRequestIdChange: (id) => { requestIdRef.current = id; },
        viewContext,
      });

      const outcome = await runToolLoop({
        response: await sendFn(currentHistory, tools), sendFn, tools, activeMessages: [...currentHistory], statusId, stopRef, ...p,
        onRound: (messages) => savePendingTurn({ prompt, userText, messages: [...messages] }),
      });
      const { content } = buildTurnReply(outcome, stopRef.current, prompt, p.val);

      // Streamed bubbles hold the same text as the final reply, so they go; but when the reply came out empty
      // (e.g. a model that wrapped its whole answer in <think>) they are the only copy the user has.
      const dropStreamed = Boolean(outcome.response.text);
      p.setDisplayMessages((prev) => [
        ...prev.filter((m) => m.id !== statusId && !(dropStreamed && m.id.startsWith('stream-'))),
        { id: `asst-${Date.now()}`, role: 'assistant', content },
      ]);
      p.setConversationHistory([
        ...p.conversationHistory,
        { role: 'user', content: userText },
        { role: 'assistant', content },
      ]);
      p.setAiStatus('done');
      setTimeout(() => p.setAiStatus('idle'), 3000);
    } catch (err) {
      reportSendError(err, p, statusId, stopRef.current);
    } finally {
      clearPendingTurn();
      p.setIsSending(false);
      abortControllerRef.current = null;
      requestIdRef.current = null;
    }
  };

  const handleSendMessage = async (chatInput: string) => {
    const p = params;
    const effectiveAttachments = p.attachments ?? (p.attachedFile ? [p.attachedFile] : []);
    const prompt = chatInput.trim() || (effectiveAttachments.length > 0 ? 'Analyze the attached file(s).' : '');
    if (!prompt) return;
    if (!p.isConnected) return void p.setChatError(p.val(AI_TEXT.needApiKeyFirst));

    p.setChatInput('');
    p.setChatError(null);
    p.setDisplayMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', content: prompt }]);
    await runTurn(prompt, userContent(prompt, effectiveAttachments), null);
  };

  /** Carries on a turn the last page load cut off, from the messages saved after its last finished step. */
  const resumePendingTurn = async () => {
    const pending = loadPendingTurn();
    if (!pending) return;
    params.setDisplayMessages((prev: DisplayMessage[]) => {
      const alreadyHasPrompt = prev.some((m: DisplayMessage) => m.role === 'user' && m.content === pending.prompt);
      if (alreadyHasPrompt) return prev;
      return [...prev, { id: `user-${pending.savedAt || Date.now()}`, role: 'user', content: pending.prompt }];
    });
    await runTurn(pending.prompt, pending.userText, pending.messages);
  };

  return { handleSendMessage, handleStopGenerating, resumePendingTurn };
}

function failureText(kind: SendFailureKind, userStopped: boolean, err: unknown, val: UseAiChatSendParams['val']): string {
  if (kind === 'abort') return userStopped ? val(AI_TEXT.stopped) : val(AI_TEXT.errorAborted);
  if (kind === 'fetch-failed') return val(AI_TEXT.errorNetwork);
  return describeSendError(err, val).displayText;
}

/** Shows a failed turn on its status line: a user stop, a dropped connection, or the provider's error. */
function reportSendError(err: unknown, p: UseAiChatSendParams, statusId: string, userStopped: boolean): void {
  const failure = classifySendFailure(err);
  const isAbort = failure.kind === 'abort';
  if (!(isAbort && userStopped)) log.error('AI send failed', { ...failure });
  const content = failureText(failure.kind, userStopped, err, p.val);
  const isProviderError = !(isAbort && userStopped);
  p.setDisplayMessages((prev) => prev.map((m) => (m.id === statusId ? { ...m, content, isProviderError } : m)));
  p.setAiStatus(isAbort && userStopped ? 'idle' : 'error');
}
