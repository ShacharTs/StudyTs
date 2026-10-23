import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DATA_ROOT, PACKAGE_ROOT } from '../runtime/appPaths.js';
import { getBuiltInLaunch } from './linker.js';

export const CLIENT_SERVER_NAME = 'studyts';

export interface ClientEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

type Env = NodeJS.ProcessEnv;

// A relative DATABASE_URL (file:./studyts.db) is resolved by Prisma against the schema folder; another client
// starts from a different working folder, so it needs the absolute path.
function absoluteDatabaseUrl(env: Env): string | undefined {
  const url = env.DATABASE_URL;
  if (!url?.startsWith('file:')) return url;
  const file = url.slice('file:'.length);
  if (path.isAbsolute(file)) return url;
  return `file:${path.resolve(PACKAGE_ROOT, 'prisma', file).split(path.sep).join('/')}`;
}

function entryEnv(env: Env): Record<string, string> {
  const result: Record<string, string> = { STUDYTS_HOME: DATA_ROOT };
  const databaseUrl = absoluteDatabaseUrl(env);
  if (databaseUrl) result.DATABASE_URL = databaseUrl;
  return result;
}

// What any MCP client must run to start the StudyTs server. The installed app has no Node, so its own executable
// runs the bundled script as plain Node. An AppImage mounts itself at a new path on every launch, so a script path
// inside it would go stale; there the image is started with --mcp instead.
export function buildClientEntry(env: Env = process.env): ClientEntry {
  if (env.STUDYTS_DESKTOP === '1' && env.APPIMAGE) return { command: env.APPIMAGE, args: ['--mcp'] };
  const launch = getBuiltInLaunch();
  if (env.STUDYTS_DESKTOP === '1' && env.STUDYTS_NODE_BIN) {
    return { command: env.STUDYTS_NODE_BIN, args: launch.args, env: { ELECTRON_RUN_AS_NODE: '1', ...entryEnv(env) } };
  }
  return { command: launch.command, args: launch.args, env: entryEnv(env) };
}

// The `mcpServers` shape is the de-facto standard: Claude Desktop, Cursor, Windsurf, Gemini CLI, Cline and most
// other clients read it, so it is also what the "copy" box shows for any client that is not listed.
export function genericMcpJson(entry: ClientEntry): string {
  return JSON.stringify({ mcpServers: { [CLIENT_SERVER_NAME]: entry } }, null, 2);
}

// Codex reads TOML (~/.codex/config.toml). A JSON string is also a valid TOML basic string.
export function codexToml(entry: ClientEntry): string {
  const lines = [
    `[mcp_servers.${CLIENT_SERVER_NAME}]`,
    `command = ${JSON.stringify(entry.command)}`,
    `args = ${JSON.stringify(entry.args)}`,
  ];
  const env = Object.entries(entry.env ?? {});
  if (env.length) {
    lines.push('', `[mcp_servers.${CLIENT_SERVER_NAME}.env]`, ...env.map(([key, value]) => `${key} = ${JSON.stringify(value)}`));
  }
  return lines.join('\n');
}

export interface JsonClient {
  id: string;
  name: string;
  configPath: string;
}

// Clients whose config is one JSON file with a top-level `mcpServers` object.
export function jsonClients(platform: NodeJS.Platform = process.platform, env: Env = process.env): JsonClient[] {
  const home = os.homedir();
  let claudeDesktop = path.join(env.XDG_CONFIG_HOME ?? path.join(home, '.config'), 'Claude', 'claude_desktop_config.json');
  if (platform === 'win32') claudeDesktop = path.join(env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  if (platform === 'darwin') claudeDesktop = path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  return [
    { id: 'claude-desktop', name: 'Claude Desktop', configPath: claudeDesktop },
    { id: 'cursor', name: 'Cursor', configPath: path.join(home, '.cursor', 'mcp.json') },
    { id: 'windsurf', name: 'Windsurf', configPath: path.join(home, '.codeium', 'windsurf', 'mcp_config.json') },
    { id: 'gemini-cli', name: 'Gemini CLI', configPath: path.join(home, '.gemini', 'settings.json') },
  ];
}

// Adds or replaces only the studyts entry; every other server and setting in the user's file is kept, and the
// previous file is saved next to it. A file that is not valid JSON is never touched.
export function addToJsonClient(entry: ClientEntry, configPath: string): { path: string; backup?: string } {
  let config: { mcpServers?: Record<string, unknown> } = {};
  let backup: string | undefined;
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    try {
      config = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      throw new Error(`${configPath} is not valid JSON, so it was left unchanged. Fix or remove it, then try again.`);
    }
    backup = `${configPath}.studyts.bak`;
    fs.copyFileSync(configPath, backup);
  }
  config.mcpServers = { ...config.mcpServers, [CLIENT_SERVER_NAME]: entry };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return { path: configPath, backup };
}

// The name must come before -e: claude's -e takes a list, so a name placed after it is read as another variable
// ("Invalid environment variable format: studyts"). --scope sits between them and ends nothing; the -- ends the list.
export function claudeCodeAddArgs(entry: ClientEntry): string[] {
  const envFlags = Object.entries(entry.env ?? {}).flatMap(([key, value]) => ['-e', `${key}=${value}`]);
  return ['mcp', 'add', CLIENT_SERVER_NAME, '--scope', 'user', ...envFlags, '--', entry.command, ...entry.args];
}

export function codexAddArgs(entry: ClientEntry): string[] {
  const envFlags = Object.entries(entry.env ?? {}).flatMap(([key, value]) => ['--env', `${key}=${value}`]);
  return ['mcp', 'add', CLIENT_SERVER_NAME, ...envFlags, '--', entry.command, ...entry.args];
}

const quoteForShell = (arg: string) => (/[\s"&|<>^]/.test(arg) ? `"${arg.split('"').join('\\"')}"` : arg);

// The same command, written out so a person can paste it into a terminal.
export function commandLine(program: string, args: string[]): string {
  return [program, ...args].map(quoteForShell).join(' ');
}

function runCli(program: string, args: string[]): Promise<string> {
  // The claude shim is a .cmd file on Windows, which only runs through a shell; each argument is quoted for it.
  const isWin = process.platform === 'win32';
  return new Promise((resolve, reject) => {
    const done = (err: Error | null, stdout = '', stderr = '') => (err ? reject(new Error(stderr.trim() || err.message)) : resolve(stdout));
    if (isWin) execFile(commandLine(program, args), { shell: true, windowsHide: true }, (err, out, stderr) => done(err, out, stderr));
    else execFile(program, args, (err, out, stderr) => done(err, out, stderr));
  });
}

// Replaces an older studyts entry, because `claude mcp add` refuses a name that already exists.
export async function addToClaudeCode(entry: ClientEntry): Promise<void> {
  await runCli('claude', ['mcp', 'remove', '--scope', 'user', CLIENT_SERVER_NAME]).catch(() => undefined);
  await runCli('claude', claudeCodeAddArgs(entry));
}

export async function removeFromClaudeCode(): Promise<void> {
  await runCli('claude', ['mcp', 'remove', '--scope', 'user', CLIENT_SERVER_NAME]);
}

export interface ClaudeCodeStatus {
  connected: boolean;
  cliMissing?: boolean;
  // A studyts entry exists but starts a different copy of StudyTs (for example a git folder, not this install).
  stale?: boolean;
}

const samePath = (a: string, b: string) => a.trim().replaceAll('\\', '/').toLowerCase() === b.trim().replaceAll('\\', '/').toLowerCase();

// `claude mcp get` prints "  Command: <exe>" and "  Args: <space-joined args>" for a stdio server.
function registeredLaunch(output: string): { command: string; args: string } | null {
  const command = /^\s*Command:\s*(.+)$/m.exec(output)?.[1];
  if (!command) return null;
  return { command, args: /^\s*Args:\s*(.*)$/m.exec(output)?.[1] ?? '' };
}

// `claude mcp get` exits non-zero when the server is not registered; a shell that cannot find claude at all says so
// in its error text, which the UI shows as "Claude Code not found" instead of "not registered". A registered entry only
// counts as connected when it launches this app's own server; output we cannot read is trusted rather than flagged.
export function toClaudeCodeStatus(err: Error | null, output = '', entry?: ClientEntry): ClaudeCodeStatus {
  if (err) {
    const cliMissing = /ENOENT|not recognized|command not found/i.test(err.message);
    return cliMissing ? { connected: false, cliMissing } : { connected: false };
  }
  const registered = registeredLaunch(output);
  if (!entry || !registered) return { connected: true };
  const matches = samePath(registered.command, entry.command) && samePath(registered.args, entry.args.join(' '));
  return matches ? { connected: true } : { connected: false, stale: true };
}

export function claudeCodeStatus(entry: ClientEntry): Promise<ClaudeCodeStatus> {
  return runCli('claude', ['mcp', 'get', CLIENT_SERVER_NAME]).then(
    (out) => toClaudeCodeStatus(null, out, entry),
    (err: Error) => toClaudeCodeStatus(err),
  );
}
