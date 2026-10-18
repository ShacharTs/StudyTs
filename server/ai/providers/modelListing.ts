import { AiProviderError } from '../aiProviderContracts.js';
import { API_VERSIONS } from '../apiVersions.js';
import { trimTrailingSlashes } from './providerCommon.js';

export interface ListedModelInfo { id: string; label: string }

export const MODELS_TIMEOUT_MS = 8000;
export const NON_CHAT_MODEL_PATTERN = /embed|whisper|tts|dall-e|moderation|rerank|transcribe|image|audio/i;

async function getJson(url: string, headers: Record<string, string>, fetchFn: typeof fetch, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(MODELS_TIMEOUT_MS);
  const response = await fetchFn(url, { method: 'GET', headers, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  const data = await response.json().catch(() => ({})) as { error?: { message?: string }; message?: string };
  if (!response.ok) throw new AiProviderError(response.status, data?.error?.message ?? data?.message ?? 'Model list request failed');
  return data;
}

const byId = (a: ListedModelInfo, b: ListedModelInfo) => a.id.localeCompare(b.id);

function readArray(data: unknown, field: string): Record<string, unknown>[] {
  const value = (data as Record<string, unknown>)?.[field];
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

export async function listOpenAiStyleModels(baseUrl: string, apiKey: string, fetchFn: typeof fetch = fetch, signal?: AbortSignal): Promise<ListedModelInfo[]> {
  const data = await getJson(`${trimTrailingSlashes(baseUrl)}/models`, { Authorization: `Bearer ${apiKey}` }, fetchFn, signal);
  return readArray(data, 'data')
    .map((m) => String(m.id ?? ''))
    .filter((id) => id && !NON_CHAT_MODEL_PATTERN.test(id))
    .map((id) => ({ id, label: id }))
    .sort(byId);
}

export async function listAnthropicModels(baseUrl: string, apiKey: string, fetchFn: typeof fetch = fetch, signal?: AbortSignal): Promise<ListedModelInfo[]> {
  const { headerName, version } = API_VERSIONS.anthropic;
  const data = await getJson(`${trimTrailingSlashes(baseUrl)}/models`, { 'x-api-key': apiKey, [headerName]: version }, fetchFn, signal);
  return readArray(data, 'data').map((m) => ({ id: String(m.id), label: String(m.display_name ?? m.id) }));
}

export async function listGeminiModels(baseUrl: string, apiKey: string, fetchFn: typeof fetch = fetch, signal?: AbortSignal): Promise<ListedModelInfo[]> {
  const data = await getJson(trimTrailingSlashes(baseUrl), { 'x-goog-api-key': apiKey }, fetchFn, signal);
  return readArray(data, 'models')
    .filter((m) => Array.isArray(m.supportedGenerationMethods) && (m.supportedGenerationMethods as string[]).includes('generateContent'))
    .map((m) => { const id = String(m.name).replace(/^models\//, ''); return { id, label: String(m.displayName ?? id) }; });
}
