export const API_PATHS = {
  courses: '/api/courses',
  scenes: '/api/scenes',
  contentEditor: '/api/content-editor',
  canvasEditor: '/api/canvas-editor',
  registry: '/api/registry',
  mcp: '/api/mcp',
  mcpServers: '/api/mcp/servers',
  mcpTools: '/api/mcp/tools',
  contentChanges: '/api/content-changes',
  clientErrors: '/api/client-errors',
  aiChat: '/api/ai/chat',
  aiModels: '/api/ai/models',
  logs: '/api/logs',
  logsStream: '/api/logs/stream',
  visualSpecs: '/api/visual-specs',
  visualLectures: '/api/visual-lectures',
  omniroute: '/api/omniroute',
} as const;

export type ApiPath = (typeof API_PATHS)[keyof typeof API_PATHS];

export function apiUrl(base: ApiPath, ...segments: (string | number)[]): string {
  if (segments.length === 0) return base;
  return [base, ...segments.map((s) => encodeURIComponent(String(s)))].join('/');
}
