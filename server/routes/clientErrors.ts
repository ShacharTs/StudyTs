import { Request, Response, Router } from 'express';
import { log } from '../utils/log.js';
import { LOG_LIMITS } from '../logging/logConfig.js';

const SOURCES = ['window.onerror', 'unhandledrejection', 'error-boundary'] as const;
type ClientErrorSource = (typeof SOURCES)[number];
const WINDOW_MS = 60_000;

export function createClientErrorLimiter(now: () => number = Date.now): () => boolean {
  let windowStart = now();
  let count = 0;
  return () => {
    if (now() - windowStart > WINDOW_MS) {
      windowStart = now();
      count = 0;
    }
    count += 1;
    return count <= LOG_LIMITS.clientReportsPerMinute;
  };
}

const clip = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.slice(0, LOG_LIMITS.maxFieldChars) : undefined;

function isSource(value: unknown): value is ClientErrorSource {
  return typeof value === 'string' && (SOURCES as readonly string[]).includes(value);
}

function checkReportValidation(req: Request): { status: number; error?: string } | null {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > LOG_LIMITS.maxClientReportBytes) return { status: 413 };

  const body = req.body as Record<string, unknown> | undefined;
  if (!body || typeof body.message !== 'string' || !body.message) {
    return { status: 400, error: 'message is required' };
  }
  if (body.source !== undefined && !isSource(body.source)) {
    return { status: 400, error: 'unknown source' };
  }
  return null;
}

export const clientErrorsRouter = Router();
const allow = createClientErrorLimiter();

clientErrorsRouter.post('/client-errors', (req: Request, res: Response) => {
  const validationProblem = checkReportValidation(req);
  if (validationProblem) {
    if (validationProblem.error) return void res.status(validationProblem.status).json({ error: validationProblem.error });
    return void res.status(validationProblem.status).end();
  }
  if (!allow()) return void res.status(429).end();

  const body = req.body as Record<string, unknown>;
  log.error('Client error', {
    source: body.source ?? 'window.onerror',
    clientMessage: clip(body.message),
    stack: clip(body.stack),
    componentStack: clip(body.componentStack),
    url: clip(body.url),
    userAgent: clip(req.headers['user-agent']),
  });
  return void res.status(204).end();
});
