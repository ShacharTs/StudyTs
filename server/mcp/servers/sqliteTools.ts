import { PrismaClient } from '@prisma/client';
import type { McpToolDefinition } from './BaseMcpServer.js';

export const SQLITE_TOOLS: McpToolDefinition[] = [
  {
    name: 'read_course_database',
    description:
      'Executes a read-only SELECT query on the course database. Automatically limits to 200 rows and previews long strings/JSON (pass rawStrings: true for full text).',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SELECT SQL query' },
        rawStrings: { type: 'boolean', description: 'Disable string truncation for raw values' },
      },
      required: ['sql'],
    },
  },
  {
    name: 'show_database_tables',
    description:
      'Returns sorted database tables, column definitions (PK, NOT NULL), and foreign key relations.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_lectures',
    description:
      'Lists topics (week, section, topic_id, title, canvas status) sorted by course hierarchy.',
    inputSchema: {
      type: 'object',
      properties: {
        course_id: { type: 'string', description: 'Optional course id filter (e.g. computer-networking)' },
      },
    },
  },
];

interface TableInfoRow {
  name: string;
  type: string;
  notnull: number | bigint;
  pk: number | bigint;
}

interface ForeignKeyRow {
  from: string;
  table: string;
  to: string;
}

/** One short string per column; PRAGMA returns BigInt flags, so nothing raw is passed through. */
function describeColumn(c: TableInfoRow): string {
  const flags = [Number(c.pk) > 0 ? 'PK' : '', Number(c.notnull) > 0 ? 'NOT NULL' : ''].filter(Boolean).join(' ');
  return `${c.name} ${c.type}${flags ? ` ${flags}` : ''}`;
}

const LITERAL = /'(?:[^']|'')*'|"(?:[^"]|"")*"/g;

export function validateReadOnlySql(sql: string): void {
  const trimmed = sql.trim();
  const normalized = trimmed.toUpperCase();
  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH') && !normalized.startsWith('PRAGMA TABLE_INFO')) {
    throw new Error('Only read-only SELECT queries are permitted');
  }
  const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'REPLACE', 'ATTACH', 'DETACH', 'VACUUM'];
  for (const word of forbidden) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(trimmed)) {
      throw new Error(`Forbidden SQL mutation keyword detected: ${word}`);
    }
  }
  if (/(^|[^:\w]):[A-Za-z_]\w*|\?|\$\d+/.test(trimmed.replace(LITERAL, "''"))) {
    throw new Error('Named parameters are not supported; write the value into the SQL');
  }
}

const DEFAULT_ROW_LIMIT = 200;

/** Keeps a careless SELECT from returning the whole database into the model's context. */
export function withDefaultLimit(sql: string): string {
  const bare = sql.trim().replace(/;+\s*$/, '');
  if (!/^(SELECT|WITH)\b/i.test(bare) || /\blimit\b/i.test(bare.replace(LITERAL, "''"))) return bare;
  return `${bare} LIMIT ${DEFAULT_ROW_LIMIT}`;
}

/** The first table a query reads, used to list its real columns when a column name was guessed wrong. */
export function tableNameOf(sql: string): string | null {
  return /\bFROM\s+["`]?(\w+)["`]?/i.exec(sql)?.[1] ?? null;
}

async function columnHint(prisma: PrismaClient, sql: string, detail: string): Promise<string> {
  const table = tableNameOf(sql);
  if (!table || !/no such column/i.test(detail)) return '';
  try {
    const columns = await prisma.$queryRawUnsafe<TableInfoRow[]>(`PRAGMA table_info("${table}")`);
    return ` Columns of ${table}: ${columns.map((c) => c.name).join(', ')}.`;
  } catch {
    return '';
  }
}

/** Formats long strings or huge JSON payloads smartly for readability and token efficiency. */
export function formatSmartValue(val: unknown, maxLen = 160): unknown {
  if (typeof val !== 'string' || val.length <= maxLen) return val;
  if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
    try {
      const parsed = JSON.parse(val) as Record<string, unknown> | unknown[];
      const isArr = Array.isArray(parsed);
      const count = isArr ? parsed.length : Object.keys(parsed).length;
      return `${val.slice(0, 80)}... [JSON ${isArr ? 'array' : 'object'}: ${count} entries, ${val.length} chars]`;
    } catch {
      // Not valid JSON, fall through to text truncation
    }
  }
  return `${val.slice(0, maxLen - 20)}... [${val.length} chars]`;
}

/** Sorts object keys deterministically and applies smart value formatting. */
export function formatSmartRow(row: Record<string, unknown>, rawStrings = false): Record<string, unknown> {
  const sortedKeys = Object.keys(row).sort();
  const out: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    out[k] = rawStrings ? row[k] : formatSmartValue(row[k]);
  }
  return out;
}

const LIST_TOPICS_SQL = `SELECT c.id AS course, w.week_key AS week, t.section AS section, t.topic_id AS topic_id,
  json_extract(t.title, '$.en') AS title, CASE WHEN t.scene IS NULL THEN 0 ELSE 1 END AS has_scene
  FROM topics t JOIN weeks w ON w.id = t.week_id JOIN courses c ON c.id = w.course_id`;

export function createSqliteTools(prisma: PrismaClient = new PrismaClient()) {
  return {
    async listTopics(args: Record<string, unknown>): Promise<unknown> {
      const courseId = typeof args.course_id === 'string' && args.course_id ? args.course_id : null;
      const where = courseId ? ' WHERE c.id = ?' : '';
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `${LIST_TOPICS_SQL}${where} ORDER BY c.id, w.week_key, t.section, t.topic_id`,
        ...(courseId ? [courseId] : [])
      );
      return { topics: rows, count: Array.isArray(rows) ? rows.length : 0 };
    },

    async queryCourseDb(args: Record<string, unknown>): Promise<unknown> {
      const sql = String(args.sql || '').trim();
      const rawStrings = Boolean(args.rawStrings);
      validateReadOnlySql(sql);
      try {
        const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(withDefaultLimit(sql));
        const formatted = Array.isArray(rows)
          ? rows.map((r) => (r && typeof r === 'object' ? formatSmartRow(r, rawStrings) : r))
          : [];
        return { rows: formatted, count: formatted.length };
      } catch (err) {
        const detail = (err instanceof Error ? err.message.trim().split(/\r?\n/).pop() : String(err)) ?? '';
        const hint = await columnHint(prisma, sql, detail);
        throw new Error(
          `${detail}${hint} — call show_database_tables for the exact table and column names (SQL columns are snake_case, and not every table has every id: join through foreign keys, e.g. topics -> weeks via week_id -> courses via course_id).`
        );
      }
    },

    async describeDbSchema(): Promise<unknown> {
      const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'"
      );
      const tableNames = (Array.isArray(tables) ? tables.map((t) => t.name) : []).sort();
      const schema: Record<string, string[]> = {};
      const relations: string[] = [];
      for (const t of tableNames) {
        const keys = await prisma.$queryRawUnsafe<ForeignKeyRow[]>(`PRAGMA foreign_key_list("${t}")`);
        for (const k of Array.isArray(keys) ? keys : []) relations.push(`${t}.${k.from} -> ${k.table}.${k.to}`);
        const columns = await prisma.$queryRawUnsafe<TableInfoRow[]>(`PRAGMA table_info("${t}")`);
        schema[t] = (Array.isArray(columns) ? columns : []).map(describeColumn);
      }
      relations.sort();
      return { tables: tableNames, schema, relations };
    },
  };
}
