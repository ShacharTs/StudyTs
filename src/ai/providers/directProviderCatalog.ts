import { PROVIDER_KEYS, PROVIDER_ENDPOINTS, type DirectProvider } from '@core/shared/aiProviders';
export type { DirectProvider } from '@core/shared/aiProviders';

export interface DirectProviderConfig {
  id: DirectProvider;
  name: string;
  baseUrl: string;
  keyPrefix?: string;
  placeholder: string;
  models: Array<{ id: string; label: string }>;
  supportsCustomUrl?: boolean;
}

export const DIRECT_PROVIDERS: DirectProviderConfig[] = [
  {
    id: PROVIDER_KEYS.ANTHROPIC,
    name: 'Anthropic (Claude)',
    baseUrl: PROVIDER_ENDPOINTS[PROVIDER_KEYS.ANTHROPIC],
    keyPrefix: 'sk-ant-',
    placeholder: 'sk-ant-...',
    models: [
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
      { id: 'claude-opus-5', label: 'Claude Opus 5' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
  },
  {
    id: PROVIDER_KEYS.OPENAI,
    name: 'OpenAI',
    baseUrl: PROVIDER_ENDPOINTS[PROVIDER_KEYS.OPENAI],
    keyPrefix: 'sk-',
    placeholder: 'sk-...',
    models: [
      { id: 'gpt-5', label: 'GPT-5' },
      { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { id: 'o3', label: 'o3' },
      { id: 'o4-mini', label: 'o4-mini' },
    ],
  },
  {
    id: PROVIDER_KEYS.DEEPSEEK,
    name: 'DeepSeek',
    baseUrl: PROVIDER_ENDPOINTS[PROVIDER_KEYS.DEEPSEEK],
    keyPrefix: 'sk-',
    placeholder: 'sk-...',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat' },
      { id: 'deepseek-coder', label: 'DeepSeek Coder' },
    ],
  },
  {
    id: PROVIDER_KEYS.GEMINI,
    name: 'Google Gemini',
    baseUrl: PROVIDER_ENDPOINTS[PROVIDER_KEYS.GEMINI],
    placeholder: 'AIzaSy...',
    models: [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-3-pro', label: 'Gemini 3 Pro (paid)' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
  },
  {
    id: PROVIDER_KEYS.XAI,
    name: 'xAI (Grok)',
    baseUrl: PROVIDER_ENDPOINTS[PROVIDER_KEYS.XAI],
    keyPrefix: 'xai-',
    placeholder: 'xai-...',
    models: [
      { id: 'grok-4', label: 'Grok 4' },
      { id: 'grok-4-fast', label: 'Grok 4 Fast' },
      { id: 'grok-3', label: 'Grok 3' },
      { id: 'grok-3-mini', label: 'Grok 3 Mini' },
    ],
  },
  {
    id: PROVIDER_KEYS.MISTRAL,
    name: 'Mistral',
    baseUrl: PROVIDER_ENDPOINTS[PROVIDER_KEYS.MISTRAL],
    placeholder: 'API key...',
    models: [
      { id: 'mistral-large-latest', label: 'Mistral Large' },
      { id: 'mistral-medium-latest', label: 'Mistral Medium' },
      { id: 'mistral-small-latest', label: 'Mistral Small' },
      { id: 'codestral-latest', label: 'Codestral' },
    ],
  },
  {
    id: PROVIDER_KEYS.GROQ,
    name: 'Groq',
    baseUrl: PROVIDER_ENDPOINTS[PROVIDER_KEYS.GROQ],
    keyPrefix: 'gsk_',
    placeholder: 'gsk_...',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)' },
      { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B (Groq)' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (Groq)' },
    ],
  },
  {
    id: PROVIDER_KEYS.COHERE,
    name: 'Cohere',
    baseUrl: PROVIDER_ENDPOINTS[PROVIDER_KEYS.COHERE],
    placeholder: 'API key...',
    models: [
      { id: 'command-a-03-2025', label: 'Command A' },
      { id: 'command-r-plus', label: 'Command R+' },
      { id: 'command-r', label: 'Command R' },
    ],
  },
  {
    id: PROVIDER_KEYS.META,
    name: 'Meta (Llama API)',
    baseUrl: PROVIDER_ENDPOINTS[PROVIDER_KEYS.META],
    placeholder: 'API key...',
    models: [
      { id: 'Llama-4-Maverick-17B-128E-Instruct-FP8', label: 'Llama 4 Maverick' },
      { id: 'Llama-4-Scout-17B-16E-Instruct-FP8', label: 'Llama 4 Scout' },
      { id: 'Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B' },
    ],
  },
  {
    id: PROVIDER_KEYS.PERPLEXITY,
    name: 'Perplexity',
    baseUrl: PROVIDER_ENDPOINTS[PROVIDER_KEYS.PERPLEXITY],
    keyPrefix: 'pplx-',
    placeholder: 'pplx-...',
    models: [
      { id: 'sonar-pro', label: 'Sonar Pro' },
      { id: 'sonar', label: 'Sonar' },
      { id: 'sonar-reasoning-pro', label: 'Sonar Reasoning Pro' },
    ],
  },
];
