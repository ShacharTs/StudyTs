import { pathToFileURL } from 'url';
import { PrismaClient } from '@prisma/client';
import { BaseMcpServer, type McpToolDefinition } from './BaseMcpServer.js';
import {
  SQLITE_TOOLS,
  createSqliteTools,
  validateReadOnlySql,
  withDefaultLimit,
  tableNameOf,
} from './sqliteTools.js';

export { validateReadOnlySql, withDefaultLimit, tableNameOf };

const prisma = new PrismaClient();
const tools = createSqliteTools(prisma);

export const TOOLS: McpToolDefinition[] = SQLITE_TOOLS;

class SqliteDatabaseServer extends BaseMcpServer {
  protected readonly serverName = 'SqliteDatabaseServer';
  protected readonly serverVersion = '1.0.0';
  protected readonly tools = TOOLS;

  protected async handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (name === 'read_course_database') return tools.queryCourseDb(args);
    if (name === 'show_database_tables') return tools.describeDbSchema();
    if (name === 'list_lectures') return tools.listTopics(args);
    throw new Error(`Unknown tool '${name}'`);
  }
}

// Auto-start if executed directly. process.argv[1] is a plain OS path
// (backslashes on Windows); pathToFileURL normalizes it to match
// import.meta.url's file:// form on every platform.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  new SqliteDatabaseServer().start();
}

