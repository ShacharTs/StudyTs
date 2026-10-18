import { AiProviderError, type AiResponse, type AiMessage, type AiTool, type AiToolCall } from '../aiProviderContracts.js';
import { trimTrailingSlashes } from './providerCommon.js';

function chatEndpoint(baseUrl: string): string {
  const base = trimTrailingSlashes(baseUrl);
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
}

interface OpenAiCompletion {
  choices?: { message?: AiMessage & { tool_calls?: AiToolCall[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function toAiResponse(data: OpenAiCompletion): AiResponse {
  const choiceMessage = data?.choices?.[0]?.message;
  const toolCalls = choiceMessage?.tool_calls;
  return {
    text: (choiceMessage?.content ?? '') as string,
    toolCalls: Array.isArray(toolCalls) && toolCalls.length > 0 ? toolCalls : undefined,
    rawMessage: choiceMessage,
    usage: {
      inputTokens: data?.usage?.prompt_tokens ?? 0,
      outputTokens: data?.usage?.completion_tokens ?? 0,
    },
  };
}

export async function sendOpenAICompatibleMessage(
  baseUrl: string,
  apiKey: string,
  model: string,
  input: string | AiMessage[],
  tools?: AiTool[],
  fetchFn: typeof fetch = fetch
): Promise<AiResponse> {
  const messages: AiMessage[] = typeof input === 'string' ? [{ role: 'user', content: input }] : input;
  const requestBody: Record<string, unknown> = { model, messages };
  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.temperature = 0.2;
  }

  const response = await fetchFn(chatEndpoint(baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AiProviderError(response.status, data?.error?.message ?? data?.message ?? 'Unknown error');
  }
  return toAiResponse(data);
}
