import { useState, useEffect, useCallback } from 'react';

import type { McpServerStatus, McpServerConfig, McpTool } from '@core/shared/mcpTypes';
export type { McpServerStatus, McpServerConfig, McpTool };

export interface McpServerRuntimeState {
  config: McpServerConfig;
  status: McpServerStatus;
  tools: McpTool[];
  lastPingMs?: number;
  errorMessage?: string;
  pid?: number;
}

async function safeJsonParse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (text.startsWith('<!DOCTYPE') || text.includes('<html')) {
      throw new Error(`Server returned HTML instead of JSON (Status ${res.status}). Ensure the backend server is running.`);
    }
    throw new Error(`Unexpected non-JSON response from server: ${text.slice(0, 100)}`);
  }
  return (await res.json()) as T;
}

export function useMcpManagement(fetchFn: typeof fetch = fetch) {
  const [servers, setServers] = useState<McpServerRuntimeState[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFn('/api/mcp/servers');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await safeJsonParse<{ servers?: McpServerRuntimeState[] }>(res);
      setServers(data.servers || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    refreshServers();
  }, [refreshServers]);

  /** POSTs /api/mcp/servers/:id/<action>, then reloads the list; the row shows as busy under `loadingKey` meanwhile. */
  const postServerAction = async (id: string, action: 'start' | 'stop' | 'ping', loadingKey = id) => {
    setActionLoading(loadingKey);
    try {
      const res = await fetchFn(`/api/mcp/servers/${id}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await safeJsonParse(res);
      await refreshServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  };

  const startServer = (id: string) => postServerAction(id, 'start');
  const stopServer = (id: string) => postServerAction(id, 'stop');
  const pingServer = (id: string) => postServerAction(id, 'ping', `ping-${id}`);

  const saveServer = async (config: McpServerConfig) => {
    setLoading(true);
    try {
      const res = await fetchFn('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await safeJsonParse(res);
      await refreshServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteServer = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetchFn(`/api/mcp/servers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await safeJsonParse(res);
      await refreshServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  };

  return {
    servers,
    loading,
    actionLoading,
    error,
    refreshServers,
    startServer,
    stopServer,
    pingServer,
    saveServer,
    deleteServer,
  };
}
