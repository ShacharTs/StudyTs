import { AiProviderError, type AiResponse, type AiMessage, type AiTool, type AiToolCall } from '../aiProviderContracts.js';
import { parseToolArguments, trimTrailingSlashes } from './providerCommon.js';

type Part = Record<string, unknown>;
type Content = { role: string; parts: Part[] };
interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: unknown };
  thoughtSignature?: string;
}

// Gemini's documented stand-in for a call that has no real signature (e.g. history written by another provider).
const SKIP_SIGNATURE_VALIDATION = 'skip_thought_signature_validator';

const functionCallPart = (tc: AiToolCall): Part => ({
  functionCall: { name: tc.function.name, args: parseToolArguments(tc.function.arguments) },
  thoughtSignature: tc.thoughtSignature ?? SKIP_SIGNATURE_VALIDATION,
});

function toGeminiContent(msg: AiMessage): Content {
  if (msg.role === 'tool') {
    return {
      role: 'user',
      parts: [{ functionResponse: { name: msg.name || 'tool_result', response: { output: msg.content || '' } } }],
    };
  }
  if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
    const text: Part[] = msg.content ? [{ text: msg.content }] : [];
    return { role: 'model', parts: [...text, ...msg.tool_calls.map(functionCallPart)] };
  }
  return { role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content || '' }] };
}

/** Gemini wants every tool result of one model turn in a single user message, or it answers 400. */
function appendContent(contents: Content[], next: Content, isToolResult: boolean): void {
  const last = contents[contents.length - 1];
  const lastIsToolResult = last?.parts.every((p) => 'functionResponse' in p);
  if (isToolResult && last && lastIsToolResult) last.parts.push(...next.parts);
  else contents.push(next);
}

function toConversation(input: string | AiMessage[]): { system?: string; contents: Content[] } {
  if (typeof input === 'string') return { contents: [{ role: 'user', parts: [{ text: input }] }] };
  const systemParts: string[] = [];
  const contents: Content[] = [];
  for (const msg of input) {
    // Mid-turn nudges are system messages too: keep them alongside the real prompt instead of replacing it.
    if (msg.role === 'system') systemParts.push(msg.content || '');
    else appendContent(contents, toGeminiContent(msg), msg.role === 'tool');
  }
  return { system: systemParts.join('\n\n') || undefined, contents };
}

// Gemini rejects JSON-Schema keywords outside its OpenAPI subset with a 400.
const UNSUPPORTED_SCHEMA_KEYS = new Set(['$schema', '$id', '$ref', '$defs', 'additionalProperties', 'default', 'examples', 'patternProperties']);

function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (!node || typeof node !== 'object') return node;
  const entries = Object.entries(node).filter(([key]) => !UNSUPPORTED_SCHEMA_KEYS.has(key));
  // Gemini has no `const`; a one-value enum says the same thing.
  return Object.fromEntries(entries.map(([key, value]) => (key === 'const' ? ['enum', [value]] : [key, toGeminiSchema(value)])));
}

function buildPayload(input: string | AiMessage[], tools?: AiTool[]): Record<string, unknown> {
  const { system, contents } = toConversation(input);
  const payload: Record<string, unknown> = { contents };
  if (system) payload.systemInstruction = { parts: [{ text: system }] };
  if (tools && tools.length > 0) {
    payload.tools = [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: toGeminiSchema(t.function.parameters),
        })),
      },
    ];
  }
  return payload;
}

const newToolCallId = () => `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function toAiResponse(data: { candidates?: { content?: { parts?: GeminiPart[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }): AiResponse {
  const parts = data.candidates?.[0]?.content?.parts || [];
  const toolCalls: AiToolCall[] = parts
    .filter((p) => !p.text && p.functionCall)
    .map((p) => ({
      id: newToolCallId(),
      type: 'function' as const,
      function: { name: (p.functionCall as { name: string }).name, arguments: JSON.stringify(p.functionCall?.args || {}) },
      thoughtSignature: p.thoughtSignature,
    }));
  return {
    text: parts.filter((p) => p.text).map((p) => p.text).join('\n'),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

export async function sendGeminiDirectMessage(
  apiKey: string,
  model: string,
  input: string | AiMessage[],
  tools?: AiTool[],
  baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models',
  fetchFn: typeof fetch = fetch
): Promise<AiResponse> {
  const url = `${trimTrailingSlashes(baseUrl)}/${model}:generateContent`;
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(buildPayload(input, tools)),
  });

  if (!res.ok) {
    throw new AiProviderError(res.status, `Gemini API error: ${await res.text()}`);
  }
  return toAiResponse(await res.json());
}
