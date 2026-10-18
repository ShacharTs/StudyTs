import type { ToolExecutionResult } from '../toolExecutionResult';
import type { AiTool } from '@core/shared/aiTypes';

export type { ToolExecutionResult };

/** One tool per source area; they differ only in name, description, example path and the wording of `content`. */
function sourceEditorTool(name: string, description: string, pathExample: string, contentDescription: string): AiTool {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: `Relative path from project root, e.g. '${pathExample}'` },
          content: { type: 'string', description: contentDescription },
          reason: { type: 'string', description: 'Brief explanation of why this change is being made' },
        },
        required: ['filePath', 'content', 'reason'],
      },
    },
  };
}

export const SOURCE_EDITOR_TOOLS: AiTool[] = [
  sourceEditorTool(
    'source_editor_component',
    'Edit or create a React component file in src/components/. Changes are verified in Docker before applying to prevent breaking the app.',
    'src/components/shell/TopBarHeader.tsx',
    'Full new file content (not a patch/diff)',
  ),
  sourceEditorTool(
    'source_editor_core',
    'Edit or create a core module file in src/core/. Changes are verified in Docker before applying.',
    'src/i18n/index.ts',
    'Full new file content',
  ),
  sourceEditorTool(
    'source_editor_config',
    'Edit configuration files like vite.config.ts, tsconfig.json, or package.json. Changes are verified in Docker before applying.',
    'vite.config.ts',
    'Full new file content',
  ),
  sourceEditorTool(
    'source_editor_plugin',
    'Edit or create a Vite plugin file in vite-plugins/. Changes are verified in Docker before applying.',
    'vite-plugins/contentEditorPlugin.ts',
    'Full new file content',
  ),
];

export interface SourceEditorArgs {
  filePath: string;
  content: string;
  reason: string;
}

const SOURCE_EDITOR_ENDPOINTS: Record<string, string> = {
  source_editor_component: '/__source-editor/component',
  source_editor_core: '/__source-editor/core',
  source_editor_config: '/__source-editor/config',
  source_editor_plugin: '/__source-editor/plugin',
};

export async function executeSourceEditorTool(
  toolName: string,
  args: SourceEditorArgs,
  fetchImpl: typeof fetch = fetch
): Promise<ToolExecutionResult> {
  const endpoint = Object.hasOwn(SOURCE_EDITOR_ENDPOINTS, toolName) ? SOURCE_EDITOR_ENDPOINTS[toolName] : undefined;
  if (!endpoint) return { success: false, error: `Unknown source editor tool: ${toolName}` };

  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    });
    const resJson = await res.json().catch(() => ({}));
    if (res.ok) return { success: true, data: resJson };
    return {
      success: false,
      error: resJson?.error || `Request failed with status ${res.status}`,
      data: resJson?.buildOutput ? { buildOutput: resJson.buildOutput } : undefined,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
