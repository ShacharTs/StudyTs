/**
 * POST/DELETE /api/ai/chat
 * Thin server-side relay for direct-provider AI calls with timeout and cancellation.
 */

import { Router, Request, Response } from 'express';
import { sendDirectMessage } from '../ai/providers/directProvider.js';
import type { AiMessage, AiTool, DirectProvider } from '../ai/aiProviderContracts.js';
import { DEFAULT_MODEL_BY_PROVIDER } from '../../src/core/shared/aiProviders.js';
import { isAppViewContext, type AppViewContext } from '../../src/core/shared/appViewContext.js';
import { filterToolsForView } from '../../src/core/shared/appViewProfiles.js';
import { resolveCredentials } from '../ai/requestCredentials.js';
import { describeAiFailure } from '../ai/describeAiFailure.js';
import { executeWithModelFallback } from '../ai/providers/modelFallback.js';
import { route } from '../utils/routeHandler.js';
import { log } from '../utils/log.js';

export const aiChatProxyRouter = Router();

const inFlight = new Map<string, AbortController>();
const AI_TIMEOUT_MS = 120_000;

export function abortAllInFlight(): void {
  for (const [, controller] of inFlight.entries()) {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  }
  inFlight.clear();
}

interface AiChatProxyBody {
  requestId: string;
  provider?: DirectProvider | 'auto';
  apiKey?: string;
  model?: string;
  messages: AiMessage[];
  tools?: AiTool[];
  customBaseUrl?: string;
  viewContext?: AppViewContext;
}

function validateProxyBody(body: Partial<AiChatProxyBody>): string | null {
  if (typeof body.requestId !== 'string' || !body.requestId || !Array.isArray(body.messages)) {
    return 'requestId and messages array are required';
  }
  if (body.viewContext !== undefined && !isAppViewContext(body.viewContext)) {
    return 'Invalid viewContext format';
  }
  return null;
}

function resolveModel(provider: DirectProvider, requestedModel?: string): string {
  return typeof requestedModel === 'string' && requestedModel.trim()
    ? requestedModel.trim()
    : DEFAULT_MODEL_BY_PROVIDER[provider] || 'gemini-3.8-flash';
}

aiChatProxyRouter.post('/ai/chat', route(async (req: Request, res: Response) => {
  const body = req.body as Partial<AiChatProxyBody>;
  const validationError = validateProxyBody(body);
  if (validationError) return void res.status(400).json({ error: validationError });

  const { requestId, provider, apiKey, model, messages, tools, customBaseUrl, viewContext } = body as AiChatProxyBody;

  const creds = resolveCredentials(provider, apiKey);
  if ('error' in creds) return void res.status(400).json({ error: creds.error });
  const { provider: effectiveProvider, key: effectiveKey } = creds;
  const effectiveModel = resolveModel(effectiveProvider, model);
  const effectiveTools = Array.isArray(tools)
    ? filterToolsForView(tools, viewContext ? viewContext.kind : null)
    : undefined;

  const clientController = new AbortController();
  const timeoutSignal = AbortSignal.timeout(AI_TIMEOUT_MS);
  const combinedSignal = AbortSignal.any([clientController.signal, timeoutSignal]);

  inFlight.set(requestId, clientController);

  try {
    const response = await executeWithModelFallback(sendDirectMessage, {
      provider: effectiveProvider,
      apiKey: effectiveKey,
      model: effectiveModel,
      messages,
      tools: effectiveTools,
      customBaseUrl,
      signal: combinedSignal,
    });
    res.json(response);
  } catch (err: unknown) {
    const failure = describeAiFailure(err, { timedOut: timeoutSignal.aborted, clientAborted: clientController.signal.aborted });
    if (failure.log) log.error(failure.log.message, { requestId, provider: effectiveProvider, model: effectiveModel, ...failure.log.fields });
    res.status(failure.status).json(failure.body);
  } finally {
    inFlight.delete(requestId);
  }
}));

aiChatProxyRouter.delete('/ai/chat/:requestId', (req: Request, res: Response) => {
  const controller = inFlight.get(req.params.requestId);
  controller?.abort();
  res.json({ ok: true });
});
