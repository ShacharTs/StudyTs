import type { AiTool } from '@core/shared/aiTypes';

interface RawMcpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
  serverName: string;
}

export async function fetchActiveMcpTools(fetchFn: typeof fetch = fetch): Promise<AiTool[]> {
  try {
    const res = await fetchFn('/api/mcp/tools');
    if (!res.ok) return [];
    const contentType = res.headers?.get?.('content-type') || '';
    if (contentType && !contentType.includes('application/json')) return [];

    const data = (await res.json()) as { tools?: RawMcpTool[] };
    const rawTools = data.tools || [];
    return rawTools.map((t) => ({
      type: 'function',
      function: {
        name: `mcp__${t.serverId}__${t.name}`,
        description: `[MCP: ${t.serverName}] ${t.description || ''}`,
        parameters: t.inputSchema,
      },
    }));
  } catch {
    return [];
  }
}

export function isMcpToolName(name: string): boolean {
  return name.startsWith('mcp__');
}

export async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  fetchFn: typeof fetch = fetch
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const parts = toolName.split('__');
    if (parts.length < 3) {
      return { success: false, error: `Invalid MCP tool name format: '${toolName}'` };
    }
    const serverId = parts[1];
    const actualToolName = parts.slice(2).join('__');

    const res = await fetchFn('/api/mcp/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId, toolName: actualToolName, args }),
    });

    const contentType = res.headers?.get?.('content-type') || '';
    if (contentType && !contentType.includes('application/json')) {
      const text = await res.text();
      return { success: false, error: `Server returned non-JSON response: ${text.slice(0, 100)}` };
    }

    const data = (await res.json()) as { success?: boolean; result?: unknown; error?: string };
    if (!res.ok || data.success === false) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return { success: true, data: data.result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
