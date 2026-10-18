import { Router, type Request, type Response } from 'express';
import { mcpLinker } from '../mcp/linker.js';
import { log } from '../utils/log.js';
import type { McpServerConfig } from '../mcp/mcpServerContracts.js';

export const mcpRouter = Router();

mcpRouter.get('/mcp/servers', (_req: Request, res: Response) => {
  res.json({ servers: mcpLinker.getServers() });
});

mcpRouter.post('/mcp/servers', async (req: Request, res: Response) => {
  try {
    const config = req.body as McpServerConfig;
    if (!config.id || !config.name || !config.command) {
      return void res.status(400).json({ error: 'Missing required fields: id, name, command' });
    }
    const server = await mcpLinker.addServer(config);
    return void res.json({ server });
  } catch (err) {
    log.error('Error adding MCP server', { error: String(err) });
    return void res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

mcpRouter.delete('/mcp/servers/:id', async (req: Request, res: Response) => {
  try {
    await mcpLinker.removeServer(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

mcpRouter.post('/mcp/servers/:id/start', async (req: Request, res: Response) => {
  try {
    const server = await mcpLinker.startServer(req.params.id);
    res.json({ server });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

mcpRouter.post('/mcp/servers/:id/stop', (req: Request, res: Response) => {
  try {
    mcpLinker.stopServer(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

mcpRouter.post('/mcp/servers/:id/ping', async (req: Request, res: Response) => {
  try {
    const pingMs = await mcpLinker.pingServer(req.params.id);
    res.json({ pingMs });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

mcpRouter.get('/mcp/tools', (_req: Request, res: Response) => {
  res.json({ tools: mcpLinker.getAllTools() });
});

mcpRouter.post('/mcp/tools/call', async (req: Request, res: Response) => {
  try {
    const { serverId, toolName, args } = req.body as { serverId: string; toolName: string; args: Record<string, unknown> };
    if (!serverId || !toolName) {
      return void res.status(400).json({ error: 'Missing required fields: serverId, toolName' });
    }
    const result = await mcpLinker.callTool(serverId, toolName, args || {});
    return void res.json({ success: true, result });
  } catch (err) {
    log.error('Error executing MCP tool', { error: String(err) });
    return void res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});
