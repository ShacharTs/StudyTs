import { Router, type Request, type Response } from 'express';
import { route } from '../utils/routeHandler.js';
import { getAdapter } from '../ai/providers/providerRegistry.js';
import { resolveCredentials } from '../ai/requestCredentials.js';
import { AiProviderError } from '../ai/aiProviderContracts.js';
import { PROVIDER_KEYS, DEFAULT_MODEL_BY_PROVIDER, type DirectProvider } from '../../src/core/shared/aiProviders.js';
import { FALLBACK_MODELS, pickDefaultModel, type FallbackModelInfo } from '../../src/core/shared/aiModelFallbacks.js';
import { buildCacheKey, getCached, setCached, setNegativeCached, type CachedModelCatalog } from '../ai/providers/modelCatalogCache.js';

export const aiModelsRouter = Router();

const VALID_PROVIDERS = new Set<string>(Object.values(PROVIDER_KEYS));

interface AiModelsBody {
  provider: DirectProvider;
  apiKey?: string;
  customBaseUrl?: string;
  refresh?: boolean;
}

interface ProviderContext {
  provider: DirectProvider;
  fallbackList: FallbackModelInfo[];
  preferredDefault: string;
}

function respondCached(res: Response, ctx: ProviderContext, cached: CachedModelCatalog): void {
  if (cached.isNegative) {
    res.status(200).json({
      provider: ctx.provider,
      source: 'fallback',
      models: ctx.fallbackList,
      defaultModel: ctx.preferredDefault,
      warning: cached.warning,
    });
    return;
  }
  res.status(200).json({
    provider: ctx.provider,
    source: 'cache',
    models: cached.models,
    defaultModel: pickDefaultModel(cached.models, ctx.preferredDefault),
  });
}

function handleFetchError(res: Response, ctx: ProviderContext, cacheKey: string, err: unknown): void {
  const status = err instanceof AiProviderError ? err.status : 500;
  const providerMsg = err instanceof AiProviderError ? err.providerMessage : (err instanceof Error ? err.message : String(err));
  const warning = status === 429 ? 'Rate limited — using offline model list' : `${status}: ${providerMsg}`;

  if (status === 429) {
    setNegativeCached(cacheKey, warning);
  }

  res.status(200).json({
    provider: ctx.provider,
    source: 'fallback',
    models: ctx.fallbackList,
    defaultModel: ctx.preferredDefault,
    warning,
  });
}

async function fetchAndRespondLive(
  res: Response,
  ctx: ProviderContext,
  effectiveKey: string,
  customBaseUrl: string | undefined,
  cacheKey: string,
): Promise<void> {
  try {
    const adapter = getAdapter(ctx.provider);
    const liveModels = await adapter.listModels({ apiKey: effectiveKey, baseUrl: customBaseUrl });

    if (!Array.isArray(liveModels) || liveModels.length === 0) {
      res.status(200).json({
        provider: ctx.provider,
        source: 'fallback',
        models: ctx.fallbackList,
        defaultModel: ctx.preferredDefault,
        warning: 'Provider returned no models — using offline list',
      });
      return;
    }

    setCached(cacheKey, liveModels);
    res.status(200).json({
      provider: ctx.provider,
      source: 'live',
      models: liveModels,
      defaultModel: pickDefaultModel(liveModels, ctx.preferredDefault),
    });
  } catch (err) {
    handleFetchError(res, ctx, cacheKey, err);
  }
}

aiModelsRouter.post('/ai/models', route(async (req: Request, res: Response) => {
  const { provider, apiKey, customBaseUrl, refresh } = req.body as Partial<AiModelsBody>;

  if (!provider || typeof provider !== 'string' || !VALID_PROVIDERS.has(provider)) {
    return void res.status(400).json({ error: `Unsupported direct provider: ${String(provider)}` });
  }

  const ctx: ProviderContext = {
    provider,
    fallbackList: FALLBACK_MODELS[provider] || [],
    preferredDefault: DEFAULT_MODEL_BY_PROVIDER[provider] || '',
  };

  const creds = resolveCredentials(provider, apiKey);
  if ('error' in creds) {
    return void res.status(200).json({
      provider,
      source: 'fallback',
      models: ctx.fallbackList,
      defaultModel: ctx.preferredDefault,
      warning: creds.error,
    });
  }

  const cacheKey = buildCacheKey(provider, customBaseUrl || '', creds.key);
  if (!refresh) {
    const cached = getCached(cacheKey);
    if (cached) {
      return void respondCached(res, ctx, cached);
    }
  }

  await fetchAndRespondLive(res, ctx, creds.key, customBaseUrl, cacheKey);
}));
