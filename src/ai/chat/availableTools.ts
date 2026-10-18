// src/ai/chat/availableTools.ts
/** The tools the model may call this turn: built-in, source-editing (when enabled) and active MCP tools. */
import type { AiTool } from '@core/shared/aiTypes';
import { ALL_AI_TOOLS } from '@ai/tools';
import { SOURCE_EDITOR_TOOLS } from '@ai/tools/sourceEditorTools';
import { fetchActiveMcpTools } from '@ai/tools/mcpTools';
import { filterToolsForView } from '@core/shared/appViewProfiles';
import type { AppViewKind } from '@core/shared/appViewContext';

export async function availableTools(
  sourceEditingEnabled: boolean,
  viewKind?: AppViewKind | null
): Promise<AiTool[]> {
  const mcpTools = await fetchActiveMcpTools();
  const baseTools = sourceEditingEnabled ? [...ALL_AI_TOOLS, ...SOURCE_EDITOR_TOOLS] : ALL_AI_TOOLS;
  const all = [...baseTools, ...mcpTools];
  return filterToolsForView(all, viewKind);
}
