import type { AiTool } from '@core/shared/aiTypes';
import { CONTENT_EDITOR_TOOLS, executeContentEditorTool } from './contentEditor';
import { VISUAL_LECTURE_TOOLS, executeVisualLectureTool } from './contentEditor/visualLectureTool';
import { SOURCE_EDITOR_TOOLS, executeSourceEditorTool, type SourceEditorArgs } from './sourceEditorTools';
import { WEB_RESEARCH_TOOLS, executeWebResearchTool } from './webResearchTools';
import { FILE_INSPECTION_TOOLS, executeFileInspectionTool } from './fileInspectionTools';
import { CANVAS_GENERATOR_TOOLS, executeCanvasGeneratorTool } from './canvasGenerator';
import { isMcpToolName, executeMcpTool } from './mcpTools';

export const ALL_AI_TOOLS: AiTool[] = [
  ...CONTENT_EDITOR_TOOLS,
  ...VISUAL_LECTURE_TOOLS,
  ...WEB_RESEARCH_TOOLS,
  ...FILE_INSPECTION_TOOLS,
  ...CANVAS_GENERATOR_TOOLS,
];

type ToolResult = { success: boolean; data?: unknown; error?: string };

interface ToolOptions {
  sourceEditingEnabled?: boolean;
  fetchFn?: typeof fetch;
}

interface ToolGroup {
  tools: AiTool[];
  run: (toolName: string, args: Record<string, unknown>, options?: ToolOptions) => Promise<ToolResult>;
}

const ownsTool = (group: ToolGroup, toolName: string): boolean => group.tools.some((tool) => tool.function.name === toolName);

async function runSourceEditor(toolName: string, args: Record<string, unknown>, options?: ToolOptions): Promise<ToolResult> {
  if (!options?.sourceEditingEnabled) return { success: false, error: 'Source editing is disabled. Enable it in AI settings.' };
  return executeSourceEditorTool(toolName, args as unknown as SourceEditorArgs, options.fetchFn);
}

// Checked in order; the first group that owns the tool name runs it.
const TOOL_GROUPS: ToolGroup[] = [
  { tools: CONTENT_EDITOR_TOOLS, run: (name, args, options) => executeContentEditorTool(name, args, options?.fetchFn) },
  { tools: VISUAL_LECTURE_TOOLS, run: (_name, args, options) => executeVisualLectureTool(args, options?.fetchFn) },
  { tools: WEB_RESEARCH_TOOLS, run: (name, args, options) => executeWebResearchTool(name, args, options?.fetchFn) },
  { tools: FILE_INSPECTION_TOOLS, run: (name, args) => executeFileInspectionTool(name, args) },
  { tools: CANVAS_GENERATOR_TOOLS, run: (name, args, options) => executeCanvasGeneratorTool(name, args, options?.fetchFn) },
  { tools: SOURCE_EDITOR_TOOLS, run: runSourceEditor },
];

export async function executeUnifiedTool(toolName: string, args: Record<string, unknown>, options?: ToolOptions): Promise<ToolResult> {
  try {
    const group = TOOL_GROUPS.find((candidate) => ownsTool(candidate, toolName));
    if (group) return await group.run(toolName, args, options);
    if (isMcpToolName(toolName)) return await executeMcpTool(toolName, args, options?.fetchFn);
    return { success: false, error: `Unrecognized AI tool '${toolName}'.` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
