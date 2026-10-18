import { Router, type Request, type Response } from 'express';
import { route } from '../utils/routeHandler.js';
import { vaultService } from '../secrets/vaultService.js';
import { PROVIDER_KEYS, ENV_KEY_BY_PROVIDER, type DirectProvider } from '../../src/core/shared/aiProviders.js';

export const aiKeysRouter = Router();

const VALID_PROVIDERS = new Set<string>(Object.values(PROVIDER_KEYS));

aiKeysRouter.get('/ai/keys', route(async (_req: Request, res: Response) => {
  const maskedKeys = vaultService.listMaskedKeys();
  const configured: DirectProvider[] = [];

  for (const provider of Object.values(PROVIDER_KEYS)) {
    const envVar = ENV_KEY_BY_PROVIDER[provider];
    const hasKey = Boolean(vaultService.getKey(provider) || (envVar && process.env[envVar]));
    if (hasKey) {
      configured.push(provider);
    }
  }

  res.status(200).json({
    keys: maskedKeys,
    configured,
  });
}));

aiKeysRouter.put('/ai/keys/:provider', route(async (req: Request, res: Response) => {
  const { provider } = req.params;
  const { apiKey } = req.body as { apiKey?: unknown };

  if (!provider || !VALID_PROVIDERS.has(provider)) {
    return void res.status(400).json({ error: `Unsupported provider: ${String(provider)}` });
  }

  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    return void res.status(400).json({ error: 'apiKey must be a non-empty string' });
  }

  const trimmed = apiKey.trim();
  if (trimmed.length > 512) {
    return void res.status(400).json({ error: 'apiKey exceeds maximum length of 512 characters' });
  }

  vaultService.setKey(provider, trimmed);
  res.status(200).json({ ok: true });
}));

aiKeysRouter.delete('/ai/keys/:provider', route(async (req: Request, res: Response) => {
  const { provider } = req.params;

  if (!provider || !VALID_PROVIDERS.has(provider)) {
    return void res.status(400).json({ error: `Unsupported provider: ${String(provider)}` });
  }

  vaultService.removeKey(provider);
  res.status(200).json({ ok: true });
}));
