/**
 * StudyTS Backend API — Express + Prisma
 * Serves course catalog and topic content from Postgres.
 */

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import type { Server } from 'http';
import { PrismaClient } from '@prisma/client';
import { apiRouter } from './routes/index.js';
import { log } from './utils/log.js';
import { gracefulShutdown } from './utils/shutdown.js';
import { mcpLinker } from './mcp/linker.js';
import { vaultService } from './secrets/vaultService.js';
import { invalidateRegistryCache } from './utils/registryCache.js';
import { announceContentChange } from './utils/contentChangeStream.js';
import { isOwnWrite } from './utils/fileSync.js';
import { allowedOrigins, localOnly } from './middleware/httpMiddleware.js';
import { errorHandler } from './middleware/httpMiddleware.js';
import { seedAtomically } from '../prisma/seed.js';

log.initCrashHandlers();
vaultService.initialize();

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

type PrismaEventEmitter = {
  $on(event: 'query', cb: (e: { duration: number; query: string }) => void): void;
  $on(event: 'error', cb: (e: { message: string; target?: string }) => void): void;
  $on(event: 'warn', cb: (e: { message: string; target?: string }) => void): void;
};

(prisma as unknown as PrismaEventEmitter).$on('query', (e) => {
  if (e.duration > 50) {
    log.warn(`[Slow Query] ${e.query} (${e.duration}ms)`, {
      durationMs: e.duration,
      query: e.query,
    });
  }
});

(prisma as unknown as PrismaEventEmitter).$on('error', (e) => {
  log.error('[Prisma]', { message: e.message, target: e.target });
});

(prisma as unknown as PrismaEventEmitter).$on('warn', (e) => {
  log.warn('[Prisma]', { message: e.message, target: e.target });
});

// Live data directory watcher for automatic cache invalidation
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (fs.existsSync(DATA_DIR)) {
  let debounceTimer: NodeJS.Timeout | null = null;
  try {
    fs.watch(DATA_DIR, { recursive: true }, (_event, filename) => {
      if (!filename || filename.endsWith('.tmp') || filename.includes('node_modules')) return;
      // Our own syncTopicToFiles write already matches the DB; reseeding it would only risk racing a newer UI save.
      if (isOwnWrite(path.join(DATA_DIR, filename))) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        log.info(`[HotSync] Data change detected in ${filename}, reseeding database`);
        seedAtomically(prisma)
          .then(() => invalidateRegistryCache())
          .then(() => announceContentChange())
          .catch((err) => log.error('[HotSync] Reseed failed, database left unchanged', { error: err instanceof Error ? err.message : String(err) }));
      }, 300);
    });
  } catch (watchErr) {
    log.warn('Could not attach recursive watcher to data directory', { error: String(watchErr) });
  }
}

// SQLite resource & concurrency optimization:
// 1. WAL mode for concurrent readers & writer
// 2. 64MB cache limit to prevent unbounded RAM growth
// 3. 5000ms busy timeout to prevent write locks
// 4. Auto-checkpoint at 1000 pages to prevent ballooning WAL files
prisma.$queryRawUnsafe(`
  PRAGMA journal_mode=WAL;
  PRAGMA busy_timeout=5000;
  PRAGMA cache_size=-64000;
  PRAGMA wal_autocheckpoint=1000;
`).catch((err) => {
  log.warn('Could not set SQLite performance PRAGMAs', { error: err instanceof Error ? err.message : String(err) });
});
const app = express();
const PORT = process.env.BACKEND_PORT || 7301;

app.use(cors({ origin: allowedOrigins() }));
app.use('/api', localOnly);
app.use(express.json({ limit: '10mb' }));

// Request correlation & logging middleware
app.use((req, res, next) => {
  const reqId = crypto.randomUUID();
  req.id = reqId;
  req.prisma = prisma;
  res.setHeader('X-Request-Id', reqId);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    log.info('HTTP request', {
      id: reqId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
    }, { fileOnly: true });
  });
  next();
});

// Serves canvas-editor-uploaded media (images/video/pdf) written by
// scenes.ts's POST /api/canvas-editor/upload, matching the /assets/<courseId>/<topicId>/<name>
// URL convention already stored in existing scene JSON (e.g. video `src` fields).
app.use('/assets', express.static(path.resolve(process.cwd(), 'data', 'assets')));

// API responses must never be cached — Express sets a weak ETag on every response by
// default (not just express.static's), and without an explicit no-store the browser can
// serve a stale scene/topic from its HTTP cache on a plain reload instead of refetching,
// which looks exactly like "my save didn't stick" even though the write landed fine.
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Routes
app.use('/api', apiRouter);

// Legacy editor URL aliases (/__canvas-editor/* -> /api/canvas-editor/*, /__content-editor/* -> /api/content-editor/*)
app.use('/__canvas-editor', (req, res, next) => {
  req.url = `/canvas-editor${req.url}`;
  apiRouter(req, res, next);
});
app.use('/__content-editor', (req, res, next) => {
  req.url = `/content-editor${req.url}`;
  apiRouter(req, res, next);
});

// Health check with active database ping & memory diagnostics
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const mcpServers = mcpLinker.getServers();
    res.json({
      status: 'ok',
      db: 'connected',
      uptimeSeconds: Math.round(process.uptime()),
      cpu: {
        userMicroseconds: cpu.user,
        systemMicroseconds: cpu.system,
      },
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
      },
      mcp: {
        activeProcesses: mcpServers.filter((s: { status: string }) => s.status === 'connected').length,
        totalConfigured: mcpServers.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    log.error('Health check failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// Production frontend build (npm run build's output) — served from the same process/port
// so `studyts start` needs no separate frontend server. Mounted after /api, legacy aliases, and /assets
// so those routes are never shadowed by the SPA catch-all below.
const DIST_DIR = path.resolve(process.cwd(), 'dist');
// Under npm run dev (--dev) vite on 7300 is the app; serving a stale dist here made 7301 look like a second site.
const serveBuild = !process.argv.includes('--dev');
if (serveBuild) app.use(express.static(DIST_DIR));
app.get('*', (req, res, next) => {
  if (!serveBuild || req.path.startsWith('/api') || req.path.startsWith('/assets') || req.path.startsWith('/__')) return next();
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) next(err);
  });
});

// JSON 404 fallback for API and legacy editor routes so fetch callers never receive HTML
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/__')) {
    return void res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  }
  next();
});

// Global error handler
app.use(errorHandler);

// Fail loudly on port conflict to prevent orphan parallel backend instances.
function listenWithRetry(startPort: number): Promise<Server> {
  return new Promise((resolve) => {
    const port = Number(startPort);
    const srv = app.listen(port, '127.0.0.1', () => {
      log.info(`StudyTS backend running on http://localhost:${port}`, { port });
      resolve(srv);
    });
    srv.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        log.error(`Port ${port} already in use — another StudyTS backend is likely already running. Run "npm stop" (or "npm run stop:dev") first.`);
        process.exit(1);
      } else {
        log.error('Failed to bind backend port', { error: err.message });
        process.exit(1);
      }
    });
  });
}

const server = await listenWithRetry(Number(PORT));
log.setShutdownHook(() => gracefulShutdown(server, prisma));
await mcpLinker.init().catch((err) => log.warn('Failed to initialize MCP linker', err));

// Lifecycle handlers
const handleExitSignal = async (signal: string) => {
  log.info(`Received ${signal}, shutting down...`);
  await gracefulShutdown(server, prisma);
  process.exit(0);
};

process.on('SIGTERM', () => handleExitSignal('SIGTERM'));
process.on('SIGINT', () => handleExitSignal('SIGINT'));
