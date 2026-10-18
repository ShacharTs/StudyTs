import path from 'path';
import { pathToFileURL } from 'url';
import { BaseMcpServer, type McpToolDefinition } from './BaseMcpServer.js';
import { createNotebookTools } from './notebookTools.js';

const NOTEBOOKS_DIR = path.resolve(process.cwd(), 'data', 'notebooks');

const TOOLS: McpToolDefinition[] = [
  {
    name: 'save_note_to_notebook',
    description: 'Uploads parsed document snippets, notes, or canvas definitions to a user research notebook.',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string', description: 'Notebook ID (defaults to "default")' },
        title: { type: 'string', description: 'Snippet title or heading' },
        content: { type: 'string', description: 'Markdown / text content or formula' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional categorization tags' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'search_notebook_notes',
    description: 'Searches relevant context chunks across saved research notebooks.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or keyword' },
        limit: { type: 'number', description: 'Maximum snippets to return (default 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_notebooks',
    description: 'Lists all available notebook repositories and snippet counts.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

const notebooks = createNotebookTools(NOTEBOOKS_DIR);

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  save_note_to_notebook: notebooks.sendSnippet,
  search_notebook_notes: notebooks.querySources,
  list_notebooks: () => notebooks.listNotebooks(),
};

class NotebookBridgeServer extends BaseMcpServer {
  protected readonly serverName = 'NotebookBridgeServer';
  protected readonly serverVersion = '1.0.0';
  protected readonly tools = TOOLS;

  protected async handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
    const handler = HANDLERS[name];
    if (!handler) throw new Error(`Unknown tool '${name}'`);
    return handler(args);
  }
}

// Auto-start if executed directly. process.argv[1] is a plain OS path
// (backslashes on Windows); pathToFileURL normalizes it to match
// import.meta.url's file:// form on every platform.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  new NotebookBridgeServer().start();
}
