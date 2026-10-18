import { API_VERSIONS } from '../apiVersions.js';
import { AiProviderError, type AiResponse, type AiMessage, type AiTool, type AiToolCall } from '../aiProviderContracts.js';
import { parseToolArguments, trimTrailingSlashes } from './providerCommon.js';

type AnthropicMessage = { role: 'user' | 'assistant'; content: unknown };
interface AnthropicBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

const toolUseBlock = (tc: AiToolCall) => ({
  type: 'tool_use',
  id: tc.id,
  name: tc.function.name,
  input: parseToolArguments(tc.function.arguments),
});

function toAnthropicMessage(msg: AiMessage): AnthropicMessage {
  if (msg.role === 'tool') {
    return {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: msg.tool_call_id || 'unknown_tool_call', content: msg.content || '' }],
    };
  }
  if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
    const text: unknown[] = msg.content ? [{ type: 'text', text: msg.content }] : [];
    return { role: 'assistant', content: [...text, ...msg.tool_calls.map(toolUseBlock)] };
  }
  return { role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content || '' };
}

function toConversation(input: string | AiMessage[]): { system?: string; messages: AnthropicMessage[] } {
  if (typeof input === 'string') return { messages: [{ role: 'user', content: input }] };
  let system: string | undefined;
  const messages: AnthropicMessage[] = [];
  for (const msg of input) {
    if (msg.role === 'system') system = msg.content || '';
    else messages.push(toAnthropicMessage(msg));
  }
  return { system, messages };
}

function buildRequestBody(model: string, input: string | AiMessage[], tools?: AiTool[]): Record<string, unknown> {
  const { system, messages } = toConversation(input);
  const body: Record<string, unknown> = { model, messages, max_tokens: 8192 };
  if (system) body.system = system;
  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
    body.temperature = 0.2;
  }
  return body;
}

function messagesEndpoint(baseUrl: string): string {
  const base = trimTrailingSlashes(baseUrl);
  return base.endsWith('/messages') ? base : `${base}/messages`;
}

function toAiResponse(data: { content?: AnthropicBlock[]; usage?: { input_tokens?: number; output_tokens?: number } }): AiResponse {
  const blocks = data?.content ?? [];
  const toolUse = blocks.filter((c) => c.type === 'tool_use');
  return {
    text: blocks.find((c) => c.type === 'text')?.text ?? '',
    toolCalls: toolUse.length > 0
      ? toolUse.map((b) => ({
          id: b.id as string,
          type: 'function' as const,
          function: { name: b.name as string, arguments: JSON.stringify(b.input) },
        }))
      : undefined,
    usage: {
      inputTokens: data?.usage?.input_tokens ?? 0,
      outputTokens: data?.usage?.output_tokens ?? 0,
    },
  };
}

export async function sendAnthropicMessage(
  apiKey: string,
  model: string,
  input: string | AiMessage[],
  tools?: AiTool[],
  baseUrl: string = 'https://api.anthropic.com/v1',
  fetchFn: typeof fetch = fetch
): Promise<AiResponse> {
  const response = await fetchFn(messagesEndpoint(baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      [API_VERSIONS.anthropic.headerName]: API_VERSIONS.anthropic.version,
    },
    body: JSON.stringify(buildRequestBody(model, input, tools)),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AiProviderError(response.status, data?.error?.message ?? data?.message ?? 'Unknown error');
  }
  return toAiResponse(data);
}
