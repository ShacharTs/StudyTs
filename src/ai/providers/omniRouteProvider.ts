import { AiProviderError, type AiResponse, type AiMessage, type AiTool, type AiUsage } from '@core/shared/aiTypes';

interface StreamingToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ToolCallDelta {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface StreamEvent {
  choices?: {
    delta?: {
      content?: string;
      reasoning_content?: string;
      tool_calls?: ToolCallDelta[];
    };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface StreamState {
  text: string;
  thought: string;
  toolCalls: Map<number, StreamingToolCall>;
  usage: AiUsage;
}

function extractThinkTags(text: string): { cleanText: string; thought: string } {
  let thought = '';
  const cleanText = text
    .replace(/<think>([\s\S]*?)<\/think>/gi, (_, t) => {
      thought += (thought ? '\n' : '') + t.trim();
      return '';
    })
    .replace(/<think>([\s\S]*)$/i, (_, t) => {
      thought += (thought ? '\n' : '') + t.trim();
      return '';
    })
    .trim();
  return { cleanText, thought };
}

/** One SSE line -> its JSON event, or null for comments, other fields, [DONE] and malformed payloads. */
function parseSseLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const payload = trimmed.slice(5).trim();
  if (payload === '[DONE]') return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/** Tool calls arrive in fragments keyed by index: the first creates the call, later ones append. */
function mergeToolCallDelta(calls: Map<number, StreamingToolCall>, tc: ToolCallDelta): void {
  const idx = tc.index ?? 0;
  const existing = calls.get(idx);
  if (!existing) {
    calls.set(idx, {
      id: tc.id ?? `call_${idx}`,
      type: 'function',
      function: { name: tc.function?.name ?? '', arguments: tc.function?.arguments ?? '' },
    });
    return;
  }
  if (tc.function?.name) existing.function.name += tc.function.name;
  if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
}

function applyEvent(
  state: StreamState,
  event: StreamEvent,
  onChunk: (text: string) => void,
  onThought?: (thought: string) => void
): void {
  const delta = event?.choices?.[0]?.delta;
  if (delta?.reasoning_content) {
    state.thought += delta.reasoning_content;
    onThought?.(delta.reasoning_content);
  }
  if (delta?.content) {
    state.text += delta.content;
    onChunk(delta.content);
  }
  if (Array.isArray(delta?.tool_calls)) {
    for (const tc of delta.tool_calls) mergeToolCallDelta(state.toolCalls, tc);
  }
  if (event?.usage) {
    state.usage = {
      inputTokens: event.usage.prompt_tokens ?? 0,
      outputTokens: event.usage.completion_tokens ?? 0,
    };
  }
}

function toResponse(state: StreamState): AiResponse {
  const toolCalls = [...state.toolCalls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call);
  const extracted = extractThinkTags(state.text);
  const fullThought = (state.thought + (extracted.thought ? `\n${extracted.thought}` : '')).trim() || undefined;
  const calls = toolCalls.length > 0 ? toolCalls : undefined;
  return {
    text: extracted.cleanText,
    toolCalls: calls,
    thought: fullThought,
    rawMessage: { role: 'assistant', content: extracted.cleanText, tool_calls: calls },
    usage: state.usage,
  };
}

function applySseLines(
  lines: string[],
  state: StreamState,
  onChunk: (text: string) => void,
  onThought?: (thought: string) => void
): void {
  for (const line of lines) {
    const event = parseSseLine(line);
    if (event) applyEvent(state, event, onChunk, onThought);
  }
}

async function readStreamedResponse(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void,
  onThought?: (thought: string) => void,
  onActivity?: () => void
): Promise<AiResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const state: StreamState = { text: '', thought: '', toolCalls: new Map(), usage: { inputTokens: 0, outputTokens: 0 } };
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      onActivity?.();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      applySseLines(lines, state, onChunk, onThought);
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      applySseLines([buffer], state, onChunk, onThought);
    }
  } catch (err) {
    await reader.cancel().catch(() => {});
    throw err;
  } finally {
    reader.releaseLock();
  }
  return toResponse(state);
}

// OmniRoute goes browser -> local sidecar directly, unlike the direct-provider path which
// gets a server-side timeout via server/routes/aiChatProxy.ts. This is an idle limit (restarted by
// every chunk), not a total one, so a long answer keeps streaming while a hung one is cut off.
const OMNIROUTE_TIMEOUT_MS = 120_000;

function buildRequestBody(model: string, input: string | AiMessage[], tools: AiTool[] | undefined, stream: boolean) {
  const messages: AiMessage[] = typeof input === 'string' ? [{ role: 'user', content: input }] : input;
  const body: Record<string, unknown> = { model, messages, stream };
  if (tools && tools.length > 0) {
    body.tools = tools;
    // Tool-calling (canvas gen, content edits) needs reliable structured output — low
    // temperature reduces malformed/inconsistent calls. Plain chat keeps the provider default.
    body.temperature = 0.2;
  }
  return body;
}

/** A silence timer: aborts the request when nothing arrives for OMNIROUTE_TIMEOUT_MS; `touch` restarts it, `stop` ends it. */
function createIdleTimeout(): { signal: AbortSignal; touch: () => void; stop: () => void } {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => clearTimeout(timer);
  const touch = () => {
    stop();
    timer = setTimeout(
      () => controller.abort(new AiProviderError(504, `OmniRoute went silent for ${OMNIROUTE_TIMEOUT_MS / 1000}s`, 'timeout')),
      OMNIROUTE_TIMEOUT_MS
    );
  };
  return { signal: controller.signal, touch, stop };
}

async function postChatCompletion(url: string, bearerKey: string, body: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
}

interface OmniMessage {
  content?: string;
  reasoning_content?: string;
  tool_calls?: AiResponse['toolCalls'];
}

interface OmniResponse {
  choices?: { message?: OmniMessage }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function toAiResponse(data: OmniResponse | undefined): AiResponse {
  const choiceMessage = data?.choices?.[0]?.message;
  const toolCalls = choiceMessage?.tool_calls;
  const rawText = choiceMessage?.content ?? '';
  const extracted = extractThinkTags(rawText);
  const thought = (choiceMessage?.reasoning_content || extracted.thought || '').trim() || undefined;
  return {
    text: extracted.cleanText,
    toolCalls: Array.isArray(toolCalls) && toolCalls.length > 0 ? toolCalls : undefined,
    thought,
    rawMessage: choiceMessage as AiResponse['rawMessage'],
    usage: {
      inputTokens: data?.usage?.prompt_tokens ?? 0,
      outputTokens: data?.usage?.completion_tokens ?? 0,
    },
  };
}

export async function sendOmniRouteMessage(
  bearerKey: string,
  model: string,
  input: string | AiMessage[],
  baseUrl: string,
  tools?: AiTool[],
  signal?: AbortSignal,
  onChunk?: (text: string) => void,
  onThought?: (thought: string) => void
): Promise<AiResponse> {
  const body = buildRequestBody(model, input, tools, !!onChunk);
  const idle = createIdleTimeout();
  const combinedSignal = signal ? AbortSignal.any([signal, idle.signal]) : idle.signal;
  idle.touch();
  try {
    const response = await postChatCompletion(`${baseUrl}/chat/completions`, bearerKey, body, combinedSignal);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new AiProviderError(response.status, data?.error?.message ?? 'Unknown error');
    }
    if (onChunk && response.body) return await readStreamedResponse(response.body, onChunk, onThought, idle.touch);
    return toAiResponse(await response.json().catch(() => ({})));
  } finally {
    idle.stop();
  }
}

export interface ModelsResult {
  models: string[];
  /** Why the list is empty, when it is not simply an aborted request. */
  error?: string;
}

/** Lists the router's models and says why it could not (service down, auth, bad body) instead of hiding it. */
export async function fetchOmniRouteModels(baseUrl: string, apiKey?: string, signal?: AbortSignal): Promise<ModelsResult> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const response = await fetch(`${baseUrl}/models`, { headers, signal });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { models: [], error: body?.error ?? `HTTP ${response.status}` };
    }
    const data = await response.json().catch(() => ({ data: [] }));
    return { models: (data?.data ?? []).map((m: { id: string }) => m.id) };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return { models: [] };
    return { models: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listOmniRouteModels(baseUrl: string, apiKey?: string, signal?: AbortSignal): Promise<string[]> {
  return (await fetchOmniRouteModels(baseUrl, apiKey, signal)).models;
}
