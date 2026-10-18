import { AiProviderError } from './aiProviderContracts.js';

export interface AiFailure {
  status: number;
  body: { error: string; category?: string };
  /** Present when the failure should be logged, with the extra fields to log. */
  log?: { message: string; fields?: Record<string, unknown> };
}

/** Maps whatever the provider call threw to the HTTP response (and log entry) the proxy should produce. */
export function describeAiFailure(err: unknown, state: { timedOut: boolean; clientAborted: boolean }): AiFailure {
  if (state.timedOut) {
    return {
      status: 504,
      body: { error: 'AI provider request timed out after 120s', category: 'timeout' },
      log: { message: 'AI provider request timed out' },
    };
  }
  if (state.clientAborted || (err instanceof DOMException && err.name === 'AbortError')) {
    return { status: 499, body: { error: 'Request aborted' } };
  }
  if (err instanceof AiProviderError) {
    // Preserve the real vendor status/category here: this is the only place it still
    // exists; once collapsed to a generic 502 it can't be recovered client-side.
    return {
      status: 502,
      body: { error: err.providerMessage, category: err.category },
      log: { message: 'AI provider call failed', fields: { vendorStatus: err.status, category: err.category, error: err.providerMessage } },
    };
  }
  const error = err instanceof Error ? err.message : 'AI provider request failed';
  return { status: 502, body: { error, category: 'network' }, log: { message: 'AI provider call failed', fields: { error } } };
}
