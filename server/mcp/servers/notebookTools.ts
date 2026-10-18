import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export interface NotebookSnippet {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
}

export interface NotebookData {
  id: string;
  title: string;
  snippets: NotebookSnippet[];
  updatedAt: string;
}

type Args = Record<string, unknown>;

const DEFAULT_LIMIT = 5;

function matches(snippet: NotebookSnippet, query: string): boolean {
  return (
    snippet.title.toLowerCase().includes(query) ||
    snippet.content.toLowerCase().includes(query) ||
    Boolean(snippet.tags?.some((t) => t.toLowerCase().includes(query)))
  );
}

/** The three notebook tools, bound to a notebooks folder (injectable so tests can use a temp dir). */
export function createNotebookTools(notebooksDir: string) {
  const fileOf = (id: string) => path.join(notebooksDir, `${id}.json`);

  async function getNotebook(notebookId: string = 'default'): Promise<NotebookData> {
    await fs.mkdir(notebooksDir, { recursive: true });
    const file = fileOf(notebookId);
    if (!fsSync.existsSync(file)) {
      const initial: NotebookData = { id: notebookId, title: `Notebook: ${notebookId}`, snippets: [], updatedAt: new Date().toISOString() };
      await fs.writeFile(file, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    return JSON.parse(await fs.readFile(file, 'utf-8')) as NotebookData;
  }

  async function saveNotebook(nb: NotebookData): Promise<void> {
    await fs.mkdir(notebooksDir, { recursive: true });
    nb.updatedAt = new Date().toISOString();
    await fs.writeFile(fileOf(nb.id), JSON.stringify(nb, null, 2), 'utf-8');
  }

  /** Every readable notebook; unreadable ones are logged to stderr and skipped. */
  async function* eachNotebook(): AsyncGenerator<NotebookData> {
    await fs.mkdir(notebooksDir, { recursive: true });
    for (const f of await fs.readdir(notebooksDir)) {
      if (!f.endsWith('.json')) continue;
      try {
        yield JSON.parse(await fs.readFile(path.join(notebooksDir, f), 'utf-8')) as NotebookData;
      } catch (err) {
        process.stderr.write(`Error reading notebook ${f}: ${String(err)}\n`);
      }
    }
  }

  async function sendSnippet(args: Args) {
    const nbId = typeof args.notebookId === 'string' && args.notebookId ? args.notebookId : 'default';
    const nb = await getNotebook(nbId);
    const snippet: NotebookSnippet = {
      id: `snip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: String(args.title || 'Untitled Snippet'),
      content: String(args.content || ''),
      tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
      createdAt: new Date().toISOString(),
    };
    nb.snippets.push(snippet);
    await saveNotebook(nb);
    return { success: true, message: `Saved snippet to notebook '${nbId}'`, snippetId: snippet.id };
  }

  async function querySources(args: Args) {
    const query = String(args.query || '').toLowerCase();
    const limit = Number(args.limit) || DEFAULT_LIMIT;
    const results: Array<{ notebookId: string; snippet: NotebookSnippet }> = [];
    for await (const nb of eachNotebook()) {
      for (const snippet of nb.snippets.filter((s) => matches(s, query))) {
        results.push({ notebookId: nb.id, snippet });
        if (results.length >= limit) return { results, totalFound: results.length };
      }
    }
    return { results, totalFound: results.length };
  }

  async function listNotebooks() {
    const notebooks: Array<{ id: string; title: string; snippetCount: number; updatedAt: string }> = [];
    for await (const nb of eachNotebook()) {
      notebooks.push({ id: nb.id, title: nb.title, snippetCount: nb.snippets.length, updatedAt: nb.updatedAt });
    }
    return { notebooks };
  }

  return { sendSnippet, querySources, listNotebooks };
}
