import { AiProviderError, type DirectProvider, type AiResponse, type AiMessage, type AiTool } from '../aiProviderContracts.js';
import { PROVIDER_KEYS, PROVIDER_ENDPOINTS } from '../constants.js';
import { log } from '../../utils/log.js';
import { sendOpenAICompatibleMessage } from './openAiProvider.js';
import { sendAnthropicMessage } from './anthropicProvider.js';
import { sendGeminiDirectMessage } from './geminiDirectProvider.js';

type ProviderSender = (
  apiKey: string,
  model: string,
  input: string | AiMessage[],
  tools?: AiTool[],
  customBaseUrl?: string,
  fetchFn?: typeof fetch
) => Promise<AiResponse>;

const PROVIDER_DISPATCH: Record<DirectProvider, ProviderSender> = {
  [PROVIDER_KEYS.ANTHROPIC]: (apiKey, model, input, tools, customBaseUrl, fetchFn) =>
    sendAnthropicMessage(apiKey, model, input, tools, customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.ANTHROPIC], fetchFn),

  [PROVIDER_KEYS.OPENAI]: (apiKey, model, input, tools, customBaseUrl, fetchFn) =>
    sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.OPENAI], apiKey, model, input, tools, fetchFn),

  [PROVIDER_KEYS.GEMINI]: (apiKey, model, input, tools, customBaseUrl, fetchFn) =>
    sendGeminiDirectMessage(apiKey, model, input, tools, customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.GEMINI], fetchFn),

  [PROVIDER_KEYS.DEEPSEEK]: (apiKey, model, input, tools, customBaseUrl, fetchFn) =>
    sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.DEEPSEEK], apiKey, model, input, tools, fetchFn),

  [PROVIDER_KEYS.XAI]: (apiKey, model, input, tools, customBaseUrl, fetchFn) =>
    sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.XAI], apiKey, model, input, tools, fetchFn),

  [PROVIDER_KEYS.MISTRAL]: (apiKey, model, input, tools, customBaseUrl, fetchFn) =>
    sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.MISTRAL], apiKey, model, input, tools, fetchFn),

  [PROVIDER_KEYS.GROQ]: (apiKey, model, input, tools, customBaseUrl, fetchFn) =>
    sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.GROQ], apiKey, model, input, tools, fetchFn),

  [PROVIDER_KEYS.COHERE]: (apiKey, model, input, tools, customBaseUrl, fetchFn) =>
    sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.COHERE], apiKey, model, input, tools, fetchFn),

  [PROVIDER_KEYS.META]: (apiKey, model, input, tools, customBaseUrl, fetchFn) =>
    sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.META], apiKey, model, input, tools, fetchFn),

  [PROVIDER_KEYS.PERPLEXITY]: (apiKey, model, input, tools, customBaseUrl, fetchFn) =>
    sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.PERPLEXITY], apiKey, model, input, tools, fetchFn),
};

export async function sendDirectMessage(
  provider: DirectProvider,
  apiKey: string,
  model: string,
  input: string | AiMessage[],
  tools?: AiTool[],
  customBaseUrlOrFetch?: string | typeof fetch,
  fetchFn?: typeof fetch,
  signal?: AbortSignal
): Promise<AiResponse> {
  const startedAt = Date.now();
  log.info(`Direct AI call: provider=${provider}, model=${model}`, { provider, model, hasTools: !!(tools && tools.length > 0) });

  let customBaseUrl: string | undefined;
  let effectiveFetch: typeof fetch = fetch;

  if (typeof customBaseUrlOrFetch === 'function') {
    effectiveFetch = customBaseUrlOrFetch;
  } else if (typeof customBaseUrlOrFetch === 'string') {
    customBaseUrl = customBaseUrlOrFetch;
    if (fetchFn) {
      effectiveFetch = fetchFn;
    }
  }

  if (signal) {
    const baseFetch = effectiveFetch;
    effectiveFetch = ((url: Parameters<typeof fetch>[0], opts?: Parameters<typeof fetch>[1]) =>
      baseFetch(url, { ...opts, signal })) as typeof fetch;
  }

  const sender = PROVIDER_DISPATCH[provider];
  if (!sender) {
    throw new AiProviderError(400, `Unsupported direct provider: ${provider}`);
  }

  try {
    const result = await sender(apiKey, model, input, tools, customBaseUrl, effectiveFetch);
    const durationMs = Date.now() - startedAt;

    log.info(`Direct AI call complete (${durationMs}ms)`, {
      provider,
      model,
      durationMs,
      tokensIn: result.usage?.inputTokens,
      tokensOut: result.usage?.outputTokens,
      toolCallsCount: result.toolCalls?.length || 0,
    });

    return result;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    log.error(`Direct AI call failed (${durationMs}ms)`, {
      provider,
      model,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
