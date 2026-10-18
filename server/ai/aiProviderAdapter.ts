import type { DirectProvider } from '../../src/core/shared/aiProviders.js';
import type { AiMessage, AiTool, AiResponse } from './aiProviderContracts.js';

export type { DirectProvider };

export interface AdapterSendRequest {
  apiKey: string;
  model: string;
  input: string | AiMessage[];
  tools?: AiTool[];
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export interface AdapterListRequest {
  apiKey: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}

export interface ModelInfo {
  id: string;
  label: string;
}

export interface AiProviderAdapter {
  readonly id: DirectProvider;
  readonly displayName: string;
  readonly defaultBaseUrl: string;
  readonly apiVersion?: string;
  send(request: AdapterSendRequest): Promise<AiResponse>;
  listModels(request: AdapterListRequest): Promise<ModelInfo[]>;
}
