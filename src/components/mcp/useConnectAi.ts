import { useState, useEffect, useCallback } from 'react';

export interface ConnectClient {
  id: string;
  name: string;
  configPath: string;
}

export interface ConnectInfo {
  genericJson: string;
  codexToml: string;
  codexCommand: string;
  claudeCodeCommand: string;
  jsonClients: ConnectClient[];
}

export type ConnectOutcome = { id: string; ok: true; removed?: boolean } | { id: string; ok: false; reason: string };

export interface ClaudeCodeConnection {
  connected: boolean;
  cliMissing?: boolean;
  stale?: boolean;
}

export function useConnectAi(fetchFn: typeof fetch = fetch) {
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  // Null while unknown or when the server is older than the status route; the panel then shows no chip.
  const [claudeCode, setClaudeCode] = useState<ClaudeCodeConnection | null>(null);
  const [outcome, setOutcome] = useState<ConnectOutcome | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFn('/api/mcp/connect-info')
      .then((res) => (res.ok ? (res.json() as Promise<ConnectInfo>) : null))
      // An older server without this route answers with something else; show no panel rather than a broken one.
      .then((data) => { if (!cancelled) setInfo(Array.isArray(data?.jsonClients) ? data : null); })
      .catch((err: unknown) => {
        if (!cancelled) setOutcome({ id: 'info', ok: false, reason: err instanceof Error ? err.message : String(err) });
      });
    return () => { cancelled = true; };
  }, [fetchFn]);

  const refreshClaudeCode = useCallback(() => {
    fetchFn('/api/mcp/claude-code/status')
      .then((res) => (res.ok ? (res.json() as Promise<ClaudeCodeConnection>) : null))
      .then((data) => setClaudeCode(typeof data?.connected === 'boolean' ? data : null))
      .catch(() => setClaudeCode(null));
  }, [fetchFn]);

  useEffect(refreshClaudeCode, [refreshClaudeCode]);

  const post = useCallback(async (id: string, action: 'connect' | 'disconnect') => {
    setBusyId(id);
    setOutcome(null);
    try {
      const res = await fetchFn(`/api/mcp/${action}/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const body = (await res.json()) as { error?: string };
      setOutcome(res.ok ? { id, ok: true, removed: action === 'disconnect' } : { id, ok: false, reason: body.error ?? `HTTP ${res.status}` });
    } catch (err) {
      setOutcome({ id, ok: false, reason: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusyId(null);
      if (id === 'claude-code') refreshClaudeCode();
    }
  }, [fetchFn, refreshClaudeCode]);

  const connect = useCallback((id: string) => post(id, 'connect'), [post]);
  const disconnect = useCallback((id: string) => post(id, 'disconnect'), [post]);

  return { info, outcome, busyId, claudeCode, connect, disconnect };
}
