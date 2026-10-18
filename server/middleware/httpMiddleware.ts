import type { NextFunction, Request, Response } from 'express';
import { log } from '../utils/log.js';
import { mapPrismaError } from '../utils/mapPrismaError.js';
import { getDefaultOrigins, isSameOrigin, LOOPBACK_HOST } from './serverOrigins.js';

// The API can spawn processes (POST /api/mcp/servers) and write course files, so a browser
// tab on any other site must not be able to call it. Requests with no Origin header
// (curl, server-side code, tests) or same-origin on a loopback host are allowed;
// other Origins must be in allowedOrigins.
// Override with ALLOWED_ORIGINS="https://a.test,https://b.test" (comma-separated).

export function allowedOrigins(env: string | undefined = process.env.ALLOWED_ORIGINS): string[] {
  return (env ?? getDefaultOrigins()).split(',').map((s) => s.trim()).filter(Boolean);
}

export function localOnly(req: Request, res: Response, next: NextFunction): void {
  const host = req.headers.host;
  const origin = req.headers.origin;
  const hostOk = LOOPBACK_HOST.test(host ?? '');
  const originOk = origin === undefined || isSameOrigin(origin, host) || allowedOrigins().includes(origin);
  if (!hostOk || !originOk) {
    log.warn('Forbidden origin rejected', { id: (req as { id?: string } | undefined)?.id, host, origin });
    res.status(403).json({ error: 'Forbidden origin' });
    return;
  }
  next();
}

// Carried HTTP status (status / statusCode), else 500.
function statusOf(err: unknown): number {
  if (typeof err !== 'object' || err === null) return 500;
  const carried = err as { status?: unknown; statusCode?: unknown };
  return Number(carried.status || carried.statusCode) || 500;
}

function problemsOf(err: unknown): { problems: unknown } | Record<string, never> {
  return err && typeof err === 'object' && 'problems' in err ? { problems: (err as { problems: unknown }).problems } : {};
}

// Global Express error handler.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const reqId = (req as { id?: string } | undefined)?.id;
  const prismaMapped = mapPrismaError(err);

  if (prismaMapped) {
    log.warn('Prisma error handled', { id: reqId, status: prismaMapped.status, msg: prismaMapped.message });
    res.status(prismaMapped.status).json({ error: prismaMapped.message });
    return;
  }

  const status = statusOf(err);
  const errorMessage = err instanceof Error ? err.message : 'Internal server error';
  log.error('Unhandled route error', { id: reqId, status, error: errorMessage });

  if (!res.headersSent) {
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : errorMessage, ...problemsOf(err) });
  }
}
