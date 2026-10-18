export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
  /** Gemini 3 hands one out with each function call and rejects the next request unless it is echoed back. */
  thoughtSignature?: string;
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: AiToolCall[];
}

export interface AiToolFunction {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface AiTool {
  type: 'function';
  function: AiToolFunction;
}

export interface AiResponse {
  text: string;
  toolCalls?: AiToolCall[];
  thought?: string;
  usage: AiUsage;
  rawMessage?: AiMessage;
}

export type AiErrorCategory = 'timeout' | 'rate-limit' | 'auth' | 'bad-request' | 'provider' | 'network';

export function classifyAiErrorStatus(status: number): AiErrorCategory {
  if (status === 408 || status === 504) return 'timeout';
  if (status === 429) return 'rate-limit';
  if (status === 401 || status === 403) return 'auth';
  if (status === 400 || status === 422) return 'bad-request';
  if (status >= 500) return 'provider';
  return 'network';
}

export class AiProviderError extends Error {
  public category: AiErrorCategory;
  constructor(public status: number, public providerMessage: string, category?: AiErrorCategory) {
    super(`AI provider error (${status}): ${providerMessage}`);
    this.name = 'AiProviderError';
    this.category = category ?? classifyAiErrorStatus(status);
  }
}
