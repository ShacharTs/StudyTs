import { spawn, type ChildProcess } from 'child_process';
import { log } from '../utils/log.js';
import type { McpServerConfig, McpServerStatus, McpTool, JsonRpcResponse, JsonRpcRequest, JsonRpcNotification } from './mcpServerContracts.js';
import { Writable, Readable } from 'stream';

interface PendingRequest {
  resolve: (res: JsonRpcResponse) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class JsonRpcProtocol {
  private nextId = 1;
  private pending = new Map<string | number, PendingRequest>();
  private buffer = '';

  constructor(
    private stdin: Writable,
    stdout: Readable,
    private defaultTimeoutMs: number = 15000
  ) {
    stdout.on('data', (chunk: Buffer | string) => this.handleData(chunk));
    stdout.on('error', (err) => this.handleStreamError(err));
  }

  private handleData(chunk: Buffer | string): void {
    this.buffer += chunk.toString('utf-8');
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const req = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          clearTimeout(req.timer);
          req.resolve(msg);
        }
      } catch {
        // Ignore unparseable non-JSON lines (e.g. server debug banners)
      }
    }
  }

  private handleStreamError(err: Error): void {
    this.rejectAll(new Error(`MCP stdout error: ${err.message}`));
  }

  public rejectAll(error: Error): void {
    for (const [id, req] of this.pending.entries()) {
      clearTimeout(req.timer);
      req.reject(error);
      this.pending.delete(id);
    }
  }

  public sendRequest(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP JSON-RPC request '${method}' timed out after ${timeout}ms`));
        }
      }, timeout);

      this.pending.set(id, { resolve, reject, timer });

      try {
        this.stdin.write(JSON.stringify(req) + '\n');
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  public sendNotification(method: string, params?: Record<string, unknown>): void {
    const notification: JsonRpcNotification = { jsonrpc: '2.0', method, params };
    this.stdin.write(JSON.stringify(notification) + '\n');
  }

  public close(): void {
    this.rejectAll(new Error('MCP protocol closed'));
  }
}

/** Quotes each arg for cmd.exe (wraps in "..." and escapes embedded quotes)
 * and joins into one command string, matching what shell:true wants on
 * Windows without Node's DEP0190 array-with-shell warning. */
function quoteWinCommand(command: string, args: string[]): string {
  const quote = (s: string) => (/[\s"&|<>^]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [command, ...args].map(quote).join(' ');
}

export class McpProcess {
  private child: ChildProcess | null = null;
  private protocol: JsonRpcProtocol | null = null;
  private _status: McpServerStatus = 'stopped';
  private _tools: McpTool[] = [];
  private _errorMessage?: string;
  private _lastPingMs?: number;

  constructor(public readonly config: McpServerConfig) {}

  public get status(): McpServerStatus { return this._status; }
  public get tools(): McpTool[] { return this._tools; }
  public get errorMessage(): string | undefined { return this._errorMessage; }
  public get lastPingMs(): number | undefined { return this._lastPingMs; }
  public get pid(): number | undefined { return this.child?.pid; }

  public async start(): Promise<void> {
    if (this._status === 'connected' || this._status === 'connecting') return;
    this._status = 'connecting';
    this._errorMessage = undefined;

    try {
      // Node 22+ warns (DEP0190) about passing an args array with shell:true on
      // Windows — it wants one pre-quoted command string instead. command/args
      // come from data/mcp-servers.json (editable config, not hardcoded), so
      // each arg is individually quoted rather than naively joined.
      const isWin = process.platform === 'win32';
      const child = isWin
        ? spawn(quoteWinCommand(this.config.command, this.config.args), { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...this.config.env }, cwd: this.config.cwd || process.cwd(), shell: true })
        : spawn(this.config.command, this.config.args, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...this.config.env }, cwd: this.config.cwd || process.cwd() });

      this.child = child;
      if (!child.stdin || !child.stdout) throw new Error('Child process stdio streams not available');

      this.protocol = new JsonRpcProtocol(child.stdin, child.stdout);

      child.stderr?.on('data', (data: Buffer | string) => {
        log.warn(`[MCP:${this.config.name}] stderr:`, { output: data.toString('utf-8').trim() });
      });

      child.on('exit', (code, signal) => {
        log.info(`[MCP:${this.config.name}] process exited`, { code, signal });
        this.handleExit(code, signal);
      });

      child.on('error', (err) => {
        log.error(`[MCP:${this.config.name}] process spawn error:`, { error: err.message });
        this._status = 'error';
        this._errorMessage = err.message;
        this.protocol?.rejectAll(err);
      });

      await this.initializeHandshake();
      await this.refreshTools();
      this._status = 'connected';
    } catch (err) {
      this.stop(); // stop() resets status to 'stopped', so record the failure after it
      this._status = 'error';
      this._errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  private async initializeHandshake(): Promise<void> {
    if (!this.protocol) throw new Error('Protocol not initialized');
    await this.protocol.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'Complexity_web', version: '1.0.0' },
    });
    this.protocol.sendNotification('notifications/initialized');
  }

  public async refreshTools(): Promise<McpTool[]> {
    if (!this.protocol) throw new Error('MCP server is not connected');
    const res = await this.protocol.sendRequest('tools/list', {});
    const result = res.result as { tools?: Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }> };
    const rawTools = result?.tools || [];
    this._tools = rawTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema || { type: 'object', properties: {} },
      serverId: this.config.id,
      serverName: this.config.name,
    }));
    return this._tools;
  }

  public async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.protocol || this._status !== 'connected') {
      throw new Error(`MCP server '${this.config.name}' is not connected`);
    }
    const res: JsonRpcResponse = await this.protocol.sendRequest('tools/call', {
      name: toolName,
      arguments: args,
    });
    if (res.error) throw new Error(`MCP tool error: ${res.error.message}`);
    return res.result;
  }

  public async ping(): Promise<number> {
    if (!this.protocol || this._status !== 'connected') throw new Error('MCP server is not connected');
    const start = Date.now();
    await this.protocol.sendRequest('ping', {});
    this._lastPingMs = Date.now() - start;
    return this._lastPingMs;
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    this._status = code === 0 ? 'stopped' : 'error';
    if (code !== 0 && !this._errorMessage) {
      this._errorMessage = `Process exited with code ${code ?? signal ?? 'unknown'}`;
    }
    this.protocol?.close();
    this.protocol = null;
    this.child = null;
  }

  public stop(): void {
    if (this.child) {
      this.protocol?.close();
      this.terminate(this.child);
      this.child = null;
      this.protocol = null;
    }
    this._status = 'stopped';
    this._tools = [];
  }

  /** Asks the child to exit: taskkill on Windows, SIGTERM (then SIGKILL after 1s) elsewhere. */
  private terminate(child: ChildProcess): void {
    try {
      if (!child.pid) {
        child.kill('SIGTERM');
      } else if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
        setTimeout(() => killIfStillRunning(child), 1000);
      }
    } catch (err) {
      log.warn(`[MCP:${this.config.name}] error killing process`, { error: String(err) });
    }
  }
}

/** SIGKILL escalation; ignores a process that already exited. */
function killIfStillRunning(child: ChildProcess): void {
  try {
    if (!child.killed) child.kill('SIGKILL');
  } catch {
    // Ignore if process already exited
  }
}
