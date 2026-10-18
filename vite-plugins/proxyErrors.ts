import type { ServerResponse } from 'node:http';

/** Vite's dev proxy answers an opaque 500 (empty body) when its target is not running. This handler
 * replaces that with a 503 and a message naming the service, so the browser console and the UI can say
 * what is actually wrong. Use as `proxy.on('error', respondServiceDown('OmniRoute', 20128))`. */
export function respondServiceDown(name: string, port: number) {
  return (_err: Error, _req: unknown, res: ServerResponse | unknown): void => {
    const out = res as Partial<ServerResponse>;
    // A websocket upgrade passes a socket instead of a response; nothing to answer there.
    if (typeof out.writeHead !== 'function' || out.headersSent) return;
    out.writeHead(503, { 'Content-Type': 'application/json' });
    out.end?.(JSON.stringify({ error: `${name} is not running on localhost:${port}` }));
  };
}
