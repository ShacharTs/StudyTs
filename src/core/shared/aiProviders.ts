export type DirectProvider =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'deepseek'
  | 'xai'
  | 'mistral'
  | 'groq'
  | 'cohere'
  | 'meta'
  | 'perplexity';

export const PROVIDER_KEYS = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  GEMINI: 'gemini',
  DEEPSEEK: 'deepseek',
  XAI: 'xai',
  MISTRAL: 'mistral',
  GROQ: 'groq',
  COHERE: 'cohere',
  META: 'meta',
  PERPLEXITY: 'perplexity',
} as const satisfies Record<string, DirectProvider>;

export const PROVIDER_ENDPOINTS = {
  [PROVIDER_KEYS.ANTHROPIC]: 'https://api.anthropic.com/v1',
  [PROVIDER_KEYS.OPENAI]: 'https://api.openai.com/v1',
  [PROVIDER_KEYS.GEMINI]: 'https://generativelanguage.googleapis.com/v1beta/models',
  [PROVIDER_KEYS.DEEPSEEK]: 'https://api.deepseek.com/v1',
  [PROVIDER_KEYS.XAI]: 'https://api.x.ai/v1',
  [PROVIDER_KEYS.MISTRAL]: 'https://api.mistral.ai/v1',
  [PROVIDER_KEYS.GROQ]: 'https://api.groq.com/openai/v1',
  [PROVIDER_KEYS.COHERE]: 'https://api.cohere.ai/compatibility/v1',
  [PROVIDER_KEYS.META]: 'https://api.llama.com/compat/v1',
  [PROVIDER_KEYS.PERPLEXITY]: 'https://api.perplexity.ai',
} as const satisfies Record<DirectProvider, string>;

export const ENV_KEY_BY_PROVIDER: Record<DirectProvider, string> = {
  [PROVIDER_KEYS.ANTHROPIC]: 'ANTHROPIC_API_KEY',
  [PROVIDER_KEYS.OPENAI]: 'OPENAI_API_KEY',
  [PROVIDER_KEYS.GEMINI]: 'GEMINI_API_KEY',
  [PROVIDER_KEYS.DEEPSEEK]: 'DEEPSEEK_API_KEY',
  [PROVIDER_KEYS.XAI]: 'XAI_API_KEY',
  [PROVIDER_KEYS.MISTRAL]: 'MISTRAL_API_KEY',
  [PROVIDER_KEYS.GROQ]: 'GROQ_API_KEY',
  [PROVIDER_KEYS.COHERE]: 'COHERE_API_KEY',
  [PROVIDER_KEYS.META]: 'META_API_KEY',
  [PROVIDER_KEYS.PERPLEXITY]: 'PERPLEXITY_API_KEY',
};

export const VAULT_KEY_BY_PROVIDER: Record<DirectProvider, string> = Object.fromEntries(
  Object.values(PROVIDER_KEYS).map((id) => [id, id === 'openai' ? 'openAiApiKey' : `${id}ApiKey`]),
) as Record<DirectProvider, string>;

export const DEFAULT_MODEL_BY_PROVIDER: Record<DirectProvider, string> = {
  gemini: 'gemini-3.8-flash',
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-4o',
  deepseek: 'deepseek-chat',
  xai: 'grok-4',
  mistral: 'mistral-large-latest',
  groq: 'llama-3.3-70b-versatile',
  cohere: 'command-r-plus',
  meta: 'Llama-3.3-70B-Instruct',
  perplexity: 'sonar-pro',
};

/** Key prefixes in match order: the specific sk-ant-/sk-proj- come before the generic sk-. */
const KEY_PREFIXES: [string, DirectProvider][] = [
  ['AIza', 'gemini'],
  ['sk-ant-', 'anthropic'],
  ['sk-proj-', 'openai'],
  ['xai-', 'xai'],
  ['gsk_', 'groq'],
  ['pplx-', 'perplexity'],
  ['sk-', 'openai'],
  ['sess-', 'openai'],
];

/** Sniffs the AI provider from the API key format/prefix. */
export function detectProviderFromKey(apiKey: string): DirectProvider | null {
  if (!apiKey || typeof apiKey !== 'string') return null;
  const key = apiKey.trim();
  return KEY_PREFIXES.find(([prefix]) => key.startsWith(prefix))?.[1] ?? null;

}
