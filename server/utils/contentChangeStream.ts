/** Server-sent events that tell open browser tabs the course data changed outside the UI (e.g. an MCP tool wrote to data/). */
import type { Request, Response } from 'express';

const clients = new Set<Response>();

export function announceContentChange(): void {
  for (const res of clients) res.write('data: changed\n\n');
}

export function contentChangeStreamHandler(req: Request, res: Response): void {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(': connected\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
}
