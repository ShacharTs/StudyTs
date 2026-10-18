import type { AiTool } from '@core/shared/aiTypes';

// Tool names (built-in and MCP, matched on the part after the last "__") that only read data.
const LOOKUP_TOOL = /(^|_)(describe|query|list|search|get|read|show)(_|$)/i;

const baseName = (name: string | undefined): string => (name ?? '').split('__').pop() ?? '';

/** The tools that can change something: everything except the lookup tools. Used to push a model out of a lookup-only loop. */
export function onlyActingTools(tools: AiTool[]): AiTool[] {
  return tools.filter((tool) => !LOOKUP_TOOL.test(baseName(tool.function?.name)));
}
