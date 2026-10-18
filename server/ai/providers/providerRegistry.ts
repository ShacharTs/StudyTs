import { PROVIDER_KEYS } from '../constants.js';
import { AiProviderError, type AiResponse } from '../aiProviderContracts.js';
import type { DirectProvider } from '../aiProviderAdapter.js';
import type { AdapterSendRequest, AdapterListRequest, ModelInfo } from '../aiProviderAdapter.js';
import { createOpenAiCompatibleAdapter } from './adapters/openAiCompatibleAdapter.js';

export interface RegistryProviderAdapter {
  readonly id: DirectProvider;
  readonly displayName: string;
  readonly defaultBaseUrl: string;
  readonly apiVersion?: string;
  send(request: AdapterSendRequest): Promise<AiResponse>;
  listModels(request: AdapterListRequest): Promise<ModelInfo[]>;
}

const ADAPTERS = new Map<DirectProvider, RegistryProviderAdapter>();

const registryIds: DirectProvider[] = [
  PROVIDER_KEYS.ANTHROPIC, PROVIDER_KEYS.GEMINI, PROVIDER_KEYS.OPENAI,
  PROVIDER_KEYS.DEEPSEEK, PROVIDER_KEYS.XAI, PROVIDER_KEYS.MISTRAL,
  PROVIDER_KEYS.GROQ, PROVIDER_KEYS.COHERE, PROVIDER_KEYS.META,
  PROVIDER_KEYS.PERPLEXITY
];

for (const id of registryIds) {
  if (id === PROVIDER_KEYS.ANTHROPIC || id === PROVIDER_KEYS.GEMINI) {
    ADAPTERS.set(id, { id, displayName: id, defaultBaseUrl: '', send: async () => ({ text: '', usage: { inputTokens: 0, outputTokens: 0 } }), listModels: async () => [] });
  } else {
    ADAPTERS.set(id, createOpenAiCompatibleAdapter(id, id.charAt(0).toUpperCase() + id.slice(1)));
  }
}

export function getAdapter(id: DirectProvider): RegistryProviderAdapter {
  const adapter = ADAPTERS.get(id);
  if (!adapter) throw new AiProviderError(400, 'Unsupported direct provider: ' + id);
  return adapter;
}

export function listAdapters(): readonly RegistryProviderAdapter[] {
  return Array.from(ADAPTERS.values());
}
