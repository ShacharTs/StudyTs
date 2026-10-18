import type { DirectProvider } from './aiProviderContracts.js';
import { detectProviderFromKey, ENV_KEY_BY_PROVIDER } from '../../src/core/shared/aiProviders.js';
import { vaultService } from '../secrets/vaultService.js';

export type { DirectProvider };
export { ENV_KEY_BY_PROVIDER };

export type Credentials = { provider: DirectProvider; key: string } | { error: string };

/** Encrypted vault first, then the server environment. */
function serverKeyFor(provider: DirectProvider): string {
  const envVar = ENV_KEY_BY_PROVIDER[provider];
  return vaultService.getKey(provider) || (envVar && process.env[envVar]) || '';
}

/** First provider that has a server-side key (vault, then env), for requests that name neither provider nor key. */
function firstProviderWithServerKey(): { provider: DirectProvider; key: string } | null {
  for (const p of Object.keys(ENV_KEY_BY_PROVIDER) as DirectProvider[]) {
    const key = serverKeyFor(p);
    if (key) return { provider: p, key };
  }
  return null;
}

function missingKeyError(provider: DirectProvider): string {
  const envVar = ENV_KEY_BY_PROVIDER[provider];
  const detail = envVar
    ? `${envVar} is not set on the server or in encrypted vault`
    : `no server-side default exists for provider "${provider}"`;
  return `No API key provided and ${detail}`;
}

/** Provider from the request, else sniffed from the key, else the first provider with a server-side key. */
function resolveProvider(provider: unknown, key: string): { provider: DirectProvider | null; key: string } {
  if (provider && provider !== 'auto') return { provider: provider as DirectProvider, key };
  const detected = key ? detectProviderFromKey(key) : null;
  if (detected) return { provider: detected, key };
  const fallback = firstProviderWithServerKey();
  return { provider: fallback?.provider ?? null, key: key || fallback?.key || '' };
}

/** Works out which provider and key a chat request will use. */
export function resolveCredentials(provider: unknown, apiKey: unknown): Credentials {
  const supplied = typeof apiKey === 'string' ? apiKey.trim() : '';
  const { provider: resolved, key } = resolveProvider(provider, supplied);
  if (!resolved) return { error: 'Unable to determine AI provider from key or request' };

  const finalKey = key || serverKeyFor(resolved);
  return finalKey ? { provider: resolved, key: finalKey } : { error: missingKeyError(resolved) };
}
