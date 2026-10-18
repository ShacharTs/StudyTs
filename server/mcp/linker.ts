import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { log } from '../utils/log.js';
import { McpProcess } from './mcpProcess.js';
import type { McpServerConfig, McpServerRuntimeState, McpTool } from './mcpServerContracts.js';

const CONFIG_PATH = path.resolve(process.cwd(), 'data', 'mcp-servers.json');

const LEGACY_ID_MAP: Record<string, string> = {
  'notebook-bridge': 'studyts-mcp',
  'sqlite-course-db': 'studyts-mcp',
  'course-author': 'studyts-mcp',
};

const DEFAULT_SERVERS: McpServerConfig[] = [
  {
    id: 'studyts-mcp',
    name: 'StudyTs-MCP',
    command: 'npx',
    args: ['tsx', 'server/mcp/servers/studyTsServer.ts'],
    enabled: true,
    autoStart: true,
  },
];

function hasLegacyServers(configs: McpServerConfig[]): boolean {
  return Array.isArray(configs) && configs.some((c) => Boolean(LEGACY_ID_MAP[c.id]));
}

class MCPLinkerManager {
  private processes = new Map<string, McpProcess>();
  private configs = new Map<string, McpServerConfig>();

  public async init(): Promise<void> {
    await this.loadConfigs();
    for (const config of this.configs.values()) {
      if (config.enabled && config.autoStart) {
        this.startServer(config.id).catch((err) => {
          log.warn(`Auto-start failed for MCP server '${config.name}'`, { error: String(err) });
        });
      }
    }
  }

  private async loadConfigs(): Promise<void> {
    try {
      if (!fsSync.existsSync(CONFIG_PATH)) {
        await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
        await fs.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_SERVERS, null, 2), 'utf-8');
        for (const s of DEFAULT_SERVERS) this.configs.set(s.id, s);
        return;
      }
      const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as McpServerConfig[];
      this.configs.clear();

      if (hasLegacyServers(parsed)) {
        const cleaned = parsed.filter((c) => !LEGACY_ID_MAP[c.id]);
        if (!cleaned.some((c) => c.id === 'studyts-mcp')) {
          cleaned.unshift(...DEFAULT_SERVERS);
        }
        for (const s of cleaned) this.configs.set(s.id, s);
        await this.saveConfigs();
        return;
      }

      for (const s of parsed) this.configs.set(s.id, s);
    } catch (err) {
      log.error('Failed to load MCP server configs', { error: String(err) });
      for (const s of DEFAULT_SERVERS) this.configs.set(s.id, s);
    }
  }

  private async saveConfigs(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
      const list = Array.from(this.configs.values());
      await fs.writeFile(CONFIG_PATH, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      log.error('Failed to save MCP server configs', { error: String(err) });
    }
  }

  public getServers(): McpServerRuntimeState[] {
    return Array.from(this.configs.values()).map((config) => {
      const proc = this.processes.get(config.id);
      return {
        config,
        status: proc?.status || 'stopped',
        tools: proc?.tools || [],
        lastPingMs: proc?.lastPingMs,
        errorMessage: proc?.errorMessage,
        pid: proc?.pid,
      };
    });
  }

  public async addServer(config: McpServerConfig): Promise<McpServerRuntimeState> {
    this.configs.set(config.id, config);
    await this.saveConfigs();
    if (config.enabled && config.autoStart) await this.startServer(config.id);
    return this.getServers().find((s) => s.config.id === config.id)!;
  }

  public async updateServer(config: McpServerConfig): Promise<McpServerRuntimeState> {
    if (this.processes.has(config.id)) {
      this.stopServer(config.id);
    }
    this.configs.set(config.id, config);
    await this.saveConfigs();
    return this.getServers().find((s) => s.config.id === config.id)!;
  }

  public async removeServer(id: string): Promise<void> {
    this.stopServer(id);
    this.configs.delete(id);
    await this.saveConfigs();
  }

  public async startServer(id: string): Promise<McpServerRuntimeState> {
    const targetId = this.configs.has(id) ? id : (LEGACY_ID_MAP[id] ?? id);
    const config = this.configs.get(targetId);
    if (!config) throw new Error(`MCP server '${id}' not found`);
    let proc = this.processes.get(targetId);
    if (!proc) {
      proc = new McpProcess(config);
      this.processes.set(targetId, proc);
    }
    await proc.start();
    return this.getServers().find((s) => s.config.id === targetId)!;
  }

  public stopServer(id: string): void {
    const targetId = this.processes.has(id) ? id : (LEGACY_ID_MAP[id] ?? id);
    const proc = this.processes.get(targetId);
    if (proc) {
      proc.stop();
      this.processes.delete(targetId);
    }
  }

  public async pingServer(id: string): Promise<number> {
    const targetId = this.processes.has(id) ? id : (LEGACY_ID_MAP[id] ?? id);
    const proc = this.processes.get(targetId);
    if (!proc) throw new Error(`MCP server '${id}' is not running`);
    return await proc.ping();
  }

  public getAllTools(): McpTool[] {
    const tools: McpTool[] = [];
    for (const proc of this.processes.values()) {
      if (proc.status === 'connected') {
        tools.push(...proc.tools);
      }
    }
    return tools;
  }

  public async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const targetId = this.processes.has(serverId) ? serverId : (LEGACY_ID_MAP[serverId] ?? serverId);
    const proc = this.processes.get(targetId);
    if (!proc) throw new Error(`MCP server '${serverId}' is not running`);
    return await proc.callTool(toolName, args);
  }

  public shutdownAll(): void {
    log.info('Shutting down all MCP subprocesses');
    for (const proc of this.processes.values()) {
      try {
        proc.stop();
      } catch (err) {
        log.warn('Error stopping MCP process during shutdown', { error: String(err) });
      }
    }
    this.processes.clear();
  }
}

export const mcpLinker = new MCPLinkerManager();
