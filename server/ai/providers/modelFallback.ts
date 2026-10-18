import { AiProviderError, type DirectProvider, type AiResponse, type AiMessage, type AiTool } from '../aiProviderContracts.js';
import { log } from '../../utils/log.js';

const MODEL_FALLBACK_CHAINS: Record<string, Record<string, string[]>> = {
  gemini: {
    'gemini-3-pro': ['gemini-3.8-flash', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
    'gemini-2.5-pro': ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
    'gemini-2.5-flash': ['gemini-3.8-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
    'gemini-2.0-flash': ['gemini-3.8-flash', 'gemini-1.5-flash'],
    'gemini-1.5-pro': ['gemini-3.8-flash', 'gemini-1.5-flash'],
    default: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
  },
  anthropic: {
    'claude-sonnet-5': ['claude-opus-5', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5-20251001'],
    'claude-opus-5': ['claude-sonnet-5', 'claude-sonnet-4-6', 'claude-sonnet-4-5'],
    'claude-sonnet-4-6': ['claude-sonnet-4-5', 'claude-haiku-4-5-20251001'],
    'claude-sonnet-4-5': ['claude-haiku-4-5-20251001'],
    default: ['claude-sonnet-5', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5-20251001'],
  },
  openai: {
    'gpt-5': ['gpt-5-mini', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'],
    'gpt-5-mini': ['gpt-4o-mini'],
    'gpt-4.1': ['gpt-4o', 'gpt-4o-mini'],
    'gpt-4o': ['gpt-4o-mini', 'gpt-4-turbo'],
    default: ['gpt-4o', 'gpt-4o-mini'],
  },
  deepseek: {
    'deepseek-chat': ['deepseek-coder'],
    default: ['deepseek-chat'],
  },
};

const MODEL_FAILURE_TERMS = ['not found', 'deprecated', 'does not exist', 'unsupported', 'free tier', 'free plan', 'limit: 0', 'not available'];

/** True when the message names a model and says it is missing/retired (plus any `extra` phrases). */
function mentionsModelFailure(message: string, extra: string[] = []): boolean {
  return message.includes('model') && [...MODEL_FAILURE_TERMS, ...extra].some((term) => message.includes(term));
}

/**
 * Checks if an error is a model-specific failure (not found, deprecated, unsupported)
 * that warrants attempting a fallback model.
 */
export function isModelError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof AiProviderError) {
    return err.status === 404 || mentionsModelFailure((err.providerMessage || '').toLowerCase());
  }
  if (err instanceof Error) return mentionsModelFailure(err.message.toLowerCase(), ['404']);
  return false;
}

interface ExecuteWithFallbackResult extends AiResponse {
  appliedFallbackModel?: string;
  originalModel: string;
}

type SendDirectFn = (
  provider: DirectProvider,
  apiKey: string,
  model: string,
  messages: AiMessage[],
  tools?: AiTool[],
  customBaseUrl?: string,
  fetchFn?: typeof fetch,
  signal?: AbortSignal
) => Promise<AiResponse>;

interface FallbackParams {
  provider: DirectProvider;
  apiKey: string;
  model: string;
  messages: AiMessage[];
  tools?: AiTool[];
  customBaseUrl?: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}

/** Candidate models to retry with, in order, after `params.model` failed with a model error. */
function listFallbackModels(provider: DirectProvider, initialModel: string): string[] {
  const providerChains = MODEL_FALLBACK_CHAINS[provider];
  const candidateList = providerChains
    ? (providerChains[initialModel] || providerChains['default'] || [])
    : [];
  return candidateList.filter((m) => m !== initialModel);
}

/** One fallback attempt: the result on success, null on another model error, a throw on any other error. */
async function tryFallbackModel(
  sendFn: SendDirectFn,
  params: FallbackParams,
  fallbackModel: string,
): Promise<ExecuteWithFallbackResult | null> {
  const { provider, apiKey, model: initialModel, messages, tools, customBaseUrl, fetchFn, signal } = params;
  log.warn(`AI model ${initialModel} failed with model error, falling back to ${fallbackModel}`, {
    provider,
    originalModel: initialModel,
    fallbackModel,
  });
  try {
    const res = await sendFn(provider, apiKey, fallbackModel, messages, tools, customBaseUrl, fetchFn, signal);
    return { ...res, appliedFallbackModel: fallbackModel, originalModel: initialModel };
  } catch (fallbackErr) {
    if (!isModelError(fallbackErr)) throw fallbackErr;
    return null;
  }
}

/**
 * Executes a direct AI call with automatic fallback retry if the primary model fails
 * with a model-specific error (not found, deprecated).
 */
export async function executeWithModelFallback(
  sendFn: SendDirectFn,
  params: FallbackParams
): Promise<ExecuteWithFallbackResult> {
  const { provider, apiKey, model: initialModel, messages, tools, customBaseUrl, fetchFn, signal } = params;

  try {
    const res = await sendFn(provider, apiKey, initialModel, messages, tools, customBaseUrl, fetchFn, signal);
    return { ...res, originalModel: initialModel };
  } catch (err) {
    if (!isModelError(err)) throw err;
    for (const fallbackModel of listFallbackModels(provider, initialModel)) {
      const result = await tryFallbackModel(sendFn, params, fallbackModel);
      if (result) return result;
    }
    throw err;
  }
}
