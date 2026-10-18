// src/ai/chat/buildSendFn.ts
/** Builds the provider-dispatch send function used by the chat loop: routes to OmniRoute (streamed) or a direct provider. */
import { sendOmniRouteMessage } from '@ai/providers/omniRouteProvider';
import { DirectProvider, DirectProviderConfig } from '@ai/providers/directProviderCatalog';
import { AiMessage, AiResponse, AiTool, AiProviderError } from '@core/shared/aiTypes';
import type { AppViewContext } from '@core/shared/appViewContext';
import type { DisplayMessage } from './aiConnectionDefaults';
import { sendWithRetry } from './sendWithRetry';

interface BuildSendFnParams {
  isOmniRoute: boolean;
  activeKey: string | null;
  omniRouteModel: string;
  omniRouteBaseUrl: string;
  directProvider: DirectProvider;
  directModel: string;
  activeProviderConfig: DirectProviderConfig;
  customBaseUrl: string;
  abortSignal: AbortSignal;
  statusId: string;
  setDisplayMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  onRequestIdChange?: (requestId: string) => void;
  viewContext?: AppViewContext | null;
}

async function sendDirectRelayed(
  params: BuildSendFnParams,
  msgs: AiMessage[],
  tools?: AiTool[]
): Promise<AiResponse> {
  const { directProvider, activeKey, directModel, activeProviderConfig, customBaseUrl, abortSignal, onRequestIdChange, viewContext } = params;
  const requestId = crypto.randomUUID();
  onRequestIdChange?.(requestId);

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: abortSignal,
    body: JSON.stringify({
      requestId,
      provider: directProvider,
      apiKey: activeKey || '',
      model: directModel,
      messages: msgs,
      tools,
      customBaseUrl: activeProviderConfig.supportsCustomUrl ? customBaseUrl : undefined,
      viewContext: viewContext ?? undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiProviderError(res.status, body.error || 'AI request failed', body.category);
  }
  return res.json();
}

async function sendOmniRouteStreamed(
  params: BuildSendFnParams,
  msgs: AiMessage[],
  tools?: AiTool[]
): Promise<AiResponse> {
  const { activeKey, omniRouteModel, omniRouteBaseUrl, abortSignal, statusId, setDisplayMessages } = params;
  if (!activeKey) throw new Error('No API key configured');

  let streamedText = '';
  let streamId: string | null = null;
  let streamedThought = '';
  let thoughtId: string | null = null;

  const onChunk = (chunk: string) => {
    streamedText += chunk;
    const text = streamedText;
    if (!streamId) {
      streamId = `stream-${Date.now()}`;
      const id = streamId;
      setDisplayMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === statusId);
        const bubble: DisplayMessage = { id, role: 'assistant', content: text };
        return idx === -1 ? [...prev, bubble] : [...prev.slice(0, idx), bubble, ...prev.slice(idx)];
      });
    } else {
      const id = streamId;
      setDisplayMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: text } : m)));
    }
  };

  const onThought = (chunk: string) => {
    streamedThought += chunk;
    const thought = streamedThought;
    if (!thoughtId) {
      thoughtId = `thought-${Date.now()}`;
      const id = thoughtId;
      setDisplayMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === statusId);
        const bubble: DisplayMessage = { id, role: 'assistant', content: '', thought };
        return idx === -1 ? [...prev, bubble] : [...prev.slice(0, idx), bubble, ...prev.slice(idx)];
      });
    } else {
      const id = thoughtId;
      setDisplayMessages((prev) => prev.map((m) => (m.id === id ? { ...m, thought } : m)));
    }
  };

  try {
    const response = await sendOmniRouteMessage(activeKey, omniRouteModel, msgs, omniRouteBaseUrl, tools, abortSignal, onChunk, onThought);
    if (response.thought && !thoughtId) {
      const id = `thought-${Date.now()}`;
      const thought = response.thought;
      setDisplayMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === statusId);
        const bubble: DisplayMessage = { id, role: 'assistant', content: '', thought };
        return idx === -1 ? [...prev, bubble] : [...prev.slice(0, idx), bubble, ...prev.slice(idx)];
      });
    }
    return response;
  } catch (err) {
    const partialIds = new Set<string | null>([streamId, thoughtId]);
    setDisplayMessages((prev) => prev.filter((m) => !partialIds.has(m.id)));
    throw err;
  }
}

export function buildSendFn(params: BuildSendFnParams) {
  const { isOmniRoute, abortSignal, statusId, setDisplayMessages } = params;

  return function sendFn(msgs: AiMessage[], tools?: AiTool[]): Promise<AiResponse> {
    const setStatus = (content: string) =>
      setDisplayMessages((prev) => prev.map((m) => (m.id === statusId ? { ...m, content } : m)));

    return sendWithRetry(
      () => (isOmniRoute ? sendOmniRouteStreamed(params, msgs, tools) : sendDirectRelayed(params, msgs, tools)),
      {
        signal: abortSignal,
        onRetryScheduled: (retryNumber, delayMs) => setStatus(`__status__retrying:${retryNumber}:${delayMs / 1000}`),
        onAttemptStart: () => setStatus('__status__generating'),
      }
    );
  };
}
