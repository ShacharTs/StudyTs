export type { McpServerStatus, McpServerConfig, McpTool } from '../../src/core/shared/mcpTypes.js';
import type { McpServerStatus, McpServerConfig, McpTool } from '../../src/core/shared/mcpTypes.js';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpServerRuntimeState {
  config: McpServerConfig;
  status: McpServerStatus;
  tools: McpTool[];
  lastPingMs?: number;
  errorMessage?: string;
  pid?: number;
}
