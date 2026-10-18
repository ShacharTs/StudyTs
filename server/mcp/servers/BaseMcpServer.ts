import readline from 'readline';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

class MethodNotFound extends Error {}

export abstract class BaseMcpServer {
  protected abstract readonly serverName: string;
  protected abstract readonly serverVersion: string;
  protected abstract readonly tools: McpToolDefinition[];

  protected abstract handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown>;

  public start(): void {
    const rl = readline.createInterface({ input: process.stdin, terminal: false });
    rl.on('line', (line) => this.handleLine(line));
  }

  private async handleLine(line: string): Promise<void> {
    const trimmed = line.trim();
    if (!trimmed) return;

    let msg: { id?: string | number; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
    try {
      msg = JSON.parse(trimmed);
    } catch (parseErr) {
      process.stderr.write(`Fatal JSON parse error: ${String(parseErr)}\n`);
      return;
    }
    if (msg.id === undefined || msg.id === null) return;

    try {
      this.sendResponse(msg.id, await this.route(msg));
    } catch (err) {
      const code = err instanceof MethodNotFound ? -32601 : -32603;
      this.sendResponse(msg.id, undefined, { code, message: err instanceof Error ? err.message : String(err) });
    }
  }

  /** The JSON-RPC result for a request; throws MethodNotFound for methods this server does not speak. */
  private async route(msg: { method?: string; params?: { name?: string; arguments?: Record<string, unknown> } }): Promise<unknown> {
    switch (msg.method) {
      case 'initialize':
        return {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: this.serverName, version: this.serverVersion },
        };
      case 'tools/list':
        return { tools: this.tools };
      case 'tools/call': {
        const output = await this.handleToolCall(msg.params?.name as string, msg.params?.arguments || {});
        return { content: [{ type: 'text', text: JSON.stringify(output, (_key, value) => (typeof value === 'bigint' ? Number(value) : value)) }] };
      }
      case 'ping':
        return {};
      default:
        throw new MethodNotFound(`Method not found: ${msg.method}`);
    }
  }

  protected sendResponse(id: string | number, result?: unknown, error?: { code: number; message: string }): void {
    const res = { jsonrpc: '2.0', id, ...(error ? { error } : { result }) };
    process.stdout.write(JSON.stringify(res) + '\n');
  }
}
