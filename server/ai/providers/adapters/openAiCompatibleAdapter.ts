import { PROVIDER_ENDPOINTS } from '../../constants.js';
import { API_VERSIONS } from '../../apiVersions.js';
import { sendOpenAICompatibleMessage } from '../openAiProvider.js';
import { listOpenAiStyleModels } from '../modelListing.js';
import type { DirectProvider, AdapterSendRequest, AdapterListRequest, AiProviderAdapter } from '../../aiProviderAdapter.js';

export function createOpenAiCompatibleAdapter(id: DirectProvider, displayName: string): AiProviderAdapter {
  const defaultBaseUrl = PROVIDER_ENDPOINTS[id];
  return {
    id,
    displayName,
    defaultBaseUrl,
    apiVersion: API_VERSIONS.openAiCompatible.version,
    send: (r: AdapterSendRequest) => sendOpenAICompatibleMessage(r.baseUrl || defaultBaseUrl, r.apiKey, r.model, r.input, r.tools, r.fetchFn),
    listModels: (r: AdapterListRequest) => listOpenAiStyleModels(r.baseUrl || defaultBaseUrl, r.apiKey, r.fetchFn, r.signal),
  };
}
