import type { Server } from 'http';
import type { PrismaClient } from '@prisma/client';
import { log } from './log.js';
import { abortAllInFlight } from '../routes/aiChatProxy.js';
import { mcpLinker } from '../mcp/linker.js';

/**
 * Gracefully shuts down the HTTP server and disconnects Prisma client.
 */
export async function gracefulShutdown(
  server?: Server | null,
  prisma?: PrismaClient | null,
  timeoutMs = 5000,
): Promise<void> {
  log.info('Initiating graceful shutdown');

  // Abort any active AI vendor calls & MCP subprocesses
  try {
    abortAllInFlight();
    mcpLinker.shutdownAll();
  } catch (err: unknown) {
    log.error('Error aborting in-flight AI requests or MCP processes', { error: err instanceof Error ? err.message : String(err) });
  }

  const shutdownHttp = new Promise<void>((resolve) => {
    if (!server) return resolve();
    server.close((err) => {
      if (err) log.error('Error closing HTTP server', { error: err.message });
      resolve();
    });
  });

  const timer = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));

  await Promise.race([shutdownHttp, timer]);

  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch (err: unknown) {
      log.error('Error disconnecting Prisma', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log.info('Graceful shutdown completed');
}
