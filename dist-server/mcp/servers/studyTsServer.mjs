// server/mcp/servers/studyTsServer.ts
import path4 from "path";
import { pathToFileURL } from "url";
import { PrismaClient as PrismaClient2 } from "@prisma/client";

// server/mcp/servers/BaseMcpServer.ts
import readline from "readline";
var MethodNotFound = class extends Error {
};
var BaseMcpServer = class {
  start() {
    const rl = readline.createInterface({ input: process.stdin, terminal: false });
    rl.on("line", (line) => this.handleLine(line));
  }
  async handleLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch (parseErr) {
      process.stderr.write(`Fatal JSON parse error: ${String(parseErr)}
`);
      return;
    }
    if (msg.id === void 0 || msg.id === null) return;
    try {
      this.sendResponse(msg.id, await this.route(msg));
    } catch (err) {
      const code = err instanceof MethodNotFound ? -32601 : -32603;
      this.sendResponse(msg.id, void 0, { code, message: err instanceof Error ? err.message : String(err) });
    }
  }
  /** The JSON-RPC result for a request; throws MethodNotFound for methods this server does not speak. */
  async route(msg) {
    switch (msg.method) {
      case "initialize":
        return {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: this.serverName, version: this.serverVersion }
        };
      case "tools/list":
        return { tools: this.tools };
      case "tools/call": {
        const output = await this.handleToolCall(msg.params?.name, msg.params?.arguments || {});
        return { content: [{ type: "text", text: JSON.stringify(output, (_key, value) => typeof value === "bigint" ? Number(value) : value) }] };
      }
      case "ping":
        return {};
      default:
        throw new MethodNotFound(`Method not found: ${msg.method}`);
    }
  }
  sendResponse(id, result, error) {
    const res = { jsonrpc: "2.0", id, ...error ? { error } : { result } };
    process.stdout.write(JSON.stringify(res) + "\n");
  }
};

// server/mcp/servers/notebookTools.ts
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
var DEFAULT_LIMIT = 5;
function matches(snippet, query) {
  return snippet.title.toLowerCase().includes(query) || snippet.content.toLowerCase().includes(query) || Boolean(snippet.tags?.some((t) => t.toLowerCase().includes(query)));
}
function createNotebookTools(notebooksDir) {
  const fileOf = (id) => path.join(notebooksDir, `${id}.json`);
  async function getNotebook(notebookId = "default") {
    await fs.mkdir(notebooksDir, { recursive: true });
    const file = fileOf(notebookId);
    if (!fsSync.existsSync(file)) {
      const initial = { id: notebookId, title: `Notebook: ${notebookId}`, snippets: [], updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await fs.writeFile(file, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    return JSON.parse(await fs.readFile(file, "utf-8"));
  }
  async function saveNotebook(nb) {
    await fs.mkdir(notebooksDir, { recursive: true });
    nb.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await fs.writeFile(fileOf(nb.id), JSON.stringify(nb, null, 2), "utf-8");
  }
  async function* eachNotebook() {
    await fs.mkdir(notebooksDir, { recursive: true });
    for (const f of await fs.readdir(notebooksDir)) {
      if (!f.endsWith(".json")) continue;
      try {
        yield JSON.parse(await fs.readFile(path.join(notebooksDir, f), "utf-8"));
      } catch (err) {
        process.stderr.write(`Error reading notebook ${f}: ${String(err)}
`);
      }
    }
  }
  async function sendSnippet(args) {
    const nbId = typeof args.notebookId === "string" && args.notebookId ? args.notebookId : "default";
    const nb = await getNotebook(nbId);
    const snippet = {
      id: `snip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: String(args.title || "Untitled Snippet"),
      content: String(args.content || ""),
      tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    nb.snippets.push(snippet);
    await saveNotebook(nb);
    return { success: true, message: `Saved snippet to notebook '${nbId}'`, snippetId: snippet.id };
  }
  async function querySources(args) {
    const query = String(args.query || "").toLowerCase();
    const limit = Number(args.limit) || DEFAULT_LIMIT;
    const results = [];
    for await (const nb of eachNotebook()) {
      for (const snippet of nb.snippets.filter((s) => matches(s, query))) {
        results.push({ notebookId: nb.id, snippet });
        if (results.length >= limit) return { results, totalFound: results.length };
      }
    }
    return { results, totalFound: results.length };
  }
  async function listNotebooks() {
    const notebooks = [];
    for await (const nb of eachNotebook()) {
      notebooks.push({ id: nb.id, title: nb.title, snippetCount: nb.snippets.length, updatedAt: nb.updatedAt });
    }
    return { notebooks };
  }
  return { sendSnippet, querySources, listNotebooks };
}

// server/mcp/servers/sqliteTools.ts
import { PrismaClient } from "@prisma/client";
var SQLITE_TOOLS = [
  {
    name: "read_course_database",
    description: "Executes a read-only SELECT query on the course database. Automatically limits to 200 rows and previews long strings/JSON (pass rawStrings: true for full text).",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SELECT SQL query" },
        rawStrings: { type: "boolean", description: "Disable string truncation for raw values" }
      },
      required: ["sql"]
    }
  },
  {
    name: "show_database_tables",
    description: "Returns sorted database tables, column definitions (PK, NOT NULL), and foreign key relations.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "list_lectures",
    description: "Lists topics (week, section, topic_id, title, canvas status) sorted by course hierarchy.",
    inputSchema: {
      type: "object",
      properties: {
        course_id: { type: "string", description: "Optional course id filter (e.g. computer-networking)" }
      }
    }
  }
];
function describeColumn(c) {
  const flags = [Number(c.pk) > 0 ? "PK" : "", Number(c.notnull) > 0 ? "NOT NULL" : ""].filter(Boolean).join(" ");
  return `${c.name} ${c.type}${flags ? ` ${flags}` : ""}`;
}
var LITERAL = /'(?:[^']|'')*'|"(?:[^"]|"")*"/g;
function validateReadOnlySql(sql) {
  const trimmed = sql.trim();
  const normalized2 = trimmed.toUpperCase();
  if (!normalized2.startsWith("SELECT") && !normalized2.startsWith("WITH") && !normalized2.startsWith("PRAGMA TABLE_INFO")) {
    throw new Error("Only read-only SELECT queries are permitted");
  }
  const forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "REPLACE", "ATTACH", "DETACH", "VACUUM"];
  for (const word of forbidden) {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(trimmed)) {
      throw new Error(`Forbidden SQL mutation keyword detected: ${word}`);
    }
  }
  if (/(^|[^:\w]):[A-Za-z_]\w*|\?|\$\d+/.test(trimmed.replace(LITERAL, "''"))) {
    throw new Error("Named parameters are not supported; write the value into the SQL");
  }
}
var DEFAULT_ROW_LIMIT = 200;
function withDefaultLimit(sql) {
  const bare = sql.trim().replace(/;+\s*$/, "");
  if (!/^(SELECT|WITH)\b/i.test(bare) || /\blimit\b/i.test(bare.replace(LITERAL, "''"))) return bare;
  return `${bare} LIMIT ${DEFAULT_ROW_LIMIT}`;
}
function tableNameOf(sql) {
  return /\bFROM\s+["`]?(\w+)["`]?/i.exec(sql)?.[1] ?? null;
}
async function columnHint(prisma, sql, detail) {
  const table = tableNameOf(sql);
  if (!table || !/no such column/i.test(detail)) return "";
  try {
    const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
    return ` Columns of ${table}: ${columns.map((c) => c.name).join(", ")}.`;
  } catch {
    return "";
  }
}
function formatSmartValue(val, maxLen = 160) {
  if (typeof val !== "string" || val.length <= maxLen) return val;
  if (val.startsWith("{") && val.endsWith("}") || val.startsWith("[") && val.endsWith("]")) {
    try {
      const parsed = JSON.parse(val);
      const isArr = Array.isArray(parsed);
      const count = isArr ? parsed.length : Object.keys(parsed).length;
      return `${val.slice(0, 80)}... [JSON ${isArr ? "array" : "object"}: ${count} entries, ${val.length} chars]`;
    } catch {
    }
  }
  return `${val.slice(0, maxLen - 20)}... [${val.length} chars]`;
}
function formatSmartRow(row, rawStrings = false) {
  const sortedKeys = Object.keys(row).sort();
  const out = {};
  for (const k of sortedKeys) {
    out[k] = rawStrings ? row[k] : formatSmartValue(row[k]);
  }
  return out;
}
var LIST_TOPICS_SQL = `SELECT c.id AS course, w.week_key AS week, t.section AS section, t.topic_id AS topic_id,
  json_extract(t.title, '$.en') AS title, CASE WHEN t.scene IS NULL THEN 0 ELSE 1 END AS has_scene
  FROM topics t JOIN weeks w ON w.id = t.week_id JOIN courses c ON c.id = w.course_id`;
function createSqliteTools(prisma = new PrismaClient()) {
  return {
    async listTopics(args) {
      const courseId = typeof args.course_id === "string" && args.course_id ? args.course_id : null;
      const where = courseId ? " WHERE c.id = ?" : "";
      const rows = await prisma.$queryRawUnsafe(
        `${LIST_TOPICS_SQL}${where} ORDER BY c.id, w.week_key, t.section, t.topic_id`,
        ...courseId ? [courseId] : []
      );
      return { topics: rows, count: Array.isArray(rows) ? rows.length : 0 };
    },
    async queryCourseDb(args) {
      const sql = String(args.sql || "").trim();
      const rawStrings = Boolean(args.rawStrings);
      validateReadOnlySql(sql);
      try {
        const rows = await prisma.$queryRawUnsafe(withDefaultLimit(sql));
        const formatted = Array.isArray(rows) ? rows.map((r) => r && typeof r === "object" ? formatSmartRow(r, rawStrings) : r) : [];
        return { rows: formatted, count: formatted.length };
      } catch (err) {
        const detail = (err instanceof Error ? err.message.trim().split(/\r?\n/).pop() : String(err)) ?? "";
        const hint = await columnHint(prisma, sql, detail);
        throw new Error(
          `${detail}${hint} \u2014 call show_database_tables for the exact table and column names (SQL columns are snake_case, and not every table has every id: join through foreign keys, e.g. topics -> weeks via week_id -> courses via course_id).`
        );
      }
    },
    async describeDbSchema() {
      const tables = await prisma.$queryRawUnsafe(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'"
      );
      const tableNames = (Array.isArray(tables) ? tables.map((t) => t.name) : []).sort();
      const schema = {};
      const relations = [];
      for (const t of tableNames) {
        const keys = await prisma.$queryRawUnsafe(`PRAGMA foreign_key_list("${t}")`);
        for (const k of Array.isArray(keys) ? keys : []) relations.push(`${t}.${k.from} -> ${k.table}.${k.to}`);
        const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info("${t}")`);
        schema[t] = (Array.isArray(columns) ? columns : []).map(describeColumn);
      }
      relations.sort();
      return { tables: tableNames, schema, relations };
    }
  };
}

// server/mcp/servers/courseAuthorTools.ts
import fs2 from "fs/promises";
import fsSync2 from "fs";
import path2 from "path";

// src/core/shared/languageDefaults.ts
var FALLBACK_LANGUAGE = "en";
var LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(-[A-Z]{2})?$/;

// src/i18n/localizedValue.ts
function isLocalizedValue(v) {
  if (typeof v === "string") return true;
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const record = v;
  return typeof record[FALLBACK_LANGUAGE] === "string" && Object.values(record).every((value) => typeof value === "string");
}
var DEFAULT_LANGUAGES = [
  { id: "he", code: "he", label: "\u05E2\u05D1\u05E8\u05D9\u05EA (HE)", nativeName: "\u05E2\u05D1\u05E8\u05D9\u05EA", flag: "\u{1F1EE}\u{1F1F1}", direction: "rtl" },
  { id: "en", code: "en", label: "English (EN)", nativeName: "English", flag: "\u{1F1FA}\u{1F1F8}", direction: "ltr" }
];
var languageCatalog = [...DEFAULT_LANGUAGES];

// src/core/validation/topicJsonSchema.ts
function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function validateCatalogJson(raw) {
  if (!isObject(raw)) return { valid: false, error: "Catalog must be an object keyed by weekKey" };
  for (const [weekKey, week] of Object.entries(raw)) {
    if (!isObject(week)) return { valid: false, error: `Week "${weekKey}" is not an object` };
    if (!isLocalizedValue(week.title)) return { valid: false, error: `Week "${weekKey}" has invalid title` };
    if (!Array.isArray(week.lectures) || !Array.isArray(week.practice)) {
      return { valid: false, error: `Week "${weekKey}" missing lectures or practice array` };
    }
  }
  return { valid: true, catalog: raw };
}
function validateSceneJson(raw) {
  if (!isObject(raw)) return { valid: false, error: "Scene must be an object" };
  if (typeof raw.id !== "string") return { valid: false, error: "Scene missing string id" };
  if (!Array.isArray(raw.blocks)) return { valid: false, error: "Scene missing blocks array" };
  if ("backgroundPattern" in raw && raw.backgroundPattern !== void 0) {
    const validPatterns = ["dots", "grid", "isometric", "blueprint", "mesh", "blank"];
    if (typeof raw.backgroundPattern !== "string" || !validPatterns.includes(raw.backgroundPattern)) {
      return { valid: false, error: `Invalid background pattern: ${raw.backgroundPattern}` };
    }
  }
  return { valid: true, scene: raw };
}

// src/core/validation/blocks/validBlockKinds.ts
var VALID_BLOCK_KINDS = /* @__PURE__ */ new Set([
  "pdf",
  "image",
  "video",
  "youtube",
  "richText",
  "box",
  "graph",
  "automata",
  "stepPlayer",
  "connector",
  "shape",
  "data"
]);

// src/core/validation/sceneNodes/validateSceneNodes.ts
function buildBlockMap(blocks) {
  const blockMap = /* @__PURE__ */ new Map();
  if (Array.isArray(blocks)) {
    for (const raw of blocks) {
      if (raw && typeof raw === "object" && typeof raw.id === "string") {
        const b = raw;
        blockMap.set(b.id, b);
      }
    }
  }
  return blockMap;
}
function validateTextNode(id, n) {
  if (!isLocalizedValue(n.body)) {
    return `Node "${id}" (text): requires "body" as string or { he, en }`;
  }
  return null;
}
function validateBlockRefNode(id, n, ctx) {
  if (typeof n.blockId !== "string") {
    return `Node "${id}" (blockRef): requires string "blockId"`;
  }
  if (n.blockId === id) {
    return `Node "${id}" (blockRef): cannot reference itself`;
  }
  const targetExists = ctx.blockMap.has(n.blockId) || ctx.nodeIds.has(n.blockId);
  if (ctx.blocks && !targetExists) {
    return `Node "${id}" (blockRef): blockId "${n.blockId}" does not match any block or node in this scene`;
  }
  return null;
}
function validateBoxNode(id, n, ctx) {
  if (!Array.isArray(n.childIds) || !n.childIds.every((cid) => typeof cid === "string")) {
    return `Node "${id}" (box): requires "childIds" as string[]`;
  }
  for (const cid of n.childIds) {
    if (!ctx.nodeIds.has(cid) && !ctx.blockMap.has(cid)) {
      return `Node "${id}" (box): childId "${cid}" does not exist in scene.nodes`;
    }
    if (cid === id) {
      return `Node "${id}" (box): cannot contain itself as a child`;
    }
  }
  return null;
}
function validateOneNode(id, rawNode, ctx) {
  if (!rawNode || typeof rawNode !== "object") {
    return `Node "${id}" is not an object`;
  }
  const n = rawNode;
  if (typeof n.id !== "string") {
    return `Node "${id}" is missing a string "id"`;
  }
  if (n.id !== id) {
    return `Node key "${id}" does not match node.id "${n.id}"`;
  }
  if (n.kind !== "text" && n.kind !== "blockRef" && n.kind !== "box") {
    return `Node "${id}" has invalid kind "${n.kind}". Valid node kinds: text, blockRef, box`;
  }
  if (n.kind === "text") return validateTextNode(id, n);
  if (n.kind === "blockRef") return validateBlockRefNode(id, n, ctx);
  return validateBoxNode(id, n, ctx);
}
function validateNodeStructure(ctx) {
  for (const [id, rawNode] of Object.entries(ctx.nodeMap)) {
    const error = validateOneNode(id, rawNode, ctx);
    if (error) return error;
  }
  return null;
}
function makeGetChildren(ctx) {
  return (containerId) => {
    const fromBlock = ctx.blockMap.get(containerId);
    if (fromBlock && fromBlock.kind === "box" && Array.isArray(fromBlock.childIds)) {
      return fromBlock.childIds;
    }
    const fromNode = ctx.nodeMap[containerId];
    if (fromNode && fromNode.kind === "box" && Array.isArray(fromNode.childIds)) {
      return fromNode.childIds;
    }
    return [];
  };
}
function checkBoxCycles(ctx, getChildren) {
  const checkCycle = (currentId, visitedPath) => {
    if (visitedPath.includes(currentId)) {
      return `Circular reference detected in box nesting: ${[...visitedPath, currentId].join(" -> ")}`;
    }
    const children = getChildren(currentId);
    for (const childId of children) {
      const err = checkCycle(childId, [...visitedPath, currentId]);
      if (err) return err;
    }
    return null;
  };
  for (const [bId, b] of ctx.blockMap.entries()) {
    if (b.kind === "box") {
      const err = checkCycle(bId, []);
      if (err) return err;
    }
  }
  for (const [nId, rawNode] of Object.entries(ctx.nodeMap)) {
    const n = rawNode;
    if (n.kind === "box") {
      const err = checkCycle(nId, []);
      if (err) return err;
    }
  }
  return null;
}
function checkBlockRefAncestorCycles(ctx, getChildren) {
  const checkContains = (ancestorId, targetId) => {
    const children = getChildren(ancestorId);
    if (children.includes(targetId)) return true;
    return children.some((cid) => checkContains(cid, targetId));
  };
  for (const [nId, rawNode] of Object.entries(ctx.nodeMap)) {
    const n = rawNode;
    if (n.kind === "blockRef" && typeof n.blockId === "string") {
      if (checkContains(n.blockId, nId)) {
        return `Circular reference: blockRef "${nId}" references ancestor box "${n.blockId}"`;
      }
    }
  }
  return null;
}
function markReachableFromBoxBlocks(blocks, markReachable) {
  const boxes = blocks.filter((raw) => !!raw && typeof raw === "object" && raw.kind === "box");
  for (const box of boxes) {
    if (!Array.isArray(box.childIds)) continue;
    for (const cid of box.childIds) markReachable(cid);
  }
  return boxes.length > 0;
}
function checkReachability(ctx, getChildren) {
  if (!Array.isArray(ctx.blocks) || ctx.nodeIds.size === 0) return null;
  const reachable = /* @__PURE__ */ new Set();
  const markReachable = (id) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const cid of getChildren(id)) {
      markReachable(cid);
    }
  };
  const hasBoxBlocks = markReachableFromBoxBlocks(ctx.blocks, markReachable);
  if (!hasBoxBlocks) return null;
  for (const nid of ctx.nodeIds) {
    if (!reachable.has(nid)) {
      return `Unreachable orphan node "${nid}" in scene.nodes`;
    }
  }
  return null;
}
function validateSceneNodes(nodes, blocks) {
  if (nodes === void 0 || nodes === null) return null;
  if (typeof nodes !== "object" || Array.isArray(nodes)) {
    return "Scene nodes must be an object map";
  }
  const nodeMap = nodes;
  const ctx = {
    nodeMap,
    nodeIds: new Set(Object.keys(nodeMap)),
    blockMap: buildBlockMap(blocks),
    blocks
  };
  const structureError = validateNodeStructure(ctx);
  if (structureError) return structureError;
  const getChildren = makeGetChildren(ctx);
  const boxCycleError = checkBoxCycles(ctx, getChildren);
  if (boxCycleError) return boxCycleError;
  const blockRefCycleError = checkBlockRefAncestorCycles(ctx, getChildren);
  if (blockRefCycleError) return blockRefCycleError;
  return checkReachability(ctx, getChildren);
}

// src/core/canvasBlocks/networkDevices.ts
var NETWORK_DEVICES = ["router", "switch", "firewall", "server", "pc", "cloud", "hub", "database"];
var isNetworkDevice = (value) => typeof value === "string" && NETWORK_DEVICES.includes(value);
var DEVICE_SIZE_PX = {
  router: { width: 72, height: 72 },
  switch: { width: 88, height: 40 },
  firewall: { width: 72, height: 56 },
  server: { width: 60, height: 72 },
  pc: { width: 72, height: 60 },
  cloud: { width: 104, height: 64 },
  hub: { width: 80, height: 36 },
  database: { width: 60, height: 68 }
};
var SHAPE_BLOCK_SHAPES = ["circle", "rect", "diamond", ...NETWORK_DEVICES];

// src/core/validation/blocks/validateBlocks.ts
function validateRichTextBlock(b, index) {
  if (!isLocalizedValue(b.body)) {
    return `Block ${index} ("${b.id}"): richText requires "body" as string or { he: string, en: string } \u2014 got ${JSON.stringify(b.body)}`;
  }
  return null;
}
function validateBoxBlock(b, index, nodes) {
  if (!Array.isArray(b.childIds) || !b.childIds.every((cid) => typeof cid === "string")) {
    return `Block ${index} ("${b.id}"): box requires "childIds" as string[]`;
  }
  if (nodes && typeof nodes === "object" && !Array.isArray(nodes)) {
    const nodeMap = nodes;
    for (const cid of b.childIds) {
      if (!nodeMap[cid]) {
        return `Block ${index} ("${b.id}"): box childId "${cid}" does not exist in scene.nodes`;
      }
    }
  }
  return null;
}
function validateGraphBlock(b, index) {
  const state = b.state;
  if (!state || typeof state !== "object") {
    return `Block ${index} ("${b.id}"): graph requires a "state" object (not top-level fields)`;
  }
  if (!Array.isArray(state.nodes) || !Array.isArray(state.edges)) {
    return `Block ${index} ("${b.id}"): graph "state" requires "nodes" and "edges" arrays`;
  }
  return validateGraphDevices(b, state, index);
}
function validateGraphDevices(b, state, index) {
  for (const node of state.nodes) {
    if (node?.device !== void 0 && !isNetworkDevice(node.device)) {
      return `Block ${index} ("${b.id}"): graph node "${node.id}" has device ${JSON.stringify(node.device)}; use one of: ${NETWORK_DEVICES.join(", ")}`;
    }
  }
  if (state.zones !== void 0 && !Array.isArray(state.zones)) return `Block ${index} ("${b.id}"): graph "zones" must be an array`;
  return null;
}
function validateAutomataBlock(b, index) {
  const state = b.state;
  if (!state || typeof state !== "object") {
    return `Block ${index} ("${b.id}"): automata requires a "state" object \u2014 a display snapshot with tape/headPosition/currentState/status/stepCount, not a transition-table definition`;
  }
  if (!Array.isArray(state.tape)) {
    return `Block ${index} ("${b.id}"): automata "state" requires "tape" as an array (not a string, not "states"/"transitions")`;
  }
  if (typeof state.headPosition !== "number") {
    return `Block ${index} ("${b.id}"): automata "state" requires numeric "headPosition" (not "head")`;
  }
  if (typeof state.currentState !== "string") {
    return `Block ${index} ("${b.id}"): automata "state" requires string "currentState" (not "startState")`;
  }
  if (!["running", "accepted", "rejected", "looping"].includes(state.status)) {
    return `Block ${index} ("${b.id}"): automata "state" requires "status" to be one of running/accepted/rejected/looping (not "halted")`;
  }
  if (typeof state.stepCount !== "number") {
    return `Block ${index} ("${b.id}"): automata "state" requires numeric "stepCount"`;
  }
  return null;
}
function validateMediaSrcBlock(b, index) {
  if (typeof b.src !== "string") return `Block ${index} ("${b.id}"): ${b.kind} requires a string "src"`;
  return null;
}
function validateYoutubeBlock(b, index) {
  if (typeof b.videoId !== "string") return `Block ${index} ("${b.id}"): youtube requires a string "videoId"`;
  return null;
}
function validateStepPlayerBlock(b, index) {
  if (!Array.isArray(b.steps) || b.steps.length === 0) {
    return `Block ${index} ("${b.id}"): stepPlayer requires a non-empty "steps" array`;
  }
  for (const [si, rawStep] of b.steps.entries()) {
    const step = rawStep;
    if (!isLocalizedValue(step?.whatChanged) || !isLocalizedValue(step?.why)) {
      return `Block ${index} ("${b.id}"), step ${si}: requires "whatChanged" and "why" as string or { he, en } (not "narration"/"description")`;
    }
  }
  return null;
}
function hasCircularReference(v, seen) {
  if (v !== null && typeof v === "object") {
    if (seen.has(v)) return true;
    seen.add(v);
    for (const child of Array.isArray(v) ? v : Object.values(v)) {
      if (hasCircularReference(child, seen)) return true;
    }
  }
  return false;
}
function validateDataBlockJson(b, index) {
  if ("data" in b && hasCircularReference(b.data, /* @__PURE__ */ new WeakSet())) {
    return `Block ${index} ("${b.id}"): data.json contains circular references`;
  }
  return null;
}
function validateDataBlockTable(b, index) {
  const cols = Array.isArray(b.columns) ? b.columns.length : 0;
  if (Array.isArray(b.rows)) {
    for (let r = 0; r < b.rows.length; r++) {
      const rowCells = b.rows[r].length;
      if (rowCells !== cols && cols > 0) {
        return `Block ${index} ("${b.id}"): data.table row ${r} has ${rowCells} cells, expected ${cols}`;
      }
    }
  }
  return null;
}
function validateDataBlock(b, index) {
  const fmt = b.format;
  if (fmt !== "table" && fmt !== "json") {
    return `Block ${index} ("${b.id}"): data requires format 'table' | 'json', got ${JSON.stringify(fmt)}`;
  }
  if (fmt === "json") return validateDataBlockJson(b, index);
  return validateDataBlockTable(b, index);
}
function validateConnectorBlock(b, index) {
  if (typeof b.fromBlockId !== "string" || typeof b.toBlockId !== "string") {
    return `Block ${index} ("${b.id}"): connector requires string "fromBlockId" and "toBlockId"`;
  }
  return null;
}
function validateShapeBlock(b, index) {
  if (!SHAPE_BLOCK_SHAPES.includes(b.shape)) {
    return `Block ${index} ("${b.id}"): shape requires "shape" to be one of ${SHAPE_BLOCK_SHAPES.join("/")}, got ${JSON.stringify(b.shape)}`;
  }
  if (typeof b.label !== "string") {
    return `Block ${index} ("${b.id}"): shape requires a string "label"`;
  }
  return null;
}
var KIND_VALIDATORS = {
  richText: validateRichTextBlock,
  box: validateBoxBlock,
  graph: validateGraphBlock,
  automata: validateAutomataBlock,
  pdf: validateMediaSrcBlock,
  image: validateMediaSrcBlock,
  video: validateMediaSrcBlock,
  youtube: validateYoutubeBlock,
  stepPlayer: validateStepPlayerBlock,
  data: validateDataBlock,
  connector: validateConnectorBlock,
  shape: validateShapeBlock
};
function validateBlock(raw, index = 0, nodes) {
  const b = raw;
  if (!b || typeof b !== "object") return `Block ${index} is not an object`;
  if (typeof b.id !== "string") return `Block ${index} is missing a string "id"`;
  if (typeof b.kind !== "string" || !VALID_BLOCK_KINDS.has(b.kind)) {
    return `Block ${index} ("${b.id}") has invalid kind "${b.kind}". Valid kinds: ${[...VALID_BLOCK_KINDS].join(", ")}`;
  }
  if (![b.x, b.y, b.width, b.height].every((n) => typeof n === "number")) {
    return `Block ${index} ("${b.id}") is missing numeric x/y/width/height`;
  }
  const kind = b.kind;
  const validator = KIND_VALIDATORS[kind];
  if (!validator) {
    const _exhaustive = kind;
    return `Block ${index} ("${b.id}"): unhandled block kind "${_exhaustive}"`;
  }
  return validator(b, index, nodes);
}
function validateBlocks(blocks, nodes) {
  if (!Array.isArray(blocks)) {
    return "Blocks must be an array";
  }
  for (const [i, raw] of blocks.entries()) {
    const error = validateBlock(raw, i, nodes);
    if (error) return error;
  }
  const blockIds = new Set(blocks.map((raw) => raw.id));
  for (const [i, raw] of blocks.entries()) {
    const b = raw;
    if (b.kind !== "connector") continue;
    if (!blockIds.has(b.fromBlockId)) return `Block ${i} ("${b.id}"): connector's fromBlockId "${b.fromBlockId}" does not match any block in this scene`;
    if (!blockIds.has(b.toBlockId)) return `Block ${i} ("${b.id}"): connector's toBlockId "${b.toBlockId}" does not match any block in this scene`;
  }
  if (nodes) {
    const nodeError = validateSceneNodes(nodes, blocks);
    if (nodeError) return nodeError;
  }
  return null;
}

// src/core/visualBuilder/specMigrations.ts
var MIGRATIONS = [];
function migrateSpec(spec, migrations = MIGRATIONS) {
  let migrated = spec;
  for (const migration of migrations) {
    if ((migrated.specVersion ?? 1) === migration.from) {
      migrated = { ...migration.run(migrated), specVersion: migration.to };
    }
  }
  return migrated;
}

// src/core/visualBuilder/blocks.ts
var blocksOf = (step) => step.builder?.blocks ?? [];

// src/core/visualBuilder/builderGeometry.ts
var MIN_SIZE = 20;
var num = (value, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
var round = (value) => Math.round(value * 10) / 10;
var boxCenter = (box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
var SEGMENT_ARGS = { M: 2, L: 2, T: 2, C: 6, S: 4, Q: 4, A: 7, H: 1, V: 1, Z: 0 };
var TAU = 2 * Math.PI;
var angleBetween = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
function arcCentre(x1, y1, rxIn, ryIn, largeArc, sweep2, x2, y2) {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const lambda = dx * dx / (rx * rx) + dy * dy / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num3 = rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx;
  const den = rx * rx * dy * dy + ry * ry * dx * dx;
  const coef = (largeArc === sweep2 ? -1 : 1) * Math.sqrt(Math.max(0, num3 / den));
  const cxp = coef * rx * dy / ry;
  const cyp = -coef * ry * dx / rx;
  const ux = (dx - cxp) / rx;
  const uy = (dy - cyp) / ry;
  let dTheta = angleBetween(ux, uy, (-dx - cxp) / rx, (-dy - cyp) / ry);
  if (!sweep2 && dTheta > 0) dTheta -= TAU;
  if (sweep2 && dTheta < 0) dTheta += TAU;
  return { cx: cxp + (x1 + x2) / 2, cy: cyp + (y1 + y2) / 2, rx, ry, theta1: angleBetween(1, 0, ux, uy), dTheta };
}
function sweepCovers(arc, theta) {
  const offset = arc.dTheta >= 0 ? theta - arc.theta1 : arc.theta1 - theta;
  return (offset % TAU + TAU) % TAU <= Math.abs(arc.dTheta);
}
function arcPoints(x1, y1, rx, ry, largeArc, sweep2, x2, y2) {
  const end = { x: x2, y: y2 };
  if (rx === 0 || ry === 0) return [end];
  const arc = arcCentre(x1, y1, rx, ry, largeArc, sweep2, x2, y2);
  const extremes = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].filter((theta) => sweepCovers(arc, theta)).map((theta) => ({ x: arc.cx + arc.rx * Math.cos(theta), y: arc.cy + arc.ry * Math.sin(theta) }));
  return [end, ...extremes];
}
function segmentPoints(command, v, from, offset) {
  if (command === "H") {
    const to = { x: offset.x + v[0], y: from.y };
    return { points: [to], to };
  }
  if (command === "V") {
    const to = { x: from.x, y: offset.y + v[0] };
    return { points: [to], to };
  }
  if (command === "A") {
    const to = { x: offset.x + v[5], y: offset.y + v[6] };
    return { points: arcPoints(from.x, from.y, v[0], v[1], v[3], v[4], to.x, to.y), to };
  }
  const points = [];
  for (let i = 0; i + 1 < v.length; i += 2) points.push({ x: offset.x + v[i], y: offset.y + v[i + 1] });
  return { points, to: points[points.length - 1] ?? from };
}
function pathPoints(d) {
  const points = [];
  let at = { x: 0, y: 0 };
  for (const [, command, args] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const upper = command.toUpperCase();
    const count = SEGMENT_ARGS[upper];
    if (!count) continue;
    const values = (args.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
    const offset = command !== upper ? at : { x: 0, y: 0 };
    for (let start = 0; start + count <= values.length; start += count) {
      const segment2 = segmentPoints(upper, values.slice(start, start + count), at, offset);
      points.push(...segment2.points);
      at = segment2.to;
    }
  }
  return points;
}
function pathBounds(d) {
  const points = pathPoints(d);
  if (points.length === 0) return { x: 0, y: 0, w: MIN_SIZE, h: MIN_SIZE };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
function diamondPath(box) {
  const { x, y, w, h } = box;
  return `M ${round(x + w / 2)} ${round(y)} L ${round(x + w)} ${round(y + h / 2)} L ${round(x + w / 2)} ${round(y + h)} L ${round(x)} ${round(y + h / 2)} Z`;
}
function trianglePath(box) {
  const { x, y, w, h } = box;
  return `M ${round(x + w / 2)} ${round(y)} L ${round(x + w)} ${round(y + h)} L ${round(x)} ${round(y + h)} Z`;
}
var HEAD_STYLES = {
  open: { length: 16, halfWidth: 10, notch: 0 },
  notched: { length: 20, halfWidth: 10, notch: 15 },
  solid: { length: 16, halfWidth: 8, notch: 0 }
};
function headPath(tip, direction, style = "notched") {
  const cfg = HEAD_STYLES[style] ?? HEAD_STYLES.notched;
  const length = Math.hypot(direction.x, direction.y) || 1;
  const u = { x: direction.x / length, y: direction.y / length };
  const n = { x: -u.y, y: u.x };
  const at = (along, side) => ({ x: tip.x - u.x * along + n.x * side, y: tip.y - u.y * along + n.y * side });
  const wingA = at(cfg.length, cfg.halfWidth);
  const wingB = at(cfg.length, -cfg.halfWidth);
  const pt = (p) => `${round(p.x)} ${round(p.y)}`;
  if (style === "open") return `M ${pt(wingA)} L ${pt(tip)} L ${pt(wingB)}`;
  if (style === "notched") return `M ${pt(tip)} L ${pt(wingA)} L ${pt(at(cfg.notch, 0))} L ${pt(wingB)} Z`;
  return `M ${pt(tip)} L ${pt(wingA)} L ${pt(wingB)} Z`;
}
var arrowHead = (tip, from, style = "notched") => headPath(tip, { x: tip.x - from.x, y: tip.y - from.y }, style);
function linePath(from, to, arrow, headStyle = "notched") {
  const body = `M ${round(from.x)} ${round(from.y)} L ${round(to.x)} ${round(to.y)}`;
  return arrow ? `${body} ${arrowHead(to, from, headStyle)}` : body;
}
function pointerPath(box) {
  const { x, y, w, h } = box;
  const cx = round(x + w / 2);
  const shoulder = round(y + 20);
  const pt = (px, py) => `${round(px)} ${round(py)}`;
  return `M ${pt(cx, y + h)} L ${pt(cx, shoulder)} M ${pt(cx, y)} L ${pt(x + w, shoulder)} L ${pt(cx, y + 14)} L ${pt(x, shoulder)} Z`;
}
function elementBox(el) {
  const a = el.attrs;
  if (el.kind === "circle") {
    const r = num(a.r);
    return { x: num(a.cx) - r, y: num(a.cy) - r, w: r * 2, h: r * 2 };
  }
  if (el.kind === "ellipse") {
    const rx = num(a.rx);
    const ry = num(a.ry);
    return { x: num(a.cx) - rx, y: num(a.cy) - ry, w: rx * 2, h: ry * 2 };
  }
  if (el.kind === "path") return el.builder?.box ?? pathBounds(String(a.d ?? ""));
  return { x: num(a.x), y: num(a.y), w: num(a.width, 80), h: num(a.height, 24) };
}

// src/core/visualBuilder/builderColors.ts
var COLOR_CHOICES = [
  { name: "Blue", value: "var(--viz-blue)" },
  { name: "Purple", value: "var(--viz-purple)" },
  { name: "Cyan", value: "var(--viz-cyan)" },
  { name: "Green", value: "var(--accent-green)" },
  { name: "Yellow", value: "var(--viz-yellow)" },
  { name: "Orange", value: "var(--viz-orange)" },
  { name: "Pink", value: "var(--viz-pink)" },
  { name: "Red", value: "var(--accent-danger)" },
  { name: "Amber", value: "var(--accent)" },
  { name: "White", value: "var(--text-primary)" }
];
var DEFAULT_SHAPE_COLOR = COLOR_CHOICES[0].value;
var GLOW_ON = "drop-shadow(0 0 14px currentColor)";
var GLOW_OFF = "drop-shadow(0 0 0px currentColor)";
var DIMMED_OPACITY = 0.3;

// src/core/geometry/pathSegments.ts
var CURVE_STEPS = 16;
var COMMAND = /([MLQCZ])([^MLQCZ]*)/g;
var lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
var reduceLevel = (level, t) => level.slice(1).map((next, index) => lerp(level[index], next, t));
function bezierPoint(points, t) {
  let level = points;
  while (level.length > 1) level = reduceLevel(level, t);
  return level[0];
}
function pairs(text, dx, dy) {
  const values = (text.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  return Array.from({ length: Math.floor(values.length / 2) }, (_, i) => ({ x: values[i * 2] + dx, y: values[i * 2 + 1] + dy }));
}
function appended(command, points, from) {
  if (command !== "Q" && command !== "C") return points;
  return Array.from({ length: CURVE_STEPS }, (_, i) => bezierPoint([from, ...points], (i + 1) / CURVE_STEPS));
}
function flattenPath(d, dx = 0, dy = 0) {
  const lines = [];
  for (const [, command, rest] of d.matchAll(COMMAND)) {
    const points = pairs(rest, dx, dy);
    const line = lines[lines.length - 1];
    if (command === "M") lines.push(points.slice(0, 1));
    else if (line && command === "Z") line.push(line[0]);
    else if (line) line.push(...appended(command, points, line[line.length - 1]));
  }
  return lines.filter((line) => line.length > 1);
}
function pathSegments(d, dx = 0, dy = 0) {
  return flattenPath(d, dx, dy).flatMap((line) => line.slice(1).map((point, i) => [line[i].x, line[i].y, point.x, point.y]));
}
function pointAtFraction(points, fraction) {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  const lengths = points.slice(1).map((point, i) => Math.hypot(point.x - points[i].x, point.y - points[i].y));
  const target = Math.max(0, Math.min(1, fraction)) * lengths.reduce((sum, length) => sum + length, 0);
  let travelled = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    if (travelled + lengths[i] >= target && lengths[i] > 0) return lerp(points[i], points[i + 1], (target - travelled) / lengths[i]);
    travelled += lengths[i];
  }
  return points[points.length - 1];
}
var pointsAlong = (points, count) => Array.from({ length: count + 1 }, (_, i) => pointAtFraction(points, i / count));

// src/core/shared/stageSize.ts
var DEFAULT_STAGE = { w: 800, h: 520 };
function parseViewBox(viewBox, fallback = DEFAULT_STAGE) {
  const [, , w, h] = viewBox.trim().split(/\s+/).map(Number);
  return { w: w > 0 ? w : fallback.w, h: h > 0 ? h : fallback.h };
}

// src/core/visualBuilder/effectOverlays.ts
var OVERLAY_ACTIONS = ["flow", "spark", "frame", "sweep", "callout"];
var SWITCHED_OFF_ACTIONS = [...OVERLAY_ACTIONS, "travel"];
var LINK_OVERLAY_ACTIONS = ["flow", "spark", "callout", "travel"];
var SWEEP_BAR_SHARE = 0.22;
var CALLOUT_W = 160;
var CALLOUT_H = 56;
var CALLOUT_GAP = 8;
var TOKEN_RADIUS = 9;
var ZIG_STEP_PX = 14;
var ZIG_AMPLITUDE = 7;
var FRAME_GAP = 9;
var overlayId = (action, target) => `fx-${action}-${target}`;
var shaftOf = (spec, linkId) => flattenPath(String(spec.elements.find((el) => el.id === linkId)?.attrs.d ?? ""))[0] ?? [];
function zigzagPoints(shaft) {
  const length = shaft.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - shaft[i].x, point.y - shaft[i].y), 0);
  const along = pointsAlong(shaft, Math.max(6, Math.round(length / ZIG_STEP_PX)));
  return along.map((point, i) => {
    if (i === 0 || i === along.length - 1) return point;
    const ahead = along[i + 1];
    const behind = along[i - 1];
    const span = Math.hypot(ahead.x - behind.x, ahead.y - behind.y) || 1;
    const side = (i % 2 === 0 ? 1 : -1) * ZIG_AMPLITUDE;
    return { x: point.x - (ahead.y - behind.y) / span * side, y: point.y + (ahead.x - behind.x) / span * side };
  });
}
var polylineD = (points) => points.map((p, i) => `${i === 0 ? "M" : "L"} ${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`).join(" ");
var shaftD = (spec, linkId) => String(spec.elements.find((el) => el.id === linkId)?.attrs.d ?? "").split(" M ")[0];
var fxBuilder = { fx: true };
var flowOverlay = (spec, target) => ({
  id: overlayId("flow", target),
  kind: "path",
  attrs: { d: shaftD(spec, target) },
  style: { fill: "none", stroke: "var(--viz-blue)", strokeWidth: 4, strokeDasharray: "8 10", strokeDashoffset: 0, opacity: 0 },
  builder: fxBuilder
});
var sparkOverlay = (spec, target) => ({
  id: overlayId("spark", target),
  kind: "path",
  attrs: { d: polylineD(zigzagPoints(shaftOf(spec, target))), pathLength: 1 },
  style: { fill: "none", stroke: "var(--viz-orange)", strokeWidth: 3, strokeDasharray: 1, strokeDashoffset: 1, opacity: 0 },
  builder: fxBuilder
});
var frameOverlay = (spec, target) => {
  const box = elementBox(spec.elements.find((el) => el.id === target));
  return {
    id: overlayId("frame", target),
    kind: "rect",
    attrs: { x: box.x - FRAME_GAP, y: box.y - FRAME_GAP, width: box.w + FRAME_GAP * 2, height: box.h + FRAME_GAP * 2, rx: 10 },
    style: { fill: "none", stroke: "var(--viz-orange)", strokeWidth: 2.5, strokeDasharray: "3 4 8 4", strokeDashoffset: 0, opacity: 0 },
    builder: fxBuilder
  };
};
var targetBox = (spec, target) => elementBox(spec.elements.find((el) => el.id === target));
var sweepOverlay = (spec, target) => {
  const box = targetBox(spec, target);
  return {
    id: overlayId("sweep", target),
    kind: "rect",
    attrs: { x: box.x, y: box.y, width: Math.max(8, Math.round(box.w * SWEEP_BAR_SHARE)), height: box.h },
    style: { fill: "var(--text-primary)", opacity: 0 },
    builder: fxBuilder
  };
};
var calloutOverlay = (spec, target, block) => {
  const box = targetBox(spec, target);
  const view = parseViewBox(spec.viewBox);
  const above = box.y - CALLOUT_H - CALLOUT_GAP;
  const x = Math.min(Math.max(0, Math.round(box.x + box.w / 2 - CALLOUT_W / 2)), Math.max(0, view.w - CALLOUT_W));
  return {
    id: overlayId("callout", target),
    kind: "bubble",
    attrs: { x, y: above >= 0 ? above : box.y + box.h + CALLOUT_GAP, width: CALLOUT_W, height: CALLOUT_H },
    style: { opacity: 0, "--bubble-color": "var(--accent)" },
    content: block.text ?? "",
    builder: fxBuilder
  };
};
var OVERLAY_MAKERS = { flow: flowOverlay, spark: sparkOverlay, frame: frameOverlay, sweep: sweepOverlay, callout: calloutOverlay };
function tokenOverlay(spec, linkId) {
  const start = shaftOf(spec, linkId)[0] ?? { x: 0, y: 0 };
  return {
    id: overlayId("travel", linkId),
    kind: "circle",
    attrs: { cx: start.x, cy: start.y, r: TOKEN_RADIUS },
    style: { fill: "var(--viz-orange)", stroke: "var(--bg-secondary)", strokeWidth: 2, opacity: 0 },
    builder: { fx: true, name: "Token" }
  };
}
var MAKERS_BY_ACTION = { ...OVERLAY_MAKERS, travel: tokenOverlay };
function overlayIdsOfLink(spec, linkId) {
  return LINK_OVERLAY_ACTIONS.map((action) => overlayId(action, linkId)).filter((id) => spec.elements.some((el) => el.id === id));
}

// src/i18n/mergeLocales.ts
function mergeLocales(en, he) {
  const merged = {};
  for (const [key, enValue] of Object.entries(en)) {
    const heValue = he[key];
    merged[key] = typeof enValue === "string" ? { en: enValue, he: heValue } : mergeLocales(enValue, heValue);
  }
  return merged;
}

// src/i18n/ai/en.json
var en_default = {
  viewActions: {
    undo: "Undo",
    redo: "Redo",
    previousStep: "Previous step",
    replayStep: "Replay step",
    changeStep: {
      label: "Change step",
      promptStart: "Change step",
      promptEnd: "of this visual:"
    }
  },
  toolDefaults: {
    courseTitle: "New Course",
    courseSubtitle: "Course Subtitle",
    courseDescription: "Course Description",
    courseBadge: "New",
    lectureTitle: "Lecture",
    practiceTitle: "Practice",
    topicDescription: "Topic Description",
    weekTitle: "Week: {weekKey}"
  },
  ai: {
    assistantTitle: "AI Assistant",
    assistantIntro: "Bring your own API key (Claude, OpenAI, DeepSeek, Gemini) to chat with an AI assistant inside the app.",
    providerLabel: "AI Provider",
    keyLabel: "API key",
    keyPlaceholder: "Paste your API key",
    keyStorageNotice: "Stored only in this browser tab (cleared when you close it). Sent directly to the selected AI provider.",
    testConnection: "Save & Test Connection",
    testing: "Testing...",
    connected: "Connected",
    connectionFailed: "Connection failed",
    removeKey: "Remove key",
    modelLabel: "Model",
    chatPlaceholder: "Type a message...",
    send: "Send",
    estimatedCost: "Estimated cost",
    confirmSend: "This will cost approximately {cost}. Send anyway?",
    sendingWarningThreshold: "This message is large and may cost more than usual.",
    requestFailed: "Request failed",
    modeOmniRoute: "OmniRoute (Docker)",
    modeDirect: "Direct API",
    omniRouteKeyLabel: "OmniRoute API key",
    omniRouteKeyPlaceholder: "Paste your OmniRoute API key",
    omniRouteKeyStorageNotice: "Stored only in this browser tab (cleared when you close it). Sent only to your local OmniRoute instance.",
    omniRouteModelLabel: "Model / routing strategy",
    costVariesNotice: "Cost varies by provider and is not estimated here.",
    clearChat: "Clear chat",
    executingTool: "Executing tool...",
    toolSuccess: "Done",
    toolDoneSchema: "Checked the database: {n} tables",
    toolDoneQuery: "Looked up {table}: {n} rows found",
    toolDoneQueryNone: "Looked up {table}: nothing found",
    toolDoneTopics: "Listed topics: {n} found",
    toolOpConverted: "blocks converted: {n}",
    toolOpTidied: "tidied the layout",
    toolOpAdded: "blocks added: {n}",
    toolOpRemoved: "blocks removed: {n}",
    toolOpChanged: "blocks changed: {n}",
    toolDoneEdit: 'Edited "{scene}": {what}',
    toolDoneBuild: 'Built canvas "{title}" ({n} blocks)',
    toolDoneDiagram: 'Added a {type} diagram to "{scene}"',
    toolActionCreated: "created",
    toolActionUpdated: "updated",
    toolActionDeleted: "deleted",
    toolActionMoved: "moved",
    toolErrWrongName: "wrong table or column name",
    toolErrNotFound: "couldn't find the target",
    toolErrBadInput: "the AI sent invalid input",
    toolErrConnection: "connection problem",
    toolFailed: "Action failed",
    toolReadSchema: "Database schema",
    toolQueryData: "Course data search",
    toolListTopics: "Topic list",
    toolListCourses: "Course list",
    toolEditCanvas: "Canvas edit",
    toolBuildCanvas: "New canvas",
    toolMakeDiagram: "UML diagram",
    toolEditCourse: "Course update",
    toolEditSection: "Section update",
    toolEditTopic: "Topic update",
    toolPublishVisual: "Step player lecture",
    toolEditCode: "Code edit",
    toolWriteLecture: "Lecture write",
    toolUpdateCatalog: "Catalog update",
    uploadFile: "Attach file",
    contextActive: "Active context",
    stop: "Stop",
    stopped: "Stopped by user",
    interruptedByReload: "Interrupted by reload.",
    emptyReplyAfterTools: "\u26A0\uFE0F No change made. Try again, more specific.",
    quickFixPage: "Fix this page",
    quickFixPagePrompt: "Please review this page for mistakes (wrong content, broken blocks, bad translations) and fix them directly.",
    quickCreateCourse: "Create course",
    quickCreateCoursePrompt: "Create a new course about: ",
    quickCreateTopic: "Create topic",
    quickCreateTopicPrompt: "Add a new topic to this course about: ",
    quickCreateCanvas: "Create canvas",
    quickCreateCanvasPrompt: "Create a canvas page for this topic about: ",
    askAi: "Ask AI",
    askAiCustom: "Ask anything\u2026",
    askAiCustomPrompt: "My question about this:",
    askAiTidy: "Fix overlaps and empty space",
    askAiTidyPrompt: "Fix overlapping blocks and big empty gaps on this page. Use one apply_scene_ops call with a tidyLayout op for this page; do not change any content.",
    askAiExplainPage: "Explain this page",
    askAiExplainPagePrompt: "Explain what is on this page in plain words. Do not change anything.",
    askAiConvertTable: "Convert to table",
    askAiConvertTablePrompt: "Convert this into a table. Edit the open scene directly (replaceBlock keeps its place).",
    askAiConvertUml: "Convert to UML diagram",
    askAiConvertUmlPrompt: "Convert this into a UML diagram on the same page.",
    askAiRewrite: "Rewrite",
    askAiRewritePrompt: "Rewrite this to be clearer and shorter. Keep its meaning.",
    askAiExplain: "Explain",
    askAiExplainPrompt: "Explain this to me in plain words. Do not change anything.",
    quickExplain: "What can you do?",
    quickExplainPrompt: "What can you do on this page? List your capabilities briefly.",
    fileUnsupported: "Only text files are supported for now (.md, .txt, .json). PDF support is coming soon.",
    fileTooLarge: "File is too large (max 200KB).",
    pdfConverting: "Converting PDF...",
    pdfConvertFailed: "Could not read this PDF.",
    toolArgsInvalidJson: "The AI sent malformed data for this action",
    showSettings: "Show Settings",
    hideSettings: "Hide Settings",
    enableSourceEditing: "Enable source code editing (Docker verified)",
    clear: "Clear",
    attachFile: "Attach file",
    statusIdle: "Idle",
    statusReading: "Reading context\u2026",
    statusSearching: "Searching\u2026",
    statusGenerating: "Generating\u2026",
    statusExecuting: "Running tool\u2026",
    statusConnecting: "Connecting\u2026",
    statusRetrying: "Connection failed, retrying",
    changeModel: "Change model",
    currentModel: "Model",
    noApiKey: "No API key \u2014 click Setting to configure",
    needApiKeyFirst: "Please connect an API key first",
    actionCompleted: "Done",
    errorTimeout: "\u26A0\uFE0F AI timed out. Try again.",
    errorRateLimit: "\u26A0\uFE0F Too many requests. Wait a moment.",
    errorAuth: "\u26A0\uFE0F API key rejected. Check Settings.",
    errorBadRequest: "\u26A0\uFE0F Invalid request. Rephrase and retry.",
    errorProvider: "\u26A0\uFE0F AI provider error. Try again shortly.",
    errorNetwork: "\u26A0\uFE0F Cannot reach the AI provider.",
    errorAborted: "\u26A0\uFE0F Request interrupted. Try again.",
    attachment_empty: "File is empty",
    attachment_too_large: "File exceeds 5MB limit",
    attachment_archive_extension: "Archive files (.zip, .rar, .7z, etc.) are blocked",
    attachment_archive_signature: "Archive file signature detected (blocked)",
    attachment_archive_mime: "Archive MIME type detected (blocked)",
    attachment_unsupported_extension: "Unsupported file extension",
    attachment_pdf_signature: "Invalid PDF signature",
    attachment_binary_content: "Binary content detected (unsupported)",
    attachment_too_many: "Max 10 attachments allowed",
    attachment_duplicate: "Duplicate file already attached",
    attachment_total_too_large: "Total attachment size exceeds 20MB",
    attachment_server_unavailable: "Attachment validation server unavailable",
    copyCode: "Copy",
    copied: "Copied!",
    copyFailed: "Failed to copy",
    scrollToBottom: "Scroll to bottom",
    thinkingProcess: "Thinking process"
  }
};

// src/i18n/ai/he.json
var he_default = {
  viewActions: {
    undo: "\u05D1\u05D8\u05DC",
    redo: "\u05D1\u05E6\u05E2 \u05E9\u05D5\u05D1",
    previousStep: "\u05E9\u05DC\u05D1 \u05E7\u05D5\u05D3\u05DD",
    replayStep: "\u05D4\u05E4\u05E2\u05DC \u05E9\u05DC\u05D1 \u05DE\u05D7\u05D3\u05E9",
    changeStep: {
      label: "\u05E9\u05E0\u05D4 \u05E9\u05DC\u05D1",
      promptStart: "\u05E9\u05E0\u05D4 \u05D0\u05EA \u05E9\u05DC\u05D1",
      promptEnd: "\u05D1\u05D5\u05D5\u05D9\u05D6\u05D5\u05D0\u05DC \u05D4\u05D6\u05D4:"
    }
  },
  toolDefaults: {
    courseTitle: "\u05E7\u05D5\u05E8\u05E1 \u05D7\u05D3\u05E9",
    courseSubtitle: "\u05DB\u05D5\u05EA\u05E8\u05EA \u05DE\u05E9\u05E0\u05D4 \u05DC\u05E7\u05D5\u05E8\u05E1",
    courseDescription: "\u05EA\u05D9\u05D0\u05D5\u05E8 \u05D4\u05E7\u05D5\u05E8\u05E1",
    courseBadge: "\u05D7\u05D3\u05E9",
    lectureTitle: "\u05D4\u05E8\u05E6\u05D0\u05D4",
    practiceTitle: "\u05EA\u05E8\u05D2\u05D5\u05DC",
    topicDescription: "\u05EA\u05D9\u05D0\u05D5\u05E8 \u05D4\u05E0\u05D5\u05E9\u05D0",
    weekTitle: "\u05E9\u05D1\u05D5\u05E2: {weekKey}"
  },
  ai: {
    assistantTitle: "\u05E2\u05D5\u05D6\u05E8 AI",
    assistantIntro: "\u05D4\u05D6\u05DF \u05DE\u05E4\u05EA\u05D7 API \u05D0\u05D9\u05E9\u05D9 (Claude, OpenAI, DeepSeek, Gemini) \u05DB\u05D3\u05D9 \u05DC\u05E9\u05D5\u05D7\u05D7 \u05E2\u05DD \u05E2\u05D5\u05D6\u05E8 AI \u05D1\u05EA\u05D5\u05DA \u05D4\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4.",
    providerLabel: "\u05E1\u05E4\u05E7 AI",
    keyLabel: "\u05DE\u05E4\u05EA\u05D7 API",
    keyPlaceholder: "\u05D4\u05D3\u05D1\u05E7 \u05DB\u05D0\u05DF \u05D0\u05EA \u05DE\u05E4\u05EA\u05D7 \u05D4-API \u05E9\u05DC\u05DA",
    keyStorageNotice: "\u05E0\u05E9\u05DE\u05E8 \u05E8\u05E7 \u05D1\u05D8\u05D0\u05D1 \u05D4\u05D3\u05E4\u05D3\u05E4\u05DF \u05D4\u05D6\u05D4 (\u05E0\u05DE\u05D7\u05E7 \u05D1\u05E1\u05D2\u05D9\u05E8\u05EA\u05D5). \u05E0\u05E9\u05DC\u05D7 \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05DC\u05E1\u05E4\u05E7 \u05D4-AI \u05D4\u05E0\u05D1\u05D7\u05E8.",
    testConnection: "\u05E9\u05DE\u05D5\u05E8 \u05D5\u05D1\u05D3\u05D5\u05E7 \u05D7\u05D9\u05D1\u05D5\u05E8",
    testing: "\u05D1\u05D5\u05D3\u05E7...",
    connected: "\u05DE\u05D7\u05D5\u05D1\u05E8",
    connectionFailed: "\u05D4\u05D7\u05D9\u05D1\u05D5\u05E8 \u05E0\u05DB\u05E9\u05DC",
    removeKey: "\u05D4\u05E1\u05E8 \u05DE\u05E4\u05EA\u05D7",
    modelLabel: "\u05DE\u05D5\u05D3\u05DC",
    chatPlaceholder: "\u05D4\u05E7\u05DC\u05D3 \u05D4\u05D5\u05D3\u05E2\u05D4...",
    send: "\u05E9\u05DC\u05D7",
    estimatedCost: "\u05E2\u05DC\u05D5\u05EA \u05DE\u05E9\u05D5\u05E2\u05E8\u05EA",
    confirmSend: "\u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05EA\u05E2\u05DC\u05D4 \u05DB-{cost}. \u05DC\u05E9\u05DC\u05D5\u05D7 \u05D1\u05DB\u05DC \u05D6\u05D0\u05EA?",
    sendingWarningThreshold: "\u05D4\u05D4\u05D5\u05D3\u05E2\u05D4 \u05D2\u05D3\u05D5\u05DC\u05D4 \u05D5\u05E2\u05E9\u05D5\u05D9\u05D4 \u05DC\u05E2\u05DC\u05D5\u05EA \u05D9\u05D5\u05EA\u05E8 \u05DE\u05D4\u05E8\u05D2\u05D9\u05DC.",
    requestFailed: "\u05D4\u05D1\u05E7\u05E9\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4",
    modeOmniRoute: "OmniRoute (Docker)",
    modeDirect: "API \u05D9\u05E9\u05D9\u05E8",
    omniRouteKeyLabel: "\u05DE\u05E4\u05EA\u05D7 API \u05E9\u05DC OmniRoute",
    omniRouteKeyPlaceholder: "\u05D4\u05D3\u05D1\u05E7 \u05DB\u05D0\u05DF \u05D0\u05EA \u05DE\u05E4\u05EA\u05D7 \u05D4-OmniRoute \u05E9\u05DC\u05DA",
    omniRouteKeyStorageNotice: "\u05E0\u05E9\u05DE\u05E8 \u05E8\u05E7 \u05D1\u05D8\u05D0\u05D1 \u05D4\u05D3\u05E4\u05D3\u05E4\u05DF \u05D4\u05D6\u05D4 (\u05E0\u05DE\u05D7\u05E7 \u05D1\u05E1\u05D2\u05D9\u05E8\u05EA\u05D5). \u05E0\u05E9\u05DC\u05D7 \u05E8\u05E7 \u05DC\u05DE\u05D5\u05E4\u05E2 \u05D4-OmniRoute \u05D4\u05DE\u05E7\u05D5\u05DE\u05D9 \u05E9\u05DC\u05DA.",
    omniRouteModelLabel: "\u05DE\u05D5\u05D3\u05DC / \u05D0\u05E1\u05D8\u05E8\u05D8\u05D2\u05D9\u05D9\u05EA \u05E0\u05D9\u05EA\u05D5\u05D1",
    costVariesNotice: "\u05D4\u05E2\u05DC\u05D5\u05EA \u05DE\u05E9\u05EA\u05E0\u05D4 \u05DC\u05E4\u05D9 \u05E1\u05E4\u05E7 \u05D5\u05D0\u05D9\u05E0\u05D4 \u05DE\u05D5\u05E2\u05E8\u05DB\u05EA \u05DB\u05D0\u05DF.",
    clearChat: "\u05E0\u05E7\u05D4 \u05E9\u05D9\u05D7\u05D4",
    executingTool: "\u05DE\u05D1\u05E6\u05E2 \u05E4\u05E2\u05D5\u05DC\u05D4...",
    toolSuccess: "\u05D1\u05D5\u05E6\u05E2",
    toolDoneSchema: "\u05D1\u05D3\u05E7 \u05D0\u05EA \u05DE\u05E1\u05D3 \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD: {n} \u05D8\u05D1\u05DC\u05D0\u05D5\u05EA",
    toolDoneQuery: "\u05D7\u05D9\u05E4\u05E9 \u05D1-{table}: \u05E0\u05DE\u05E6\u05D0\u05D5 {n} \u05E9\u05D5\u05E8\u05D5\u05EA",
    toolDoneQueryNone: "\u05D7\u05D9\u05E4\u05E9 \u05D1-{table}: \u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0 \u05DB\u05DC\u05D5\u05DD",
    toolDoneTopics: "\u05E8\u05E9\u05DD \u05E0\u05D5\u05E9\u05D0\u05D9\u05DD: \u05E0\u05DE\u05E6\u05D0\u05D5 {n}",
    toolOpConverted: "\u05D1\u05DC\u05D5\u05E7\u05D9\u05DD \u05E9\u05D4\u05D5\u05DE\u05E8\u05D5: {n}",
    toolOpTidied: "\u05E1\u05D9\u05D3\u05E8 \u05D0\u05EA \u05D4\u05E4\u05E8\u05D9\u05E1\u05D4",
    toolOpAdded: "\u05D1\u05DC\u05D5\u05E7\u05D9\u05DD \u05E9\u05E0\u05D5\u05E1\u05E4\u05D5: {n}",
    toolOpRemoved: "\u05D1\u05DC\u05D5\u05E7\u05D9\u05DD \u05E9\u05D4\u05D5\u05E1\u05E8\u05D5: {n}",
    toolOpChanged: "\u05D1\u05DC\u05D5\u05E7\u05D9\u05DD \u05E9\u05E9\u05D5\u05E0\u05D5: {n}",
    toolDoneEdit: '\u05E2\u05E8\u05DA \u05D0\u05EA "{scene}": {what}',
    toolDoneBuild: '\u05D1\u05E0\u05D4 \u05E7\u05E0\u05D1\u05E1 "{title}" ({n} \u05D1\u05DC\u05D5\u05E7\u05D9\u05DD)',
    toolDoneDiagram: '\u05D4\u05D5\u05E1\u05D9\u05E3 \u05D3\u05D9\u05D0\u05D2\u05E8\u05DE\u05EA {type} \u05DC-"{scene}"',
    toolActionCreated: "\u05E0\u05D5\u05E6\u05E8",
    toolActionUpdated: "\u05E2\u05D5\u05D3\u05DB\u05DF",
    toolActionDeleted: "\u05E0\u05DE\u05D7\u05E7",
    toolActionMoved: "\u05D4\u05D5\u05D6\u05D6",
    toolErrWrongName: "\u05E9\u05DD \u05D8\u05D1\u05DC\u05D4 \u05D0\u05D5 \u05E2\u05DE\u05D5\u05D3\u05D4 \u05E9\u05D2\u05D5\u05D9",
    toolErrNotFound: "\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0 \u05D4\u05D9\u05E2\u05D3",
    toolErrBadInput: "\u05D4-AI \u05E9\u05DC\u05D7 \u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF",
    toolErrConnection: "\u05D1\u05E2\u05D9\u05D9\u05EA \u05D7\u05D9\u05D1\u05D5\u05E8",
    toolFailed: "\u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4",
    toolReadSchema: "\u05DE\u05D1\u05E0\u05D4 \u05DE\u05E1\u05D3 \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD",
    toolQueryData: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05D1\u05E0\u05EA\u05D5\u05E0\u05D9 \u05D4\u05E7\u05D5\u05E8\u05E1",
    toolListTopics: "\u05E8\u05E9\u05D9\u05DE\u05EA \u05E0\u05D5\u05E9\u05D0\u05D9\u05DD",
    toolListCourses: "\u05E8\u05E9\u05D9\u05DE\u05EA \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD",
    toolEditCanvas: "\u05E2\u05E8\u05D9\u05DB\u05EA \u05E7\u05E0\u05D1\u05E1",
    toolBuildCanvas: "\u05E7\u05E0\u05D1\u05E1 \u05D7\u05D3\u05E9",
    toolMakeDiagram: "\u05D3\u05D9\u05D0\u05D2\u05E8\u05DE\u05EA UML",
    toolEditCourse: "\u05E2\u05D3\u05DB\u05D5\u05DF \u05E7\u05D5\u05E8\u05E1",
    toolEditSection: "\u05E2\u05D3\u05DB\u05D5\u05DF \u05E4\u05E8\u05E7",
    toolEditTopic: "\u05E2\u05D3\u05DB\u05D5\u05DF \u05E0\u05D5\u05E9\u05D0",
    toolPublishVisual: "\u05D4\u05E8\u05E6\u05D0\u05EA \u05E0\u05D2\u05DF \u05E6\u05E2\u05D3\u05D9\u05DD",
    toolEditCode: "\u05E2\u05E8\u05D9\u05DB\u05EA \u05E7\u05D5\u05D3",
    toolWriteLecture: "\u05DB\u05EA\u05D9\u05D1\u05EA \u05D4\u05E8\u05E6\u05D0\u05D4",
    toolUpdateCatalog: "\u05E2\u05D3\u05DB\u05D5\u05DF \u05E7\u05D8\u05DC\u05D5\u05D2",
    uploadFile: "\u05E6\u05E8\u05E3 \u05E7\u05D5\u05D1\u05E5",
    contextActive: "\u05D4\u05E7\u05E9\u05E8 \u05E4\u05E2\u05D9\u05DC",
    stop: "\u05E2\u05E6\u05D5\u05E8",
    stopped: "\u05D4\u05D5\u05E4\u05E1\u05E7 \u05E2\u05DC \u05D9\u05D3\u05D9 \u05D4\u05DE\u05E9\u05EA\u05DE\u05E9",
    interruptedByReload: "\u05D4\u05D5\u05E4\u05E1\u05E7 \u05D1\u05E8\u05E2\u05E0\u05D5\u05DF.",
    emptyReplyAfterTools: "\u26A0\uFE0F \u05DC\u05D0 \u05D1\u05D5\u05E6\u05E2 \u05E9\u05D9\u05E0\u05D5\u05D9. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1, \u05D1\u05D9\u05EA\u05E8 \u05E4\u05D9\u05E8\u05D5\u05D8.",
    quickFixPage: "\u05EA\u05E7\u05DF \u05D0\u05EA \u05D4\u05D3\u05E3",
    quickFixPagePrompt: "\u05D1\u05D1\u05E7\u05E9\u05D4 \u05D1\u05D3\u05D5\u05E7 \u05D0\u05EA \u05D4\u05D3\u05E3 \u05D4\u05D6\u05D4 \u05DC\u05D8\u05E2\u05D5\u05D9\u05D5\u05EA (\u05EA\u05D5\u05DB\u05DF \u05E9\u05D2\u05D5\u05D9, \u05D1\u05DC\u05D5\u05E7\u05D9\u05DD \u05E9\u05D1\u05D5\u05E8\u05D9\u05DD, \u05EA\u05E8\u05D2\u05D5\u05DE\u05D9\u05DD \u05DC\u05D0 \u05D8\u05D5\u05D1\u05D9\u05DD) \u05D5\u05EA\u05E7\u05DF \u05D0\u05D5\u05EA\u05DF \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA.",
    quickCreateCourse: "\u05E6\u05D5\u05E8 \u05E7\u05D5\u05E8\u05E1",
    quickCreateCoursePrompt: "\u05E6\u05D5\u05E8 \u05E7\u05D5\u05E8\u05E1 \u05D7\u05D3\u05E9 \u05D1\u05E0\u05D5\u05E9\u05D0: ",
    quickCreateTopic: "\u05E6\u05D5\u05E8 \u05E0\u05D5\u05E9\u05D0",
    quickCreateTopicPrompt: "\u05D4\u05D5\u05E1\u05E3 \u05E0\u05D5\u05E9\u05D0 \u05D7\u05D3\u05E9 \u05DC\u05E7\u05D5\u05E8\u05E1 \u05D4\u05D6\u05D4 \u05D1\u05E0\u05D5\u05E9\u05D0: ",
    quickCreateCanvas: "\u05E6\u05D5\u05E8 \u05E7\u05E0\u05D1\u05E1",
    quickCreateCanvasPrompt: "\u05E6\u05D5\u05E8 \u05D3\u05E3 \u05E7\u05E0\u05D1\u05E1 \u05DC\u05E0\u05D5\u05E9\u05D0 \u05D4\u05D6\u05D4 \u05D1\u05E0\u05D5\u05E9\u05D0: ",
    askAi: "\u05E9\u05D0\u05DC AI",
    askAiCustom: "\u05E9\u05D0\u05DC \u05DE\u05E9\u05D4\u05D5\u2026",
    askAiCustomPrompt: "\u05D4\u05E9\u05D0\u05DC\u05D4 \u05E9\u05DC\u05D9 \u05E2\u05DC \u05D6\u05D4:",
    askAiTidy: "\u05EA\u05E7\u05DF \u05D7\u05E4\u05D9\u05E4\u05D5\u05EA \u05D5\u05E8\u05D5\u05D5\u05D7\u05D9\u05DD \u05E8\u05D9\u05E7\u05D9\u05DD",
    askAiTidyPrompt: "\u05EA\u05E7\u05DF \u05D1\u05DC\u05D5\u05E7\u05D9\u05DD \u05D7\u05D5\u05E4\u05E4\u05D9\u05DD \u05D5\u05E8\u05D5\u05D5\u05D7\u05D9\u05DD \u05E8\u05D9\u05E7\u05D9\u05DD \u05D2\u05D3\u05D5\u05DC\u05D9\u05DD \u05D1\u05E2\u05DE\u05D5\u05D3 \u05D4\u05D6\u05D4. \u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05E7\u05E8\u05D9\u05D0\u05D4 \u05D0\u05D7\u05EA \u05DC-apply_scene_ops \u05E2\u05DD \u05E4\u05E2\u05D5\u05DC\u05EA tidyLayout \u05DC\u05E2\u05DE\u05D5\u05D3 \u05D4\u05D6\u05D4; \u05D0\u05DC \u05EA\u05E9\u05E0\u05D4 \u05EA\u05D5\u05DB\u05DF.",
    askAiExplainPage: "\u05D4\u05E1\u05D1\u05E8 \u05D0\u05EA \u05D4\u05E2\u05DE\u05D5\u05D3",
    askAiExplainPagePrompt: "\u05D4\u05E1\u05D1\u05E8 \u05D1\u05DE\u05D9\u05DC\u05D9\u05DD \u05E4\u05E9\u05D5\u05D8\u05D5\u05EA \u05DE\u05D4 \u05D9\u05E9 \u05D1\u05E2\u05DE\u05D5\u05D3 \u05D4\u05D6\u05D4. \u05D0\u05DC \u05EA\u05E9\u05E0\u05D4 \u05D3\u05D1\u05E8.",
    askAiConvertTable: "\u05D4\u05DE\u05E8 \u05DC\u05D8\u05D1\u05DC\u05D4",
    askAiConvertTablePrompt: "\u05D4\u05DE\u05E8 \u05D0\u05EA \u05D6\u05D4 \u05DC\u05D8\u05D1\u05DC\u05D4. \u05E2\u05E8\u05D5\u05DA \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05D0\u05EA \u05D4\u05E1\u05E6\u05E0\u05D4 \u05D4\u05E4\u05EA\u05D5\u05D7\u05D4 (replaceBlock \u05E9\u05D5\u05DE\u05E8 \u05E2\u05DC \u05D4\u05DE\u05D9\u05E7\u05D5\u05DD).",
    askAiConvertUml: "\u05D4\u05DE\u05E8 \u05DC\u05D3\u05D9\u05D0\u05D2\u05E8\u05DE\u05EA UML",
    askAiConvertUmlPrompt: "\u05D4\u05DE\u05E8 \u05D0\u05EA \u05D6\u05D4 \u05DC\u05D3\u05D9\u05D0\u05D2\u05E8\u05DE\u05EA UML \u05D1\u05D0\u05D5\u05EA\u05D5 \u05E2\u05DE\u05D5\u05D3.",
    askAiRewrite: "\u05E9\u05DB\u05EA\u05D1",
    askAiRewritePrompt: "\u05E9\u05DB\u05EA\u05D1 \u05D0\u05EA \u05D6\u05D4 \u05DB\u05DA \u05E9\u05D9\u05D4\u05D9\u05D4 \u05D1\u05E8\u05D5\u05E8 \u05D5\u05E7\u05E6\u05E8 \u05D9\u05D5\u05EA\u05E8. \u05E9\u05DE\u05D5\u05E8 \u05E2\u05DC \u05D4\u05DE\u05E9\u05DE\u05E2\u05D5\u05EA.",
    askAiExplain: "\u05D4\u05E1\u05D1\u05E8",
    askAiExplainPrompt: "\u05D4\u05E1\u05D1\u05E8 \u05DC\u05D9 \u05D0\u05EA \u05D6\u05D4 \u05D1\u05DE\u05D9\u05DC\u05D9\u05DD \u05E4\u05E9\u05D5\u05D8\u05D5\u05EA. \u05D0\u05DC \u05EA\u05E9\u05E0\u05D4 \u05D3\u05D1\u05E8.",
    quickExplain: "\u05DE\u05D4 \u05D0\u05EA\u05D4 \u05D9\u05DB\u05D5\u05DC \u05DC\u05E2\u05E9\u05D5\u05EA?",
    quickExplainPrompt: "\u05DE\u05D4 \u05D0\u05EA\u05D4 \u05DE\u05E1\u05D5\u05D2\u05DC \u05DC\u05E2\u05E9\u05D5\u05EA \u05D1\u05D3\u05E3 \u05D4\u05D6\u05D4? \u05E4\u05E8\u05D8 \u05D1\u05E7\u05E6\u05E8\u05D4 \u05D0\u05EA \u05D4\u05D9\u05DB\u05D5\u05DC\u05D5\u05EA \u05E9\u05DC\u05DA.",
    fileUnsupported: "\u05DB\u05E8\u05D2\u05E2 \u05E0\u05EA\u05DE\u05DB\u05D9\u05DD \u05E8\u05E7 \u05E7\u05D1\u05E6\u05D9 \u05D8\u05E7\u05E1\u05D8 (md, txt, json). \u05EA\u05DE\u05D9\u05DB\u05D4 \u05D1-PDF \u05EA\u05D2\u05D9\u05E2 \u05D1\u05E7\u05E8\u05D5\u05D1.",
    fileTooLarge: "\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D2\u05D3\u05D5\u05DC \u05DE\u05D3\u05D9 (\u05DE\u05E7\u05E1\u05D9\u05DE\u05D5\u05DD 200KB).",
    pdfConverting: "\u05DE\u05DE\u05D9\u05E8 PDF...",
    pdfConvertFailed: "\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05D4\u05D9\u05D4 \u05DC\u05E7\u05E8\u05D5\u05D0 \u05D0\u05EA \u05E7\u05D5\u05D1\u05E5 \u05D4-PDF \u05D4\u05D6\u05D4.",
    toolArgsInvalidJson: "\u05D4\u05D1\u05D9\u05E0\u05D4 \u05E9\u05DC\u05D7\u05D4 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05E4\u05D2\u05D5\u05DE\u05D9\u05DD \u05DC\u05E4\u05E2\u05D5\u05DC\u05D4 \u05D4\u05D6\u05D5",
    showSettings: "\u05D4\u05E6\u05D2 \u05D4\u05D2\u05D3\u05E8\u05D5\u05EA",
    hideSettings: "\u05D4\u05E1\u05EA\u05E8 \u05D4\u05D2\u05D3\u05E8\u05D5\u05EA",
    enableSourceEditing: "\u05D0\u05E4\u05E9\u05E8 \u05E2\u05E8\u05D9\u05DB\u05EA \u05E7\u05D5\u05D3 \u05DE\u05E7\u05D5\u05E8 (\u05DE\u05D0\u05D5\u05DE\u05EA Docker)",
    clear: "\u05E0\u05E7\u05D4",
    attachFile: "\u05E6\u05E8\u05E3 \u05E7\u05D5\u05D1\u05E5",
    statusIdle: "\u05DE\u05D5\u05DB\u05DF",
    statusReading: "\u05E7\u05D5\u05E8\u05D0 \u05D4\u05E7\u05E9\u05E8\u2026",
    statusSearching: "\u05DE\u05D7\u05E4\u05E9\u2026",
    statusGenerating: "\u05DE\u05D9\u05D9\u05E6\u05E8 \u05EA\u05E9\u05D5\u05D1\u05D4\u2026",
    statusExecuting: "\u05DE\u05E8\u05D9\u05E5 \u05DB\u05DC\u05D9\u2026",
    statusConnecting: "\u05DE\u05EA\u05D7\u05D1\u05E8\u2026",
    statusRetrying: "\u05D4\u05D7\u05D9\u05D1\u05D5\u05E8 \u05E0\u05DB\u05E9\u05DC, \u05DE\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1",
    changeModel: "\u05E9\u05E0\u05D4 \u05DE\u05D5\u05D3\u05DC",
    currentModel: "\u05DE\u05D5\u05D3\u05DC",
    noApiKey: "\u05D0\u05D9\u05DF \u05DE\u05E4\u05EA\u05D7 API \u2014 \u05DC\u05D7\u05E5 \u05E2\u05DC \u05D4\u05D2\u05D3\u05E8\u05D5\u05EA \u05DC\u05E7\u05D1\u05D9\u05E2\u05EA \u05EA\u05E6\u05D5\u05E8\u05D4",
    needApiKeyFirst: "\u05D9\u05E9 \u05DC\u05D7\u05D1\u05E8 \u05DE\u05E4\u05EA\u05D7 API \u05EA\u05D7\u05D9\u05DC\u05D4",
    actionCompleted: "\u05D1\u05D5\u05E6\u05E2",
    errorTimeout: "\u26A0\uFE0F \u05D4-AI \u05DC\u05D0 \u05D4\u05D2\u05D9\u05D1 \u05D1\u05D6\u05DE\u05DF. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1.",
    errorRateLimit: "\u26A0\uFE0F \u05D9\u05D5\u05EA\u05E8 \u05DE\u05D3\u05D9 \u05D1\u05E7\u05E9\u05D5\u05EA. \u05D4\u05DE\u05EA\u05DF \u05E8\u05D2\u05E2.",
    errorAuth: "\u26A0\uFE0F \u05DE\u05E4\u05EA\u05D7 \u05D4-API \u05E0\u05D3\u05D7\u05D4. \u05D1\u05D3\u05D5\u05E7 \u05D1\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA.",
    errorBadRequest: "\u26A0\uFE0F \u05D1\u05E7\u05E9\u05D4 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05E0\u05D4. \u05E0\u05E1\u05D7 \u05DE\u05D7\u05D3\u05E9.",
    errorProvider: "\u26A0\uFE0F \u05EA\u05E7\u05DC\u05D4 \u05D0\u05E6\u05DC \u05E1\u05E4\u05E7 \u05D4-AI. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1 \u05D1\u05E7\u05E8\u05D5\u05D1.",
    errorNetwork: "\u26A0\uFE0F \u05D0\u05D9\u05DF \u05D7\u05D9\u05D1\u05D5\u05E8 \u05DC\u05E1\u05E4\u05E7 \u05D4-AI.",
    errorAborted: "\u26A0\uFE0F \u05D4\u05D1\u05E7\u05E9\u05D4 \u05D4\u05D5\u05E4\u05E1\u05E7\u05D4. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1.",
    attachment_empty: "\u05D4\u05E7\u05D5\u05D1\u05E5 \u05E8\u05D9\u05E7",
    attachment_too_large: "\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D7\u05D5\u05E8\u05D2 \u05DE\u05DE\u05D2\u05D1\u05DC\u05EA 5MB",
    attachment_archive_extension: "\u05E7\u05D1\u05E6\u05D9 \u05D0\u05E8\u05DB\u05D9\u05D5\u05DF (.zip, .rar, .7z \u05D5\u05DB\u05D5\u05F3) \u05D7\u05E1\u05D5\u05DE\u05D9\u05DD",
    attachment_archive_signature: "\u05D6\u05D5\u05D4\u05EA\u05D4 \u05D7\u05EA\u05D9\u05DE\u05EA \u05D0\u05E8\u05DB\u05D9\u05D5\u05DF (\u05D7\u05E1\u05D5\u05DD)",
    attachment_archive_mime: "\u05E1\u05D5\u05D2 \u05E7\u05D5\u05D1\u05E5 \u05D0\u05E8\u05DB\u05D9\u05D5\u05DF (\u05D7\u05E1\u05D5\u05DD)",
    attachment_unsupported_extension: "\u05E1\u05D9\u05D5\u05DE\u05EA \u05E7\u05D5\u05D1\u05E5 \u05DC\u05D0 \u05E0\u05EA\u05DE\u05DB\u05EA",
    attachment_pdf_signature: "\u05D7\u05EA\u05D9\u05DE\u05EA PDF \u05DC\u05D0 \u05EA\u05E7\u05D9\u05E0\u05D4",
    attachment_binary_content: "\u05D6\u05D5\u05D4\u05D4 \u05EA\u05D5\u05DB\u05DF \u05D1\u05D9\u05E0\u05D0\u05E8\u05D9 (\u05DC\u05D0 \u05E0\u05EA\u05DE\u05DA)",
    attachment_too_many: "\u05E0\u05D9\u05EA\u05DF \u05DC\u05E6\u05E8\u05E3 \u05E2\u05D3 10 \u05E7\u05D1\u05E6\u05D9\u05DD",
    attachment_duplicate: "\u05E7\u05D5\u05D1\u05E5 \u05DB\u05E4\u05D5\u05DC \u05DB\u05D1\u05E8 \u05E6\u05D5\u05E8\u05E3",
    attachment_total_too_large: "\u05D2\u05D5\u05D3\u05DC \u05D4\u05E7\u05D1\u05E6\u05D9\u05DD \u05D4\u05DB\u05D5\u05DC\u05DC \u05D7\u05D5\u05E8\u05D2 \u05DE-20MB",
    attachment_server_unavailable: "\u05E9\u05E8\u05EA \u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05E7\u05D1\u05E6\u05D9\u05DD \u05D0\u05D9\u05E0\u05D5 \u05D6\u05DE\u05D9\u05DF",
    copyCode: "\u05D4\u05E2\u05EA\u05E7",
    copied: "\u05D4\u05D5\u05E2\u05EA\u05E7!",
    copyFailed: "\u05D4\u05D4\u05E2\u05EA\u05E7\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4",
    scrollToBottom: "\u05D2\u05DC\u05D5\u05DC \u05DC\u05EA\u05D7\u05EA\u05D9\u05EA",
    thinkingProcess: "\u05EA\u05D4\u05DC\u05D9\u05DA \u05D7\u05E9\u05D9\u05D1\u05D4"
  }
};

// src/i18n/appShell/en.json
var en_default2 = {
  switchLanguageTooltip: "Switch Language / \u05D4\u05D7\u05DC\u05E3 \u05E9\u05E4\u05D4",
  visualSteps: "Step player",
  author: {
    websiteAuthorLongPrefix: "Website made by ",
    websiteAuthorLongSuffix: ", check my website for my other projects",
    websiteAuthorShortPrefix: "By "
  },
  buttons: {
    launchModel: "Launch Model",
    retryLoading: "Retry Loading",
    close: "Close",
    sidebar: "Sidebar",
    patchNotes: "Patch Notes",
    aiAssistant: "AI Assistant"
  },
  common: {
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    apply: "Apply",
    delete: "Delete",
    edit: "Edit",
    back: "Back",
    next: "Next",
    confirm: "Confirm",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    retry: "Retry",
    search: "Search...",
    empty: "(empty)",
    networkError: "Network Error loading content",
    tryAgain: "Try Again",
    backToHub: "Back to Hub",
    canvasRenderError: "This canvas failed to render."
  },
  headers: {
    week1Header: "Week 1: Computational Models",
    week2Header: "Week 2: Turing Machines & Reductions",
    sidebarBrandTitle: "Complexity Theory",
    mainHeaderHome: "Complexity & Computability",
    mainHeaderDefault: "Interactive Course Portal"
  },
  home: {
    title: "Home Dashboard",
    welcomeTitle: "Welcome to the Computability & Complexity Course Website",
    welcomeSubtitle: "An interactive learning platform for step-by-step visualization of Turing machines, time and space hierarchy theorems, and polynomial time reductions.",
    heroPlatformTag: "Computability & Complexity Platform",
    week1Title: "Week 1 Topics & Visual Models",
    lectures: "Lectures",
    practice: "Practice"
  },
  patchNotes: {
    patchNotesTitle: "Platform Updates & Patch Notes",
    patchNotesVersion: "Version 2.4.0",
    patchNotesDesc: "Interactive Canvas improvements, Nocturne theme integration, and Docker verification engine."
  },
  player: {
    activeStep: "Active Step",
    stepPlayer: "Step Player",
    whatChanged: "What changed",
    why: "Why",
    speedLabel: "Speed",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit Fullscreen",
    failedToLoad: "Failed to load visual model",
    reset: "Reset",
    previous: "Previous",
    next: "Next",
    play: "Play",
    pause: "Pause",
    scrubber: "Preview scrubber",
    part: "Part",
    partTitle: "Play only a part of this step",
    loop: "Loop",
    loopTitle: "Repeat the part",
    milliseconds: "{value} ms",
    seconds: "{value}s"
  },
  settings: {
    settingsTitle: "Settings",
    tabAppearance: "Appearance & Theme",
    tabAi: "AI Assistant",
    tabMcp: "MCP Integrations",
    tabStorage: "Storage & Data",
    tabLogs: "Logs & Diagnostics",
    popoutLogs: "Pop out to window",
    dockLogs: "Dock to settings",
    refreshLogs: "Refresh",
    autoRefreshLogs: "Auto refresh",
    autoScrollLogs: "Auto-scroll",
    scrollToBottom: "Scroll to bottom",
    copyLogs: "Copy",
    copiedLogs: "Copied!",
    runLogsTab: "Current Run",
    runtimeErrorsTab: "Runtime Errors",
    allRunsTab: "All Runs",
    searchLogs: "Search logs...",
    noLogs: "No logs recorded yet.",
    accentColor: "Accent Color",
    themeMode: "Light / Dark Mode",
    themeModeLight: "Light",
    themeModeDark: "Dark",
    language: "Language",
    selectLanguage: "Select Language",
    hebrew: "Hebrew",
    english: "English",
    clearAutoSaves: "Clear Canvas Auto-Saves",
    clearChatHistory: "Clear AI Conversation History",
    resetAll: "Reset All Local Settings",
    clearedSuccess: "Cleared successfully",
    close: "Close"
  },
  status: {
    accept: "Accept",
    reject: "Reject",
    looping: "Looping",
    currentState: "Current State",
    stepCount: "Step Count",
    headPointer: "Head Pointer",
    inputInstance: "Input Instance",
    polyReduction: "Polynomial Reduction",
    targetDecider: "Target Decider"
  },
  topics: {
    recallPTitle: "Class P Review",
    recallPDesc: "Deterministic polynomial time decision problems and complexity characteristics.",
    timeHierarchyTitle: "Time Hierarchy Theorem",
    timeHierarchyDesc: "Deterministic time separation and simulation diagonalization visual proof.",
    reductionPipelineTitle: "Reduction Pipeline",
    reductionPipelineDesc: "Step-by-step polynomial reduction mapping between computational problems.",
    gadgetGraphTitle: "Gadget Graph Construction",
    gadgetGraphDesc: "Visual clause-to-subgraph gadget transformations and verification.",
    dfsColoringTitle: "DFS Graph Coloring",
    dfsColoringDesc: "Interactive 3-Colorability search and vertex constraint validation."
  },
  update: {
    updateAvailable: "Update Available",
    newVersion: "Version {version} is available",
    updateAction: "Update on next start",
    updateAndRestart: "Update and restart",
    updateRestarting: "Updating, restarting...",
    updatingScheduled: "Scheduled for next restart",
    restartHint: "Close StudyTS and start it again to finish updating.",
    skipVersion: "Skip this version",
    later: "Later",
    rollbackNotice: "Last update was rolled back. Your data is untouched.",
    dismiss: "Dismiss",
    updateBadge: "Update",
    whatsNew: "What's new",
    tabTitle: "Updates",
    currentVersion: "Current version",
    checkNow: "Check for updates",
    checking: "Checking...",
    lastChecked: "Last checked",
    upToDate: "You are up to date.",
    justChecked: "Just checked a moment ago. Try again in a few seconds.",
    offline: "Could not reach the update server. Try again when you are online.",
    rateLimited: "Too many update checks. Try again later.",
    noReleases: "No releases are published yet.",
    checkError: "The update check failed.",
    appliedOnNextStart: "Updates are applied the next time you start StudyTS. Your settings (.env), database and course data (data/) are kept.",
    scheduledFor: "Scheduled: version {version}"
  },
  mcp: {
    tabMcp: "StudyTs-MCP",
    tabAiProvider: "AI Provider",
    mcpTitle: "StudyTs-MCP Daemon",
    mcpSubtitle: "Unified local daemon connecting tools, database, and notebooks directly to the AI assistant.",
    addServer: "Add MCP Server",
    serverName: "Server Name",
    command: "Command",
    args: "Arguments (space separated)",
    autoStart: "Auto-start with backend",
    statusConnected: "Connected",
    statusConnecting: "Connecting...",
    statusStopped: "Stopped",
    statusError: "Error",
    start: "Start",
    stop: "Stop",
    ping: "Ping",
    delete: "Delete",
    toolsCount: "{count} tools available",
    noServers: "StudyTs-MCP is not running.",
    tutorialBtn: "How StudyTs-MCP Works",
    tutorialTitle: "StudyTs-MCP Architecture & Guide",
    step1Title: "1. What is StudyTs-MCP?",
    step1Desc: "StudyTs-MCP is a unified local daemon running on your machine over stdio JSON-RPC. It connects the AI assistant directly to your local database, notebooks, and course content without cloud lock-in.",
    step2Title: "2. Unified Domains & Capabilities",
    step2Desc: "StudyTs-MCP groups all 12 tools into 3 distinct domains: Research & Notebooks, SQLite Course Database, and Course Authoring.",
    step3Title: "3. Live Daemon Test",
    step3Desc: "Run an instant, side-effect-free test query against the running StudyTs-MCP daemon.",
    testSnippetPlaceholder: "Enter query or leave blank to test...",
    testSendBtn: "Run Daemon Test",
    sending: "Sending...",
    testSuccess: "StudyTs-MCP daemon responded successfully!",
    testFailed: "Test failed:",
    close: "Close",
    nextStep: "Next",
    prevStep: "Back",
    saveServer: "Save Server",
    cancel: "Cancel",
    activeTools: "Active Tools",
    domainNotebooks: "Research & Notebooks",
    domainDatabase: "Course Database",
    domainAuthoring: "Course Authoring",
    howItWorksTitle: "How StudyTs-MCP Works",
    howItWorksSubtitle: "Local-first, model-agnostic MCP integration pipeline",
    architectureClient: "AI Chat Assistant",
    architectureClientDesc: "Web UI invokes tools during study & course authoring",
    architectureGateway: "Express API Gateway",
    architectureGatewayDesc: "Routes /api/mcp calls over stdio JSON-RPC",
    architectureDaemon: "StudyTs-MCP Daemon",
    architectureDaemonDesc: "Single background process managing 12 domain tools",
    architectureStorage: "Local Database & Files",
    architectureStorageDesc: "Read-only SQLite and atomic data/ file operations"
  },
  complexityClasses: {
    P: {
      name: "Class P",
      description: "Problems decidable in polynomial time on a deterministic Turing machine."
    },
    NP: {
      name: "Class NP",
      description: "Problems verifiable in polynomial time or decidable on a non-deterministic Turing machine."
    },
    NPC: {
      name: "Class NP-Complete",
      description: "The hardest problems in NP, to which every problem in NP polynomial-time reduces."
    },
    PSPACE: {
      name: "Class PSPACE",
      description: "Problems decidable using a polynomial amount of memory space."
    },
    EXPTIME: {
      name: "Class EXPTIME",
      description: "Problems decidable in exponential time $O(2^{p(n)})$."
    }
  },
  hub: {
    topics: "topics",
    addTopic: "Add topic",
    coursesTitle: "Courses",
    coursesIntro: "Pick a course to start.",
    platformTagline: "Interactive Complexity Platform",
    hubTitle: "Course Hub & Learning Modules",
    hubSubtitle: "Select a course to explore interactive visualizations, lectures, and practice modules.",
    availableCourses: "Available Courses",
    exploreCourse: "Explore Course",
    weeksLabel: "Weeks",
    interactiveModules: "Interactive Modules",
    coursesHub: "Courses Hub",
    allCourses: "All Courses",
    fieldTitle: "Title",
    fieldDescription: "Description",
    titlePlaceholder: "e.g. Data Structures",
    descriptionPlaceholder: "A short description",
    apply: "Apply",
    saving: "Saving\u2026",
    cancel: "Cancel",
    close: "Close",
    editCourse: "Edit course",
    editSection: "Edit section",
    editTopic: "Edit topic",
    courseIdLabel: "Course ID",
    sectionIdLabel: "Section ID",
    topicIdLabel: "Topic ID",
    idDerivedNote: "derived automatically, can't be changed later.",
    idWaitingForTitle: "(type a title above)",
    idCannotDerive: "Couldn't derive an ID from the title. Use some English letters or digits in the title.",
    idInvalid: 'The ID "{id}" is invalid. Use lowercase letters, numbers, hyphens and underscores, starting with a letter or number.',
    exportCourse: "Export course as ZIP",
    importCourseFromZip: "Import course from ZIP",
    deleteCourse: "Delete course",
    deleteSection: "Delete section",
    deleteTopic: "Delete topic",
    exportPdfCourse: "Export course as PDF",
    openStepMaker: "Step maker",
    exportPdfWeek: "Export section as PDF",
    exportPdfSectionLabel: "Section",
    exportingPdf: "Preparing PDF\u2026 {done}/{total}",
    exportPdfEmpty: "No canvas topics to export.",
    exportPdfFailed: "Could not load: {names}",
    confirmDelete: "Confirm?",
    addCourse: "Add course",
    addSection: "Add section",
    edit: "Edit",
    doneEditing: "Done editing",
    noTopicsYet: "No topics yet. Turn on editing to add one.",
    deleteAnyway: "Delete anyway",
    sectionHasTopics: 'Section "{name}" still has topics. Delete it and all its topics anyway?',
    importCourseTitle: "Import course",
    importCourseHint: "Upload a course ZIP exported from this app.",
    importing: "Importing\u2026",
    importAction: "Import",
    importFailed: "Import failed",
    topicKindCanvas: "Canvas",
    topicKindFile: "Document",
    topicTypeFileHint: "Upload a PDF, Word, PowerPoint, Excel or CSV file",
    fileTopicEmpty: "This document topic has no file yet.",
    attachmentTypeRefused: "This file type is not supported",
    attachFileChoose: "Choose a file",
    attachFileChange: "Change file",
    topicKindPlayer: "Step player",
    funnyTopicName1: "I was too lazy to name my topic",
    funnyTopicName2: "Untitled, but make it fancy",
    funnyTopicName3: "The topic formerly known as nameless",
    funnyTopicName4: "Final final v2 (really)",
    funnyTopicName5: "Name TBD, vibes confirmed",
    funnyTopicName6: "Somebody please name me",
    funnyTopicName7: "Nameless topic, big energy",
    funnyTopicName8: "I typed nothing and it still worked",
    attachmentsLabel: "Lecture documents",
    attachmentsEmpty: "No documents yet. Attach PDF, Word or PowerPoint files.",
    attachmentAdd: "Attach file",
    attachmentRemove: "Remove",
    topicTypeLabel: "Topic type",
    topicTypeCanvasHint: "Freeform diagrams, tables and formulas",
    topicTypePlayerHint: "Interactive step-by-step animation",
    importArchiveTitle: "Import archive",
    importArchiveChoose: "Choose ZIP file",
    importKindCourse: "Single Course",
    importKindCourses: "Course Bundle",
    importKindBackup: "Full Backup",
    importConflictLabel: "Conflict resolution",
    importPolicySkip: "Skip existing",
    importPolicyReplace: "Replace existing",
    importPolicyDuplicate: "Import as copy (new ID)",
    importConfirm: "Import now",
    importPartialNone: "No courses imported",
    importErrorUnsupportedVersion: "Archive format is newer than supported; please update the app",
    importErrorCorrupt: "File is not a valid zip archive or is corrupted",
    importErrorUnsafe: "Archive contains unsafe file paths",
    importErrorTooLarge: "Archive size exceeds upload limits"
  }
};

// src/i18n/appShell/he.json
var he_default2 = {
  switchLanguageTooltip: "Switch Language / \u05D4\u05D7\u05DC\u05E3 \u05E9\u05E4\u05D4",
  visualSteps: "\u05E0\u05D2\u05DF \u05E9\u05DC\u05D1\u05D9\u05DD",
  author: {
    websiteAuthorLongPrefix: "\u05D4\u05D0\u05EA\u05E8 \u05E0\u05D1\u05E0\u05D4 \u05E2\u05DC \u05D9\u05D3\u05D9 ",
    websiteAuthorLongSuffix: ", \u05D1\u05E7\u05E8 \u05D1\u05D0\u05EA\u05E8 \u05E9\u05DC\u05D9 \u05DC\u05DE\u05D9\u05D6\u05DE\u05D9\u05DD \u05E0\u05D5\u05E1\u05E4\u05D9\u05DD",
    websiteAuthorShortPrefix: "\u05E2\u05DC \u05D9\u05D3\u05D9 "
  },
  buttons: {
    launchModel: "\u05D4\u05E4\u05E2\u05DC \u05DE\u05D5\u05D3\u05DC",
    retryLoading: "\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1",
    close: "\u05E1\u05D2\u05D5\u05E8",
    sidebar: "\u05EA\u05E4\u05E8\u05D9\u05D8 \u05E6\u05D3",
    patchNotes: "\u05E2\u05D3\u05DB\u05D5\u05E0\u05D9\u05DD",
    aiAssistant: "\u05E2\u05D5\u05D6\u05E8 AI"
  },
  common: {
    save: "\u05E9\u05DE\u05D5\u05E8",
    cancel: "\u05D1\u05D9\u05D8\u05D5\u05DC",
    close: "\u05E1\u05D2\u05D5\u05E8",
    apply: "\u05D4\u05D7\u05DC",
    delete: "\u05DE\u05D7\u05E7",
    edit: "\u05E2\u05E8\u05D5\u05DA",
    back: "\u05D7\u05D6\u05D5\u05E8",
    next: "\u05D4\u05D1\u05D0",
    confirm: "\u05D0\u05D9\u05E9\u05D5\u05E8",
    loading: "\u05D8\u05D5\u05E2\u05DF...",
    error: "\u05E9\u05D2\u05D9\u05D0\u05D4",
    success: "\u05D4\u05E6\u05DC\u05D7\u05D4",
    retry: "\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1",
    search: "\u05D7\u05D9\u05E4\u05D5\u05E9...",
    empty: "(\u05E8\u05D9\u05E7)",
    networkError: "\u05E9\u05D2\u05D9\u05D0\u05EA \u05EA\u05E7\u05E9\u05D5\u05E8\u05EA \u05D1\u05D8\u05E2\u05D9\u05E0\u05EA \u05D4\u05EA\u05D5\u05DB\u05DF",
    tryAgain: "\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1",
    backToHub: "\u05D7\u05D6\u05E8\u05D4 \u05DC\u05D3\u05E3 \u05D4\u05D1\u05D9\u05EA",
    canvasRenderError: "\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D8\u05E2\u05D9\u05E0\u05EA \u05D4\u05E7\u05E0\u05D1\u05E1"
  },
  headers: {
    week1Header: "\u05E9\u05D1\u05D5\u05E2 1: \u05DE\u05D5\u05D3\u05DC\u05D9\u05DD \u05D7\u05D9\u05E9\u05D5\u05D1\u05D9\u05D9\u05DD",
    week2Header: "\u05E9\u05D1\u05D5\u05E2 2: \u05DE\u05DB\u05D5\u05E0\u05D5\u05EA \u05D8\u05D5\u05E8\u05D9\u05E0\u05D2 \u05D5\u05E8\u05D3\u05D5\u05E7\u05E6\u05D9\u05D5\u05EA",
    sidebarBrandTitle: "\u05EA\u05D5\u05E8\u05EA \u05D4\u05E1\u05D9\u05D1\u05D5\u05DB\u05D9\u05D5\u05EA",
    mainHeaderHome: "\u05E1\u05D9\u05D1\u05D5\u05DB\u05D9\u05D5\u05EA \u05D5\u05D7\u05D9\u05E9\u05D5\u05D1\u05D9\u05D5\u05EA",
    mainHeaderDefault: "\u05E4\u05D5\u05E8\u05D8\u05DC \u05E7\u05D5\u05E8\u05E1 \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9"
  },
  home: {
    title: "\u05D3\u05E3 \u05D4\u05D1\u05D9\u05EA",
    welcomeTitle: "\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC\u05D0\u05EA\u05E8 \u05D4\u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9 \u05E9\u05DC \u05E7\u05D5\u05E8\u05E1 \u05D7\u05D9\u05E9\u05D5\u05D1\u05D9\u05D5\u05EA \u05D5\u05E1\u05D9\u05D1\u05D5\u05DB\u05D9\u05D5\u05EA",
    welcomeSubtitle: "\u05E4\u05DC\u05D8\u05E4\u05D5\u05E8\u05DE\u05EA \u05DC\u05DE\u05D9\u05D3\u05D4 \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9\u05EA \u05DC\u05D4\u05DE\u05D7\u05E9\u05D4 \u05D5\u05D9\u05D6\u05D5\u05D0\u05DC\u05D9\u05EA \u05E9\u05DC \u05DE\u05DB\u05D5\u05E0\u05D5\u05EA \u05D8\u05D5\u05E8\u05D9\u05E0\u05D2, \u05DE\u05E9\u05E4\u05D8\u05D9 \u05D4\u05D9\u05E8\u05E8\u05DB\u05D9\u05D4, \u05D5\u05E8\u05D3\u05D5\u05E7\u05E6\u05D9\u05D5\u05EA \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05D0\u05DC\u05D9\u05D5\u05EA.",
    heroPlatformTag: "\u05E4\u05DC\u05D8\u05E4\u05D5\u05E8\u05DE\u05EA \u05D7\u05D9\u05E9\u05D5\u05D1\u05D9\u05D5\u05EA \u05D5\u05E1\u05D9\u05D1\u05D5\u05DB\u05D9\u05D5\u05EA",
    week1Title: "\u05E9\u05D1\u05D5\u05E2 1: \u05DE\u05D1\u05D5\u05D0 \u05D5\u05E0\u05D5\u05E9\u05D0\u05D9\u05DD \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9\u05D9\u05DD",
    lectures: "\u05D4\u05E8\u05E6\u05D0\u05D5\u05EA",
    practice: "\u05EA\u05E8\u05D2\u05D5\u05DC\u05D9\u05DD"
  },
  patchNotes: {
    patchNotesTitle: "\u05E2\u05D3\u05DB\u05D5\u05E0\u05D9 \u05DE\u05E2\u05E8\u05DB\u05EA \u05D5\u05D9\u05D5\u05DE\u05DF \u05D2\u05E8\u05E1\u05D0\u05D5\u05EA",
    patchNotesVersion: "\u05D2\u05E8\u05E1\u05D4 2.4.0",
    patchNotesDesc: "\u05E9\u05D9\u05E4\u05D5\u05E8\u05D9 \u05E7\u05E0\u05D1\u05E1 \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9, \u05E2\u05D9\u05E6\u05D5\u05D1 Nocturne \u05D5\u05DE\u05E0\u05D5\u05E2 \u05D0\u05D9\u05DE\u05D5\u05EA Docker."
  },
  player: {
    activeStep: "\u05E9\u05DC\u05D1 \u05E0\u05D5\u05DB\u05D7\u05D9",
    stepPlayer: "\u05E0\u05D2\u05DF \u05E9\u05DC\u05D1\u05D9\u05DD",
    whatChanged: "\u05DE\u05D4 \u05D4\u05E9\u05EA\u05E0\u05D4",
    why: "\u05DE\u05D3\u05D5\u05E2",
    speedLabel: "\u05DE\u05D4\u05D9\u05E8\u05D5\u05EA",
    fullscreen: "\u05DE\u05E1\u05DA \u05DE\u05DC\u05D0",
    exitFullscreen: "\u05D9\u05E6\u05D9\u05D0\u05D4 \u05DE\u05DE\u05E1\u05DA \u05DE\u05DC\u05D0",
    failedToLoad: "\u05D8\u05E2\u05D9\u05E0\u05EA \u05D4\u05DE\u05D5\u05D3\u05DC \u05D4\u05D7\u05D6\u05D5\u05EA\u05D9 \u05E0\u05DB\u05E9\u05DC\u05D4",
    reset: "\u05D0\u05D9\u05E4\u05D5\u05E1",
    previous: "\u05D4\u05E7\u05D5\u05D3\u05DD",
    next: "\u05D4\u05D1\u05D0",
    play: "\u05E0\u05D9\u05D2\u05D5\u05DF",
    pause: "\u05D4\u05E9\u05D4\u05D9\u05D4",
    scrubber: "\u05DE\u05D7\u05D5\u05D5\u05DF \u05D4\u05EA\u05E6\u05D5\u05D2\u05D4 \u05D4\u05DE\u05E7\u05D3\u05D9\u05DE\u05D4",
    part: "\u05E7\u05D8\u05E2",
    partTitle: "\u05E0\u05D2\u05E0\u05D5 \u05E8\u05E7 \u05E7\u05D8\u05E2 \u05DE\u05D4\u05E9\u05DC\u05D1 \u05D4\u05D6\u05D4",
    loop: "\u05D7\u05D6\u05E8\u05D4",
    loopTitle: "\u05D7\u05D6\u05E8\u05D4 \u05E2\u05DC \u05D4\u05E7\u05D8\u05E2",
    milliseconds: "{value} \u05DE\u05F4\u05E9",
    seconds: "{value} \u05E9\u05E0\u05F3"
  },
  settings: {
    settingsTitle: "\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA",
    tabAppearance: "\u05E2\u05D9\u05E6\u05D5\u05D1 \u05D5\u05E2\u05E8\u05DB\u05EA \u05E0\u05D5\u05E9\u05D0",
    tabAi: "\u05E2\u05D5\u05D6\u05E8 AI",
    tabMcp: "\u05D7\u05D9\u05D1\u05D5\u05E8\u05D9 MCP",
    tabStorage: "\u05D0\u05D7\u05E1\u05D5\u05DF \u05D5\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD",
    tabLogs: "\u05D9\u05D5\u05DE\u05E0\u05D9 \u05DE\u05E2\u05E8\u05DB\u05EA \u05D5\u05D3\u05D9\u05D0\u05D2\u05E0\u05D5\u05E1\u05D8\u05D9\u05E7\u05D4",
    popoutLogs: "\u05E4\u05EA\u05D7 \u05D1\u05D7\u05DC\u05D5\u05DF \u05E0\u05E4\u05E8\u05D3",
    dockLogs: "\u05D4\u05D7\u05D6\u05E8 \u05DC\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA",
    refreshLogs: "\u05E8\u05E2\u05E0\u05DF",
    autoRefreshLogs: "\u05E8\u05E2\u05E0\u05D5\u05DF \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9",
    autoScrollLogs: "\u05D2\u05DC\u05D9\u05DC\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA",
    scrollToBottom: "\u05D2\u05DC\u05D5\u05DC \u05DC\u05EA\u05D7\u05EA\u05D9\u05EA",
    copyLogs: "\u05D4\u05E2\u05EA\u05E7",
    copiedLogs: "\u05D4\u05D5\u05E2\u05EA\u05E7!",
    runLogsTab: "\u05E8\u05D9\u05E6\u05D4 \u05E0\u05D5\u05DB\u05D7\u05D9\u05EA",
    runtimeErrorsTab: "\u05E9\u05D2\u05D9\u05D0\u05D5\u05EA \u05D6\u05DE\u05DF \u05E8\u05D9\u05E6\u05D4",
    allRunsTab: "\u05DB\u05DC \u05D4\u05E8\u05D9\u05E6\u05D5\u05EA",
    searchLogs: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05D1\u05D9\u05D5\u05DE\u05E0\u05D9\u05DD...",
    noLogs: "\u05D0\u05D9\u05DF \u05D9\u05D5\u05DE\u05E0\u05D9\u05DD \u05E2\u05D3\u05D9\u05D9\u05DF.",
    accentColor: "\u05E6\u05D1\u05E2 \u05D4\u05D3\u05D2\u05E9\u05D4",
    themeMode: "\u05DE\u05E6\u05D1 \u05D1\u05D4\u05D9\u05E8 / \u05DB\u05D4\u05D4",
    themeModeLight: "\u05D1\u05D4\u05D9\u05E8",
    themeModeDark: "\u05DB\u05D4\u05D4",
    language: "\u05E9\u05E4\u05D4",
    selectLanguage: "\u05D1\u05D7\u05E8 \u05E9\u05E4\u05D4",
    hebrew: "\u05E2\u05D1\u05E8\u05D9\u05EA",
    english: "\u05D0\u05E0\u05D2\u05DC\u05D9\u05EA",
    clearAutoSaves: "\u05E0\u05E7\u05D4 \u05E9\u05DE\u05D9\u05E8\u05D5\u05EA \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05D5\u05EA \u05E9\u05DC \u05E7\u05E0\u05D1\u05E1",
    clearChatHistory: "\u05E0\u05E7\u05D4 \u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D9\u05EA \u05E9\u05D9\u05D7\u05D5\u05EA AI",
    resetAll: "\u05D0\u05E4\u05E1 \u05D0\u05EA \u05DB\u05DC \u05D4\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA \u05D4\u05DE\u05E7\u05D5\u05DE\u05D9\u05D5\u05EA",
    clearedSuccess: "\u05E0\u05D5\u05E7\u05D4 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4",
    close: "\u05E1\u05D2\u05D5\u05E8"
  },
  status: {
    accept: "\u05E7\u05D1\u05DC\u05D4",
    reject: "\u05D3\u05D7\u05D9\u05D9\u05D4",
    looping: "\u05DC\u05D5\u05DC\u05D0\u05D4 \u05D0\u05D9\u05E0\u05E1\u05D5\u05E4\u05D9\u05EA",
    currentState: "\u05DE\u05E6\u05D1 \u05E0\u05D5\u05DB\u05D7\u05D9",
    stepCount: "\u05DE\u05D5\u05E0\u05D4 \u05E6\u05E2\u05D3\u05D9\u05DD",
    headPointer: "\u05DE\u05D9\u05E7\u05D5\u05DD \u05E8\u05D0\u05E9",
    inputInstance: "\u05DE\u05D5\u05E4\u05E2 \u05E7\u05DC\u05D8",
    polyReduction: "\u05E8\u05D3\u05D5\u05E7\u05E6\u05D9\u05D4 \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05EA",
    targetDecider: "\u05DE\u05DB\u05E8\u05D9\u05E2 \u05D9\u05E2\u05D3"
  },
  topics: {
    recallPTitle: "\u05D7\u05D6\u05E8\u05D4 \u05E2\u05DC \u05D4\u05DE\u05D7\u05DC\u05E7\u05D4 P",
    recallPDesc: "\u05D1\u05E2\u05D9\u05D5\u05EA \u05D4\u05DB\u05E8\u05E2\u05D4 \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05D0\u05DC\u05D9\u05D5\u05EA \u05D3\u05D8\u05E8\u05DE\u05D9\u05E0\u05D9\u05E1\u05D8\u05D9\u05D5\u05EA \u05D5\u05DE\u05D0\u05E4\u05D9\u05D9\u05E0\u05D9 \u05E1\u05D9\u05D1\u05D5\u05DB\u05D9\u05D5\u05EA.",
    timeHierarchyTitle: "\u05DE\u05E9\u05E4\u05D8 \u05D4\u05D9\u05E8\u05E8\u05DB\u05D9\u05D9\u05EA \u05D4\u05D6\u05DE\u05DF",
    timeHierarchyDesc: "\u05D4\u05D5\u05DB\u05D7\u05D4 \u05D7\u05D6\u05D5\u05EA\u05D9\u05EA \u05DC\u05D4\u05E4\u05E8\u05D3\u05D4 \u05D1\u05D9\u05DF \u05DE\u05D7\u05DC\u05E7\u05D5\u05EA \u05D6\u05DE\u05DF \u05D5\u05D3\u05D9\u05D0\u05D2\u05D5\u05E0\u05DC\u05D9\u05D6\u05E6\u05D9\u05D4.",
    reductionPipelineTitle: "\u05E6\u05D9\u05E0\u05D5\u05E8 \u05E8\u05D3\u05D5\u05E7\u05E6\u05D9\u05D4",
    reductionPipelineDesc: "\u05DE\u05D9\u05E4\u05D5\u05D9 \u05E6\u05E2\u05D3-\u05D0\u05D7\u05E8-\u05E6\u05E2\u05D3 \u05E9\u05DC \u05E8\u05D3\u05D5\u05E7\u05E6\u05D9\u05D4 \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05EA \u05D1\u05D9\u05DF \u05D1\u05E2\u05D9\u05D5\u05EA \u05D7\u05D9\u05E9\u05D5\u05D1\u05D9\u05D5\u05EA.",
    gadgetGraphTitle: "\u05D1\u05E0\u05D9\u05D9\u05EA \u05D2\u05E8\u05E3 \u05D2\u05D0\u05D3\u05D2\u05F3\u05D8\u05D9\u05DD",
    gadgetGraphDesc: "\u05D8\u05E8\u05E0\u05E1\u05E4\u05D5\u05E8\u05DE\u05E6\u05D9\u05D5\u05EA \u05D7\u05D6\u05D5\u05EA\u05D9\u05D5\u05EA \u05DE\u05E4\u05E1\u05D5\u05E7\u05D9\u05D5\u05EA \u05DC\u05EA\u05EA\u05D9-\u05D2\u05E8\u05E4\u05D9\u05DD \u05D5\u05D0\u05D9\u05DE\u05D5\u05EA.",
    dfsColoringTitle: "\u05E6\u05D1\u05D9\u05E2\u05EA \u05D2\u05E8\u05E3 \u05D1-DFS",
    dfsColoringDesc: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9 \u05DC\u05E6\u05D1\u05D9\u05E2\u05D4 \u05D1-3 \u05E6\u05D1\u05E2\u05D9\u05DD \u05D5\u05D1\u05D3\u05D9\u05E7\u05EA \u05D0\u05D9\u05DC\u05D5\u05E6\u05D9 \u05E6\u05DE\u05EA\u05D9\u05DD."
  },
  update: {
    updateAvailable: "\u05E2\u05D3\u05DB\u05D5\u05DF \u05D6\u05DE\u05D9\u05DF",
    newVersion: "\u05D2\u05E8\u05E1\u05D4 {version} \u05D6\u05DE\u05D9\u05E0\u05D4 \u05DC\u05D4\u05D5\u05E8\u05D3\u05D4",
    updateAction: "\u05E2\u05D3\u05DB\u05DF \u05D1\u05D4\u05E4\u05E2\u05DC\u05D4 \u05D4\u05D1\u05D0\u05D4",
    updateAndRestart: "\u05E2\u05D3\u05DB\u05DF \u05D5\u05D4\u05E4\u05E2\u05DC \u05DE\u05D7\u05D3\u05E9",
    updateRestarting: "\u05DE\u05E2\u05D3\u05DB\u05DF \u05D5\u05DE\u05E4\u05E2\u05D9\u05DC \u05DE\u05D7\u05D3\u05E9...",
    updatingScheduled: "\u05EA\u05D5\u05D6\u05DE\u05DF \u05DC\u05D4\u05E4\u05E2\u05DC\u05D4 \u05D4\u05D1\u05D0\u05D4",
    restartHint: "\u05E1\u05D2\u05D5\u05E8 \u05D5\u05D4\u05E4\u05E2\u05DC \u05DE\u05D7\u05D3\u05E9 \u05D0\u05EA StudyTS \u05DC\u05E1\u05D9\u05D5\u05DD \u05D4\u05E2\u05D3\u05DB\u05D5\u05DF.",
    skipVersion: "\u05D3\u05DC\u05D2 \u05E2\u05DC \u05D2\u05E8\u05E1\u05D4 \u05D6\u05D5",
    later: "\u05DE\u05D0\u05D5\u05D7\u05E8 \u05D9\u05D5\u05EA\u05E8",
    rollbackNotice: "\u05D4\u05E2\u05D3\u05DB\u05D5\u05DF \u05D4\u05D0\u05D7\u05E8\u05D5\u05DF \u05D1\u05D5\u05D8\u05DC. \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05E9\u05DC\u05DA \u05DC\u05D0 \u05E0\u05E4\u05D2\u05E2\u05D5.",
    dismiss: "\u05E1\u05D2\u05D5\u05E8",
    updateBadge: "\u05E2\u05D3\u05DB\u05D5\u05DF",
    whatsNew: "\u05DE\u05D4 \u05D7\u05D3\u05E9",
    tabTitle: "\u05E2\u05D3\u05DB\u05D5\u05E0\u05D9\u05DD",
    currentVersion: "\u05D2\u05E8\u05E1\u05D4 \u05E0\u05D5\u05DB\u05D7\u05D9\u05EA",
    checkNow: "\u05D1\u05D3\u05D5\u05E7 \u05E2\u05D3\u05DB\u05D5\u05E0\u05D9\u05DD",
    checking: "\u05D1\u05D5\u05D3\u05E7...",
    lastChecked: "\u05E0\u05D1\u05D3\u05E7 \u05DC\u05D0\u05D7\u05E8\u05D5\u05E0\u05D4",
    upToDate: "\u05D4\u05D2\u05E8\u05E1\u05D4 \u05E9\u05DC\u05DA \u05DE\u05E2\u05D5\u05D3\u05DB\u05E0\u05EA.",
    justChecked: "\u05E0\u05D1\u05D3\u05E7 \u05D4\u05E8\u05D2\u05E2. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1 \u05D1\u05E2\u05D5\u05D3 \u05DB\u05DE\u05D4 \u05E9\u05E0\u05D9\u05D5\u05EA.",
    offline: "\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D4\u05EA\u05D7\u05D1\u05E8 \u05DC\u05E9\u05E8\u05EA \u05D4\u05E2\u05D3\u05DB\u05D5\u05E0\u05D9\u05DD. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1 \u05DB\u05E9\u05D9\u05E9 \u05D7\u05D9\u05D1\u05D5\u05E8.",
    rateLimited: "\u05D9\u05D5\u05EA\u05E8 \u05DE\u05D3\u05D9 \u05D1\u05D3\u05D9\u05E7\u05D5\u05EA \u05E2\u05D3\u05DB\u05D5\u05DF. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1 \u05DE\u05D0\u05D5\u05D7\u05E8 \u05D9\u05D5\u05EA\u05E8.",
    noReleases: "\u05E2\u05D3\u05D9\u05D9\u05DF \u05DC\u05D0 \u05E4\u05D5\u05E8\u05E1\u05DE\u05D5 \u05D2\u05E8\u05E1\u05D0\u05D5\u05EA.",
    checkError: "\u05D1\u05D3\u05D9\u05E7\u05EA \u05D4\u05E2\u05D3\u05DB\u05D5\u05DF \u05E0\u05DB\u05E9\u05DC\u05D4.",
    appliedOnNextStart: "\u05D4\u05E2\u05D3\u05DB\u05D5\u05DF \u05DE\u05EA\u05D1\u05E6\u05E2 \u05D1\u05D4\u05E4\u05E2\u05DC\u05D4 \u05D4\u05D1\u05D0\u05D4 \u05E9\u05DC StudyTS. \u05D4\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA (.env), \u05DE\u05E1\u05D3 \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D5\u05E0\u05EA\u05D5\u05E0\u05D9 \u05D4\u05E7\u05D5\u05E8\u05E1\u05D9\u05DD (data/) \u05E0\u05E9\u05DE\u05E8\u05D9\u05DD.",
    scheduledFor: "\u05DE\u05EA\u05D5\u05D6\u05DE\u05DF: \u05D2\u05E8\u05E1\u05D4 {version}"
  },
  mcp: {
    tabMcp: "StudyTs-MCP",
    tabAiProvider: "\u05E1\u05E4\u05E7 AI",
    mcpTitle: "\u05D3\u05DE\u05D5\u05DF StudyTs-MCP",
    mcpSubtitle: "\u05D3\u05DE\u05D5\u05DF \u05DE\u05E7\u05D5\u05DE\u05D9 \u05DE\u05D0\u05D5\u05D7\u05D3 \u05D4\u05DE\u05D7\u05D1\u05E8 \u05DB\u05DC\u05D9\u05DD, \u05DE\u05E1\u05D3 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D5\u05DE\u05D7\u05D1\u05E8\u05D5\u05EA \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05DC\u05E2\u05D5\u05D6\u05E8 \u05D4-AI.",
    addServer: "\u05D4\u05D5\u05E1\u05E3 \u05E9\u05E8\u05EA MCP",
    serverName: "\u05E9\u05DD \u05D4\u05E9\u05E8\u05EA",
    command: "\u05E4\u05E7\u05D5\u05D3\u05D4",
    args: "\u05D0\u05E8\u05D2\u05D5\u05DE\u05E0\u05D8\u05D9\u05DD (\u05DE\u05D5\u05E4\u05E8\u05D3\u05D9\u05DD \u05D1\u05E8\u05D5\u05D5\u05D7)",
    autoStart: "\u05D4\u05E4\u05E2\u05DC \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05E2\u05DD \u05D4\u05E9\u05E8\u05EA",
    statusConnected: "\u05DE\u05D7\u05D5\u05D1\u05E8",
    statusConnecting: "\u05DE\u05EA\u05D7\u05D1\u05E8...",
    statusStopped: "\u05DE\u05D5\u05E4\u05E1\u05E7",
    statusError: "\u05E9\u05D2\u05D9\u05D0\u05D4",
    start: "\u05D4\u05E4\u05E2\u05DC",
    stop: "\u05E2\u05E6\u05D5\u05E8",
    ping: "\u05D1\u05D3\u05D9\u05E7\u05EA \u05E7\u05E9\u05E8",
    delete: "\u05DE\u05D7\u05E7",
    toolsCount: "{count} \u05DB\u05DC\u05D9\u05DD \u05D6\u05DE\u05D9\u05E0\u05D9\u05DD",
    noServers: "StudyTs-MCP \u05D0\u05D9\u05E0\u05D5 \u05E4\u05D5\u05E2\u05DC \u05DB\u05E2\u05EA.",
    tutorialBtn: "\u05D0\u05D9\u05DA StudyTs-MCP \u05E4\u05D5\u05E2\u05DC",
    tutorialTitle: "\u05D0\u05E8\u05DB\u05D9\u05D8\u05E7\u05D8\u05D5\u05E8\u05D4 \u05D5\u05DE\u05D3\u05E8\u05D9\u05DA StudyTs-MCP",
    step1Title: "1. \u05DE\u05D4 \u05D6\u05D4 StudyTs-MCP?",
    step1Desc: "StudyTs-MCP \u05D4\u05D5\u05D0 \u05D3\u05DE\u05D5\u05DF \u05DE\u05E7\u05D5\u05DE\u05D9 \u05DE\u05D0\u05D5\u05D7\u05D3 \u05D4\u05E4\u05D5\u05E2\u05DC \u05D1\u05DE\u05D7\u05E9\u05D1\u05DA \u05DE\u05E2\u05DC stdio JSON-RPC. \u05D4\u05D5\u05D0 \u05DE\u05D7\u05D1\u05E8 \u05D0\u05EA \u05E2\u05D5\u05D6\u05E8 \u05D4-AI \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05DC\u05DE\u05E1\u05D3 \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD, \u05DC\u05DE\u05D7\u05D1\u05E8\u05D5\u05EA \u05D5\u05DC\u05EA\u05D5\u05DB\u05DF \u05D4\u05E7\u05D5\u05E8\u05E1\u05D9\u05DD \u05DC\u05DC\u05D0 \u05EA\u05DC\u05D5\u05EA \u05D1\u05E2\u05E0\u05DF.",
    step2Title: "2. \u05EA\u05D7\u05D5\u05DE\u05D9 \u05D0\u05D7\u05E8\u05D9\u05D5\u05EA \u05D5\u05D9\u05DB\u05D5\u05DC\u05D5\u05EA",
    step2Desc: "StudyTs-MCP \u05DE\u05D0\u05D2\u05D3 \u05D0\u05EA \u05DB\u05DC 12 \u05D4\u05DB\u05DC\u05D9\u05DD \u05EA\u05D7\u05EA 3 \u05EA\u05D7\u05D5\u05DE\u05D9\u05DD: \u05DE\u05D7\u05E7\u05E8 \u05D5\u05DE\u05D7\u05D1\u05E8\u05D5\u05EA, \u05DE\u05E1\u05D3 \u05E0\u05EA\u05D5\u05E0\u05D9 \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD \u05D1-SQLite, \u05D5\u05D9\u05E6\u05D9\u05E8\u05EA \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD.",
    step3Title: "3. \u05D1\u05D3\u05D9\u05E7\u05EA \u05D3\u05DE\u05D5\u05DF \u05D7\u05D9\u05D4",
    step3Desc: "\u05D4\u05E8\u05E5 \u05E9\u05D0\u05D9\u05DC\u05EA\u05EA \u05D1\u05D3\u05D9\u05E7\u05D4 \u05DE\u05D9\u05D9\u05D3\u05D9\u05EA \u05D5\u05E0\u05E7\u05D9\u05D9\u05D4 \u05DE\u05EA\u05D5\u05E4\u05E2\u05D5\u05EA \u05DC\u05D5\u05D5\u05D0\u05D9 \u05DE\u05D5\u05DC \u05D3\u05DE\u05D5\u05DF StudyTs-MCP \u05D4\u05E4\u05E2\u05D9\u05DC.",
    testSnippetPlaceholder: "\u05D4\u05D6\u05DF \u05E9\u05D0\u05D9\u05DC\u05EA\u05D4 \u05D0\u05D5 \u05D4\u05E9\u05D0\u05E8 \u05E8\u05D9\u05E7 \u05DC\u05D1\u05D3\u05D9\u05E7\u05D4...",
    testSendBtn: "\u05D4\u05E8\u05E5 \u05D1\u05D3\u05D9\u05E7\u05EA \u05D3\u05DE\u05D5\u05DF",
    sending: "\u05E9\u05D5\u05DC\u05D7...",
    testSuccess: "\u05D3\u05DE\u05D5\u05DF StudyTs-MCP \u05D4\u05D2\u05D9\u05D1 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4!",
    testFailed: "\u05D4\u05D1\u05D3\u05D9\u05E7\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4:",
    close: "\u05E1\u05D2\u05D5\u05E8",
    nextStep: "\u05D4\u05D1\u05D0",
    prevStep: "\u05D7\u05D6\u05D5\u05E8",
    saveServer: "\u05E9\u05DE\u05D5\u05E8 \u05E9\u05E8\u05EA",
    cancel: "\u05D1\u05D9\u05D8\u05D5\u05DC",
    activeTools: "\u05DB\u05DC\u05D9\u05DD \u05E4\u05E2\u05D9\u05DC\u05D9\u05DD",
    domainNotebooks: "\u05DE\u05D7\u05E7\u05E8 \u05D5\u05DE\u05D7\u05D1\u05E8\u05D5\u05EA",
    domainDatabase: "\u05DE\u05E1\u05D3 \u05E0\u05EA\u05D5\u05E0\u05D9 \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD",
    domainAuthoring: "\u05D9\u05E6\u05D9\u05E8\u05EA \u05D5\u05E2\u05E8\u05D9\u05DB\u05EA \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD",
    howItWorksTitle: "\u05D0\u05D9\u05DA StudyTs-MCP \u05E4\u05D5\u05E2\u05DC",
    howItWorksSubtitle: "\u05E6\u05D9\u05E0\u05D5\u05E8 \u05D0\u05D9\u05E0\u05D8\u05D2\u05E8\u05E6\u05D9\u05D4 MCP \u05DE\u05E7\u05D5\u05DE\u05D9 \u05D5\u05D1\u05DC\u05EA\u05D9-\u05EA\u05DC\u05D5\u05D9 \u05D1\u05DE\u05D5\u05D3\u05DC",
    architectureClient: "\u05E2\u05D5\u05D6\u05E8 \u05E9\u05D9\u05D7\u05EA AI",
    architectureClientDesc: "\u05DE\u05DE\u05E9\u05E7 \u05D4\u05DE\u05E9\u05EA\u05DE\u05E9 \u05DE\u05E4\u05E2\u05D9\u05DC \u05DB\u05DC\u05D9\u05DD \u05D1\u05D6\u05DE\u05DF \u05DC\u05D9\u05DE\u05D5\u05D3 \u05D5\u05E2\u05E8\u05D9\u05DB\u05EA \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD",
    architectureGateway: "\u05E9\u05E2\u05E8 \u05D4-API \u05E9\u05DC Express",
    architectureGatewayDesc: "\u05DE\u05E0\u05EA\u05D1 \u05E7\u05E8\u05D9\u05D0\u05D5\u05EA \u05D1\u05E0\u05EA\u05D9\u05D1 /api/mcp \u05DE\u05E2\u05DC stdio \u05D1-JSON-RPC",
    architectureDaemon: "\u05D3\u05DE\u05D5\u05DF StudyTs-MCP",
    architectureDaemonDesc: "\u05EA\u05D4\u05DC\u05D9\u05DA \u05E8\u05E7\u05E2 \u05D9\u05D7\u05D9\u05D3 \u05D4\u05DE\u05E0\u05D4\u05DC 12 \u05DB\u05DC\u05D9 \u05EA\u05D7\u05D5\u05DD \u05DE\u05E7\u05D5\u05DE\u05D9\u05D9\u05DD",
    architectureStorage: "\u05DE\u05E1\u05D3 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D5\u05E7\u05D1\u05E6\u05D9\u05DD \u05DE\u05E7\u05D5\u05DE\u05D9\u05D9\u05DD",
    architectureStorageDesc: "\u05E9\u05D0\u05D9\u05DC\u05EA\u05D5\u05EA SQLite \u05DC\u05E7\u05E8\u05D9\u05D0\u05D4 \u05D1\u05DC\u05D1\u05D3 \u05D5\u05E9\u05DE\u05D9\u05E8\u05EA \u05E7\u05D1\u05E6\u05D9\u05DD \u05D0\u05D8\u05D5\u05DE\u05D9\u05EA \u05D1-data/"
  },
  complexityClasses: {
    P: {
      name: "\u05DE\u05D7\u05DC\u05E7\u05EA P",
      description: "\u05D1\u05E2\u05D9\u05D5\u05EA \u05D4\u05E0\u05D9\u05EA\u05E0\u05D5\u05EA \u05DC\u05D4\u05DB\u05E8\u05E2\u05D4 \u05D1\u05D6\u05DE\u05DF \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05D0\u05DC\u05D9 \u05D1\u05DE\u05DB\u05D5\u05E0\u05EA \u05D8\u05D5\u05E8\u05D9\u05E0\u05D2 \u05D3\u05D8\u05E8\u05DE\u05D9\u05E0\u05D9\u05E1\u05D8\u05D9\u05EA."
    },
    NP: {
      name: "\u05DE\u05D7\u05DC\u05E7\u05EA NP",
      description: "\u05D1\u05E2\u05D9\u05D5\u05EA \u05D4\u05E0\u05D9\u05EA\u05E0\u05D5\u05EA \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA \u05D1\u05D6\u05DE\u05DF \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05D0\u05DC\u05D9 \u05D0\u05D5 \u05DC\u05D4\u05DB\u05E8\u05E2\u05D4 \u05D1\u05DE\u05DB\u05D5\u05E0\u05EA \u05D8\u05D5\u05E8\u05D9\u05E0\u05D2 \u05D0\u05D9-\u05D3\u05D8\u05E8\u05DE\u05D9\u05E0\u05D9\u05E1\u05D8\u05D9\u05EA."
    },
    NPC: {
      name: "\u05DE\u05D7\u05DC\u05E7\u05EA NP-Complete",
      description: "\u05D4\u05D1\u05E2\u05D9\u05D5\u05EA \u05D4\u05E7\u05E9\u05D5\u05EA \u05D1\u05D9\u05D5\u05EA\u05E8 \u05D1-NP, \u05D0\u05DC\u05D9\u05D4\u05DF \u05DB\u05DC \u05D1\u05E2\u05D9\u05D4 \u05D1-NP \u05E0\u05D9\u05EA\u05E0\u05EA \u05DC\u05E8\u05D3\u05D5\u05E7\u05E6\u05D9\u05D4 \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05EA."
    },
    PSPACE: {
      name: "\u05DE\u05D7\u05DC\u05E7\u05EA PSPACE",
      description: "\u05D1\u05E2\u05D9\u05D5\u05EA \u05D4\u05E0\u05D9\u05EA\u05E0\u05D5\u05EA \u05DC\u05D4\u05DB\u05E8\u05E2\u05D4 \u05D1\u05D6\u05D9\u05DB\u05E8\u05D5\u05DF (\u05DE\u05E7\u05D5\u05DD) \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05D0\u05DC\u05D9."
    },
    EXPTIME: {
      name: "\u05DE\u05D7\u05DC\u05E7\u05EA EXPTIME",
      description: "\u05D1\u05E2\u05D9\u05D5\u05EA \u05D4\u05E0\u05D9\u05EA\u05E0\u05D5\u05EA \u05DC\u05D4\u05DB\u05E8\u05E2\u05D4 \u05D1\u05D6\u05DE\u05DF \u05D0\u05E7\u05E1\u05E4\u05D5\u05E0\u05E0\u05E6\u05D9\u05D0\u05DC\u05D9 $O(2^{p(n)})$."
    }
  },
  hub: {
    topics: "\u05E0\u05D5\u05E9\u05D0\u05D9\u05DD",
    addTopic: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E0\u05D5\u05E9\u05D0",
    coursesTitle: "\u05E7\u05D5\u05E8\u05E1\u05D9\u05DD",
    coursesIntro: "\u05D1\u05D7\u05E8\u05D5 \u05E7\u05D5\u05E8\u05E1 \u05DB\u05D3\u05D9 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC.",
    platformTagline: "\u05E4\u05DC\u05D8\u05E4\u05D5\u05E8\u05DE\u05EA \u05D7\u05D9\u05E9\u05D5\u05D1\u05D9\u05D5\u05EA \u05D5\u05E1\u05D9\u05D1\u05D5\u05DB\u05D9\u05D5\u05EA",
    hubTitle: "\u05E4\u05D5\u05E8\u05D8\u05DC \u05D4\u05E7\u05D5\u05E8\u05E1\u05D9\u05DD \u05D5\u05D9\u05D7\u05D9\u05D3\u05D5\u05EA \u05D4\u05DC\u05D9\u05DE\u05D5\u05D3",
    hubSubtitle: "\u05D1\u05D7\u05E8 \u05E7\u05D5\u05E8\u05E1 \u05DB\u05D3\u05D9 \u05DC\u05E6\u05E4\u05D5\u05EA \u05D1\u05D4\u05D3\u05DE\u05D9\u05D5\u05EA \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9\u05D5\u05EA, \u05D4\u05E8\u05E6\u05D0\u05D5\u05EA \u05D5\u05EA\u05E8\u05D2\u05D5\u05DC\u05D9\u05DD.",
    availableCourses: "\u05E7\u05D5\u05E8\u05E1\u05D9\u05DD \u05D6\u05DE\u05D9\u05E0\u05D9\u05DD",
    exploreCourse: "\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DC\u05E7\u05D5\u05E8\u05E1",
    weeksLabel: "\u05E9\u05D1\u05D5\u05E2\u05D5\u05EA",
    interactiveModules: "\u05D9\u05D7\u05D9\u05D3\u05D5\u05EA \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9\u05D5\u05EA",
    coursesHub: "\u05DE\u05E8\u05DB\u05D6 \u05D4\u05E7\u05D5\u05E8\u05E1\u05D9\u05DD",
    allCourses: "\u05DB\u05DC \u05D4\u05E7\u05D5\u05E8\u05E1\u05D9\u05DD",
    fieldTitle: "\u05DB\u05D5\u05EA\u05E8\u05EA",
    fieldDescription: "\u05EA\u05D9\u05D0\u05D5\u05E8",
    titlePlaceholder: "\u05DC\u05D3\u05D5\u05D2\u05DE\u05D4: \u05DE\u05D1\u05E0\u05D9 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD",
    descriptionPlaceholder: "\u05EA\u05D9\u05D0\u05D5\u05E8 \u05E7\u05E6\u05E8",
    apply: "\u05D4\u05D7\u05DC",
    saving: "\u05E9\u05D5\u05DE\u05E8\u2026",
    cancel: "\u05D1\u05D9\u05D8\u05D5\u05DC",
    close: "\u05E1\u05D2\u05D9\u05E8\u05D4",
    editCourse: "\u05E2\u05E8\u05D9\u05DB\u05EA \u05E7\u05D5\u05E8\u05E1",
    editSection: "\u05E2\u05E8\u05D9\u05DB\u05EA \u05E4\u05E8\u05E7",
    editTopic: "\u05E2\u05E8\u05D9\u05DB\u05EA \u05E0\u05D5\u05E9\u05D0",
    courseIdLabel: "\u05DE\u05D6\u05D4\u05D4 \u05E7\u05D5\u05E8\u05E1",
    sectionIdLabel: "\u05DE\u05D6\u05D4\u05D4 \u05E4\u05E8\u05E7",
    topicIdLabel: "\u05DE\u05D6\u05D4\u05D4 \u05E0\u05D5\u05E9\u05D0",
    idDerivedNote: "\u05E0\u05D5\u05E6\u05E8 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05D5\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05E9\u05D9\u05E0\u05D5\u05D9 \u05D0\u05D7\u05E8 \u05DB\u05DA.",
    idWaitingForTitle: "(\u05D4\u05E7\u05DC\u05D9\u05D3\u05D5 \u05DB\u05D5\u05EA\u05E8\u05EA \u05DC\u05DE\u05E2\u05DC\u05D4)",
    idCannotDerive: "\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D9\u05E6\u05D5\u05E8 \u05DE\u05D6\u05D4\u05D4 \u05DE\u05D4\u05DB\u05D5\u05EA\u05E8\u05EA. \u05D4\u05D5\u05E1\u05D9\u05E4\u05D5 \u05D0\u05D5\u05EA\u05D9\u05D5\u05EA \u05D1\u05D0\u05E0\u05D2\u05DC\u05D9\u05EA \u05D0\u05D5 \u05E1\u05E4\u05E8\u05D5\u05EA \u05DC\u05DB\u05D5\u05EA\u05E8\u05EA.",
    idInvalid: '\u05D4\u05DE\u05D6\u05D4\u05D4 "{id}" \u05D0\u05D9\u05E0\u05D5 \u05EA\u05E7\u05D9\u05DF. \u05D4\u05E9\u05EA\u05DE\u05E9\u05D5 \u05D1\u05D0\u05D5\u05EA\u05D9\u05D5\u05EA \u05E7\u05D8\u05E0\u05D5\u05EA \u05D1\u05D0\u05E0\u05D2\u05DC\u05D9\u05EA, \u05E1\u05E4\u05E8\u05D5\u05EA, \u05DE\u05E7\u05E4\u05D9\u05DD \u05D5\u05E7\u05D5\u05D5\u05D9\u05DD \u05EA\u05D7\u05EA\u05D5\u05E0\u05D9\u05DD, \u05D5\u05D4\u05EA\u05D7\u05D9\u05DC\u05D5 \u05D1\u05D0\u05D5\u05EA \u05D0\u05D5 \u05D1\u05E1\u05E4\u05E8\u05D4.',
    exportCourse: "\u05D9\u05D9\u05E6\u05D5\u05D0 \u05D4\u05E7\u05D5\u05E8\u05E1 \u05DB\u05E7\u05D5\u05D1\u05E5 ZIP",
    importCourseFromZip: "\u05D9\u05D9\u05D1\u05D5\u05D0 \u05E7\u05D5\u05E8\u05E1 \u05DE\u05E7\u05D5\u05D1\u05E5 ZIP",
    deleteCourse: "\u05DE\u05D7\u05D9\u05E7\u05EA \u05D4\u05E7\u05D5\u05E8\u05E1",
    deleteSection: "\u05DE\u05D7\u05D9\u05E7\u05EA \u05D4\u05E4\u05E8\u05E7",
    deleteTopic: "\u05DE\u05D7\u05D9\u05E7\u05EA \u05D4\u05E0\u05D5\u05E9\u05D0",
    exportPdfCourse: "\u05D9\u05D9\u05E6\u05D5\u05D0 \u05D4\u05E7\u05D5\u05E8\u05E1 \u05DC-PDF",
    openStepMaker: "\u05D9\u05D5\u05E6\u05E8 \u05E6\u05E2\u05D3\u05D9\u05DD",
    exportPdfWeek: "\u05D9\u05D9\u05E6\u05D5\u05D0 \u05D4\u05E4\u05E8\u05E7 \u05DC-PDF",
    exportPdfSectionLabel: "\u05E4\u05E8\u05E7",
    exportingPdf: "\u05DE\u05DB\u05D9\u05DF PDF\u2026 {done}/{total}",
    exportPdfEmpty: "\u05D0\u05D9\u05DF \u05E0\u05D5\u05E9\u05D0\u05D9 \u05E7\u05E0\u05D1\u05E1 \u05DC\u05D9\u05D9\u05E6\u05D5\u05D0.",
    exportPdfFailed: "\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D8\u05E2\u05D5\u05DF: {names}",
    confirmDelete: "\u05DC\u05D0\u05E9\u05E8?",
    addCourse: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E7\u05D5\u05E8\u05E1",
    addSection: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E4\u05E8\u05E7",
    edit: "\u05E2\u05E8\u05D9\u05DB\u05D4",
    doneEditing: "\u05E1\u05D9\u05D5\u05DD \u05E2\u05E8\u05D9\u05DB\u05D4",
    noTopicsYet: "\u05E2\u05D3\u05D9\u05D9\u05DF \u05D0\u05D9\u05DF \u05E0\u05D5\u05E9\u05D0\u05D9\u05DD. \u05D4\u05E4\u05E2\u05D9\u05DC\u05D5 \u05E2\u05E8\u05D9\u05DB\u05D4 \u05DB\u05D3\u05D9 \u05DC\u05D4\u05D5\u05E1\u05D9\u05E3.",
    deleteAnyway: "\u05DC\u05DE\u05D7\u05D5\u05E7 \u05D1\u05DB\u05DC \u05D6\u05D0\u05EA",
    sectionHasTopics: '\u05DC\u05E4\u05E8\u05E7 "{name}" \u05E2\u05D3\u05D9\u05D9\u05DF \u05D9\u05E9 \u05E0\u05D5\u05E9\u05D0\u05D9\u05DD. \u05DC\u05DE\u05D7\u05D5\u05E7 \u05D0\u05D5\u05EA\u05D5 \u05D5\u05D0\u05EA \u05DB\u05DC \u05D4\u05E0\u05D5\u05E9\u05D0\u05D9\u05DD \u05E9\u05DC\u05D5?',
    importCourseTitle: "\u05D9\u05D9\u05D1\u05D5\u05D0 \u05E7\u05D5\u05E8\u05E1",
    importCourseHint: "\u05D4\u05E2\u05DC\u05D5 \u05E7\u05D5\u05D1\u05E5 ZIP \u05E9\u05DC \u05E7\u05D5\u05E8\u05E1 \u05E9\u05D9\u05D5\u05E6\u05D0 \u05DE\u05D4\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4 \u05D4\u05D6\u05D5.",
    importing: "\u05DE\u05D9\u05D9\u05D1\u05D0\u2026",
    importAction: "\u05D9\u05D9\u05D1\u05D5\u05D0",
    importFailed: "\u05D4\u05D9\u05D9\u05D1\u05D5\u05D0 \u05E0\u05DB\u05E9\u05DC",
    topicKindCanvas: "\u05E7\u05E0\u05D1\u05E1",
    topicKindFile: "\u05DE\u05E1\u05DE\u05DA",
    topicTypeFileHint: "\u05D4\u05E2\u05DC\u05D0\u05EA \u05DE\u05E1\u05DE\u05DA \u05D4\u05E8\u05E6\u05D0\u05D4 \u05DC\u05E9\u05D9\u05E2\u05D5\u05E8",
    fileTopicEmpty: "\u05DC\u05E0\u05D5\u05E9\u05D0 \u05D4\u05DE\u05E1\u05DE\u05DA \u05D4\u05D6\u05D4 \u05E2\u05D3\u05D9\u05D9\u05DF \u05D0\u05D9\u05DF \u05E7\u05D5\u05D1\u05E5.",
    attachmentTypeRefused: "\u05E1\u05D5\u05D2 \u05D4\u05E7\u05D5\u05D1\u05E5 \u05D0\u05D9\u05E0\u05D5 \u05E0\u05EA\u05DE\u05DA",
    attachFileChoose: "\u05D1\u05D7\u05D9\u05E8\u05EA \u05E7\u05D5\u05D1\u05E5",
    attachFileChange: "\u05D4\u05D7\u05DC\u05E4\u05EA \u05E7\u05D5\u05D1\u05E5",
    topicKindPlayer: "\u05E0\u05D2\u05DF \u05E9\u05DC\u05D1\u05D9\u05DD",
    funnyTopicName1: "\u05D4\u05D9\u05D9\u05EA\u05D9 \u05E2\u05E6\u05DC\u05DF \u05DE\u05D3\u05D9 \u05DC\u05EA\u05EA \u05E9\u05DD \u05DC\u05E0\u05D5\u05E9\u05D0 \u05E9\u05DC\u05D9",
    funnyTopicName2: "\u05DC\u05DC\u05D0 \u05DB\u05D5\u05EA\u05E8\u05EA, \u05D0\u05D1\u05DC \u05D1\u05E1\u05D8\u05D9\u05D9\u05DC",
    funnyTopicName3: "\u05D4\u05E0\u05D5\u05E9\u05D0 \u05E9\u05E4\u05E2\u05DD \u05D4\u05D9\u05D4 \u05D1\u05DC\u05D9 \u05E9\u05DD",
    funnyTopicName4: "\u05E1\u05D5\u05E4\u05D9 \u05E1\u05D5\u05E4\u05D9 v2 (\u05D1\u05D0\u05DE\u05EA)",
    funnyTopicName5: "\u05D4\u05E9\u05DD \u05D9\u05D9\u05E7\u05D1\u05E2, \u05D4\u05D0\u05D5\u05D5\u05D9\u05E8\u05D4 \u05D0\u05D5\u05E9\u05E8\u05D4",
    funnyTopicName6: "\u05DE\u05D9\u05E9\u05D4\u05D5 \u05D1\u05D1\u05E7\u05E9\u05D4 \u05D9\u05D9\u05EA\u05DF \u05DC\u05D9 \u05E9\u05DD",
    funnyTopicName7: "\u05E0\u05D5\u05E9\u05D0 \u05D1\u05DC\u05D9 \u05E9\u05DD, \u05D0\u05E0\u05E8\u05D2\u05D9\u05D4 \u05D2\u05D3\u05D5\u05DC\u05D4",
    funnyTopicName8: "\u05DC\u05D0 \u05D4\u05E7\u05DC\u05D3\u05EA\u05D9 \u05DB\u05DC\u05D5\u05DD \u05D5\u05D6\u05D4 \u05E2\u05D3\u05D9\u05D9\u05DF \u05E2\u05D1\u05D3",
    attachmentsLabel: "\u05DE\u05E1\u05DE\u05DB\u05D9 \u05D4\u05E8\u05E6\u05D0\u05D4",
    attachmentsEmpty: "\u05D0\u05D9\u05DF \u05DE\u05E1\u05DE\u05DB\u05D9\u05DD \u05E2\u05D3\u05D9\u05D9\u05DF. \u05E6\u05E8\u05E4\u05D5 \u05E7\u05D1\u05E6\u05D9 PDF, Word \u05D0\u05D5 PowerPoint.",
    attachmentAdd: "\u05E6\u05D9\u05E8\u05D5\u05E3 \u05E7\u05D5\u05D1\u05E5",
    attachmentRemove: "\u05D4\u05E1\u05E8\u05D4",
    topicTypeLabel: "\u05E1\u05D5\u05D2 \u05E0\u05D5\u05E9\u05D0",
    topicTypeCanvasHint: "\u05D3\u05D9\u05D0\u05D2\u05E8\u05DE\u05D5\u05EA \u05D7\u05D5\u05E4\u05E9\u05D9\u05D5\u05EA, \u05D8\u05D1\u05DC\u05D0\u05D5\u05EA \u05D5\u05E0\u05D5\u05E1\u05D7\u05D0\u05D5\u05EA",
    topicTypePlayerHint: "\u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D4 \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9\u05EA \u05E9\u05DC\u05D1 \u05D0\u05D7\u05E8 \u05E9\u05DC\u05D1",
    importArchiveTitle: "\u05D9\u05D9\u05D1\u05D5\u05D0 \u05D0\u05E8\u05DB\u05D9\u05D5\u05DF",
    importArchiveChoose: "\u05D1\u05D7\u05D9\u05E8\u05EA \u05E7\u05D5\u05D1\u05E5 ZIP",
    importKindCourse: "\u05E7\u05D5\u05E8\u05E1 \u05D1\u05D5\u05D3\u05D3",
    importKindCourses: "\u05D7\u05D1\u05D9\u05DC\u05EA \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD",
    importKindBackup: "\u05D2\u05D9\u05D1\u05D5\u05D9 \u05DE\u05DC\u05D0",
    importConflictLabel: "\u05E4\u05EA\u05E8\u05D5\u05DF \u05D4\u05EA\u05E0\u05D2\u05E9\u05D5\u05D9\u05D5\u05EA",
    importPolicySkip: "\u05D3\u05DC\u05D2 \u05E2\u05DC \u05E7\u05D9\u05D9\u05DD",
    importPolicyReplace: "\u05D4\u05D7\u05DC\u05E3 \u05E7\u05D9\u05D9\u05DD",
    importPolicyDuplicate: "\u05D9\u05D9\u05D1\u05D0 \u05DB\u05E2\u05D5\u05EA\u05E7 (\u05DE\u05D6\u05D4\u05D4 \u05D7\u05D3\u05E9)",
    importConfirm: "\u05D9\u05D9\u05D1\u05D5\u05D0 \u05E2\u05DB\u05E9\u05D9\u05D5",
    importPartialNone: "\u05DC\u05D0 \u05D9\u05D5\u05D1\u05D0\u05D5 \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD",
    importErrorUnsupportedVersion: "\u05D2\u05E8\u05E1\u05EA \u05E4\u05D5\u05E8\u05DE\u05D8 \u05D4\u05D0\u05E8\u05DB\u05D9\u05D5\u05DF \u05D7\u05D3\u05E9\u05D4 \u05DE\u05D4\u05E0\u05EA\u05DE\u05DB\u05EA; \u05D0\u05E0\u05D0 \u05E2\u05D3\u05DB\u05E0\u05D5 \u05D0\u05EA \u05D4\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4",
    importErrorCorrupt: "\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D0\u05D9\u05E0\u05D5 \u05D0\u05E8\u05DB\u05D9\u05D5\u05DF ZIP \u05EA\u05E7\u05D9\u05DF \u05D0\u05D5 \u05E4\u05D2\u05D5\u05DD",
    importErrorUnsafe: "\u05D4\u05D0\u05E8\u05DB\u05D9\u05D5\u05DF \u05DE\u05DB\u05D9\u05DC \u05E0\u05EA\u05D9\u05D1\u05D9\u05DD \u05DC\u05D0 \u05D1\u05D8\u05D5\u05D7\u05D9\u05DD",
    importErrorTooLarge: "\u05D2\u05D5\u05D3\u05DC \u05D4\u05D0\u05E8\u05DB\u05D9\u05D5\u05DF \u05D7\u05D5\u05E8\u05D2 \u05DE\u05D4\u05DE\u05D2\u05D1\u05DC\u05D4"
  }
};

// src/i18n/visualAuthoring/en.json
var en_default3 = {
  errorBoundary: {
    title: "Something went wrong",
    safe: "Your last saved version is safe.",
    recover: "Recover from backup",
    reload: "Reload"
  },
  opening: {
    newer: "This spec was saved by a newer version of the app, so it opens read-only. It is untouched on disk.",
    migrationFailed: "Could not upgrade this spec, so it was not opened. The saved copy is untouched. Error: "
  },
  timeline: {
    play: "Play",
    pause: "Pause",
    playTitle: "Play or pause the preview (Space)",
    playStep: "Play step",
    playStepTitle: "Play only the current step from its start",
    splitClip: "Split",
    splitClipTitle: "Split the clip at the playhead (S)",
    duplicateClip: "Duplicate",
    duplicateClipTitle: "Duplicate the clip after its end (D)",
    deleteClip: "Delete",
    deleteClipTitle: "Delete the clip (Del)",
    playheadTime: "Playhead time",
    seconds: "{value} s",
    calloutText: "Callout text",
    snap: "Snap",
    snapTitle: "Magnet to edges, playhead and ticks (hold Alt to bypass)",
    zoomHint: "Zoom: + / - or Ctrl+wheel around the mouse, 0 fits the step",
    zoomReadout: "{px} px/s",
    timelineLabel: "Timeline",
    ghosts: "Ghosts",
    ghostsTitle: "Show removed and not-yet-created objects",
    animationsInStep: "Animations in this step",
    noAnimation: "No animation in this step yet. Select a shape or arrow, then press A or the Animate button.",
    previewTime: "Preview time",
    tickSeconds: "{value}s",
    stepsLabel: "Steps",
    hasCaption: "Has a caption",
    addStep: "Add step",
    duplicateStep: "Duplicate step",
    deleteStep: "Delete step",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    actualSize: "100%",
    fit: "Fit"
  },
  canvas: {
    headerHidden: "Header Hidden",
    headerVisible: "Header Visible",
    cardTitle: "Card Title",
    direction: "Direction",
    untitledBlock: "Untitled block...",
    editBlock: "Edit {kind} block",
    addBlock: "Add Block",
    duplicate: "Duplicate",
    movePageTo: "Move to page",
    movePageLabel: "Page {n}",
    moveToNewPage: "Move to new page",
    delete: "Delete",
    lock: "Lock",
    unlock: "Unlock",
    fitToContent: "Fit to Content",
    autoHeight: "Auto Height",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    resetZoom: "Reset Zoom",
    stylePreset: "Style Preset",
    custom: "Custom",
    newStylePlaceholder: "New style name\u2026",
    add: "Add",
    patterns: {
      blank: "Clean Blank",
      dots: "Subtle Dots",
      grid: "Square Grid",
      isometric: "Isometric",
      blueprint: "Blueprint",
      mesh: "Gradient Mesh"
    },
    presets: {
      plain: "Plain",
      card: "Card",
      proof: "Formal Proof",
      callout: "Callout",
      code: "Code Block"
    },
    media: {
      image: "Image",
      pdf: "PDF",
      video: "Video",
      expandPreview: "Expand preview",
      downloadImage: "Download image",
      download: "Download",
      close: "Close",
      expandVideo: "Expand video",
      expandYouTube: "Expand YouTube video",
      openPdf: "Open PDF",
      openNewTab: "Open in new tab",
      openInYouTube: "Open in YouTube",
      loadingPreview: "Loading preview\u2026",
      clickToExpandPdf: "Click to expand PDF",
      pdfEmptyTitle: "No PDF URL provided",
      pdfEmptyDesc: "Select this block in Edit Mode and use the Content Editor to paste a PDF URL.",
      uploadPdf: "Upload PDF",
      url: "URL",
      set: "Set"
    },
    duality: {
      certificate: "Strong Duality Certificate",
      primalOptimal: "Primal Optimal Value",
      dualOptimal: "Dual Optimal Value",
      dualityGap: "Duality Gap"
    },
    pipeline: {
      addStage: "Add Stage",
      removeStage: "Remove Stage"
    },
    header: {
      editModeEnter: "Edit Mode",
      editModeExit: "Exit Edit Mode",
      restoreSave: "Restore last save",
      restoring: "Restoring...",
      noPreviousSave: "No previous save to restore",
      undo: "Undo",
      undoTooltip: "Undo (Ctrl+Z)",
      redo: "Redo",
      redoTooltip: "Redo (Ctrl+Shift+Z)",
      layers: "Layers",
      layersTooltip: "Layers panel",
      properties: "Properties",
      propertiesTooltip: "Properties & Settings panel",
      splitView: "Split",
      splitViewTooltip: "Dual Pane: Live Editor & Presentation",
      editorOnly: "Editor",
      editorOnlyTooltip: "Editor only",
      previewOnly: "Preview",
      previewOnlyTooltip: "Live presentation preview only",
      syncViewport: "Synchronize scroll & zoom between editor and preview",
      print: "Print",
      printTooltip: "Print / Export to PDF",
      restore: "Restore"
    }
  },
  builderTextB: {
    hintSelect: "Select: click to select, drag to move, double click to rename. Use the Arrow tool (L) to connect shapes.",
    hintArrow: "Arrow: drag from a shape or a \u25CF port onto another shape \xB7 Esc to cancel",
    hintFrom: "From {name}: click the shape to connect to \xB7 Esc to cancel",
    hintDrag: "Release on a shape to connect, or on empty space to add a new one \xB7 Esc to cancel",
    hintQuickAdd: "Choose a shape to add here and connect, or press Esc",
    hintWalkStart: "Walk a path: click the shapes in order \xB7 Enter to finish \xB7 Esc to cancel",
    hintWalk: "Walk: {path} \xB7 Enter to finish \xB7 Esc to cancel",
    hintPickSpot: "Click the canvas where the shape should go \xB7 Esc to cancel",
    hintPickTarget: "{effect}: click the {kinds} to animate \xB7 Esc to cancel",
    noticePickShape: "Pick a shape, not a link.",
    noticeSecond: "Pick a second shape, or press Esc to cancel.",
    noticeFirst: "Click the first shape, or press Esc to cancel.",
    noticeKinds: "Pick {kinds} for this animation.",
    layoutOutline: '"{a}" sits on the outline of "{b}"',
    layoutCrossed: '"{a}" is crossed by the line "{b}"',
    layoutOverlap: '"{a}" overlaps "{b}"',
    layoutOutside: '"{a}" leaves the viewBox',
    layoutPartlyOutside: '"{a}" partly leaves the viewBox',
    layoutOrphan: '"{a}" has a missing parent or link end',
    cvBringInside: "Bring inside",
    nameArrow: "Arrow {from} to {to}",
    nameLabelled: "{shape} \u201C{label}\u201D",
    nameIdentified: "{shape} ({id})",
    shapeCircle: "Circle",
    shapeOval: "Oval",
    shapeBox: "Box",
    shapeRounded: "Rounded box",
    shapeDiamond: "Diamond",
    shapeTriangle: "Triangle",
    shapeLine: "Line",
    shapeArrow: "Arrow",
    shapeText: "Text",
    shapeHeading: "Heading",
    shapeCaption: "Caption",
    shapeNote: "Note",
    shapeUnknown: "Shape",
    cvBuilderSettings: "Builder settings",
    cvHistory: "History",
    cvAdd: "Add",
    cvView: "View",
    cvGridNone: "No grid",
    cvGridLines: "Grid lines",
    cvGridDots: "Dot grid",
    cvDocument: "Document",
    cvTool: "Tool",
    cvLayout: "Layout",
    cvUndo: "Undo",
    cvRedo: "Redo",
    cvSelect: "Select",
    cvArrow: "Arrow",
    cvAnimate: "Animate",
    cvAnimateSelected: "Animate the selected object (A)",
    cvSelectToAnimate: "Select an object on the canvas first, then animate it",
    cvBuildLarge: "Build large",
    cvSplit: "Split",
    cvPreviewLarge: "Preview large",
    cvSnapToGrid: "Snap to grid",
    cvProject: "Project",
    cvSectionLocal: "Local spec",
    cvSectionPublish: "Publish to course",
    cvSectionTransfer: "Import / export",
    cvKeyboardShortcuts: "Keyboard shortcuts",
    cvAppearsAtStep: "appears step {n}",
    cvRemovedAtStep: "removed at step {n}",
    cvCanvasLabel: "Builder canvas",
    cvZoomHint: "Wheel zooms, middle button drags",
    cvZoomReadout: "Zoom {percent}%",
    cvOutsideStage: "! outside the real stage",
    cvLayoutNotes: "Layout notes",
    cvCanvasActions: "Canvas actions",
    cvAddText: "Add text",
    cvAddCaption: "Add caption",
    cvInsertObject: "Insert object\u2026",
    cvRemoveLabel: "Remove label",
    cvAddLabel: "Add label",
    cvRename: "Rename",
    cvConnect: "Connect",
    cvDuplicate: "Duplicate",
    cvDelete: "Delete",
    cvReverse: "Reverse",
    cvStraight: "Straight",
    cvElbow: "Elbow",
    cvCurve: "Curve",
    cvShapeTools: "Shape tools",
    cvArrowTools: "Arrow tools",
    cvRoute: "Route",
    cvArrowHead: "Arrow head",
    cvArrowLabel: "Arrow label",
    cvLabelPlaceholder: "label",
    cvColourName: "Colour {name}",
    cvBlue: "Blue",
    cvPurple: "Purple",
    cvGreen: "Green",
    cvOrange: "Orange",
    cvPink: "Pink",
    cvAddAndConnect: "Add a shape and connect",
    cvAddShapeHere: "Add a new shape here and connect",
    cvCircle: "Circle",
    cvBox: "Box",
    cvDiamond: "Diamond",
    cvShapeText: "Shape text",
    cvLivePreview: "Live preview",
    cvPopOut: "Pop out",
    cvShortcutSelectTool: "Select tool",
    cvShortcutArrowTool: "Arrow tool",
    cvShortcutAddShapes: "Add circle, box, diamond, text, heading, caption, note, custom",
    cvShortcutAnimate: "Add an animation",
    cvShortcutNewStep: "New step",
    cvShortcutPrevNext: "Previous or next step",
    cvShortcutPlayPause: "Play or pause the preview",
    cvShortcutDelete: "Delete selected",
    cvShortcutEdit: "Edit selected",
    cvShortcutCancel: "Cancel and go back to Select",
    cvShortcutUndoRedo: "Undo or redo",
    cvShortcutDuplicate: "Duplicate selected",
    cvShortcutNudge: "Nudge selected, Shift for 10",
    cvClose: "Close"
  },
  builderTextC: {
    edEditShape: "Edit shape",
    edName: "Name",
    edText: "Text",
    edColour: "Colour",
    edWidth: "Width",
    edHeight: "Height",
    edDone: "Done",
    edFill: "Fill",
    edFillStrength: "Fill strength",
    edOutline: "Outline",
    edLineColor: "Color",
    edThickness: "Thickness",
    edOutlineWidth: "Outline width",
    edLine: "Line",
    edOutlineStyle: "Outline style",
    edSolid: "Solid",
    edDashed: "Dashed",
    edDotted: "Dotted",
    edAccent: "Accent",
    edTextColor: "Text color",
    edTextSize: "Text size",
    edSmall: "Small",
    edMedium: "Medium",
    edLarge: "Large",
    edHuge: "Huge",
    edSize: "Size",
    edNone: "none",
    edCustomColor: "custom color",
    edColourBlue: "Blue",
    edColourPurple: "Purple",
    edColourCyan: "Cyan",
    edColourGreen: "Green",
    edColourYellow: "Yellow",
    edColourOrange: "Orange",
    edColourPink: "Pink",
    edColourRed: "Red",
    edColourAmber: "Amber",
    edColourWhite: "White",
    edChooseAnimation: "Choose an animation",
    edFor: "for",
    edOr: "or",
    edAnyObject: "any object",
    edKindShapes: "shapes",
    edKindBoxes: "boxes",
    edKindArrows: "arrows",
    edKindLines: "lines",
    edKindText: "text",
    edEffectFill: "Fill",
    edEffectFillDesc: "The shape fills with colour.",
    edEffectReveal: "Reveal",
    edEffectRevealDesc: "The shape fades in.",
    edEffectRemove: "Remove",
    edEffectRemoveDesc: "The shape fades out and stays gone.",
    edEffectDraw: "Draw in",
    edEffectDrawDesc: "The arrow draws from start to end.",
    edEffectTravel: "Travel",
    edEffectTravelDesc: "A token rides along the arrow.",
    edEffectFlow: "Flow",
    edEffectFlowDesc: "Dashes stream along the arrow.",
    edEffectSpark: "Zigzag",
    edEffectSparkDesc: "A zigzag spark runs along the arrow.",
    edEffectFrame: "Zigzag outline",
    edEffectFrameDesc: "A marching dashed frame, like the swap marker.",
    edEffectPulse: "Pulse",
    edEffectPulseDesc: "The shape swells and settles.",
    edEffectGlow: "Glow",
    edEffectGlowDesc: "Glows until the step ends or you calm it down.",
    edEffectSweep: "Highlight sweep",
    edEffectSweepDesc: "A bar of light crosses the shape from left to right.",
    edEffectCallout: "Callout",
    edEffectCalloutDesc: "A short note appears beside the shape for the step.",
    edEffectFade: "Fade",
    edEffectFadeDesc: "The object dims to make the rest stand out.",
    edEffectTint: "Colour change",
    edEffectTintDesc: "The object switches to another colour.",
    edEffectOutline: "Emphasise outline",
    edEffectOutlineDesc: "The outline thickens.",
    edEffectSoften: "Soft highlight",
    edEffectSoftenDesc: "The fill brightens softly.",
    edEffectMove: "Move",
    edEffectMoveDesc: "The object slides to a new spot.",
    edEffectGrow: "Grow or shrink",
    edEffectGrowDesc: "The object grows to a larger size.",
    edEffectBounce: "Bounce",
    edEffectBounceDesc: "The object hops up and settles back."
  },
  insertGallery: {
    title: "Insert",
    filterAll: "All",
    filterLabel: "Filter shapes by section",
    atStep: "at step {n}: it appears from this step",
    searchLabel: "Search shapes",
    searchPlaceholder: "Search shapes, for example state",
    noResults: "Nothing matches",
    replaceConfirm: "Replace what is on the canvas with this starter? You can undo it.",
    basic: "Basic",
    templates: "Templates",
    outsideMode: "More matches outside this mode",
    modeButton: "Mode",
    modeTitle: "Workspace mode",
    modeShowAll: "Show all",
    modeEverything: "everything",
    modeCategories: "categories",
    modeCategory: "category",
    modeStartWith: "Start with",
    modeStartHint: "or pick an object from Insert",
    modeInspector: "Selection",
    modeNothing: "Select an item to edit it.",
    modeLabelField: "Label",
    modeSize: "Size",
    modeNextSymbol: "Next symbol",
    modeBend: "Bend",
    modeStart: "Start state",
    modeAccepting: "Accepting",
    modeReplace: "Replace",
    modeColour: "Colour",
    modeRun: "Run that object",
    modeRunHint: "Runs from the selected object, or from the first one",
    modeKeep: "Keep my drawing",
    modeSets: "sets",
    modeRegions: "regions",
    modeItems: "items",
    modeLinks: "links",
    modeOutside: "outside all sets",
    stylePacks: "Style packs",
    stylePacksNote: "Style packs are files in the diagramPacks folder. Importing your own is not available yet.",
    presets: {
      circle: "Circle",
      box: "Box",
      diamond: "Diamond",
      text: "Text",
      heading: "Heading",
      caption: "Caption",
      note: "Note",
      custom: "Custom",
      ellipse: "Oval",
      rounded: "Rounded box",
      triangle: "Triangle",
      line: "Line",
      arrow: "Arrow"
    }
  }
};

// src/i18n/visualAuthoring/he.json
var he_default3 = {
  errorBoundary: {
    title: "\u05DE\u05E9\u05D4\u05D5 \u05D4\u05E9\u05EA\u05D1\u05E9",
    safe: "\u05D4\u05D2\u05E8\u05E1\u05D4 \u05D4\u05D0\u05D7\u05E8\u05D5\u05E0\u05D4 \u05E9\u05E9\u05DE\u05E8\u05EA \u05D1\u05D8\u05D5\u05D7\u05D4.",
    recover: "\u05E9\u05D7\u05D6\u05D5\u05E8 \u05DE\u05D4\u05D2\u05D9\u05D1\u05D5\u05D9",
    reload: "\u05D8\u05E2\u05D9\u05E0\u05D4 \u05DE\u05D7\u05D3\u05E9"
  },
  opening: {
    newer: "\u05D4\u05DE\u05E4\u05E8\u05D8 \u05E0\u05E9\u05DE\u05E8 \u05D1\u05D2\u05E8\u05E1\u05D4 \u05D7\u05D3\u05E9\u05D4 \u05D9\u05D5\u05EA\u05E8 \u05E9\u05DC \u05D4\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4, \u05DC\u05DB\u05DF \u05D4\u05D5\u05D0 \u05E0\u05E4\u05EA\u05D7 \u05DC\u05E7\u05E8\u05D9\u05D0\u05D4 \u05D1\u05DC\u05D1\u05D3. \u05D4\u05E7\u05D5\u05D1\u05E5 \u05DC\u05D0 \u05E9\u05D5\u05E0\u05D4 \u05D1\u05D3\u05D9\u05E1\u05E7.",
    migrationFailed: "\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05E9\u05D3\u05E8\u05D2 \u05D0\u05EA \u05D4\u05DE\u05E4\u05E8\u05D8, \u05D5\u05DC\u05DB\u05DF \u05DC\u05D0 \u05E0\u05E4\u05EA\u05D7. \u05D4\u05E2\u05D5\u05EA\u05E7 \u05D4\u05E9\u05DE\u05D5\u05E8 \u05DC\u05D0 \u05E9\u05D5\u05E0\u05D4. \u05E9\u05D2\u05D9\u05D0\u05D4: "
  },
  timeline: {
    play: "\u05E0\u05D9\u05D2\u05D5\u05DF",
    pause: "\u05D4\u05E9\u05D4\u05D9\u05D9\u05D4",
    playTitle: "\u05E0\u05D9\u05D2\u05D5\u05DF \u05D0\u05D5 \u05D4\u05E9\u05D4\u05D9\u05D4 \u05E9\u05DC \u05D4\u05EA\u05E6\u05D5\u05D2\u05D4 \u05D4\u05DE\u05E7\u05D3\u05D9\u05DE\u05D4 (Space)",
    playStep: "\u05E0\u05D9\u05D2\u05D5\u05DF \u05E9\u05DC\u05D1",
    playStepTitle: "\u05E0\u05D9\u05D2\u05D5\u05DF \u05D4\u05E9\u05DC\u05D1 \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9 \u05D1\u05DC\u05D1\u05D3, \u05DE\u05EA\u05D7\u05D9\u05DC\u05EA\u05D5",
    splitClip: "\u05E4\u05D9\u05E6\u05D5\u05DC",
    splitClipTitle: "\u05E4\u05D9\u05E6\u05D5\u05DC \u05D4\u05E7\u05DC\u05D9\u05E4 \u05D1\u05E8\u05D0\u05E9 \u05D4\u05E0\u05D9\u05D2\u05D5\u05DF (S)",
    duplicateClip: "\u05E9\u05DB\u05E4\u05D5\u05DC",
    duplicateClipTitle: "\u05E9\u05DB\u05E4\u05D5\u05DC \u05D4\u05E7\u05DC\u05D9\u05E4 \u05D0\u05D7\u05E8\u05D9 \u05E1\u05D5\u05E4\u05D5 (D)",
    deleteClip: "\u05DE\u05D7\u05D9\u05E7\u05D4",
    deleteClipTitle: "\u05DE\u05D7\u05D9\u05E7\u05EA \u05D4\u05E7\u05DC\u05D9\u05E4 (Del)",
    playheadTime: "\u05D6\u05DE\u05DF \u05E8\u05D0\u05E9 \u05D4\u05E0\u05D9\u05D2\u05D5\u05DF",
    seconds: "{value} \u05E9\u05E0\u05F3",
    calloutText: "\u05D8\u05E7\u05E1\u05D8 \u05D4\u05E1\u05D1\u05E8",
    snap: "\u05D4\u05E6\u05DE\u05D3\u05D4",
    snapTitle: "\u05D4\u05E6\u05DE\u05D3\u05D4 \u05DC\u05E7\u05E6\u05D5\u05D5\u05EA, \u05DC\u05E8\u05D0\u05E9 \u05D4\u05E0\u05D9\u05D2\u05D5\u05DF \u05D5\u05DC\u05E1\u05D9\u05DE\u05E0\u05D9\u05DD (\u05D4\u05D7\u05D6\u05E7 Alt \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC)",
    zoomHint: "\u05D6\u05D5\u05DD: + / - \u05D0\u05D5 Ctrl+\u05D2\u05DC\u05D2\u05DC\u05EA \u05E1\u05D1\u05D9\u05D1 \u05D4\u05E2\u05DB\u05D1\u05E8, 0 \u05DE\u05EA\u05D0\u05D9\u05DD \u05D0\u05EA \u05D4\u05E9\u05DC\u05D1",
    zoomReadout: "{px} \u05E4\u05D9\u05E7\u05E1\u05DC/\u05E9\u05E0\u05F3",
    timelineLabel: "\u05E6\u05D9\u05E8 \u05D6\u05DE\u05DF",
    ghosts: "\u05E6\u05DC\u05DC\u05D9\u05DD",
    ghostsTitle: "\u05D4\u05E6\u05D2\u05EA \u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8\u05D9\u05DD \u05E9\u05E0\u05DE\u05D7\u05E7\u05D5 \u05D5\u05E9\u05E2\u05D3\u05D9\u05D9\u05DF \u05DC\u05D0 \u05E0\u05D5\u05E6\u05E8\u05D5",
    animationsInStep: "\u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D5\u05EA \u05D1\u05E9\u05DC\u05D1 \u05D4\u05D6\u05D4",
    noAnimation: "\u05D0\u05D9\u05DF \u05E2\u05D3\u05D9\u05D9\u05DF \u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D4 \u05D1\u05E9\u05DC\u05D1 \u05D4\u05D6\u05D4. \u05D1\u05D7\u05E8 \u05E6\u05D5\u05E8\u05D4 \u05D0\u05D5 \u05D7\u05E5, \u05D5\u05D0\u05D6 \u05DC\u05D7\u05E5 \u05E2\u05DC A \u05D0\u05D5 \u05E2\u05DC \u05DB\u05E4\u05EA\u05D5\u05E8 \u05D4\u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D4.",
    previewTime: "\u05D6\u05DE\u05DF \u05EA\u05E6\u05D5\u05D2\u05D4 \u05DE\u05E7\u05D3\u05D9\u05DE\u05D4",
    tickSeconds: "{value} \u05E9\u05E0\u05F3",
    stepsLabel: "\u05E9\u05DC\u05D1\u05D9\u05DD",
    hasCaption: "\u05D9\u05E9 \u05DB\u05D9\u05EA\u05D5\u05D1",
    addStep: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E9\u05DC\u05D1",
    duplicateStep: "\u05E9\u05DB\u05E4\u05D5\u05DC \u05E9\u05DC\u05D1",
    deleteStep: "\u05DE\u05D7\u05D9\u05E7\u05EA \u05E9\u05DC\u05D1",
    zoomOut: "\u05D4\u05E7\u05D8\u05E0\u05EA \u05D6\u05D5\u05DD",
    zoomIn: "\u05D4\u05D2\u05D3\u05DC\u05EA \u05D6\u05D5\u05DD",
    actualSize: "100%",
    fit: "\u05D4\u05EA\u05D0\u05DE\u05D4"
  },
  canvas: {
    headerHidden: "\u05DB\u05D5\u05EA\u05E8\u05EA \u05DE\u05D5\u05E1\u05EA\u05E8\u05EA",
    headerVisible: "\u05DB\u05D5\u05EA\u05E8\u05EA \u05DE\u05D5\u05E6\u05D2\u05EA",
    cardTitle: "\u05DB\u05D5\u05EA\u05E8\u05EA \u05DB\u05E8\u05D8\u05D9\u05E1",
    direction: "\u05DB\u05D9\u05D5\u05D5\u05DF",
    untitledBlock: "\u05D1\u05DC\u05D5\u05E7 \u05DC\u05DC\u05D0 \u05E9\u05DD...",
    editBlock: "\u05E2\u05E8\u05D5\u05DA \u05D1\u05DC\u05D5\u05E7 {kind}",
    addBlock: "\u05D4\u05D5\u05E1\u05E3 \u05D1\u05DC\u05D5\u05E7",
    duplicate: "\u05E9\u05DB\u05E4\u05DC",
    movePageTo: "\u05D4\u05E2\u05D1\u05E8 \u05DC\u05E2\u05DE\u05D5\u05D3",
    movePageLabel: "\u05E2\u05DE\u05D5\u05D3 {n}",
    moveToNewPage: "\u05D4\u05E2\u05D1\u05E8 \u05DC\u05E2\u05DE\u05D5\u05D3 \u05D7\u05D3\u05E9",
    delete: "\u05DE\u05D7\u05E7",
    lock: "\u05E0\u05E2\u05DC",
    unlock: "\u05D1\u05D8\u05DC \u05E0\u05E2\u05D9\u05DC\u05D4",
    fitToContent: "\u05D4\u05EA\u05D0\u05DD \u05DC\u05EA\u05D5\u05DB\u05DF",
    autoHeight: "\u05D2\u05D5\u05D1\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9",
    zoomIn: "\u05D4\u05D2\u05D3\u05DC",
    zoomOut: "\u05D4\u05E7\u05D8\u05DF",
    resetZoom: "\u05D0\u05E4\u05E1 \u05EA\u05E6\u05D5\u05D2\u05D4",
    stylePreset: "\u05E2\u05E8\u05DB\u05EA \u05E1\u05D2\u05E0\u05D5\u05DF",
    custom: "\u05DE\u05D5\u05EA\u05D0\u05DD \u05D0\u05D9\u05E9\u05D9\u05EA",
    newStylePlaceholder: "\u05E9\u05DD \u05E1\u05D2\u05E0\u05D5\u05DF \u05D7\u05D3\u05E9\u2026",
    add: "\u05D4\u05D5\u05E1\u05E3",
    patterns: {
      blank: "\u05E0\u05E7\u05D9 \u05DC\u05DC\u05D0 \u05E8\u05E9\u05EA",
      dots: "\u05E0\u05E7\u05D5\u05D3\u05D5\u05EA \u05E2\u05D3\u05D9\u05E0\u05D5\u05EA",
      grid: "\u05E8\u05E9\u05EA \u05DE\u05E9\u05D1\u05E6\u05D5\u05EA",
      isometric: "\u05D0\u05D9\u05D6\u05D5\u05DE\u05D8\u05E8\u05D9",
      blueprint: "\u05E9\u05E8\u05D8\u05D5\u05D8 \u05D4\u05E0\u05D3\u05E1\u05D9",
      mesh: "\u05E8\u05E9\u05EA \u05D2\u05E8\u05D3\u05D9\u05D0\u05E0\u05D8"
    },
    presets: {
      plain: "\u05E8\u05D2\u05D9\u05DC",
      card: "\u05DB\u05E8\u05D8\u05D9\u05E1",
      proof: "\u05D4\u05D5\u05DB\u05D7\u05D4 \u05E4\u05D5\u05E8\u05DE\u05DC\u05D9\u05EA",
      callout: "\u05D4\u05E2\u05E8\u05EA \u05D4\u05D3\u05D2\u05E9\u05D4",
      code: "\u05D1\u05DC\u05D5\u05E7 \u05E7\u05D5\u05D3"
    },
    media: {
      image: "\u05EA\u05DE\u05D5\u05E0\u05D4",
      pdf: "PDF",
      video: "\u05D5\u05D9\u05D3\u05D0\u05D5",
      expandPreview: "\u05D4\u05D2\u05D3\u05DC \u05EA\u05DE\u05D5\u05E0\u05D4",
      downloadImage: "\u05D4\u05D5\u05E8\u05D3 \u05EA\u05DE\u05D5\u05E0\u05D4",
      download: "\u05D4\u05D5\u05E8\u05D3",
      close: "\u05E1\u05D2\u05D5\u05E8",
      expandVideo: "\u05D4\u05D2\u05D3\u05DC \u05D5\u05D9\u05D3\u05D0\u05D5",
      expandYouTube: "\u05D4\u05D2\u05D3\u05DC \u05E1\u05E8\u05D8\u05D5\u05DF YouTube",
      openPdf: "\u05E4\u05EA\u05D7 PDF",
      openNewTab: "\u05E4\u05EA\u05D7 \u05D1\u05DC\u05E9\u05D5\u05E0\u05D9\u05EA \u05D7\u05D3\u05E9\u05D4",
      openInYouTube: "\u05E4\u05EA\u05D7 \u05D1-YouTube",
      loadingPreview: "\u05D8\u05D5\u05E2\u05DF \u05EA\u05E6\u05D5\u05D2\u05D4 \u05DE\u05E7\u05D3\u05D9\u05DE\u05D4\u2026",
      clickToExpandPdf: "\u05DC\u05D7\u05E5 \u05DC\u05D4\u05E8\u05D7\u05D1\u05EA \u05D4\u05DE\u05E1\u05DE\u05DA",
      pdfEmptyTitle: "\u05DC\u05D0 \u05E0\u05D1\u05D7\u05E8 \u05E7\u05D5\u05D1\u05E5 PDF",
      pdfEmptyDesc: "\u05D1\u05D7\u05E8 \u05D1\u05DC\u05D5\u05E7 \u05D6\u05D4 \u05D1\u05DE\u05E6\u05D1 \u05E2\u05E8\u05D9\u05DB\u05D4 \u05D5\u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05E2\u05D5\u05E8\u05DA \u05D4\u05EA\u05D5\u05DB\u05DF \u05DB\u05D3\u05D9 \u05DC\u05D4\u05D3\u05D1\u05D9\u05E7 \u05DB\u05EA\u05D5\u05D1\u05EA PDF.",
      uploadPdf: "\u05D4\u05E2\u05DC\u05D0\u05EA PDF",
      url: "\u05DB\u05EA\u05D5\u05D1\u05EA URL",
      set: "\u05D4\u05D2\u05D3\u05E8"
    },
    duality: {
      certificate: "\u05EA\u05E2\u05D5\u05D3\u05EA \u05D3\u05D5\u05D0\u05DC\u05D9\u05D5\u05EA (Strong Duality)",
      primalOptimal: "\u05E2\u05E8\u05DA \u05D0\u05D5\u05E4\u05D8\u05D9\u05DE\u05DC\u05D9 \u05E8\u05D0\u05E9\u05D9 (Primal)",
      dualOptimal: "\u05E2\u05E8\u05DA \u05D0\u05D5\u05E4\u05D8\u05D9\u05DE\u05DC\u05D9 \u05D3\u05D5\u05D0\u05DC\u05D9 (Dual)",
      dualityGap: "\u05E4\u05E2\u05E8 \u05D3\u05D5\u05D0\u05DC\u05D9\u05D5\u05EA (Duality Gap)"
    },
    pipeline: {
      addStage: "\u05D4\u05D5\u05E1\u05E3 \u05E9\u05DC\u05D1",
      removeStage: "\u05D4\u05E1\u05E8 \u05E9\u05DC\u05D1"
    },
    header: {
      editModeEnter: "\u05DE\u05E6\u05D1 \u05E2\u05E8\u05D9\u05DB\u05D4",
      editModeExit: "\u05D9\u05E6\u05D9\u05D0\u05D4 \u05DE\u05E2\u05E8\u05D9\u05DB\u05D4",
      restoreSave: "\u05E9\u05D7\u05D6\u05E8 \u05E9\u05DE\u05D9\u05E8\u05D4 \u05D0\u05D7\u05E8\u05D5\u05E0\u05D4",
      restoring: "\u05DE\u05E9\u05D7\u05D6\u05E8...",
      noPreviousSave: "\u05D0\u05D9\u05DF \u05D2\u05E8\u05E1\u05D0\u05D5\u05EA \u05E7\u05D5\u05D3\u05DE\u05D5\u05EA \u05DC\u05E9\u05D7\u05D6\u05D5\u05E8",
      undo: "\u05D1\u05D8\u05DC",
      undoTooltip: "\u05D1\u05D8\u05DC (Ctrl+Z)",
      redo: "\u05D1\u05E6\u05E2 \u05E9\u05D5\u05D1",
      redoTooltip: "\u05D1\u05E6\u05E2 \u05E9\u05D5\u05D1 (Ctrl+Shift+Z)",
      layers: "\u05E9\u05DB\u05D1\u05D5\u05EA",
      layersTooltip: "\u05DC\u05D5\u05D7 \u05E9\u05DB\u05D1\u05D5\u05EA",
      properties: "\u05DE\u05D0\u05E4\u05D9\u05D9\u05E0\u05D9\u05DD",
      propertiesTooltip: "\u05DC\u05D5\u05D7 \u05DE\u05D0\u05E4\u05D9\u05D9\u05E0\u05D9\u05DD \u05D5\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA",
      splitView: "\u05DE\u05E4\u05D5\u05E6\u05DC",
      splitViewTooltip: "\u05EA\u05E6\u05D5\u05D2\u05D4 \u05DE\u05E4\u05D5\u05E6\u05DC\u05EA: \u05E2\u05D5\u05E8\u05DA \u05D5\u05EA\u05E6\u05D5\u05D2\u05D4 \u05D7\u05D9\u05D4",
      editorOnly: "\u05E2\u05D5\u05E8\u05DA",
      editorOnlyTooltip: "\u05DE\u05E6\u05D1 \u05E2\u05D5\u05E8\u05DA \u05D1\u05DC\u05D1\u05D3",
      previewOnly: "\u05EA\u05E6\u05D5\u05D2\u05D4 \u05D7\u05D9\u05D4",
      previewOnlyTooltip: "\u05DE\u05E6\u05D1 \u05EA\u05E6\u05D5\u05D2\u05D4 \u05D7\u05D9\u05D4 \u05D5\u05E4\u05E8\u05D6\u05E0\u05D8\u05E6\u05D9\u05D4",
      syncViewport: "\u05E1\u05E0\u05DB\u05E8\u05DF \u05D2\u05DC\u05D9\u05DC\u05D4 \u05D5\u05D6\u05D5\u05DD \u05D1\u05D9\u05DF \u05E9\u05E0\u05D9 \u05D4\u05D7\u05DC\u05D5\u05E0\u05D5\u05EA",
      print: "\u05D4\u05D3\u05E4\u05E1\u05D4",
      printTooltip: "\u05D4\u05D3\u05E4\u05E1 / \u05D9\u05D9\u05E6\u05D0 \u05DB-PDF",
      restore: "\u05E9\u05D7\u05D6\u05D5\u05E8"
    }
  },
  builderTextB: {
    hintSelect: "\u05D1\u05D7\u05D9\u05E8\u05D4: \u05DC\u05D7\u05D9\u05E6\u05D4 \u05DC\u05D1\u05D7\u05D9\u05E8\u05D4, \u05D2\u05E8\u05D9\u05E8\u05D4 \u05DC\u05D4\u05D6\u05D6\u05D4, \u05DC\u05D7\u05D9\u05E6\u05D4 \u05DB\u05E4\u05D5\u05DC\u05D4 \u05DC\u05E9\u05D9\u05E0\u05D5\u05D9 \u05E9\u05DD. \u05DB\u05DC\u05D9 \u05D4\u05D7\u05E5 (L) \u05DE\u05D7\u05D1\u05E8 \u05E6\u05D5\u05E8\u05D5\u05EA.",
    hintArrow: "\u05D7\u05E5: \u05D2\u05E8\u05E8\u05D5 \u05DE\u05E6\u05D5\u05E8\u05D4 \u05D0\u05D5 \u05DE\u05E0\u05E7\u05D5\u05D3\u05EA \u25CF \u05D0\u05DC \u05E6\u05D5\u05E8\u05D4 \u05D0\u05D7\u05E8\u05EA \xB7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC",
    hintFrom: "\u05DE-{name}: \u05DC\u05D7\u05E6\u05D5 \u05E2\u05DC \u05D4\u05E6\u05D5\u05E8\u05D4 \u05DC\u05D7\u05D9\u05D1\u05D5\u05E8 \xB7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC",
    hintDrag: "\u05E9\u05D7\u05E8\u05E8\u05D5 \u05E2\u05DC \u05E6\u05D5\u05E8\u05D4 \u05DC\u05D7\u05D9\u05D1\u05D5\u05E8, \u05D0\u05D5 \u05E2\u05DC \u05DE\u05E7\u05D5\u05DD \u05E8\u05D9\u05E7 \u05DC\u05D4\u05D5\u05E1\u05E4\u05EA \u05E6\u05D5\u05E8\u05D4 \u05D7\u05D3\u05E9\u05D4 \xB7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC",
    hintQuickAdd: "\u05D1\u05D7\u05E8\u05D5 \u05E6\u05D5\u05E8\u05D4 \u05DC\u05D4\u05D5\u05E1\u05E4\u05D4 \u05D5\u05D7\u05D9\u05D1\u05D5\u05E8 \u05DB\u05D0\u05DF, \u05D0\u05D5 \u05DC\u05D7\u05E6\u05D5 Esc",
    hintWalkStart: "\u05DE\u05E1\u05DC\u05D5\u05DC: \u05DC\u05D7\u05E6\u05D5 \u05E2\u05DC \u05D4\u05E6\u05D5\u05E8\u05D5\u05EA \u05DC\u05E4\u05D9 \u05D4\u05E1\u05D3\u05E8 \xB7 Enter \u05DC\u05E1\u05D9\u05D5\u05DD \xB7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC",
    hintWalk: "\u05DE\u05E1\u05DC\u05D5\u05DC: {path} \xB7 Enter \u05DC\u05E1\u05D9\u05D5\u05DD \xB7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC",
    hintPickSpot: "\u05DC\u05D7\u05E6\u05D5 \u05E2\u05DC \u05D4\u05E7\u05E0\u05D1\u05E1 \u05D1\u05DE\u05E7\u05D5\u05DD \u05E9\u05D1\u05D5 \u05D4\u05E6\u05D5\u05E8\u05D4 \u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05D9\u05D5\u05EA \xB7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC",
    hintPickTarget: "{effect}: \u05DC\u05D7\u05E6\u05D5 \u05E2\u05DC \u05D4{kinds} \u05DC\u05D4\u05E0\u05E4\u05E9\u05D4 \xB7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC",
    noticePickShape: "\u05D1\u05D7\u05E8\u05D5 \u05E6\u05D5\u05E8\u05D4, \u05DC\u05D0 \u05E7\u05E9\u05E8.",
    noticeSecond: "\u05D1\u05D7\u05E8\u05D5 \u05E6\u05D5\u05E8\u05D4 \u05E9\u05E0\u05D9\u05D9\u05D4, \u05D0\u05D5 \u05DC\u05D7\u05E6\u05D5 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC.",
    noticeFirst: "\u05DC\u05D7\u05E6\u05D5 \u05E2\u05DC \u05D4\u05E6\u05D5\u05E8\u05D4 \u05D4\u05E8\u05D0\u05E9\u05D5\u05E0\u05D4, \u05D0\u05D5 \u05DC\u05D7\u05E6\u05D5 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC.",
    noticeKinds: "\u05D1\u05D7\u05E8\u05D5 {kinds} \u05DC\u05D4\u05E0\u05E4\u05E9\u05D4 \u05D4\u05D6\u05D5.",
    layoutOutline: '"{a}" \u05D9\u05D5\u05E9\u05D1 \u05E2\u05DC \u05E7\u05D5 \u05D4\u05DE\u05EA\u05D0\u05E8 \u05E9\u05DC "{b}"',
    layoutCrossed: '"{a}" \u05E0\u05D7\u05EA\u05DA \u05D1\u05D9\u05D3\u05D9 \u05D4\u05E7\u05D5 "{b}"',
    layoutOverlap: '"{a}" \u05D7\u05D5\u05E4\u05E3 \u05D0\u05EA "{b}"',
    layoutOutside: '"{a}" \u05D9\u05D5\u05E6\u05D0 \u05DE\u05D2\u05D1\u05D5\u05DC\u05D5\u05EA \u05D4\u05D1\u05D3',
    layoutPartlyOutside: '"{a}" \u05D9\u05D5\u05E6\u05D0 \u05D7\u05DC\u05E7\u05D9\u05EA \u05DE\u05D2\u05D1\u05D5\u05DC\u05D5\u05EA \u05D4\u05D1\u05D3',
    layoutOrphan: '"{a}" \u05D7\u05E1\u05E8 \u05D4\u05D5\u05E8\u05D4 \u05D0\u05D5 \u05E7\u05E6\u05D4 \u05E7\u05D9\u05E9\u05D5\u05E8',
    cvBringInside: "\u05D4\u05D7\u05D6\u05E8\u05D4 \u05DC\u05EA\u05D5\u05DA \u05D4\u05D1\u05D3",
    nameArrow: "\u05D7\u05E5 {from} \u05D0\u05DC {to}",
    nameLabelled: "{shape} \u201C{label}\u201D",
    nameIdentified: "{shape} ({id})",
    shapeCircle: "\u05E2\u05D9\u05D2\u05D5\u05DC",
    shapeOval: "\u05D0\u05DC\u05D9\u05E4\u05E1\u05D4",
    shapeBox: "\u05EA\u05D9\u05D1\u05D4",
    shapeRounded: "\u05EA\u05D9\u05D1\u05D4 \u05DE\u05E2\u05D5\u05D2\u05DC\u05EA",
    shapeDiamond: "\u05DE\u05E2\u05D5\u05D9\u05DF",
    shapeTriangle: "\u05DE\u05E9\u05D5\u05DC\u05E9",
    shapeLine: "\u05E7\u05D5",
    shapeArrow: "\u05D7\u05E5",
    shapeText: "\u05D8\u05E7\u05E1\u05D8",
    shapeHeading: "\u05DB\u05D5\u05EA\u05E8\u05EA",
    shapeCaption: "\u05DB\u05D9\u05EA\u05D5\u05D1",
    shapeNote: "\u05D4\u05E2\u05E8\u05D4",
    shapeUnknown: "\u05E6\u05D5\u05E8\u05D4",
    cvBuilderSettings: "\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA \u05D4\u05D1\u05D5\u05E0\u05D4",
    cvHistory: "\u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D4",
    cvAdd: "\u05D4\u05D5\u05E1\u05E4\u05D4",
    cvView: "\u05EA\u05E6\u05D5\u05D2\u05D4",
    cvGridNone: "\u05DC\u05DC\u05D0 \u05E8\u05E9\u05EA",
    cvGridLines: "\u05E7\u05D5\u05D5\u05D9 \u05E8\u05E9\u05EA",
    cvGridDots: "\u05E8\u05E9\u05EA \u05E0\u05E7\u05D5\u05D3\u05D5\u05EA",
    cvDocument: "\u05DE\u05E1\u05DE\u05DA",
    cvTool: "\u05DB\u05DC\u05D9",
    cvLayout: "\u05E4\u05E8\u05D9\u05E1\u05D4",
    cvUndo: "\u05D1\u05D9\u05D8\u05D5\u05DC",
    cvRedo: "\u05D7\u05D6\u05E8\u05D4",
    cvSelect: "\u05D1\u05D7\u05D9\u05E8\u05D4",
    cvArrow: "\u05D7\u05E5",
    cvAnimate: "\u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D4",
    cvAnimateSelected: "\u05D4\u05E4\u05E2\u05DC\u05EA \u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D4 \u05DC\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05D4\u05E0\u05D1\u05D7\u05E8 (A)",
    cvSelectToAnimate: "\u05D1\u05D7\u05E8\u05D5 \u05E7\u05D5\u05D3\u05DD \u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05D1\u05E7\u05E0\u05D1\u05E1, \u05D5\u05D0\u05D6 \u05D4\u05E4\u05E2\u05D9\u05DC\u05D5 \u05E2\u05DC\u05D9\u05D5 \u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D4",
    cvBuildLarge: "\u05D1\u05E0\u05D9\u05D9\u05D4 \u05DE\u05D5\u05D2\u05D3\u05DC\u05EA",
    cvSplit: "\u05E4\u05D9\u05E6\u05D5\u05DC",
    cvPreviewLarge: "\u05EA\u05E6\u05D5\u05D2\u05D4 \u05DE\u05E7\u05D3\u05D9\u05DE\u05D4 \u05DE\u05D5\u05D2\u05D3\u05DC\u05EA",
    cvSnapToGrid: "\u05D4\u05E6\u05DE\u05D3\u05D4 \u05DC\u05E8\u05E9\u05EA",
    cvProject: "\u05E4\u05E8\u05D5\u05D9\u05E7\u05D8",
    cvSectionLocal: "\u05DE\u05E4\u05E8\u05D8 \u05DE\u05E7\u05D5\u05DE\u05D9",
    cvSectionPublish: "\u05E4\u05E8\u05E1\u05D5\u05DD \u05DC\u05E7\u05D5\u05E8\u05E1",
    cvSectionTransfer: "\u05D9\u05D9\u05D1\u05D5\u05D0 / \u05D9\u05D9\u05E6\u05D5\u05D0",
    cvKeyboardShortcuts: "\u05E7\u05D9\u05E6\u05D5\u05E8\u05D9 \u05DE\u05E7\u05DC\u05D3\u05EA",
    cvAppearsAtStep: "\u05DE\u05D5\u05E4\u05D9\u05E2 \u05D1\u05E9\u05DC\u05D1 {n}",
    cvRemovedAtStep: "\u05E0\u05DE\u05D7\u05E7 \u05D1\u05E9\u05DC\u05D1 {n}",
    cvCanvasLabel: "\u05E7\u05E0\u05D1\u05E1 \u05D4\u05D1\u05D5\u05E0\u05D4",
    cvZoomHint: "\u05D4\u05D2\u05DC\u05D2\u05DC \u05DE\u05D2\u05D3\u05D9\u05DC \u05D5\u05DE\u05E7\u05D8\u05D9\u05DF, \u05DC\u05D7\u05E6\u05DF \u05D4\u05D0\u05DE\u05E6\u05E2 \u05D2\u05D5\u05E8\u05E8",
    cvZoomReadout: "\u05D6\u05D5\u05DD {percent}%",
    cvOutsideStage: "! \u05DE\u05D7\u05D5\u05E5 \u05DC\u05D1\u05DE\u05D4 \u05D4\u05D0\u05DE\u05D9\u05EA\u05D9\u05EA",
    cvLayoutNotes: "\u05D4\u05E2\u05E8\u05D5\u05EA \u05E2\u05DC \u05D4\u05E4\u05E8\u05D9\u05E1\u05D4",
    cvCanvasActions: "\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA \u05E2\u05DC \u05D4\u05E7\u05E0\u05D1\u05E1",
    cvAddText: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05D8\u05E7\u05E1\u05D8",
    cvAddCaption: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05DB\u05D9\u05EA\u05D5\u05D1",
    cvInsertObject: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8\u2026",
    cvRemoveLabel: "\u05D4\u05E1\u05E8\u05EA \u05EA\u05D5\u05D5\u05D9\u05EA",
    cvAddLabel: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05EA\u05D5\u05D5\u05D9\u05EA",
    cvRename: "\u05E9\u05D9\u05E0\u05D5\u05D9 \u05E9\u05DD",
    cvConnect: "\u05D7\u05D9\u05D1\u05D5\u05E8",
    cvDuplicate: "\u05E9\u05DB\u05E4\u05D5\u05DC",
    cvDelete: "\u05DE\u05D7\u05D9\u05E7\u05D4",
    cvReverse: "\u05D4\u05D9\u05E4\u05D5\u05DA \u05DB\u05D9\u05D5\u05D5\u05DF",
    cvStraight: "\u05D9\u05E9\u05E8",
    cvElbow: "\u05D6\u05D5\u05D5\u05D9\u05EA\u05D9",
    cvCurve: "\u05DE\u05E2\u05D5\u05E7\u05DC",
    cvShapeTools: "\u05DB\u05DC\u05D9 \u05E6\u05D5\u05E8\u05D4",
    cvArrowTools: "\u05DB\u05DC\u05D9 \u05D7\u05E5",
    cvRoute: "\u05DE\u05E1\u05DC\u05D5\u05DC",
    cvArrowHead: "\u05E8\u05D0\u05E9 \u05D7\u05E5",
    cvArrowLabel: "\u05EA\u05D5\u05D5\u05D9\u05EA \u05D4\u05D7\u05E5",
    cvLabelPlaceholder: "\u05EA\u05D5\u05D5\u05D9\u05EA",
    cvColourName: "\u05E6\u05D1\u05E2 {name}",
    cvBlue: "\u05DB\u05D7\u05D5\u05DC",
    cvPurple: "\u05E1\u05D2\u05D5\u05DC",
    cvGreen: "\u05D9\u05E8\u05D5\u05E7",
    cvOrange: "\u05DB\u05EA\u05D5\u05DD",
    cvPink: "\u05D5\u05E8\u05D5\u05D3",
    cvAddAndConnect: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E6\u05D5\u05E8\u05D4 \u05D5\u05D7\u05D9\u05D1\u05D5\u05E8",
    cvAddShapeHere: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E6\u05D5\u05E8\u05D4 \u05D7\u05D3\u05E9\u05D4 \u05DB\u05D0\u05DF \u05D5\u05D7\u05D9\u05D1\u05D5\u05E8",
    cvCircle: "\u05E2\u05D9\u05D2\u05D5\u05DC",
    cvBox: "\u05EA\u05D9\u05D1\u05D4",
    cvDiamond: "\u05DE\u05E2\u05D5\u05D9\u05DF",
    cvShapeText: "\u05D8\u05E7\u05E1\u05D8 \u05D4\u05E6\u05D5\u05E8\u05D4",
    cvLivePreview: "\u05EA\u05E6\u05D5\u05D2\u05D4 \u05DE\u05E7\u05D3\u05D9\u05DE\u05D4 \u05D7\u05D9\u05D4",
    cvPopOut: "\u05E4\u05EA\u05D9\u05D7\u05D4 \u05D1\u05D7\u05DC\u05D5\u05DF \u05E0\u05E4\u05E8\u05D3",
    cvShortcutSelectTool: "\u05DB\u05DC\u05D9 \u05D4\u05D1\u05D7\u05D9\u05E8\u05D4",
    cvShortcutArrowTool: "\u05DB\u05DC\u05D9 \u05D4\u05D7\u05E5",
    cvShortcutAddShapes: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E2\u05D9\u05D2\u05D5\u05DC, \u05EA\u05D9\u05D1\u05D4, \u05DE\u05E2\u05D5\u05D9\u05DF, \u05D8\u05E7\u05E1\u05D8, \u05DB\u05D5\u05EA\u05E8\u05EA, \u05DB\u05D9\u05EA\u05D5\u05D1, \u05D4\u05E2\u05E8\u05D4, \u05DE\u05D5\u05EA\u05D0\u05DD \u05D0\u05D9\u05E9\u05D9\u05EA",
    cvShortcutAnimate: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D4",
    cvShortcutNewStep: "\u05E9\u05DC\u05D1 \u05D7\u05D3\u05E9",
    cvShortcutPrevNext: "\u05D4\u05E9\u05DC\u05D1 \u05D4\u05E7\u05D5\u05D3\u05DD \u05D0\u05D5 \u05D4\u05D1\u05D0",
    cvShortcutPlayPause: "\u05D4\u05E4\u05E2\u05DC\u05D4 \u05D0\u05D5 \u05D4\u05E9\u05D4\u05D9\u05D4 \u05E9\u05DC \u05D4\u05EA\u05E6\u05D5\u05D2\u05D4 \u05D4\u05DE\u05E7\u05D3\u05D9\u05DE\u05D4",
    cvShortcutDelete: "\u05DE\u05D7\u05D9\u05E7\u05EA \u05D4\u05E0\u05D1\u05D7\u05E8",
    cvShortcutEdit: "\u05E2\u05E8\u05D9\u05DB\u05EA \u05D4\u05E0\u05D1\u05D7\u05E8",
    cvShortcutCancel: "\u05D1\u05D9\u05D8\u05D5\u05DC \u05D5\u05D7\u05D6\u05E8\u05D4 \u05DC\u05DB\u05DC\u05D9 \u05D4\u05D1\u05D7\u05D9\u05E8\u05D4",
    cvShortcutUndoRedo: "\u05D1\u05D9\u05D8\u05D5\u05DC \u05D0\u05D5 \u05D7\u05D6\u05E8\u05D4",
    cvShortcutDuplicate: "\u05E9\u05DB\u05E4\u05D5\u05DC \u05D4\u05E0\u05D1\u05D7\u05E8",
    cvShortcutNudge: "\u05D4\u05D6\u05D6\u05EA \u05D4\u05E0\u05D1\u05D7\u05E8, Shift \u05DC\u05D4\u05D6\u05D6\u05D4 \u05E9\u05DC 10",
    cvClose: "\u05E1\u05D2\u05D9\u05E8\u05D4"
  },
  builderTextC: {
    edEditShape: "\u05E2\u05E8\u05D9\u05DB\u05EA \u05E6\u05D5\u05E8\u05D4",
    edName: "\u05E9\u05DD",
    edText: "\u05D8\u05E7\u05E1\u05D8",
    edColour: "\u05E6\u05D1\u05E2",
    edWidth: "\u05E8\u05D5\u05D7\u05D1",
    edHeight: "\u05D2\u05D5\u05D1\u05D4",
    edDone: "\u05E1\u05D9\u05D5\u05DD",
    edFill: "\u05DE\u05D9\u05DC\u05D5\u05D9",
    edFillStrength: "\u05E2\u05D5\u05E6\u05DE\u05EA \u05DE\u05D9\u05DC\u05D5\u05D9",
    edOutline: "\u05E7\u05D5 \u05DE\u05EA\u05D0\u05E8",
    edLineColor: "\u05E6\u05D1\u05E2",
    edThickness: "\u05E2\u05D5\u05D1\u05D9",
    edOutlineWidth: "\u05E2\u05D5\u05D1\u05D9 \u05E7\u05D5 \u05DE\u05EA\u05D0\u05E8",
    edLine: "\u05E7\u05D5",
    edOutlineStyle: "\u05E1\u05D2\u05E0\u05D5\u05DF \u05E7\u05D5 \u05DE\u05EA\u05D0\u05E8",
    edSolid: "\u05E8\u05E6\u05D9\u05E3",
    edDashed: "\u05DE\u05E7\u05D5\u05D5\u05E7\u05D5",
    edDotted: "\u05DE\u05E0\u05D5\u05E7\u05D3",
    edAccent: "\u05D4\u05D3\u05D2\u05E9\u05D4",
    edTextColor: "\u05E6\u05D1\u05E2 \u05D8\u05E7\u05E1\u05D8",
    edTextSize: "\u05D2\u05D5\u05D3\u05DC \u05D8\u05E7\u05E1\u05D8",
    edSmall: "\u05E7\u05D8\u05DF",
    edMedium: "\u05D1\u05D9\u05E0\u05D5\u05E0\u05D9",
    edLarge: "\u05D2\u05D3\u05D5\u05DC",
    edHuge: "\u05E2\u05E0\u05E7",
    edSize: "\u05D2\u05D5\u05D3\u05DC",
    edNone: "\u05DC\u05DC\u05D0",
    edCustomColor: "\u05E6\u05D1\u05E2 \u05DE\u05D5\u05EA\u05D0\u05DD \u05D0\u05D9\u05E9\u05D9\u05EA",
    edColourBlue: "\u05DB\u05D7\u05D5\u05DC",
    edColourPurple: "\u05E1\u05D2\u05D5\u05DC",
    edColourCyan: "\u05D8\u05D5\u05E8\u05E7\u05D9\u05D6",
    edColourGreen: "\u05D9\u05E8\u05D5\u05E7",
    edColourYellow: "\u05E6\u05D4\u05D5\u05D1",
    edColourOrange: "\u05DB\u05EA\u05D5\u05DD",
    edColourPink: "\u05D5\u05E8\u05D5\u05D3",
    edColourRed: "\u05D0\u05D3\u05D5\u05DD",
    edColourAmber: "\u05E2\u05E0\u05D1\u05E8",
    edColourWhite: "\u05DC\u05D1\u05DF",
    edChooseAnimation: "\u05D1\u05D7\u05D9\u05E8\u05EA \u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D4",
    edFor: "\u05E2\u05D1\u05D5\u05E8",
    edOr: "\u05D0\u05D5",
    edAnyObject: "\u05DB\u05DC \u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8",
    edKindShapes: "\u05E6\u05D5\u05E8\u05D5\u05EA",
    edKindBoxes: "\u05EA\u05D9\u05D1\u05D5\u05EA",
    edKindArrows: "\u05D7\u05E6\u05D9\u05DD",
    edKindLines: "\u05E7\u05D5\u05D5\u05D9\u05DD",
    edKindText: "\u05D8\u05E7\u05E1\u05D8",
    edEffectFill: "\u05DE\u05D9\u05DC\u05D5\u05D9",
    edEffectFillDesc: "\u05D4\u05E6\u05D5\u05E8\u05D4 \u05DE\u05EA\u05DE\u05DC\u05D0\u05EA \u05D1\u05E6\u05D1\u05E2.",
    edEffectReveal: "\u05D4\u05D5\u05E4\u05E2\u05D4",
    edEffectRevealDesc: "\u05D4\u05E6\u05D5\u05E8\u05D4 \u05DE\u05D5\u05E4\u05D9\u05E2\u05D4 \u05D1\u05D4\u05D3\u05E8\u05D2\u05D4.",
    edEffectRemove: "\u05D4\u05E1\u05E8\u05D4",
    edEffectRemoveDesc: "\u05D4\u05E6\u05D5\u05E8\u05D4 \u05E0\u05E2\u05DC\u05DE\u05EA \u05D1\u05D4\u05D3\u05E8\u05D2\u05D4 \u05D5\u05E0\u05E9\u05D0\u05E8\u05EA \u05E0\u05E2\u05DC\u05DE\u05EA.",
    edEffectDraw: "\u05E6\u05D9\u05D5\u05E8",
    edEffectDrawDesc: "\u05D4\u05D7\u05E5 \u05DE\u05E6\u05D8\u05D9\u05D9\u05E8 \u05DE\u05D4\u05EA\u05D7\u05DC\u05D4 \u05D5\u05E2\u05D3 \u05E1\u05D5\u05E3.",
    edEffectTravel: "\u05DE\u05E1\u05E2",
    edEffectTravelDesc: "\u05D0\u05E1\u05D9\u05DE\u05D5\u05DF \u05E0\u05E2 \u05DC\u05D0\u05D5\u05E8\u05DA \u05D4\u05D7\u05E5.",
    edEffectFlow: "\u05D6\u05E8\u05D9\u05DE\u05D4",
    edEffectFlowDesc: "\u05E7\u05D5\u05D5\u05D9\u05DD \u05DE\u05E7\u05D5\u05D5\u05E7\u05D5\u05D5\u05D9\u05DD \u05D6\u05D5\u05E8\u05DE\u05D9\u05DD \u05DC\u05D0\u05D5\u05E8\u05DA \u05D4\u05D7\u05E5.",
    edEffectSpark: "\u05D6\u05D9\u05D2\u05D6\u05D2",
    edEffectSparkDesc: "\u05E0\u05D9\u05E6\u05D5\u05E5 \u05D6\u05D9\u05D2\u05D6\u05D2 \u05E8\u05E5 \u05DC\u05D0\u05D5\u05E8\u05DA \u05D4\u05D7\u05E5.",
    edEffectFrame: "\u05E7\u05D5 \u05DE\u05EA\u05D0\u05E8 \u05D6\u05D9\u05D2\u05D6\u05D2",
    edEffectFrameDesc: "\u05DE\u05E1\u05D2\u05E8\u05EA \u05DE\u05E7\u05D5\u05D5\u05E7\u05D5\u05D5\u05EA \u05E0\u05E2\u05D4, \u05DB\u05DE\u05D5 \u05E1\u05DE\u05DF \u05D4\u05D4\u05D7\u05DC\u05E4\u05D4.",
    edEffectPulse: "\u05E4\u05E2\u05D9\u05DE\u05D4",
    edEffectPulseDesc: "\u05D4\u05E6\u05D5\u05E8\u05D4 \u05DE\u05EA\u05E0\u05E4\u05D7\u05EA \u05D5\u05DE\u05EA\u05D9\u05D9\u05E6\u05D1\u05EA.",
    edEffectGlow: "\u05D6\u05D5\u05D4\u05E8",
    edEffectGlowDesc: "\u05D6\u05D5\u05D4\u05E8\u05EA \u05E2\u05D3 \u05E1\u05D5\u05E3 \u05D4\u05E9\u05DC\u05D1 \u05D0\u05D5 \u05E2\u05D3 \u05E9\u05EA\u05DB\u05D1\u05D5 \u05D0\u05D5\u05EA\u05D4.",
    edEffectSweep: "\u05E1\u05E8\u05D9\u05E7\u05EA \u05D4\u05D3\u05D2\u05E9\u05D4",
    edEffectSweepDesc: "\u05E4\u05E1 \u05D0\u05D5\u05E8 \u05D7\u05D5\u05E6\u05D4 \u05D0\u05EA \u05D4\u05E6\u05D5\u05E8\u05D4 \u05DE\u05E9\u05DE\u05D0\u05DC \u05DC\u05D9\u05DE\u05D9\u05DF.",
    edEffectCallout: "\u05D4\u05E2\u05E8\u05EA \u05D4\u05D3\u05D2\u05E9\u05D4",
    edEffectCalloutDesc: "\u05D4\u05E2\u05E8\u05D4 \u05E7\u05E6\u05E8\u05D4 \u05DE\u05D5\u05E4\u05D9\u05E2\u05D4 \u05DC\u05E6\u05D3 \u05D4\u05E6\u05D5\u05E8\u05D4 \u05DC\u05D0\u05D5\u05E8\u05DA \u05D4\u05E9\u05DC\u05D1.",
    edEffectFade: "\u05D3\u05D4\u05D9\u05D9\u05D4",
    edEffectFadeDesc: "\u05D4\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05DE\u05EA\u05E2\u05DE\u05E2\u05DD \u05DB\u05D3\u05D9 \u05E9\u05D4\u05E9\u05D0\u05E8 \u05D9\u05D1\u05DC\u05D8\u05D5.",
    edEffectTint: "\u05E9\u05D9\u05E0\u05D5\u05D9 \u05E6\u05D1\u05E2",
    edEffectTintDesc: "\u05D4\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05E2\u05D5\u05D1\u05E8 \u05DC\u05E6\u05D1\u05E2 \u05D0\u05D7\u05E8.",
    edEffectOutline: "\u05D4\u05D3\u05D2\u05E9\u05EA \u05E7\u05D5 \u05DE\u05EA\u05D0\u05E8",
    edEffectOutlineDesc: "\u05E7\u05D5 \u05D4\u05DE\u05EA\u05D0\u05E8 \u05DE\u05EA\u05E2\u05D1\u05D4.",
    edEffectSoften: "\u05D4\u05D3\u05D2\u05E9\u05D4 \u05E8\u05DB\u05D4",
    edEffectSoftenDesc: "\u05D4\u05DE\u05D9\u05DC\u05D5\u05D9 \u05DE\u05EA\u05D1\u05D4\u05E8 \u05D1\u05E2\u05D3\u05D9\u05E0\u05D5\u05EA.",
    edEffectMove: "\u05D4\u05D6\u05D6\u05D4",
    edEffectMoveDesc: "\u05D4\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05DE\u05D7\u05DC\u05D9\u05E7 \u05DC\u05DE\u05D9\u05E7\u05D5\u05DD \u05D7\u05D3\u05E9.",
    edEffectGrow: "\u05D4\u05D2\u05D3\u05DC\u05D4 \u05D0\u05D5 \u05D4\u05E7\u05D8\u05E0\u05D4",
    edEffectGrowDesc: "\u05D4\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05D2\u05D3\u05DC \u05DC\u05D2\u05D5\u05D3\u05DC \u05D2\u05D3\u05D5\u05DC \u05D9\u05D5\u05EA\u05E8.",
    edEffectBounce: "\u05E7\u05E4\u05D9\u05E6\u05D4",
    edEffectBounceDesc: "\u05D4\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05E7\u05D5\u05E4\u05E5 \u05DC\u05DE\u05E2\u05DC\u05D4 \u05D5\u05D7\u05D5\u05D6\u05E8 \u05DC\u05DE\u05E7\u05D5\u05DE\u05D5."
  },
  insertGallery: {
    title: "\u05D4\u05D5\u05E1\u05E4\u05D4",
    filterAll: "\u05D4\u05DB\u05D5\u05DC",
    filterLabel: "\u05E1\u05D9\u05E0\u05D5\u05DF \u05E6\u05D5\u05E8\u05D5\u05EA \u05DC\u05E4\u05D9 \u05E7\u05D8\u05D2\u05D5\u05E8\u05D9\u05D4",
    atStep: "\u05D1\u05E9\u05DC\u05D1 {n}: \u05DE\u05D5\u05E4\u05D9\u05E2 \u05DE\u05D4\u05E9\u05DC\u05D1 \u05D4\u05D6\u05D4",
    searchLabel: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05E6\u05D5\u05E8\u05D5\u05EA",
    searchPlaceholder: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05E6\u05D5\u05E8\u05D5\u05EA, \u05DC\u05DE\u05E9\u05DC \u05DE\u05E6\u05D1",
    noResults: "\u05D0\u05D9\u05DF \u05EA\u05D5\u05E6\u05D0\u05D5\u05EA",
    replaceConfirm: "\u05DC\u05D4\u05D7\u05DC\u05D9\u05E3 \u05D0\u05EA \u05DE\u05D4 \u05E9\u05E2\u05DC \u05D4\u05E7\u05E0\u05D1\u05E1 \u05D1\u05EA\u05D1\u05E0\u05D9\u05EA \u05D4\u05D6\u05D5? \u05D0\u05E4\u05E9\u05E8 \u05DC\u05D1\u05D8\u05DC.",
    basic: "\u05D1\u05E1\u05D9\u05E1\u05D9",
    templates: "\u05EA\u05D1\u05E0\u05D9\u05D5\u05EA",
    outsideMode: "\u05E2\u05D5\u05D3 \u05EA\u05D5\u05E6\u05D0\u05D5\u05EA \u05DE\u05D7\u05D5\u05E5 \u05DC\u05DE\u05E6\u05D1 \u05D4\u05D6\u05D4",
    modeButton: "\u05DE\u05E6\u05D1",
    modeTitle: "\u05DE\u05E6\u05D1 \u05E2\u05D1\u05D5\u05D3\u05D4",
    modeShowAll: "\u05D4\u05E6\u05D2 \u05D4\u05DB\u05D5\u05DC",
    modeEverything: "\u05D4\u05DB\u05D5\u05DC",
    modeCategories: "\u05E7\u05D8\u05D2\u05D5\u05E8\u05D9\u05D5\u05EA",
    modeCategory: "\u05E7\u05D8\u05D2\u05D5\u05E8\u05D9\u05D4",
    modeStartWith: "\u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05E2\u05DD",
    modeStartHint: "\u05D0\u05D5 \u05DC\u05D1\u05D7\u05D5\u05E8 \u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05DE-\u05D4\u05D5\u05E1\u05E4\u05D4",
    modeInspector: "\u05D1\u05D7\u05D9\u05E8\u05D4",
    modeNothing: "\u05D1\u05D7\u05E8\u05D5 \u05E4\u05E8\u05D9\u05D8 \u05DB\u05D3\u05D9 \u05DC\u05E2\u05E8\u05D5\u05DA \u05D0\u05D5\u05EA\u05D5.",
    modeLabelField: "\u05EA\u05D5\u05D5\u05D9\u05EA",
    modeSize: "\u05D2\u05D5\u05D3\u05DC",
    modeNextSymbol: "\u05E1\u05DE\u05DC \u05D4\u05D1\u05D0",
    modeBend: "\u05DB\u05D9\u05E4\u05D5\u05E3",
    modeStart: "\u05DE\u05E6\u05D1 \u05D4\u05EA\u05D7\u05DC\u05D4",
    modeAccepting: "\u05DE\u05E7\u05D1\u05DC",
    modeReplace: "\u05DC\u05D4\u05D7\u05DC\u05D9\u05E3",
    modeColour: "\u05E6\u05D1\u05E2",
    modeRun: "\u05D4\u05E8\u05E5 \u05D0\u05EA \u05D4\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8",
    modeRunHint: "\u05E8\u05E5 \u05DE\u05D4\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05E9\u05E0\u05D1\u05D7\u05E8, \u05D0\u05D5 \u05DE\u05D4\u05E8\u05D0\u05E9\u05D5\u05DF",
    modeKeep: "\u05DC\u05D4\u05E9\u05D0\u05D9\u05E8 \u05D0\u05EA \u05D4\u05E6\u05D9\u05D5\u05E8",
    modeSets: "\u05E7\u05D1\u05D5\u05E6\u05D5\u05EA",
    modeRegions: "\u05D0\u05D6\u05D5\u05E8\u05D9\u05DD",
    modeItems: "\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD",
    modeLinks: "\u05E7\u05E9\u05E8\u05D9\u05DD",
    modeOutside: "\u05DE\u05D7\u05D5\u05E5 \u05DC\u05DB\u05DC \u05D4\u05E7\u05D1\u05D5\u05E6\u05D5\u05EA",
    stylePacks: "\u05D7\u05D1\u05D9\u05DC\u05D5\u05EA \u05E1\u05D2\u05E0\u05D5\u05DF",
    stylePacksNote: "\u05D7\u05D1\u05D9\u05DC\u05D5\u05EA \u05E1\u05D2\u05E0\u05D5\u05DF \u05D4\u05DF \u05E7\u05D1\u05E6\u05D9\u05DD \u05D1\u05EA\u05D9\u05E7\u05D9\u05D9\u05EA diagramPacks. \u05D9\u05D9\u05D1\u05D5\u05D0 \u05D7\u05D1\u05D9\u05DC\u05D4 \u05DE\u05E9\u05DC\u05DA \u05E2\u05D3\u05D9\u05D9\u05DF \u05DC\u05D0 \u05D6\u05DE\u05D9\u05DF.",
    presets: {
      circle: "\u05E2\u05D9\u05D2\u05D5\u05DC",
      box: "\u05E8\u05D9\u05D1\u05D5\u05E2",
      diamond: "\u05DE\u05E2\u05D5\u05D9\u05DF",
      text: "\u05D8\u05E7\u05E1\u05D8",
      heading: "\u05DB\u05D5\u05EA\u05E8\u05EA",
      caption: "\u05DB\u05D9\u05EA\u05D5\u05D1",
      note: "\u05D4\u05E2\u05E8\u05D4",
      custom: "\u05DE\u05D5\u05EA\u05D0\u05DD",
      ellipse: "\u05D0\u05DC\u05D9\u05E4\u05E1\u05D4",
      rounded: "\u05E8\u05D9\u05D1\u05D5\u05E2 \u05DE\u05E2\u05D5\u05D2\u05DC",
      triangle: "\u05DE\u05E9\u05D5\u05DC\u05E9",
      line: "\u05E7\u05D5",
      arrow: "\u05D7\u05E5"
    }
  }
};

// src/i18n/modes/en.json
var en_default4 = {
  automata: {
    label: "Automata",
    note: "States, transitions, input",
    tools: {
      "1": {
        label: "Add state"
      },
      connect: {
        label: "Add transition"
      },
      input: {
        label: "Input"
      },
      action: {
        label: "Run input"
      },
      autoRun: {
        label: "Run by itself"
      }
    },
    starterLabel: "a DFA with its input tape",
    verdict: {
      accept: "Accepts",
      reject: "Rejects",
      stuck: "Stuck on {symbol}",
      noStart: "Needs a start state",
      empty: "Type a word"
    },
    runChoice: {
      question: "This drawing already has steps. Add the run after them, or replace them?",
      add: "Add steps",
      replace: "Replace steps",
      cancel: "Cancel"
    }
  },
  diagrams: {
    label: "Diagrams",
    note: "Flowcharts, UML, architecture",
    tools: {
      "1": {
        label: "Shapes"
      },
      "2": {
        label: "Parts"
      },
      connect: {
        label: "Add edge"
      },
      algorithm: {
        label: "Simulate"
      },
      chart: {
        label: "Chart",
        charts: {
          flowchart: {
            label: "Flowchart",
            note: "Steps, decisions and loops."
          },
          pipeline: {
            label: "Pipeline",
            note: "Stages that pass data along."
          }
        }
      }
    }
  },
  free: {
    label: "Free",
    note: "Everything, as before",
    tools: {
      placePicker: {
        label: "Shapes"
      },
      connect: {
        label: "Add edge"
      }
    }
  },
  graph: {
    label: "Graph",
    note: "Vertices, edges, weights",
    tools: {
      "3": {
        label: "Directed"
      },
      "4": {
        label: "Weighted"
      },
      place: {
        label: "Add vertex"
      },
      connect: {
        label: "Add edge"
      },
      algorithm: {
        label: "Algorithm"
      }
    }
  },
  memory: {
    label: "Memory",
    note: "Stack, heap, pointers",
    tools: {
      placePicker: {
        label: "Objects"
      },
      connect: {
        label: "Pointer"
      },
      algorithm: {
        label: "Analyse"
      }
    }
  },
  network: {
    label: "Network",
    note: "Devices, links, packets",
    tools: {
      placePicker: {
        label: "Devices"
      },
      connect: {
        label: "Add link"
      },
      algorithm: {
        label: "Send"
      }
    }
  },
  tape: {
    label: "Tape",
    note: "Cells, head, scanning",
    tools: {
      "2": {
        label: "Head \u25C0"
      },
      "3": {
        label: "Head \u25B6"
      },
      "4": {
        label: "Scan"
      },
      input: {
        label: "Tape"
      }
    },
    starterLabel: "a new tape"
  },
  venn: {
    label: "Venn",
    note: "Sets, elements and regions",
    tools: {
      "3": {
        label: "Re-arrange"
      },
      "4": {
        label: "Shared regions"
      },
      stepper: {
        label: "Sets"
      },
      place: {
        label: "Add element"
      }
    }
  },
  chartUse: "Use this chart",
  algorithmText: {
    bfs: "Breadth-first search",
    dfs: "Depth-first search",
    dijkstra: "Dijkstra shortest paths",
    prim: "Prim spanning tree",
    edmondsKarp: "Max flow (Edmonds-Karp)",
    fordFulkerson: "Max flow (Ford-Fulkerson)",
    automataRun: "Run the word",
    networkSend: "Send a packet (fewest hops)",
    networkSendCost: "Send a packet (lowest cost)",
    searchStart: "Start at {vertex}",
    searchVisit: "Visit {vertex}",
    searchDiscover: "Found {vertex}",
    searchDone: "Done: {order}",
    stripFifo: "Queue",
    stripLifo: "Stack",
    stripPriority: "Waiting",
    stripOrder: "Order",
    distance: "d = {value}",
    nameStrip: "Algorithm strip",
    nameDistance: "Distance",
    nameFlowLabel: "Flow label",
    inputWord: "Input word",
    inputPrefix: "Input: ",
    recipeStart: "Start at {vertex}",
    recipeGo: "Go to {vertex}",
    recipeShow: "Show {vertex}",
    recipeMove: "Move from {from} to {to}.",
    tapeCellName: "Cell",
    tapeIndexName: "Index",
    tapeHeadName: "Head",
    tapeHeadLabelName: "Head label",
    tapeStripName: "Tape strip",
    tapeHeadText: "head",
    tapeRead: "Read {symbol}",
    tapeBlank: "blank",
    tapeWhy: "The head is on cell {number}.",
    flowStart: "Flow from {source} to {sink}",
    flowAugment: "Path {path}: push {pushed}",
    flowDone: "Maximum flow = {value}",
    flowStrip: "Flow",
    autoStart: "Start at {states}",
    autoRead: "Read {symbol}",
    autoAccept: "Accept",
    autoReject: "Reject",
    autoStuck: "Reject: no move on {symbol}",
    autoWhyRead: "{from} reads {symbol} and goes to {to}.",
    autoWhyAccept: "{states} accepts: {word} is accepted.",
    autoWhyReject: "{states} does not accept: {word} is rejected.",
    autoWhyStuck: "{states} has no transition on {symbol}.",
    netStart: "{device} sends a packet",
    netHop: "Hop {number}: {to}",
    netDelivered: "Delivered to {device}",
    netUnreachable: "No route from {device}",
    netExpired: "Dropped at {device}: TTL ended",
    netWhyStart: "The packet starts with TTL {ttl}.",
    netWhyHop: "{from} forwards it to {to}; TTL left {ttlLeft}.",
    netWhyDelivered: "It arrived after {hops} hops.",
    netWhyUnreachable: "No cable path leads to the destination.",
    netWhyExpired: "A router drops a packet whose TTL is zero."
  },
  memoryText: {
    memLeaks: "Leak search",
    memChase: "Follow pointers",
    memRoot: "Start from {cell}",
    memWhyRoot: "Every variable on the stack is a root: the blocks its pointers reach are alive.",
    memReach: "{block} is reachable",
    memWhyReach: "Reached from {via}.",
    memLeak: "Leak: {block} is unreachable",
    memWhyLeak: "No variable leads to it, so nothing can free it.",
    memVerdict: "Leaked: {leaks}",
    memWhyVerdict: "Reachable: {reachable}.",
    memNone: "none",
    memFollow: "Step {number}: {from} points to {to}",
    memWhyFollow: "Follow the address stored in {from}.",
    memBlock: "The chain ends at block {at}",
    memWhyBlock: "{at} points nowhere, so the value is the block.",
    memNull: "The chain ends at null",
    memWhyNull: "{at} holds no address.",
    memCycle: "The chain loops back to {at}",
    memWhyCycle: "Following the pointers returns to a node already visited.",
    memDangling: "The pointer to {at} leads nowhere",
    memWhyDangling: "{at} is neither a variable nor a heap block."
  },
  pipelineText: {
    pipeRun: "Run a pipeline (tick by tick)",
    pipeTick: "Tick {number}",
    pipeWhyTick: "A stage passes items on when the next stage has room. Stalled: {stalled}.",
    pipeNone: "none",
    pipeDone: "Finished {done} of {tokens} items in {ticks} ticks",
    pipeWhyBottleneck: "Bottleneck: {stage}, the stage that stalled most often.",
    pipeWhyClear: "No stage stalled, so nothing waited."
  }
};

// src/i18n/modes/he.json
var he_default4 = {
  automata: {
    label: "\u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05DD",
    note: "\u05DE\u05E6\u05D1\u05D9\u05DD, \u05DE\u05E2\u05D1\u05E8\u05D9\u05DD, \u05E7\u05DC\u05D8",
    tools: {
      "1": {
        label: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05DE\u05E6\u05D1"
      },
      connect: {
        label: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05DE\u05E2\u05D1\u05E8"
      },
      input: {
        label: "\u05E7\u05DC\u05D8"
      },
      action: {
        label: "\u05D4\u05E8\u05E6\u05EA \u05E7\u05DC\u05D8"
      },
      autoRun: {
        label: "\u05D4\u05E8\u05E6\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA"
      }
    },
    starterLabel: "\u05D0\u05D5\u05D8\u05D5\u05DE\u05D8 \u05E2\u05DD \u05E1\u05E8\u05D8 \u05D4\u05E7\u05DC\u05D8 \u05E9\u05DC\u05D5",
    verdict: {
      accept: "\u05DE\u05E7\u05D1\u05DC",
      reject: "\u05D3\u05D5\u05D7\u05D4",
      stuck: "\u05EA\u05E7\u05D5\u05E2 \u05E2\u05DC {symbol}",
      noStart: "\u05E6\u05E8\u05D9\u05DA \u05DE\u05E6\u05D1 \u05D4\u05EA\u05D7\u05DC\u05D4",
      empty: "\u05D4\u05E7\u05DC\u05D9\u05D3\u05D5 \u05DE\u05D9\u05DC\u05D4"
    },
    runChoice: {
      question: "\u05D1\u05E9\u05E8\u05D8\u05D5\u05D8 \u05DB\u05D1\u05E8 \u05D9\u05E9 \u05E6\u05E2\u05D3\u05D9\u05DD. \u05DC\u05D4\u05D5\u05E1\u05D9\u05E3 \u05D0\u05EA \u05D4\u05D4\u05E8\u05E6\u05D4 \u05D0\u05D7\u05E8\u05D9\u05D4\u05DD \u05D0\u05D5 \u05DC\u05D4\u05D7\u05DC\u05D9\u05E3 \u05D0\u05D5\u05EA\u05DD?",
      add: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E6\u05E2\u05D3\u05D9\u05DD",
      replace: "\u05D4\u05D7\u05DC\u05E4\u05EA \u05E6\u05E2\u05D3\u05D9\u05DD",
      cancel: "\u05D1\u05D9\u05D8\u05D5\u05DC"
    }
  },
  diagrams: {
    label: "\u05D3\u05D9\u05D0\u05D2\u05E8\u05DE\u05D5\u05EA",
    note: "\u05EA\u05E8\u05E9\u05D9\u05DE\u05D9 \u05D6\u05E8\u05D9\u05DE\u05D4, UML, \u05D0\u05E8\u05DB\u05D9\u05D8\u05E7\u05D8\u05D5\u05E8\u05D4",
    tools: {
      "1": {
        label: "\u05E6\u05D5\u05E8\u05D5\u05EA"
      },
      "2": {
        label: "\u05D7\u05DC\u05E7\u05D9\u05DD"
      },
      connect: {
        label: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E7\u05E9\u05EA"
      },
      algorithm: {
        label: "\u05D4\u05D3\u05DE\u05D9\u05D4"
      },
      chart: {
        label: "\u05EA\u05E8\u05E9\u05D9\u05DD",
        charts: {
          flowchart: {
            label: "\u05EA\u05E8\u05E9\u05D9\u05DD \u05D6\u05E8\u05D9\u05DE\u05D4",
            note: "\u05E9\u05DC\u05D1\u05D9\u05DD, \u05D4\u05D7\u05DC\u05D8\u05D5\u05EA \u05D5\u05DC\u05D5\u05DC\u05D0\u05D5\u05EA."
          },
          pipeline: {
            label: "\u05E6\u05D9\u05E0\u05D5\u05E8",
            note: "\u05E9\u05DC\u05D1\u05D9\u05DD \u05E9\u05DE\u05E2\u05D1\u05D9\u05E8\u05D9\u05DD \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D4\u05DC\u05D0\u05D4."
          }
        }
      }
    }
  },
  free: {
    label: "\u05D7\u05D5\u05E4\u05E9\u05D9",
    note: "\u05D4\u05DB\u05D5\u05DC, \u05DB\u05DE\u05D5 \u05E7\u05D5\u05D3\u05DD",
    tools: {
      placePicker: {
        label: "\u05E6\u05D5\u05E8\u05D5\u05EA"
      },
      connect: {
        label: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E7\u05E9\u05EA"
      }
    }
  },
  graph: {
    label: "\u05D2\u05E8\u05E3",
    note: "\u05E7\u05D5\u05D3\u05E7\u05D5\u05D3\u05D9\u05DD, \u05E7\u05E9\u05EA\u05D5\u05EA, \u05DE\u05E9\u05E7\u05DC\u05D9\u05DD",
    tools: {
      "3": {
        label: "\u05DE\u05DB\u05D5\u05D5\u05DF"
      },
      "4": {
        label: "\u05DE\u05DE\u05D5\u05E9\u05E7\u05DC"
      },
      place: {
        label: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E7\u05D5\u05D3\u05E7\u05D5\u05D3"
      },
      connect: {
        label: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E7\u05E9\u05EA"
      },
      algorithm: {
        label: "\u05D0\u05DC\u05D2\u05D5\u05E8\u05D9\u05EA\u05DD"
      }
    }
  },
  memory: {
    label: "\u05D6\u05D9\u05DB\u05E8\u05D5\u05DF",
    note: "\u05DE\u05D7\u05E1\u05E0\u05D9\u05EA, \u05E2\u05E8\u05D9\u05DE\u05D4, \u05DE\u05E6\u05D1\u05D9\u05E2\u05D9\u05DD",
    tools: {
      placePicker: {
        label: "\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8\u05D9\u05DD"
      },
      connect: {
        label: "\u05DE\u05E6\u05D1\u05D9\u05E2"
      },
      algorithm: {
        label: "\u05E0\u05D9\u05EA\u05D5\u05D7"
      }
    }
  },
  network: {
    label: "\u05E8\u05E9\u05EA",
    note: "\u05D4\u05EA\u05E7\u05E0\u05D9\u05DD, \u05E7\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD, \u05D7\u05D1\u05D9\u05DC\u05D5\u05EA",
    tools: {
      placePicker: {
        label: "\u05D4\u05EA\u05E7\u05E0\u05D9\u05DD"
      },
      connect: {
        label: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E7\u05D9\u05E9\u05D5\u05E8"
      },
      algorithm: {
        label: "\u05E9\u05DC\u05D9\u05D7\u05D4"
      }
    }
  },
  tape: {
    label: "\u05E1\u05E8\u05D8",
    note: "\u05EA\u05D0\u05D9\u05DD, \u05E8\u05D0\u05E9, \u05E1\u05E8\u05D9\u05E7\u05D4",
    tools: {
      "2": {
        label: "\u05E8\u05D0\u05E9 \u25C0"
      },
      "3": {
        label: "\u05E8\u05D0\u05E9 \u25B6"
      },
      "4": {
        label: "\u05E1\u05E8\u05D9\u05E7\u05D4"
      },
      input: {
        label: "\u05E1\u05E8\u05D8"
      }
    },
    starterLabel: "\u05E1\u05E8\u05D8 \u05D7\u05D3\u05E9"
  },
  venn: {
    label: "\u05D5\u05DF",
    note: "\u05E7\u05D1\u05D5\u05E6\u05D5\u05EA, \u05D0\u05D9\u05D1\u05E8\u05D9\u05DD \u05D5\u05D0\u05D6\u05D5\u05E8\u05D9\u05DD",
    tools: {
      "3": {
        label: "\u05E1\u05D9\u05D3\u05D5\u05E8 \u05DE\u05D7\u05D3\u05E9"
      },
      "4": {
        label: "\u05D0\u05D6\u05D5\u05E8\u05D9\u05DD \u05DE\u05E9\u05D5\u05EA\u05E4\u05D9\u05DD"
      },
      stepper: {
        label: "\u05E7\u05D1\u05D5\u05E6\u05D5\u05EA"
      },
      place: {
        label: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05D0\u05D9\u05D1\u05E8"
      }
    }
  },
  chartUse: "\u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05EA\u05E8\u05E9\u05D9\u05DD \u05D6\u05D4",
  algorithmText: {
    bfs: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05DC\u05E8\u05D5\u05D7\u05D1",
    dfs: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05DC\u05E2\u05D5\u05DE\u05E7",
    dijkstra: "\u05DE\u05E1\u05DC\u05D5\u05DC\u05D9\u05DD \u05E7\u05E6\u05E8\u05D9\u05DD (\u05D3\u05D9\u05D9\u05E7\u05E1\u05D8\u05E8\u05D4)",
    prim: "\u05E2\u05E5 \u05E4\u05D5\u05E8\u05E9 (\u05E4\u05E8\u05D9\u05DD)",
    edmondsKarp: "\u05D6\u05E8\u05D9\u05DE\u05D4 \u05DE\u05E7\u05E1\u05D9\u05DE\u05DC\u05D9\u05EA (\u05D0\u05D3\u05DE\u05D5\u05E0\u05D3\u05E1-\u05E7\u05E8\u05E4)",
    fordFulkerson: "\u05D6\u05E8\u05D9\u05DE\u05D4 \u05DE\u05E7\u05E1\u05D9\u05DE\u05DC\u05D9\u05EA (\u05E4\u05D5\u05E8\u05D3-\u05E4\u05D5\u05DC\u05E7\u05E8\u05E1\u05D5\u05DF)",
    automataRun: "\u05D4\u05E8\u05E6\u05EA \u05D4\u05DE\u05D9\u05DC\u05D4",
    networkSend: "\u05E9\u05DC\u05D9\u05D7\u05EA \u05D7\u05D1\u05D9\u05DC\u05D4 (\u05DE\u05E2\u05D8 \u05E7\u05E4\u05D9\u05E6\u05D5\u05EA)",
    networkSendCost: "\u05E9\u05DC\u05D9\u05D7\u05EA \u05D7\u05D1\u05D9\u05DC\u05D4 (\u05E2\u05DC\u05D5\u05EA \u05E0\u05DE\u05D5\u05DB\u05D4)",
    searchStart: "\u05DE\u05EA\u05D7\u05D9\u05DC\u05D9\u05DD \u05D1-{vertex}",
    searchVisit: "\u05DE\u05D1\u05E7\u05E8\u05D9\u05DD \u05D1-{vertex}",
    searchDiscover: "\u05DE\u05E6\u05D0\u05E0\u05D5 \u05D0\u05EA {vertex}",
    searchDone: "\u05E1\u05D9\u05D5\u05DD: {order}",
    stripFifo: "\u05EA\u05D5\u05E8",
    stripLifo: "\u05DE\u05D7\u05E1\u05E0\u05D9\u05EA",
    stripPriority: "\u05DE\u05DE\u05EA\u05D9\u05E0\u05D9\u05DD",
    stripOrder: "\u05E1\u05D3\u05E8",
    distance: "d = {value}",
    nameStrip: "\u05E4\u05E1 \u05D4\u05D0\u05DC\u05D2\u05D5\u05E8\u05D9\u05EA\u05DD",
    nameDistance: "\u05DE\u05E8\u05D7\u05E7",
    nameFlowLabel: "\u05EA\u05D5\u05D5\u05D9\u05EA \u05D6\u05E8\u05D9\u05DE\u05D4",
    inputWord: "\u05DE\u05D9\u05DC\u05EA \u05E7\u05DC\u05D8",
    inputPrefix: "\u05E7\u05DC\u05D8: ",
    recipeStart: "\u05DE\u05EA\u05D7\u05D9\u05DC\u05D9\u05DD \u05D1-{vertex}",
    recipeGo: "\u05E2\u05D5\u05D1\u05E8\u05D9\u05DD \u05DC-{vertex}",
    recipeShow: "\u05DE\u05E6\u05D9\u05D2\u05D9\u05DD \u05D0\u05EA {vertex}",
    recipeMove: "\u05E2\u05D5\u05D1\u05E8\u05D9\u05DD \u05DE-{from} \u05DC-{to}.",
    tapeCellName: "\u05EA\u05D0",
    tapeIndexName: "\u05D0\u05D9\u05E0\u05D3\u05E7\u05E1",
    tapeHeadName: "\u05E8\u05D0\u05E9",
    tapeHeadLabelName: "\u05EA\u05D5\u05D5\u05D9\u05EA \u05E8\u05D0\u05E9",
    tapeStripName: "\u05E1\u05E8\u05D8",
    tapeHeadText: "\u05E8\u05D0\u05E9",
    tapeRead: "\u05E7\u05D5\u05E8\u05D0\u05D9\u05DD {symbol}",
    tapeBlank: "\u05E8\u05D9\u05E7",
    tapeWhy: "\u05D4\u05E8\u05D0\u05E9 \u05E0\u05DE\u05E6\u05D0 \u05D1\u05EA\u05D0 {number}.",
    flowStart: "\u05D6\u05E8\u05D9\u05DE\u05D4 \u05DE-{source} \u05DC-{sink}",
    flowAugment: "\u05DE\u05E1\u05DC\u05D5\u05DC {path}: \u05D3\u05D5\u05D7\u05E4\u05D9\u05DD {pushed}",
    flowDone: "\u05D6\u05E8\u05D9\u05DE\u05D4 \u05DE\u05E7\u05E1\u05D9\u05DE\u05DC\u05D9\u05EA = {value}",
    flowStrip: "\u05D6\u05E8\u05D9\u05DE\u05D4",
    autoStart: "\u05DE\u05EA\u05D7\u05D9\u05DC\u05D9\u05DD \u05D1-{states}",
    autoRead: "\u05E7\u05D5\u05E8\u05D0\u05D9\u05DD {symbol}",
    autoAccept: "\u05DE\u05E7\u05D1\u05DC",
    autoReject: "\u05D3\u05D5\u05D7\u05D4",
    autoStuck: "\u05D3\u05D5\u05D7\u05D4: \u05D0\u05D9\u05DF \u05DE\u05E2\u05D1\u05E8 \u05E2\u05DC {symbol}",
    autoWhyRead: "{from} \u05E7\u05D5\u05E8\u05D0 {symbol} \u05D5\u05E2\u05D5\u05D1\u05E8 \u05DC-{to}.",
    autoWhyAccept: "{states} \u05DE\u05E7\u05D1\u05DC: \u05D4\u05DE\u05D9\u05DC\u05D4 {word} \u05D4\u05EA\u05E7\u05D1\u05DC\u05D4.",
    autoWhyReject: "{states} \u05DC\u05D0 \u05DE\u05E7\u05D1\u05DC: \u05D4\u05DE\u05D9\u05DC\u05D4 {word} \u05E0\u05D3\u05D7\u05EA\u05D4.",
    autoWhyStuck: "\u05DC-{states} \u05D0\u05D9\u05DF \u05DE\u05E2\u05D1\u05E8 \u05E2\u05DC {symbol}.",
    netStart: "{device} \u05E9\u05D5\u05DC\u05D7 \u05D7\u05D1\u05D9\u05DC\u05D4",
    netHop: "\u05E7\u05E4\u05D9\u05E6\u05D4 {number}: {to}",
    netDelivered: "\u05E0\u05DE\u05E1\u05E8 \u05DC-{device}",
    netUnreachable: "\u05D0\u05D9\u05DF \u05DE\u05E1\u05DC\u05D5\u05DC \u05DE-{device}",
    netExpired: "\u05E0\u05E4\u05DC\u05D4 \u05D1-{device}: \u05D4-TTL \u05E0\u05D2\u05DE\u05E8",
    netWhyStart: "\u05D4\u05D7\u05D1\u05D9\u05DC\u05D4 \u05D9\u05D5\u05E6\u05D0\u05EA \u05E2\u05DD TTL {ttl}.",
    netWhyHop: "{from} \u05DE\u05E2\u05D1\u05D9\u05E8 \u05DC-{to}; \u05E0\u05E9\u05D0\u05E8 TTL {ttlLeft}.",
    netWhyDelivered: "\u05D4\u05D2\u05D9\u05E2\u05D4 \u05D0\u05D7\u05E8\u05D9 {hops} \u05E7\u05E4\u05D9\u05E6\u05D5\u05EA.",
    netWhyUnreachable: "\u05D0\u05D9\u05DF \u05E0\u05EA\u05D9\u05D1 \u05DB\u05D1\u05DC\u05D9\u05DD \u05DC\u05D9\u05E2\u05D3.",
    netWhyExpired: "\u05E0\u05EA\u05D1 \u05DE\u05D5\u05E8\u05D9\u05D3 \u05D7\u05D1\u05D9\u05DC\u05D4 \u05E9\u05D4-TTL \u05E9\u05DC\u05D4 \u05D0\u05E4\u05E1."
  },
  memoryText: {
    memLeaks: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05D3\u05DC\u05D9\u05E4\u05D5\u05EA",
    memChase: "\u05DE\u05E2\u05E7\u05D1 \u05D0\u05D7\u05E8\u05D9 \u05DE\u05E6\u05D1\u05D9\u05E2\u05D9\u05DD",
    memRoot: "\u05DE\u05EA\u05D7\u05D9\u05DC\u05D9\u05DD \u05DE-{cell}",
    memWhyRoot: "\u05DB\u05DC \u05DE\u05E9\u05EA\u05E0\u05D4 \u05D1\u05DE\u05D7\u05E1\u05E0\u05D9\u05EA \u05D4\u05D5\u05D0 \u05E9\u05D5\u05E8\u05E9: \u05D1\u05DC\u05D5\u05E7\u05D9\u05DD \u05E9\u05D4\u05DE\u05E6\u05D1\u05D9\u05E2\u05D9\u05DD \u05E9\u05DC\u05D5 \u05DE\u05D2\u05D9\u05E2\u05D9\u05DD \u05D0\u05DC\u05D9\u05D4\u05DD \u05D4\u05DD \u05D7\u05D9\u05D9\u05DD.",
    memReach: "\u05D0\u05E4\u05E9\u05E8 \u05DC\u05D4\u05D2\u05D9\u05E2 \u05DC-{block}",
    memWhyReach: "\u05DE\u05D2\u05D9\u05E2\u05D9\u05DD \u05D0\u05DC\u05D9\u05D5 \u05DE-{via}.",
    memLeak: "\u05D3\u05DC\u05D9\u05E4\u05D4: \u05D0\u05D9 \u05D0\u05E4\u05E9\u05E8 \u05DC\u05D4\u05D2\u05D9\u05E2 \u05DC-{block}",
    memWhyLeak: "\u05D0\u05E3 \u05DE\u05E9\u05EA\u05E0\u05D4 \u05DC\u05D0 \u05DE\u05D5\u05D1\u05D9\u05DC \u05D0\u05DC\u05D9\u05D5, \u05D5\u05DC\u05DB\u05DF \u05D0\u05D9 \u05D0\u05E4\u05E9\u05E8 \u05DC\u05E9\u05D7\u05E8\u05E8 \u05D0\u05D5\u05EA\u05D5.",
    memVerdict: "\u05D3\u05DC\u05E4\u05D5: {leaks}",
    memWhyVerdict: "\u05E0\u05D2\u05D9\u05E9\u05D9\u05DD: {reachable}.",
    memNone: "\u05D0\u05D9\u05DF",
    memFollow: "\u05E9\u05DC\u05D1 {number}: {from} \u05DE\u05E6\u05D1\u05D9\u05E2 \u05E2\u05DC {to}",
    memWhyFollow: "\u05E2\u05D5\u05E7\u05D1\u05D9\u05DD \u05D0\u05D7\u05E8\u05D9 \u05D4\u05DB\u05EA\u05D5\u05D1\u05EA \u05E9\u05E9\u05DE\u05D5\u05E8\u05D4 \u05D1-{from}.",
    memBlock: "\u05D4\u05E9\u05E8\u05E9\u05E8\u05EA \u05E0\u05D2\u05DE\u05E8\u05EA \u05D1\u05D1\u05DC\u05D5\u05E7 {at}",
    memWhyBlock: "{at} \u05DC\u05D0 \u05DE\u05E6\u05D1\u05D9\u05E2 \u05DC\u05E9\u05D5\u05DD \u05DE\u05E7\u05D5\u05DD, \u05D5\u05D4\u05E2\u05E8\u05DA \u05D4\u05D5\u05D0 \u05D4\u05D1\u05DC\u05D5\u05E7.",
    memNull: "\u05D4\u05E9\u05E8\u05E9\u05E8\u05EA \u05E0\u05D2\u05DE\u05E8\u05EA \u05D1-null",
    memWhyNull: "\u05D1-{at} \u05D0\u05D9\u05DF \u05DB\u05EA\u05D5\u05D1\u05EA.",
    memCycle: "\u05D4\u05E9\u05E8\u05E9\u05E8\u05EA \u05D7\u05D5\u05D6\u05E8\u05EA \u05D0\u05DC {at}",
    memWhyCycle: "\u05D4\u05DE\u05E2\u05E7\u05D1 \u05D0\u05D7\u05E8\u05D9 \u05D4\u05DE\u05E6\u05D1\u05D9\u05E2\u05D9\u05DD \u05D7\u05D5\u05D6\u05E8 \u05DC\u05E6\u05D5\u05DE\u05EA \u05E9\u05DB\u05D1\u05E8 \u05D1\u05D9\u05E7\u05E8\u05E0\u05D5 \u05D1\u05D5.",
    memDangling: "\u05D4\u05DE\u05E6\u05D1\u05D9\u05E2 \u05D0\u05DC {at} \u05DC\u05D0 \u05DE\u05D5\u05D1\u05D9\u05DC \u05DC\u05E9\u05D5\u05DD \u05DE\u05E7\u05D5\u05DD",
    memWhyDangling: "{at} \u05D0\u05D9\u05E0\u05D5 \u05DE\u05E9\u05EA\u05E0\u05D4 \u05D5\u05D0\u05D9\u05E0\u05D5 \u05D1\u05DC\u05D5\u05E7 \u05D1\u05E2\u05E8\u05D9\u05DE\u05D4."
  },
  pipelineText: {
    pipeRun: "\u05D4\u05E8\u05E6\u05EA \u05E6\u05D9\u05E0\u05D5\u05E8 (\u05DE\u05D7\u05D6\u05D5\u05E8 \u05D0\u05D7\u05E8 \u05DE\u05D7\u05D6\u05D5\u05E8)",
    pipeTick: "\u05DE\u05D7\u05D6\u05D5\u05E8 {number}",
    pipeWhyTick: "\u05E9\u05DC\u05D1 \u05DE\u05E2\u05D1\u05D9\u05E8 \u05E4\u05E8\u05D9\u05D8\u05D9\u05DD \u05D4\u05DC\u05D0\u05D4 \u05DB\u05E9\u05DC\u05E9\u05DC\u05D1 \u05D4\u05D1\u05D0 \u05D9\u05E9 \u05DE\u05E7\u05D5\u05DD. \u05E0\u05EA\u05E7\u05E2\u05D5: {stalled}.",
    pipeNone: "\u05D0\u05D9\u05DF",
    pipeDone: "\u05D4\u05E1\u05EA\u05D9\u05D9\u05DE\u05D5 {done} \u05DE\u05EA\u05D5\u05DA {tokens} \u05E4\u05E8\u05D9\u05D8\u05D9\u05DD \u05D1-{ticks} \u05DE\u05D7\u05D6\u05D5\u05E8\u05D9\u05DD",
    pipeWhyBottleneck: "\u05E6\u05D5\u05D5\u05D0\u05E8 \u05D1\u05E7\u05D1\u05D5\u05E7: {stage}, \u05D4\u05E9\u05DC\u05D1 \u05E9\u05E0\u05EA\u05E7\u05E2 \u05D4\u05DB\u05D9 \u05D4\u05E8\u05D1\u05D4 \u05E4\u05E2\u05DE\u05D9\u05DD.",
    pipeWhyClear: "\u05D0\u05E3 \u05E9\u05DC\u05D1 \u05DC\u05D0 \u05E0\u05EA\u05E7\u05E2, \u05D5\u05DC\u05DB\u05DF \u05D0\u05E3 \u05E4\u05E8\u05D9\u05D8 \u05DC\u05D0 \u05D4\u05DE\u05EA\u05D9\u05DF."
  }
};

// src/i18n/dictionary.ts
var aiEn = en_default.ai;
var aiHe = he_default.ai;
var { author: authorEn, buttons: buttonsEn, common: commonEn, headers: headersEn, home: homeEn, patchNotes: patchNotesEn, player: playerEn, settings: settingsEn, status: statusEn, topics: topicsEn, update: updateEn, mcp: mcpEn, complexityClasses: complexityClassesEn, hub: hubEn } = en_default2;
var { author: authorHe, buttons: buttonsHe, common: commonHe, headers: headersHe, home: homeHe, patchNotes: patchNotesHe, player: playerHe, settings: settingsHe, status: statusHe, topics: topicsHe, update: updateHe, mcp: mcpHe, complexityClasses: complexityClassesHe, hub: hubHe } = he_default2;
var { canvas: canvasEn, builderTextB: builderTextBEn, builderTextC: builderTextCEn, insertGallery: insertGalleryEn } = en_default3;
var { canvas: canvasHe, builderTextB: builderTextBHe, builderTextC: builderTextCHe, insertGallery: insertGalleryHe } = he_default3;
var { algorithmText: algorithmTextEn, memoryText: memoryTextEn, pipelineText: pipelineTextEn } = en_default4;
var { algorithmText: algorithmTextHe, memoryText: memoryTextHe, pipelineText: pipelineTextHe } = he_default4;
var AI_TEXT = mergeLocales(aiEn, aiHe);
var ALGORITHM_TEXT = mergeLocales({ ...algorithmTextEn, ...pipelineTextEn, ...memoryTextEn }, { ...algorithmTextHe, ...pipelineTextHe, ...memoryTextHe });
var BUILDER_TEXT = mergeLocales({ ...builderTextBEn, ...builderTextCEn }, { ...builderTextBHe, ...builderTextCHe });
var AUTHOR_TEXT = mergeLocales(authorEn, authorHe);
var BUTTONS_TEXT = mergeLocales(buttonsEn, buttonsHe);
var COMMON_TEXT = mergeLocales(commonEn, commonHe);
var HEADERS_TEXT = mergeLocales(headersEn, headersHe);
var HOME_TEXT = mergeLocales(homeEn, homeHe);
var HUB_TEXT = mergeLocales(hubEn, hubHe);
var INSERT_GALLERY_TEXT = mergeLocales(insertGalleryEn, insertGalleryHe);
var MCP_TEXT = mergeLocales(mcpEn, mcpHe);
var PATCH_NOTES_TEXT = mergeLocales(patchNotesEn, patchNotesHe);
var PLAYER_TEXT = mergeLocales(playerEn, playerHe);
var SETTINGS_TEXT = mergeLocales(settingsEn, settingsHe);
var STATUS_TEXT = mergeLocales(statusEn, statusHe);
var TOPICS_TEXT = mergeLocales(topicsEn, topicsHe);
var UPDATE_TEXT = mergeLocales(updateEn, updateHe);
var { patterns, presets, header, duality, pipeline, media, ...canvasText } = mergeLocales(canvasEn, canvasHe);
var COMPLEXITY_CLASSES = mergeLocales(complexityClassesEn, complexityClassesHe);

// src/core/visualBuilder/shapeCatalog.ts
var SHAPE_PRESETS = [
  { shape: "circle", label: "Circle", glyph: "\u25CB" },
  { shape: "ellipse", label: "Oval", glyph: "\u2B2D" },
  { shape: "box", label: "Box", glyph: "\u25AD" },
  { shape: "rounded", label: "Rounded box", glyph: "\u25A2" },
  { shape: "diamond", label: "Diamond", glyph: "\u25C7" },
  { shape: "triangle", label: "Triangle", glyph: "\u25B3" },
  { shape: "line", label: "Line", glyph: "\u2571" },
  { shape: "arrow", label: "Arrow", glyph: "\u2192" },
  { shape: "text", label: "Text", glyph: "T" },
  { shape: "heading", label: "Heading", glyph: "H" },
  { shape: "caption", label: "Caption", glyph: "t" },
  { shape: "note", label: "Note", glyph: "\u{1F5E8}" }
];
function presetOfRef(ref) {
  const [pack, shape] = ref.split("/");
  return pack === "preset" ? SHAPE_PRESETS.find((preset) => preset.shape === shape)?.shape : void 0;
}
var DEFAULT_VIEW_WIDTH = DEFAULT_STAGE.w;
function shapeStyle(color = DEFAULT_SHAPE_COLOR) {
  return { fill: color, fillOpacity: 0.25, stroke: color, color, strokeWidth: 3, filter: GLOW_OFF, transformBox: "fill-box", transformOrigin: "center" };
}
var lineStyle = (color) => ({ fill: "none", stroke: color, color, strokeWidth: 3, filter: GLOW_OFF });
var center = (box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
var textFrame = (box) => ({ x: box.x, y: box.y, width: box.w, height: box.h });
var rectFactory = (shape, extra) => (id, box) => ({
  id,
  kind: "rect",
  attrs: { ...textFrame(box), ...extra },
  style: shapeStyle(),
  builder: { shape }
});
var pathFactory = (shape, draw2) => (id, box) => ({
  id,
  kind: "path",
  attrs: { d: draw2(box) },
  style: shapeStyle(),
  builder: { shape, box }
});
var lineFactory = (shape) => (id, box) => ({
  id,
  kind: "path",
  attrs: { d: linePath({ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y + box.h }, shape === "arrow") },
  style: lineStyle(DEFAULT_SHAPE_COLOR),
  builder: { shape, box }
});
var textFactory = (shape, content, look) => (id, box) => ({
  id,
  kind: "math",
  attrs: textFrame(box),
  content,
  style: { color: "var(--text-primary)", ...look },
  builder: { shape }
});
var MAIN_FACTORIES = {
  circle: (id, box) => ({ id, kind: "circle", attrs: { cx: center(box).x, cy: center(box).y, r: box.w / 2 }, style: shapeStyle(), builder: { shape: "circle" } }),
  ellipse: (id, box) => ({ id, kind: "ellipse", attrs: { cx: center(box).x, cy: center(box).y, rx: box.w / 2, ry: box.h / 2 }, style: shapeStyle(), builder: { shape: "ellipse" } }),
  box: rectFactory("box", {}),
  rounded: rectFactory("rounded", { rx: 16 }),
  diamond: pathFactory("diamond", diamondPath),
  triangle: pathFactory("triangle", trianglePath),
  pointer: pathFactory("pointer", pointerPath),
  line: lineFactory("line"),
  arrow: lineFactory("arrow"),
  text: textFactory("text", "Text", { "--label-size": "1.15rem" }),
  heading: textFactory("heading", "Heading", { "--label-size": "2.2rem", "--label-weight": 800 }),
  caption: textFactory("caption", "Caption", { "--label-size": "0.85rem", "--label-weight": 400 }),
  note: (id, box) => ({ id, kind: "bubble", attrs: textFrame(box), content: "**Note** \u2014 write here", style: { "--bubble-color": DEFAULT_SHAPE_COLOR }, builder: { shape: "note" } })
};

// src/core/visualBuilder/diagramPacks/automataSeed.pack.json
var automataSeed_pack_default = {
  format: 1,
  id: "automata",
  name: {
    en: "Automata",
    he: "\u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05DD"
  },
  category: "automata-graph",
  color: "blue",
  objects: [
    {
      id: "state",
      label: {
        en: "State",
        he: "\u05DE\u05E6\u05D1"
      },
      size: {
        w: 0.1,
        h: 0.1
      },
      kind: "closed",
      color: "blue",
      svg: '<circle cx="0" cy="0" r="{hw}"/>',
      labelAt: "center",
      keywords: [
        "state",
        "node"
      ]
    },
    {
      id: "accepting-state",
      label: {
        en: "Accepting state",
        he: "\u05DE\u05E6\u05D1 \u05DE\u05E7\u05D1\u05DC"
      },
      size: {
        w: 0.1,
        h: 0.1
      },
      kind: "closed",
      color: "green",
      svg: '<circle cx="0" cy="0" r="{hw}"/><circle cx="0" cy="0" r="{inner}"/>',
      labelAt: "center",
      keywords: [
        "accept",
        "final"
      ]
    },
    {
      id: "start-marker",
      label: {
        en: "Start marker",
        he: "\u05E1\u05D9\u05DE\u05D5\u05DF \u05D4\u05EA\u05D7\u05DC\u05D4"
      },
      size: {
        w: 0.06,
        h: 0.02
      },
      kind: "arrow",
      color: "orange",
      svg: '<path d="M -48 0 L 0 0 M -8 -8 L 0 0 L -8 8"/>',
      labelAt: "top",
      keywords: [
        "start",
        "initial"
      ]
    }
  ],
  effects: [
    {
      id: "wiggle",
      label: {
        en: "Wiggle",
        he: "\u05E8\u05D9\u05D8\u05D5\u05D8"
      },
      description: {
        en: "Shakes side to side and settles.",
        he: "\u05DE\u05EA\u05E0\u05D3\u05E0\u05D3 \u05D4\u05E6\u05D9\u05D3\u05D4 \u05D5\u05D7\u05D5\u05D6\u05E8 \u05DC\u05DE\u05E7\u05D5\u05DE\u05D5."
      },
      kinds: [
        "closed",
        "box",
        "text"
      ],
      duration: 600,
      icon: "\u224B",
      tone: "look",
      anime: {
        translateX: [
          0,
          -10,
          10,
          -6,
          0
        ],
        easing: "easeInOutSine"
      }
    }
  ],
  templates: [
    {
      id: "automata-dfa-mini",
      name: {
        en: "Mini DFA",
        he: "\u05D0\u05D5\u05D8\u05D5\u05DE\u05D8 \u05E1\u05D5\u05E4\u05D9 \u05E7\u05D8\u05DF"
      },
      category: "automata-graph",
      description: {
        en: "Three states; input walks to accept.",
        he: "\u05E9\u05DC\u05D5\u05E9\u05D4 \u05DE\u05E6\u05D1\u05D9\u05DD; \u05E7\u05DC\u05D8 \u05DE\u05D2\u05D9\u05E2 \u05DC\u05DE\u05E6\u05D1 \u05DE\u05E7\u05D1\u05DC."
      },
      objects: [
        {
          key: "start",
          ref: "automata/start-marker",
          at: {
            x: 0.12,
            y: 0.5
          }
        },
        {
          key: "q0",
          ref: "automata/state",
          at: {
            x: 0.25,
            y: 0.5
          },
          label: {
            en: "q0",
            he: "q0"
          }
        },
        {
          key: "q1",
          ref: "automata/state",
          at: {
            x: 0.5,
            y: 0.5
          },
          label: {
            en: "q1",
            he: "q1"
          }
        },
        {
          key: "q2",
          ref: "automata/accepting-state",
          at: {
            x: 0.75,
            y: 0.5
          }
        }
      ],
      links: [
        {
          from: "q0",
          to: "q1",
          label: {
            en: "a",
            he: "a"
          }
        },
        {
          from: "q1",
          to: "q2",
          label: {
            en: "b",
            he: "b"
          }
        }
      ],
      steps: [
        {
          caption: {
            en: "Start in q0",
            he: "\u05D4\u05EA\u05D7\u05DC\u05D4 \u05D1-q0"
          },
          show: [
            "start",
            "q0"
          ],
          effects: [
            {
              effect: "glow",
              target: "q0"
            }
          ]
        },
        {
          caption: {
            en: "Read a: go to q1",
            he: "\u05E7\u05E8\u05D9\u05D0\u05EA a: \u05DE\u05E2\u05D1\u05E8 \u05D0\u05DC q1"
          },
          show: [
            "q1"
          ],
          effects: [
            {
              effect: "travel",
              target: "q0->q1"
            },
            {
              effect: "glow",
              target: "q1"
            }
          ]
        },
        {
          caption: {
            en: "Read b: go to q2",
            he: "\u05E7\u05E8\u05D9\u05D0\u05EA b: \u05DE\u05E2\u05D1\u05E8 \u05D0\u05DC q2"
          },
          show: [
            "q2"
          ],
          effects: [
            {
              effect: "travel",
              target: "q1->q2"
            },
            {
              effect: "glow",
              target: "q2"
            }
          ]
        },
        {
          caption: {
            en: "q2 accepts the word",
            he: "q2 \u05DE\u05E7\u05D1\u05DC \u05D0\u05EA \u05D4\u05DE\u05D9\u05DC\u05D4"
          },
          show: [],
          effects: [
            {
              effect: "pulse",
              target: "q2"
            }
          ]
        }
      ]
    },
    {
      id: "automata-dfa-even-ones",
      name: {
        en: "DFA: even number of 1s",
        he: "\u05D0\u05D5\u05D8\u05D5\u05DE\u05D8: \u05DE\u05E1\u05E4\u05E8 \u05D6\u05D5\u05D2\u05D9 \u05E9\u05DC 1"
      },
      category: "automata-graph",
      description: {
        en: "Loops on 0, 1 switches states.",
        he: "\u05DC\u05D5\u05DC\u05D0\u05D4 \u05E2\u05DC 0, \u200F1 \u05DE\u05D7\u05DC\u05D9\u05E3 \u05DE\u05E6\u05D1."
      },
      objects: [
        {
          key: "start",
          ref: "automata/start-marker",
          at: {
            x: 0.235,
            y: 0.55
          }
        },
        {
          key: "q0",
          ref: "automata/accepting-state",
          at: {
            x: 0.3,
            y: 0.55
          },
          label: {
            en: "q0",
            he: "q0"
          }
        },
        {
          key: "q1",
          ref: "automata/state",
          at: {
            x: 0.7,
            y: 0.55
          },
          label: {
            en: "q1",
            he: "q1"
          }
        }
      ],
      links: [
        {
          from: "q0",
          to: "q0",
          label: {
            en: "0",
            he: "0"
          },
          route: "loop"
        },
        {
          from: "q1",
          to: "q1",
          label: {
            en: "0",
            he: "0"
          },
          route: "loop"
        },
        {
          from: "q0",
          to: "q1",
          label: {
            en: "1",
            he: "1"
          },
          route: "curve",
          fromPort: "n",
          toPort: "n"
        },
        {
          from: "q1",
          to: "q0",
          label: {
            en: "1",
            he: "1"
          },
          route: "curve",
          fromPort: "s",
          toPort: "s"
        }
      ],
      steps: [
        {
          caption: {
            en: "Start in q0: zero 1s so far, accept",
            he: "\u05DE\u05EA\u05D7\u05D9\u05DC\u05D9\u05DD \u05D1-q0: \u05D0\u05E4\u05E1 1, \u05DE\u05E7\u05D1\u05DC"
          },
          show: [
            "start",
            "q0",
            "q1"
          ],
          effects: [
            {
              effect: "glow",
              target: "q0"
            }
          ]
        },
        {
          caption: {
            en: "Read 0: stay in q0",
            he: "\u05E7\u05D5\u05E8\u05D0\u05D9\u05DD 0: \u05E0\u05E9\u05D0\u05E8\u05D9\u05DD \u05D1-q0"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "q0->q0"
            }
          ]
        },
        {
          caption: {
            en: "Read 1: go to q1 (odd)",
            he: "\u05E7\u05D5\u05E8\u05D0\u05D9\u05DD 1: \u05E2\u05D5\u05D1\u05E8\u05D9\u05DD \u05DC-q1 (\u05D0\u05D9-\u05D6\u05D5\u05D2\u05D9)"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "q0->q1"
            },
            {
              effect: "glow",
              target: "q1"
            }
          ]
        },
        {
          caption: {
            en: "Read 1: back to q0 (even)",
            he: "\u05E7\u05D5\u05E8\u05D0\u05D9\u05DD 1: \u05D7\u05D5\u05D6\u05E8\u05D9\u05DD \u05DC-q0 (\u05D6\u05D5\u05D2\u05D9)"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "q1->q0"
            },
            {
              effect: "glow",
              target: "q0"
            }
          ]
        },
        {
          caption: {
            en: "q0 accepts the word 0110",
            he: "q0 \u05DE\u05E7\u05D1\u05DC \u05D0\u05EA \u05D4\u05DE\u05D9\u05DC\u05D4 0110"
          },
          show: [],
          effects: [
            {
              effect: "pulse",
              target: "q0"
            }
          ]
        }
      ]
    }
  ]
};

// src/core/visualBuilder/diagramPacks/basicTemplates.pack.json
var basicTemplates_pack_default = {
  format: 1,
  id: "basic",
  name: {
    en: "Starter diagrams",
    he: "\u05EA\u05E8\u05E9\u05D9\u05DE\u05D9 \u05E4\u05EA\u05D9\u05D7\u05D4"
  },
  category: "shapes",
  color: "blue",
  objects: [],
  templates: [
    {
      id: "graph",
      name: {
        en: "Graph",
        he: "\u05D2\u05E8\u05E3"
      },
      category: "shapes",
      description: {
        en: "Three nodes; a token walks from A to C.",
        he: "\u05E9\u05DC\u05D5\u05E9\u05D4 \u05E6\u05DE\u05EA\u05D9\u05DD; \u05D0\u05E1\u05D9\u05DE\u05D5\u05DF \u05E2\u05D5\u05D1\u05E8 \u05DE-A \u05D0\u05DC C."
      },
      objects: [
        {
          key: "a",
          ref: "preset/circle",
          at: {
            x: 0.225,
            y: 0.36538
          },
          label: {
            en: "A",
            he: "A"
          }
        },
        {
          key: "b",
          ref: "preset/circle",
          at: {
            x: 0.5,
            y: 0.67308
          },
          label: {
            en: "B",
            he: "B"
          }
        },
        {
          key: "c",
          ref: "preset/circle",
          at: {
            x: 0.775,
            y: 0.36538
          },
          label: {
            en: "C",
            he: "C"
          }
        }
      ],
      links: [
        {
          from: "a",
          to: "b"
        },
        {
          from: "b",
          to: "c"
        }
      ],
      steps: [
        {
          caption: {
            en: "Start at A",
            he: "\u05D4\u05EA\u05D7\u05DC\u05D4 \u05D1-A"
          },
          show: [
            "a",
            "b",
            "c"
          ],
          effects: [
            {
              effect: "glow",
              target: "a"
            }
          ]
        },
        {
          caption: {
            en: "Go to B",
            he: "\u05DE\u05E2\u05D1\u05E8 \u05D0\u05DC B"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "a->b"
            },
            {
              effect: "spark",
              target: "a->b"
            },
            {
              effect: "glow",
              target: "b"
            }
          ]
        },
        {
          caption: {
            en: "Go to C",
            he: "\u05DE\u05E2\u05D1\u05E8 \u05D0\u05DC C"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "b->c"
            },
            {
              effect: "spark",
              target: "b->c"
            },
            {
              effect: "glow",
              target: "c"
            },
            {
              effect: "fill",
              target: "c"
            }
          ]
        }
      ]
    },
    {
      id: "tape",
      name: {
        en: "Tape",
        he: "\u05E1\u05E8\u05D8"
      },
      category: "shapes",
      description: {
        en: "Four cells; a head walks along the tape.",
        he: "\u05D0\u05E8\u05D1\u05E2\u05D4 \u05EA\u05D0\u05D9\u05DD; \u05E8\u05D0\u05E9 \u05E2\u05D5\u05D1\u05E8 \u05DC\u05D0\u05D5\u05E8\u05DA \u05D4\u05E1\u05E8\u05D8."
      },
      objects: [
        {
          key: "c1",
          ref: "preset/box",
          at: {
            x: 0.1375,
            y: 0.5
          },
          label: {
            en: "a",
            he: "a"
          }
        },
        {
          key: "c2",
          ref: "preset/box",
          at: {
            x: 0.3625,
            y: 0.5
          },
          label: {
            en: "b",
            he: "b"
          }
        },
        {
          key: "c3",
          ref: "preset/box",
          at: {
            x: 0.5875,
            y: 0.5
          },
          label: {
            en: "a",
            he: "a"
          }
        },
        {
          key: "c4",
          ref: "preset/box",
          at: {
            x: 0.8125,
            y: 0.5
          },
          label: {
            en: "b",
            he: "b"
          }
        }
      ],
      links: [
        {
          from: "c1",
          to: "c2"
        },
        {
          from: "c2",
          to: "c3"
        },
        {
          from: "c3",
          to: "c4"
        }
      ],
      steps: [
        {
          caption: {
            en: "Start at the first cell",
            he: "\u05D4\u05EA\u05D7\u05DC\u05D4 \u05D1\u05EA\u05D0 \u05D4\u05E8\u05D0\u05E9\u05D5\u05DF"
          },
          show: [
            "c1",
            "c2",
            "c3",
            "c4"
          ],
          effects: [
            {
              effect: "glow",
              target: "c1"
            }
          ]
        },
        {
          caption: {
            en: "Move to the second cell",
            he: "\u05DE\u05E2\u05D1\u05E8 \u05DC\u05EA\u05D0 \u05D4\u05E9\u05E0\u05D9"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "c1->c2"
            },
            {
              effect: "spark",
              target: "c1->c2"
            },
            {
              effect: "glow",
              target: "c2"
            }
          ]
        },
        {
          caption: {
            en: "Move to the third cell",
            he: "\u05DE\u05E2\u05D1\u05E8 \u05DC\u05EA\u05D0 \u05D4\u05E9\u05DC\u05D9\u05E9\u05D9"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "c2->c3"
            },
            {
              effect: "spark",
              target: "c2->c3"
            },
            {
              effect: "glow",
              target: "c3"
            }
          ]
        },
        {
          caption: {
            en: "Move to the last cell",
            he: "\u05DE\u05E2\u05D1\u05E8 \u05DC\u05EA\u05D0 \u05D4\u05D0\u05D7\u05E8\u05D5\u05DF"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "c3->c4"
            },
            {
              effect: "spark",
              target: "c3->c4"
            },
            {
              effect: "glow",
              target: "c4"
            },
            {
              effect: "fill",
              target: "c4"
            }
          ]
        }
      ]
    },
    {
      id: "pipeline",
      name: {
        en: "Pipeline",
        he: "\u05E6\u05D9\u05E0\u05D5\u05E8"
      },
      category: "shapes",
      description: {
        en: "Input, process, output, left to right.",
        he: "\u05E7\u05DC\u05D8, \u05E2\u05D9\u05D1\u05D5\u05D3 \u05D5\u05E4\u05DC\u05D8 \u05DE\u05E9\u05DE\u05D0\u05DC \u05DC\u05D9\u05DE\u05D9\u05DF."
      },
      objects: [
        {
          key: "input",
          ref: "preset/rounded",
          at: {
            x: 0.2,
            y: 0.5
          },
          label: {
            en: "Input",
            he: "\u05E7\u05DC\u05D8"
          }
        },
        {
          key: "process",
          ref: "preset/rounded",
          at: {
            x: 0.5,
            y: 0.5
          },
          label: {
            en: "Process",
            he: "\u05E2\u05D9\u05D1\u05D5\u05D3"
          }
        },
        {
          key: "output",
          ref: "preset/rounded",
          at: {
            x: 0.8,
            y: 0.5
          },
          label: {
            en: "Output",
            he: "\u05E4\u05DC\u05D8"
          }
        }
      ],
      links: [
        {
          from: "input",
          to: "process"
        },
        {
          from: "process",
          to: "output"
        }
      ],
      steps: [
        {
          caption: {
            en: "Data enters",
            he: "\u05D4\u05DE\u05D9\u05D3\u05E2 \u05E0\u05DB\u05E0\u05E1"
          },
          show: [
            "input",
            "process",
            "output"
          ],
          effects: [
            {
              effect: "glow",
              target: "input"
            }
          ]
        },
        {
          caption: {
            en: "Data is processed",
            he: "\u05D4\u05DE\u05D9\u05D3\u05E2 \u05DE\u05E2\u05D5\u05D1\u05D3"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "input->process"
            },
            {
              effect: "spark",
              target: "input->process"
            },
            {
              effect: "glow",
              target: "process"
            }
          ]
        },
        {
          caption: {
            en: "Result leaves",
            he: "\u05D4\u05EA\u05D5\u05E6\u05D0\u05D4 \u05D9\u05D5\u05E6\u05D0\u05EA"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "process->output"
            },
            {
              effect: "spark",
              target: "process->output"
            },
            {
              effect: "glow",
              target: "output"
            },
            {
              effect: "fill",
              target: "output"
            }
          ]
        }
      ]
    },
    {
      id: "graph-tree-7",
      name: {
        en: "Search tree",
        he: "\u05E2\u05E5 \u05D7\u05D9\u05E4\u05D5\u05E9"
      },
      category: "shapes",
      description: {
        en: "Seven vertices; visit them in DFS order.",
        he: "\u05E9\u05D1\u05E2\u05D4 \u05E7\u05D5\u05D3\u05E7\u05D5\u05D3\u05D9\u05DD; \u05D1\u05D9\u05E7\u05D5\u05E8 \u05D1\u05E1\u05D3\u05E8 DFS."
      },
      objects: [
        {
          key: "title",
          ref: "preset/caption",
          at: {
            x: 0.5,
            y: 0.08
          },
          label: {
            en: "Search tree",
            he: "\u05E2\u05E5 \u05D7\u05D9\u05E4\u05D5\u05E9"
          }
        },
        {
          key: "start",
          ref: "preset/caption",
          at: {
            x: 0.35,
            y: 0.22
          },
          label: {
            en: "start",
            he: "\u05D4\u05EA\u05D7\u05DC\u05D4"
          }
        },
        {
          key: "a",
          ref: "preset/circle",
          at: {
            x: 0.5,
            y: 0.22
          },
          label: {
            en: "A",
            he: "A"
          }
        },
        {
          key: "b",
          ref: "preset/circle",
          at: {
            x: 0.3,
            y: 0.45
          },
          label: {
            en: "B",
            he: "B"
          }
        },
        {
          key: "c",
          ref: "preset/circle",
          at: {
            x: 0.7,
            y: 0.45
          },
          label: {
            en: "C",
            he: "C"
          }
        },
        {
          key: "d",
          ref: "preset/circle",
          at: {
            x: 0.2,
            y: 0.72
          },
          label: {
            en: "D",
            he: "D"
          }
        },
        {
          key: "e",
          ref: "preset/circle",
          at: {
            x: 0.4,
            y: 0.72
          },
          label: {
            en: "E",
            he: "E"
          }
        },
        {
          key: "f",
          ref: "preset/circle",
          at: {
            x: 0.6,
            y: 0.72
          },
          label: {
            en: "F",
            he: "F"
          }
        },
        {
          key: "g",
          ref: "preset/circle",
          at: {
            x: 0.8,
            y: 0.72
          },
          label: {
            en: "G",
            he: "G"
          }
        }
      ],
      links: [
        {
          from: "a",
          to: "b",
          arrow: false
        },
        {
          from: "a",
          to: "c",
          arrow: false
        },
        {
          from: "b",
          to: "d",
          arrow: false
        },
        {
          from: "b",
          to: "e",
          arrow: false
        },
        {
          from: "f",
          to: "c",
          arrow: false
        },
        {
          from: "c",
          to: "g",
          arrow: false
        },
        {
          from: "e",
          to: "f",
          arrow: false
        }
      ],
      steps: [
        {
          caption: {
            en: "Visit A: the root, start here",
            he: "\u05DE\u05D1\u05E7\u05E8\u05D9\u05DD \u05D1-A: \u05D4\u05E9\u05D5\u05E8\u05E9, \u05DE\u05EA\u05D7\u05D9\u05DC\u05D9\u05DD \u05DB\u05D0\u05DF"
          },
          show: [
            "title",
            "start",
            "a",
            "b",
            "c",
            "d",
            "e",
            "f",
            "g"
          ],
          effects: [
            {
              effect: "fill",
              target: "a"
            },
            {
              effect: "glow",
              target: "a"
            }
          ]
        },
        {
          caption: {
            en: "From A go to its first neighbour B",
            he: "\u05DE-A \u05E2\u05D5\u05D1\u05E8\u05D9\u05DD \u05DC\u05E9\u05DB\u05DF \u05D4\u05E8\u05D0\u05E9\u05D5\u05DF, B"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "a->b"
            },
            {
              effect: "fill",
              target: "b"
            },
            {
              effect: "glow",
              target: "b"
            }
          ]
        },
        {
          caption: {
            en: "B has D and E unvisited: take D first",
            he: "\u05DC-B \u05E9\u05DB\u05E0\u05D9\u05DD D \u05D5-E: \u05E7\u05D5\u05D3\u05DD D"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "b->d"
            },
            {
              effect: "fill",
              target: "d"
            },
            {
              effect: "glow",
              target: "d"
            }
          ]
        },
        {
          caption: {
            en: "D is a dead end: back to B, then E",
            he: "D \u05DC\u05DC\u05D0 \u05D4\u05DE\u05E9\u05DA: \u05D7\u05D5\u05D6\u05E8\u05D9\u05DD \u05DC-B, \u05D0\u05D6 E"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "b->e"
            },
            {
              effect: "fill",
              target: "e"
            },
            {
              effect: "glow",
              target: "e"
            }
          ]
        },
        {
          caption: {
            en: "E has unvisited F: go to F",
            he: "\u05DC-E \u05E9\u05DB\u05DF \u05DC\u05D0 \u05DE\u05D1\u05D5\u05E7\u05E8 F: \u05E2\u05D5\u05D1\u05E8\u05D9\u05DD \u05DC-F"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "e->f"
            },
            {
              effect: "fill",
              target: "f"
            },
            {
              effect: "glow",
              target: "f"
            }
          ]
        },
        {
          caption: {
            en: "F leads to unvisited C: go to C",
            he: "\u05DE-F \u05DC-C \u05E9\u05D8\u05E8\u05DD \u05D1\u05D5\u05E7\u05E8: \u05E2\u05D5\u05D1\u05E8\u05D9\u05DD \u05DC-C"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "f->c"
            },
            {
              effect: "fill",
              target: "c"
            },
            {
              effect: "glow",
              target: "c"
            }
          ]
        },
        {
          caption: {
            en: "C has unvisited G: go to G",
            he: "\u05DC-C \u05E9\u05DB\u05DF \u05DC\u05D0 \u05DE\u05D1\u05D5\u05E7\u05E8 G: \u05E2\u05D5\u05D1\u05E8\u05D9\u05DD \u05DC-G"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "c->g"
            },
            {
              effect: "fill",
              target: "g"
            },
            {
              effect: "glow",
              target: "g"
            }
          ]
        },
        {
          caption: {
            en: "Done: A-C skipped, C reached via F",
            he: "\u05E1\u05D9\u05D5\u05DD: A-C \u05DE\u05D3\u05D5\u05DC\u05D2, C \u05D4\u05D2\u05D9\u05E2 \u05D3\u05E8\u05DA F"
          },
          show: [],
          effects: []
        }
      ]
    },
    {
      id: "tape-cells",
      name: {
        en: "Tape with head",
        he: "\u05E1\u05E8\u05D8 \u05E2\u05DD \u05E8\u05D0\u05E9"
      },
      category: "shapes",
      description: {
        en: "Four cells and a read head.",
        he: "\u05D0\u05E8\u05D1\u05E2\u05D4 \u05EA\u05D0\u05D9\u05DD \u05D5\u05E8\u05D0\u05E9 \u05E7\u05E8\u05D9\u05D0\u05D4."
      },
      objects: [
        {
          key: "c0",
          ref: "preset/box",
          at: {
            x: 0.17,
            y: 0.5
          },
          label: {
            en: "1",
            he: "1"
          }
        },
        {
          key: "c1",
          ref: "preset/box",
          at: {
            x: 0.39,
            y: 0.5
          },
          label: {
            en: "0",
            he: "0"
          }
        },
        {
          key: "c2",
          ref: "preset/box",
          at: {
            x: 0.61,
            y: 0.5
          },
          label: {
            en: "0",
            he: "0"
          }
        },
        {
          key: "c3",
          ref: "preset/box",
          at: {
            x: 0.83,
            y: 0.5
          },
          label: {
            en: "1",
            he: "1"
          }
        },
        {
          key: "head",
          ref: "preset/triangle",
          at: {
            x: 0.61,
            y: 0.78
          }
        },
        {
          key: "headlabel",
          ref: "preset/caption",
          at: {
            x: 0.61,
            y: 0.93
          },
          label: {
            en: "head",
            he: "\u05E8\u05D0\u05E9"
          }
        },
        {
          key: "i0",
          ref: "preset/caption",
          at: {
            x: 0.17,
            y: 0.63
          },
          label: {
            en: "0",
            he: "0"
          }
        },
        {
          key: "i1",
          ref: "preset/caption",
          at: {
            x: 0.39,
            y: 0.63
          },
          label: {
            en: "1",
            he: "1"
          }
        },
        {
          key: "i2",
          ref: "preset/caption",
          at: {
            x: 0.61,
            y: 0.63
          },
          label: {
            en: "2",
            he: "2"
          }
        },
        {
          key: "i3",
          ref: "preset/caption",
          at: {
            x: 0.83,
            y: 0.63
          },
          label: {
            en: "3",
            he: "3"
          }
        }
      ],
      links: [],
      steps: [
        {
          caption: {
            en: "The head reads cell 3: it holds 0",
            he: "\u05D4\u05E8\u05D0\u05E9 \u05E7\u05D5\u05E8\u05D0 \u05EA\u05D0 3: \u05D1\u05D5 0"
          },
          show: [
            "c0",
            "c1",
            "c2",
            "c3",
            "head",
            "headlabel",
            "i0",
            "i1",
            "i2",
            "i3"
          ],
          effects: [
            {
              effect: "glow",
              target: "c2"
            },
            {
              effect: "bounce",
              target: "head"
            }
          ]
        },
        {
          caption: {
            en: "Scan: cell 4",
            he: "\u05E1\u05E8\u05D9\u05E7\u05D4: \u05EA\u05D0 4"
          },
          show: [],
          effects: [
            {
              effect: "glow",
              target: "c3"
            }
          ]
        }
      ]
    },
    {
      id: "graph-weighted-6",
      name: {
        en: "Weighted graph",
        he: "\u05D2\u05E8\u05E3 \u05DE\u05DE\u05D5\u05E9\u05E7\u05DC"
      },
      category: "shapes",
      description: {
        en: "Six vertices, edge weights.",
        he: "\u05E9\u05D9\u05E9\u05D4 \u05E7\u05D5\u05D3\u05E7\u05D5\u05D3\u05D9\u05DD \u05D5\u05DE\u05E9\u05E7\u05DC\u05D9\u05DD."
      },
      objects: [
        {
          key: "title",
          ref: "preset/caption",
          at: {
            x: 0.5,
            y: 0.06
          },
          label: {
            en: "Weighted graph",
            he: "\u05D2\u05E8\u05E3 \u05DE\u05DE\u05D5\u05E9\u05E7\u05DC"
          }
        },
        {
          key: "a",
          ref: "preset/circle",
          at: {
            x: 0.14,
            y: 0.55
          },
          label: {
            en: "A",
            he: "A"
          }
        },
        {
          key: "b",
          ref: "preset/circle",
          at: {
            x: 0.33,
            y: 0.2
          },
          label: {
            en: "B",
            he: "B"
          }
        },
        {
          key: "d",
          ref: "preset/circle",
          at: {
            x: 0.72,
            y: 0.2
          },
          label: {
            en: "D",
            he: "D"
          }
        },
        {
          key: "e",
          ref: "preset/circle",
          at: {
            x: 0.88,
            y: 0.55
          },
          label: {
            en: "E",
            he: "E"
          }
        },
        {
          key: "f",
          ref: "preset/circle",
          at: {
            x: 0.66,
            y: 0.88
          },
          label: {
            en: "F",
            he: "F"
          }
        },
        {
          key: "c",
          ref: "preset/circle",
          at: {
            x: 0.5,
            y: 0.55
          },
          label: {
            en: "C",
            he: "C"
          }
        }
      ],
      links: [
        {
          from: "a",
          to: "b",
          label: {
            en: "7",
            he: "7"
          },
          arrow: false
        },
        {
          from: "a",
          to: "c",
          label: {
            en: "9",
            he: "9"
          },
          arrow: false
        },
        {
          from: "a",
          to: "f",
          label: {
            en: "14",
            he: "14"
          },
          arrow: false
        },
        {
          from: "b",
          to: "c",
          label: {
            en: "10",
            he: "10"
          },
          arrow: false
        },
        {
          from: "b",
          to: "d",
          label: {
            en: "15",
            he: "15"
          },
          arrow: false
        },
        {
          from: "c",
          to: "d",
          label: {
            en: "11",
            he: "11"
          },
          arrow: false
        },
        {
          from: "c",
          to: "f",
          label: {
            en: "2",
            he: "2"
          },
          arrow: false
        },
        {
          from: "d",
          to: "e",
          label: {
            en: "6",
            he: "6"
          },
          arrow: false
        },
        {
          from: "e",
          to: "f",
          label: {
            en: "9",
            he: "9"
          },
          arrow: false
        }
      ],
      steps: [
        {
          caption: {
            en: "Each edge carries a weight",
            he: "\u05DC\u05DB\u05DC \u05E7\u05E9\u05EA \u05D9\u05E9 \u05DE\u05E9\u05E7\u05DC"
          },
          show: [
            "title",
            "a",
            "b",
            "d",
            "e",
            "f",
            "c"
          ],
          effects: []
        }
      ]
    },
    {
      id: "flow-network-6",
      name: {
        en: "Flow network",
        he: "\u05E8\u05E9\u05EA \u05D6\u05E8\u05D9\u05DE\u05D4"
      },
      category: "shapes",
      description: {
        en: "Source S, sink T, capacities.",
        he: "\u05DE\u05E7\u05D5\u05E8 S, \u05D9\u05E2\u05D3 T, \u05E7\u05D9\u05D1\u05D5\u05DC\u05D9\u05DD."
      },
      objects: [
        {
          key: "title",
          ref: "preset/caption",
          at: {
            x: 0.5,
            y: 0.06
          },
          label: {
            en: "Flow network",
            he: "\u05E8\u05E9\u05EA \u05D6\u05E8\u05D9\u05DE\u05D4"
          }
        },
        {
          key: "s",
          ref: "preset/circle",
          at: {
            x: 0.1,
            y: 0.5
          },
          label: {
            en: "S",
            he: "S"
          }
        },
        {
          key: "a",
          ref: "preset/circle",
          at: {
            x: 0.3,
            y: 0.2
          },
          label: {
            en: "A",
            he: "A"
          }
        },
        {
          key: "c",
          ref: "preset/circle",
          at: {
            x: 0.3,
            y: 0.8
          },
          label: {
            en: "C",
            he: "C"
          }
        },
        {
          key: "d",
          ref: "preset/circle",
          at: {
            x: 0.58,
            y: 0.5
          },
          label: {
            en: "D",
            he: "D"
          }
        },
        {
          key: "b",
          ref: "preset/circle",
          at: {
            x: 0.78,
            y: 0.2
          },
          label: {
            en: "B",
            he: "B"
          }
        },
        {
          key: "t",
          ref: "preset/circle",
          at: {
            x: 0.92,
            y: 0.5
          },
          label: {
            en: "T",
            he: "T"
          }
        }
      ],
      links: [
        {
          from: "s",
          to: "a",
          label: {
            en: "10",
            he: "10"
          }
        },
        {
          from: "s",
          to: "c",
          label: {
            en: "10",
            he: "10"
          }
        },
        {
          from: "a",
          to: "b",
          label: {
            en: "4",
            he: "4"
          }
        },
        {
          from: "a",
          to: "c",
          label: {
            en: "2",
            he: "2"
          }
        },
        {
          from: "a",
          to: "d",
          label: {
            en: "8",
            he: "8"
          }
        },
        {
          from: "c",
          to: "d",
          label: {
            en: "9",
            he: "9"
          }
        },
        {
          from: "d",
          to: "b",
          label: {
            en: "6",
            he: "6"
          }
        },
        {
          from: "d",
          to: "t",
          label: {
            en: "10",
            he: "10"
          }
        },
        {
          from: "b",
          to: "t",
          label: {
            en: "10",
            he: "10"
          }
        }
      ],
      steps: [
        {
          caption: {
            en: "Each arrow has a capacity",
            he: "\u05DC\u05DB\u05DC \u05D7\u05E5 \u05D9\u05E9 \u05E7\u05D9\u05D1\u05D5\u05DC"
          },
          show: [
            "title",
            "s",
            "a",
            "c",
            "d",
            "b",
            "t"
          ],
          effects: []
        }
      ]
    }
  ]
};

// src/core/visualBuilder/diagramPacks/flowchart.pack.json
var flowchart_pack_default = {
  format: 1,
  id: "flowchart",
  name: {
    en: "Flowchart",
    he: "\u05EA\u05E8\u05E9\u05D9\u05DD \u05D6\u05E8\u05D9\u05DE\u05D4"
  },
  category: "flowchart",
  color: "blue",
  objects: [
    {
      id: "io-data",
      label: {
        en: "Input / output",
        he: "\u05E7\u05DC\u05D8 / \u05E4\u05DC\u05D8"
      },
      size: {
        w: 0.15,
        h: 0.08
      },
      kind: "box",
      svg: '<polygon points="-36 -32 60 -32 36 32 -60 32"/>',
      labelAt: "center",
      keywords: [
        "parallelogram",
        "input",
        "output",
        "data"
      ]
    },
    {
      id: "process",
      label: {
        en: "Process",
        he: "\u05EA\u05D4\u05DC\u05D9\u05DA"
      },
      size: {
        w: 0.16,
        h: 0.1
      },
      kind: "box",
      svg: '<rect x="-64" y="-40" width="{w}" height="{h}" rx="10"/>',
      labelAt: "center",
      keywords: [
        "step",
        "action",
        "rounded",
        "task"
      ]
    },
    {
      id: "decision",
      label: {
        en: "Decision",
        he: "\u05D4\u05D7\u05DC\u05D8\u05D4"
      },
      size: {
        w: 0.13,
        h: 0.28
      },
      kind: "closed",
      svg: '<polygon points="0 -112 52 0 0 112 -52 0"/>',
      labelAt: "center",
      keywords: [
        "diamond",
        "branch",
        "if",
        "condition"
      ]
    },
    {
      id: "terminator",
      label: {
        en: "Start / end",
        he: "\u05D4\u05EA\u05D7\u05DC\u05D4 / \u05E1\u05D9\u05D5\u05DD"
      },
      size: {
        w: 0.16,
        h: 0.1
      },
      kind: "box",
      svg: '<rect x="-64" y="-40" width="{w}" height="{h}" rx="{hh}"/>',
      labelAt: "center",
      keywords: [
        "stadium",
        "pill",
        "terminal",
        "start",
        "end"
      ]
    }
  ],
  templates: [
    {
      id: "flowchart-login",
      name: {
        en: "Login flow",
        he: "\u05D6\u05E8\u05D9\u05DE\u05EA \u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA"
      },
      category: "flowchart",
      description: {
        en: "Check credentials, then enter or retry.",
        he: "\u05D1\u05D3\u05D9\u05E7\u05EA \u05E4\u05E8\u05D8\u05D9\u05DD, \u05DB\u05E0\u05D9\u05E1\u05D4 \u05D0\u05D5 \u05E0\u05D9\u05E1\u05D9\u05D5\u05DF \u05D7\u05D5\u05D6\u05E8."
      },
      objects: [
        {
          key: "start",
          ref: "flowchart/terminator",
          at: {
            x: 0.1,
            y: 0.5
          },
          label: {
            en: "Start",
            he: "\u05D4\u05EA\u05D7\u05DC\u05D4"
          }
        },
        {
          key: "enter",
          ref: "flowchart/process",
          at: {
            x: 0.325,
            y: 0.5
          },
          label: {
            en: "Sign in",
            he: "\u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA"
          }
        },
        {
          key: "valid",
          ref: "flowchart/decision",
          at: {
            x: 0.55,
            y: 0.5
          },
          label: {
            en: "Valid?",
            he: "\u05EA\u05E7\u05D9\u05DF?"
          }
        },
        {
          key: "dash",
          ref: "flowchart/process",
          at: {
            x: 0.8125,
            y: 0.5
          },
          label: {
            en: "Dashboard",
            he: "\u05DC\u05D5\u05D7 \u05D1\u05E7\u05E8\u05D4"
          }
        },
        {
          key: "err",
          ref: "flowchart/process",
          at: {
            x: 0.55,
            y: 0.865
          },
          label: {
            en: "Show error",
            he: "\u05D4\u05E6\u05D2\u05EA \u05E9\u05D2\u05D9\u05D0\u05D4"
          }
        }
      ],
      links: [
        {
          from: "start",
          to: "enter"
        },
        {
          from: "enter",
          to: "valid"
        },
        {
          from: "valid",
          to: "dash",
          label: {
            en: "Yes",
            he: "\u05DB\u05DF"
          }
        },
        {
          from: "valid",
          to: "err",
          label: {
            en: "No",
            he: "\u05DC\u05D0"
          }
        },
        {
          from: "err",
          to: "enter",
          route: "elbow",
          fromPort: "w",
          toPort: "s"
        }
      ],
      steps: [
        {
          caption: {
            en: "The login starts at Start",
            he: "\u05D4\u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA \u05DE\u05EA\u05D7\u05D9\u05DC\u05D4 \u05D1\u05D4\u05EA\u05D7\u05DC\u05D4"
          },
          show: [
            "start",
            "enter",
            "valid",
            "dash",
            "err"
          ],
          effects: [
            {
              effect: "glow",
              target: "start"
            }
          ]
        },
        {
          caption: {
            en: "The user enters credentials",
            he: "\u05D4\u05DE\u05E9\u05EA\u05DE\u05E9 \u05DE\u05D6\u05D9\u05DF \u05E4\u05E8\u05D8\u05D9\u05DD"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "start->enter"
            },
            {
              effect: "glow",
              target: "enter"
            }
          ]
        },
        {
          caption: {
            en: "The system checks them",
            he: "\u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05D1\u05D5\u05D3\u05E7\u05EA \u05D0\u05D5\u05EA\u05DD"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "enter->valid"
            },
            {
              effect: "glow",
              target: "valid"
            }
          ]
        },
        {
          caption: {
            en: "Valid: open the dashboard",
            he: "\u05EA\u05E7\u05D9\u05DF: \u05E4\u05D5\u05EA\u05D7\u05D9\u05DD \u05D0\u05EA \u05DC\u05D5\u05D7 \u05D4\u05D1\u05E7\u05E8\u05D4"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "valid->dash"
            },
            {
              effect: "pulse",
              target: "dash"
            }
          ]
        },
        {
          caption: {
            en: "Invalid: show an error",
            he: "\u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05DE\u05D5\u05E6\u05D2\u05EA \u05E9\u05D2\u05D9\u05D0\u05D4"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "valid->err"
            },
            {
              effect: "glow",
              target: "err"
            }
          ]
        },
        {
          caption: {
            en: "Back to entering credentials",
            he: "\u05D7\u05D5\u05D6\u05E8\u05D9\u05DD \u05DC\u05D4\u05D6\u05E0\u05EA \u05D4\u05E4\u05E8\u05D8\u05D9\u05DD"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "err->enter"
            },
            {
              effect: "glow",
              target: "enter"
            }
          ]
        }
      ]
    },
    {
      id: "flowchart-loop",
      name: {
        en: "Loop until done",
        he: "\u05DC\u05D5\u05DC\u05D0\u05D4 \u05E2\u05D3 \u05E1\u05D9\u05D5\u05DD"
      },
      category: "flowchart",
      description: {
        en: "Repeat the work until the check passes.",
        he: "\u05D7\u05D5\u05D6\u05E8\u05D9\u05DD \u05E2\u05DC \u05D4\u05E2\u05D1\u05D5\u05D3\u05D4 \u05E2\u05D3 \u05E9\u05D4\u05D1\u05D3\u05D9\u05E7\u05D4 \u05E2\u05D5\u05D1\u05E8\u05EA."
      },
      objects: [
        {
          key: "begin",
          ref: "flowchart/terminator",
          at: {
            x: 0.1,
            y: 0.5
          },
          label: {
            en: "Begin",
            he: "\u05D4\u05EA\u05D7\u05DC\u05D4"
          }
        },
        {
          key: "work",
          ref: "flowchart/process",
          at: {
            x: 0.325,
            y: 0.5
          },
          label: {
            en: "Do the work",
            he: "\u05D1\u05D9\u05E6\u05D5\u05E2 \u05D4\u05E2\u05D1\u05D5\u05D3\u05D4"
          }
        },
        {
          key: "done",
          ref: "flowchart/decision",
          at: {
            x: 0.55,
            y: 0.5
          },
          label: {
            en: "Done?",
            he: "\u05E1\u05D9\u05D9\u05DE\u05E0\u05D5?"
          }
        },
        {
          key: "end",
          ref: "flowchart/terminator",
          at: {
            x: 0.8125,
            y: 0.5
          },
          label: {
            en: "End",
            he: "\u05E1\u05D9\u05D5\u05DD"
          }
        }
      ],
      links: [
        {
          from: "begin",
          to: "work"
        },
        {
          from: "work",
          to: "done"
        },
        {
          from: "done",
          to: "work",
          label: {
            en: "No",
            he: "\u05DC\u05D0"
          },
          route: "curve",
          fromPort: "n",
          toPort: "n"
        },
        {
          from: "done",
          to: "end",
          label: {
            en: "Yes",
            he: "\u05DB\u05DF"
          }
        }
      ],
      steps: [
        {
          caption: {
            en: "Begin the loop",
            he: "\u05DE\u05EA\u05D7\u05D9\u05DC\u05D9\u05DD \u05D0\u05EA \u05D4\u05DC\u05D5\u05DC\u05D0\u05D4"
          },
          show: [
            "begin",
            "work",
            "done",
            "end"
          ],
          effects: [
            {
              effect: "glow",
              target: "begin"
            }
          ]
        },
        {
          caption: {
            en: "Do one round of work",
            he: "\u05DE\u05D1\u05E6\u05E2\u05D9\u05DD \u05E1\u05D1\u05D1 \u05E2\u05D1\u05D5\u05D3\u05D4 \u05D0\u05D7\u05D3"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "begin->work"
            },
            {
              effect: "glow",
              target: "work"
            }
          ]
        },
        {
          caption: {
            en: "Check whether it is done",
            he: "\u05D1\u05D5\u05D3\u05E7\u05D9\u05DD \u05D0\u05DD \u05E1\u05D9\u05D9\u05DE\u05E0\u05D5"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "work->done"
            },
            {
              effect: "glow",
              target: "done"
            }
          ]
        },
        {
          caption: {
            en: "Not done: repeat the work",
            he: "\u05DC\u05D0 \u05E1\u05D9\u05D9\u05DE\u05E0\u05D5: \u05D7\u05D5\u05D6\u05E8\u05D9\u05DD \u05DC\u05E2\u05D1\u05D5\u05D3\u05D4"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "done->work"
            },
            {
              effect: "glow",
              target: "work"
            }
          ]
        },
        {
          caption: {
            en: "Check again",
            he: "\u05D1\u05D5\u05D3\u05E7\u05D9\u05DD \u05E9\u05D5\u05D1"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "work->done"
            },
            {
              effect: "glow",
              target: "done"
            }
          ]
        },
        {
          caption: {
            en: "Done: leave the loop",
            he: "\u05E1\u05D9\u05D9\u05DE\u05E0\u05D5: \u05D9\u05D5\u05E6\u05D0\u05D9\u05DD \u05DE\u05D4\u05DC\u05D5\u05DC\u05D0\u05D4"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "done->end"
            },
            {
              effect: "pulse",
              target: "end"
            }
          ]
        }
      ]
    }
  ]
};

// src/core/visualBuilder/diagramPacks/memory.pack.json
var memory_pack_default = {
  format: 1,
  id: "memory",
  name: {
    en: "Memory",
    he: "\u05D6\u05D9\u05DB\u05E8\u05D5\u05DF"
  },
  category: "data",
  color: "purple",
  objects: [
    {
      id: "stack-cell",
      label: {
        en: "Variable",
        he: "\u05DE\u05E9\u05EA\u05E0\u05D4"
      },
      size: {
        w: 0.1,
        h: 0.075
      },
      kind: "box",
      svg: '<rect x="-40" y="-30" width="{w}" height="{h}" rx="2"/>',
      labelAt: "top",
      keywords: [
        "variable",
        "stack",
        "cell",
        "value"
      ]
    },
    {
      id: "heap-block",
      label: {
        en: "Heap block",
        he: "\u05D1\u05DC\u05D5\u05E7 \u05D1\u05E2\u05E8\u05D9\u05DE\u05D4"
      },
      size: {
        w: 0.12,
        h: 0.09
      },
      kind: "box",
      svg: '<rect x="-48" y="-36" width="{w}" height="{h}" rx="2"/><rect x="-48" y="-36" width="{w}" height="12" fill="currentColor" stroke="none"/>',
      labelAt: "below",
      keywords: [
        "heap",
        "new",
        "allocated",
        "block"
      ]
    },
    {
      id: "null-cell",
      label: {
        en: "Null variable",
        he: "\u05DE\u05E9\u05EA\u05E0\u05D4 null"
      },
      size: {
        w: 0.1,
        h: 0.075
      },
      kind: "box",
      svg: '<rect x="-40" y="-30" width="{w}" height="{h}" rx="2"/><path d="M -40 30 L 40 -30"/>',
      labelAt: "top",
      keywords: [
        "null",
        "nullptr",
        "empty",
        "pointer"
      ]
    },
    {
      id: "stack-frame",
      label: {
        en: "Stack frame",
        he: "\u05DE\u05E1\u05D2\u05E8\u05EA \u05DE\u05D7\u05E1\u05E0\u05D9\u05EA"
      },
      size: {
        w: 0.2,
        h: 0.45
      },
      kind: "box",
      svg: '<rect x="-80" y="-180" width="{w}" height="{h}" rx="4"/><path d="M -80 -150 L 80 -150"/>',
      labelAt: "top",
      keywords: [
        "frame",
        "function",
        "call",
        "scope"
      ]
    }
  ],
  templates: [
    {
      id: "memory-pointers",
      name: {
        en: "Pointers and a leak",
        he: "\u05DE\u05E6\u05D1\u05D9\u05E2\u05D9\u05DD \u05D5\u05D3\u05DC\u05D9\u05E4\u05D4"
      },
      category: "data",
      description: {
        en: "Three variables, two blocks, one leak.",
        he: "\u05E9\u05DC\u05D5\u05E9\u05D4 \u05DE\u05E9\u05EA\u05E0\u05D9\u05DD, \u05E9\u05E0\u05D9 \u05D1\u05DC\u05D5\u05E7\u05D9\u05DD, \u05D3\u05DC\u05D9\u05E4\u05D4 \u05D0\u05D7\u05EA."
      },
      objects: [
        {
          key: "f",
          ref: "memory/stack-frame",
          at: {
            x: 0.2,
            y: 0.5
          },
          label: {
            en: "main()",
            he: "main()"
          }
        },
        {
          key: "a",
          ref: "memory/stack-cell",
          at: {
            x: 0.2,
            y: 0.36
          },
          label: {
            en: "a",
            he: "a"
          }
        },
        {
          key: "p",
          ref: "memory/stack-cell",
          at: {
            x: 0.2,
            y: 0.55
          },
          label: {
            en: "p",
            he: "p"
          }
        },
        {
          key: "q",
          ref: "memory/stack-cell",
          at: {
            x: 0.2,
            y: 0.74
          },
          label: {
            en: "q",
            he: "q"
          }
        },
        {
          key: "h1",
          ref: "memory/heap-block",
          at: {
            x: 0.7,
            y: 0.3
          },
          label: {
            en: "h1",
            he: "h1"
          }
        },
        {
          key: "h2",
          ref: "memory/heap-block",
          at: {
            x: 0.7,
            y: 0.72
          },
          label: {
            en: "h2",
            he: "h2"
          }
        }
      ],
      links: [
        {
          from: "p",
          to: "h1",
          fromPort: "e",
          toPort: "w",
          route: "straight",
          arrow: true
        },
        {
          from: "q",
          to: "h1",
          fromPort: "e",
          toPort: "w",
          route: "straight",
          arrow: true
        }
      ],
      steps: [
        {
          caption: {
            en: "p and q both hold the address of h1",
            he: "p \u05D5-q \u05E9\u05E0\u05D9\u05D4\u05DD \u05E9\u05D5\u05DE\u05E8\u05D9\u05DD \u05D0\u05EA \u05D4\u05DB\u05EA\u05D5\u05D1\u05EA \u05E9\u05DC h1"
          },
          show: [
            "f",
            "a",
            "p",
            "q",
            "h1",
            "h2"
          ],
          effects: [
            {
              effect: "glow",
              target: "p"
            },
            {
              effect: "glow",
              target: "q"
            }
          ]
        },
        {
          caption: {
            en: "h2 has no pointer: a leak",
            he: "\u05D0\u05D9\u05DF \u05DE\u05E6\u05D1\u05D9\u05E2 \u05D0\u05DC h2: \u05D3\u05DC\u05D9\u05E4\u05D4"
          },
          show: [],
          effects: [
            {
              effect: "pulse",
              target: "h2"
            }
          ]
        }
      ]
    }
  ]
};

// src/core/visualBuilder/diagramPacks/network.pack.json
var network_pack_default = {
  format: 1,
  id: "network",
  name: {
    en: "Network",
    he: "\u05E8\u05E9\u05EA"
  },
  category: "network",
  color: "orange",
  objects: [
    {
      id: "router",
      label: {
        en: "Router",
        he: "\u05E0\u05EA\u05D1"
      },
      size: {
        w: 0.09,
        h: 0.09
      },
      kind: "closed",
      view: {
        w: 18,
        h: 18
      },
      outline: "ellipse",
      anchors: [
        {
          id: "top",
          x: 0.5,
          y: 0,
          nx: 0,
          ny: -1
        },
        {
          id: "right",
          x: 1,
          y: 0.5,
          nx: 1,
          ny: 0
        },
        {
          id: "bottom",
          x: 0.5,
          y: 1,
          nx: 0,
          ny: 1
        },
        {
          id: "left",
          x: 0,
          y: 0.5,
          nx: -1,
          ny: 0
        }
      ],
      svg: '<circle cx="0" cy="0" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M 0 -6 V -3 M 0 3 V 6 M -6 0 H -3 M 3 0 H 6" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      labelAt: "below",
      keywords: [
        "route",
        "gateway",
        "forward"
      ]
    },
    {
      id: "switch",
      label: {
        en: "Switch",
        he: "\u05DE\u05EA\u05D2"
      },
      size: {
        w: 0.09,
        h: 0.045
      },
      kind: "box",
      view: {
        w: 20,
        h: 10
      },
      outline: "rect",
      anchors: [
        {
          id: "top",
          x: 0.5,
          y: 0,
          nx: 0,
          ny: -1
        },
        {
          id: "right",
          x: 1,
          y: 0.5,
          nx: 1,
          ny: 0
        },
        {
          id: "bottom",
          x: 0.5,
          y: 1,
          nx: 0,
          ny: 1
        },
        {
          id: "left",
          x: 0,
          y: 0.5,
          nx: -1,
          ny: 0
        }
      ],
      svg: '<rect x="-10" y="-5" width="20" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M -6 -2 H 5 M 6 2 H -5" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      labelAt: "below",
      keywords: [
        "l2",
        "frames"
      ]
    },
    {
      id: "firewall",
      label: {
        en: "Firewall",
        he: "\u05D7\u05D5\u05DE\u05EA \u05D0\u05E9"
      },
      size: {
        w: 0.09,
        h: 0.07
      },
      kind: "box",
      view: {
        w: 18,
        h: 14
      },
      outline: "rect",
      anchors: [
        {
          id: "top",
          x: 0.5,
          y: 0,
          nx: 0,
          ny: -1
        },
        {
          id: "right",
          x: 1,
          y: 0.5,
          nx: 1,
          ny: 0
        },
        {
          id: "bottom",
          x: 0.5,
          y: 1,
          nx: 0,
          ny: 1
        },
        {
          id: "left",
          x: 0,
          y: 0.5,
          nx: -1,
          ny: 0
        }
      ],
      svg: '<rect x="-9" y="-7" width="18" height="14" rx="0" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M -9 -2.3 H 9 M -9 2.3 H 9 M 0 -7 V -2.3 M -4.5 -2.3 V 2.3 M 4.5 -2.3 V 2.3 M 0 2.3 V 7" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      labelAt: "below",
      keywords: [
        "security",
        "filter",
        "wall"
      ]
    },
    {
      id: "server",
      label: {
        en: "Server",
        he: "\u05E9\u05E8\u05EA"
      },
      size: {
        w: 0.07,
        h: 0.08
      },
      kind: "box",
      view: {
        w: 16,
        h: 18
      },
      outline: "rect",
      anchors: [
        {
          id: "top",
          x: 0.5,
          y: 0,
          nx: 0,
          ny: -1
        },
        {
          id: "right",
          x: 1,
          y: 0.5,
          nx: 1,
          ny: 0
        },
        {
          id: "bottom",
          x: 0.5,
          y: 1,
          nx: 0,
          ny: 1
        },
        {
          id: "left",
          x: 0,
          y: 0.5,
          nx: -1,
          ny: 0
        }
      ],
      svg: '<rect x="-8" y="-9" width="16" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M -5 -3 H 5 M -5 1 H 5 M -5 5 H 5" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      labelAt: "below",
      keywords: [
        "host",
        "machine"
      ]
    },
    {
      id: "client",
      label: {
        en: "Client",
        he: "\u05DC\u05E7\u05D5\u05D7"
      },
      size: {
        w: 0.08,
        h: 0.07
      },
      kind: "box",
      view: {
        w: 18,
        h: 16
      },
      outline: "rect",
      anchors: [
        {
          id: "top",
          x: 0.5,
          y: 0,
          nx: 0,
          ny: -1
        },
        {
          id: "right",
          x: 1,
          y: 0.5,
          nx: 1,
          ny: 0
        },
        {
          id: "bottom",
          x: 0.5,
          y: 1,
          nx: 0,
          ny: 1
        },
        {
          id: "left",
          x: 0,
          y: 0.5,
          nx: -1,
          ny: 0
        }
      ],
      svg: '<path d="M -9 -8 H 9 V 4 H -9 Z M 0 4 V 7 M -4 8 H 4" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      labelAt: "below",
      aliases: [
        "pc"
      ],
      keywords: [
        "pc",
        "computer",
        "workstation"
      ]
    },
    {
      id: "cloud",
      label: {
        en: "Cloud",
        he: "\u05E2\u05E0\u05DF"
      },
      size: {
        w: 0.12,
        h: 0.081
      },
      kind: "closed",
      view: {
        w: 19,
        h: 12.8
      },
      outline: "ellipse",
      anchors: [
        {
          id: "top",
          x: 0.5,
          y: 0,
          nx: 0,
          ny: -1
        },
        {
          id: "right",
          x: 1,
          y: 0.5,
          nx: 1,
          ny: 0
        },
        {
          id: "bottom",
          x: 0.5,
          y: 1,
          nx: 0,
          ny: 1
        },
        {
          id: "left",
          x: 0,
          y: 0.5,
          nx: -1,
          ny: 0
        }
      ],
      svg: '<path d="M -5 6 A 4 4 0 0 1 -5.5 -2 A 5.5 5.5 0 0 1 5 -3.5 A 4.5 4.5 0 0 1 5 6 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      labelAt: "below",
      keywords: [
        "internet",
        "wan"
      ]
    },
    {
      id: "hub",
      label: {
        en: "Hub",
        he: "\u05E8\u05DB\u05D6\u05EA"
      },
      size: {
        w: 0.08,
        h: 0.032
      },
      kind: "box",
      view: {
        w: 20,
        h: 8
      },
      outline: "rect",
      anchors: [
        {
          id: "top",
          x: 0.5,
          y: 0,
          nx: 0,
          ny: -1
        },
        {
          id: "right",
          x: 1,
          y: 0.5,
          nx: 1,
          ny: 0
        },
        {
          id: "bottom",
          x: 0.5,
          y: 1,
          nx: 0,
          ny: 1
        },
        {
          id: "left",
          x: 0,
          y: 0.5,
          nx: -1,
          ny: 0
        }
      ],
      svg: '<rect x="-10" y="-4" width="20" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="-6" cy="0" r="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="-2" cy="0" r="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="2" cy="0" r="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="0" r="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      labelAt: "below",
      keywords: [
        "repeater",
        "ports"
      ]
    },
    {
      id: "database",
      label: {
        en: "Database",
        he: "\u05DE\u05E1\u05D3 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD"
      },
      size: {
        w: 0.07,
        h: 0.08
      },
      kind: "closed",
      view: {
        w: 16,
        h: 18
      },
      outline: "rect",
      anchors: [
        {
          id: "top",
          x: 0.5,
          y: 0,
          nx: 0,
          ny: -1
        },
        {
          id: "right",
          x: 1,
          y: 0.5,
          nx: 1,
          ny: 0
        },
        {
          id: "bottom",
          x: 0.5,
          y: 1,
          nx: 0,
          ny: 1
        },
        {
          id: "left",
          x: 0,
          y: 0.5,
          nx: -1,
          ny: 0
        }
      ],
      svg: '<path d="M -8 -6 A 8 3 0 0 1 8 -6 V 6 A 8 3 0 0 1 -8 6 Z M -8 -6 A 8 3 0 0 0 8 -6" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      labelAt: "below",
      aliases: [
        "cylinder"
      ],
      keywords: [
        "db",
        "sql",
        "storage"
      ]
    },
    {
      id: "subnet",
      label: {
        en: "Subnet",
        he: "\u05EA\u05EA-\u05E8\u05E9\u05EA"
      },
      size: {
        w: 0.3,
        h: 0.2
      },
      kind: "box",
      svg: '<rect x="-120" y="-80" width="{w}" height="{h}" rx="16" fill="none" stroke-dasharray="8 6"/>',
      labelAt: "top",
      keywords: [
        "vpc",
        "boundary",
        "region",
        "zone"
      ]
    },
    {
      id: "packet",
      label: {
        en: "Packet",
        he: "\u05DE\u05E0\u05EA \u05DE\u05D9\u05D3\u05E2"
      },
      size: {
        w: 0.025,
        h: 0.02
      },
      kind: "closed",
      svg: '<rect x="-10" y="-8" width="{w}" height="{h}" fill="currentColor" stroke="none" data-role="solid"/>',
      labelAt: "none",
      keywords: [
        "frame",
        "datagram",
        "message"
      ]
    }
  ],
  templates: [
    {
      id: "network-lan",
      name: {
        en: "Small LAN",
        he: "\u05E8\u05E9\u05EA \u05E7\u05D8\u05E0\u05D4"
      },
      category: "network",
      description: {
        en: "Clients, a switch, a router, a server.",
        he: "\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA, \u05DE\u05EA\u05D2, \u05E0\u05EA\u05D1 \u05D5\u05E9\u05E8\u05EA."
      },
      objects: [
        {
          key: "c1",
          ref: "network/client",
          at: {
            x: 0.14,
            y: 0.8
          },
          label: {
            en: "PC 1",
            he: "PC 1"
          }
        },
        {
          key: "c2",
          ref: "network/client",
          at: {
            x: 0.14,
            y: 0.3
          },
          label: {
            en: "PC 2",
            he: "PC 2"
          }
        },
        {
          key: "sw",
          ref: "network/switch",
          at: {
            x: 0.38,
            y: 0.55
          },
          label: {
            en: "Switch",
            he: "Switch"
          }
        },
        {
          key: "rt",
          ref: "network/router",
          at: {
            x: 0.62,
            y: 0.55
          },
          label: {
            en: "Router",
            he: "Router"
          }
        },
        {
          key: "cl",
          ref: "network/cloud",
          at: {
            x: 0.86,
            y: 0.3
          },
          label: {
            en: "Internet",
            he: "Internet"
          }
        },
        {
          key: "sv",
          ref: "network/server",
          at: {
            x: 0.86,
            y: 0.78
          },
          label: {
            en: "Server",
            he: "Server"
          }
        }
      ],
      links: [
        {
          from: "c1",
          to: "sw",
          arrow: false
        },
        {
          from: "c2",
          to: "sw",
          arrow: false
        },
        {
          from: "sw",
          to: "rt",
          arrow: false
        },
        {
          from: "rt",
          to: "cl",
          arrow: false
        },
        {
          from: "rt",
          to: "sv",
          arrow: false
        }
      ],
      steps: [
        {
          caption: {
            en: "PC 1 has a packet to send",
            he: "\u05DC\u05DE\u05D7\u05E9\u05D1 1 \u05D9\u05E9 \u05D7\u05D1\u05D9\u05DC\u05D4 \u05DC\u05E9\u05DC\u05D9\u05D7\u05D4"
          },
          show: [
            "c1",
            "c2",
            "sw",
            "rt",
            "cl",
            "sv"
          ],
          effects: [
            {
              effect: "glow",
              target: "c1"
            }
          ]
        },
        {
          caption: {
            en: "The switch forwards it",
            he: "\u05D4\u05DE\u05EA\u05D2 \u05DE\u05E2\u05D1\u05D9\u05E8 \u05D0\u05D5\u05EA\u05D4"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "c1->sw"
            },
            {
              effect: "glow",
              target: "sw"
            }
          ]
        },
        {
          caption: {
            en: "The router picks the next hop",
            he: "\u05D4\u05E0\u05EA\u05D1 \u05D1\u05D5\u05D7\u05E8 \u05D0\u05EA \u05D4\u05E7\u05E4\u05D9\u05E6\u05D4 \u05D4\u05D1\u05D0\u05D4"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "sw->rt"
            },
            {
              effect: "glow",
              target: "rt"
            }
          ]
        },
        {
          caption: {
            en: "The server receives it",
            he: "\u05D4\u05E9\u05E8\u05EA \u05DE\u05E7\u05D1\u05DC \u05D0\u05D5\u05EA\u05D4"
          },
          show: [],
          effects: [
            {
              effect: "travel",
              target: "rt->sv"
            },
            {
              effect: "pulse",
              target: "sv"
            }
          ]
        }
      ]
    }
  ]
};

// src/core/visualBuilder/diagramPacks/sets.pack.json
var sets_pack_default = {
  format: 1,
  id: "sets",
  name: {
    en: "Sets and Venn",
    he: "\u05E7\u05D1\u05D5\u05E6\u05D5\u05EA \u05D5-\u05D5\u05DF"
  },
  category: "sets",
  color: "green",
  objects: [
    {
      id: "set",
      label: {
        en: "Set",
        he: "\u05E7\u05D1\u05D5\u05E6\u05D4"
      },
      size: {
        w: 0.2,
        h: 0.2
      },
      kind: "closed",
      svg: '<circle cx="0" cy="0" r="{hw}"/>',
      labelAt: "center",
      keywords: [
        "venn",
        "circle",
        "group"
      ]
    },
    {
      id: "universe",
      label: {
        en: "Universe",
        he: "\u05DE\u05E8\u05D7\u05D1"
      },
      size: {
        w: 0.6,
        h: 0.45
      },
      kind: "box",
      svg: '<rect x="-240" y="-180" width="{w}" height="{h}" rx="16" fill="none"/>',
      labelAt: "top",
      keywords: [
        "frame",
        "domain",
        "u"
      ]
    },
    {
      id: "overlap-lens",
      label: {
        en: "Overlap",
        he: "\u05D7\u05D9\u05EA\u05D5\u05DA"
      },
      size: {
        w: 0.08,
        h: 0.16
      },
      kind: "closed",
      svg: '<path d="M 0 -64 C 32 -32 32 32 0 64 C -32 32 -32 -32 0 -64 Z" stroke-dasharray="6 4"/>',
      labelAt: "center",
      keywords: [
        "intersection",
        "lens",
        "venn"
      ]
    },
    {
      id: "element",
      label: {
        en: "Element",
        he: "\u05D0\u05D9\u05D1\u05E8"
      },
      size: {
        w: 0.03,
        h: 0.03
      },
      kind: "closed",
      svg: '<circle cx="0" cy="0" r="{hw}" fill="currentColor" data-role="solid"/>',
      labelAt: "right",
      keywords: [
        "member",
        "dot",
        "point"
      ]
    }
  ],
  templates: [
    {
      id: "sets-venn-2",
      name: {
        en: "Venn: two sets",
        he: "\u05D5\u05DF: \u05E9\u05EA\u05D9 \u05E7\u05D1\u05D5\u05E6\u05D5\u05EA"
      },
      category: "sets",
      description: {
        en: "Two sets, their overlap and one element.",
        he: "\u05E9\u05EA\u05D9 \u05E7\u05D1\u05D5\u05E6\u05D5\u05EA, \u05D4\u05D7\u05D9\u05EA\u05D5\u05DA \u05E9\u05DC\u05D4\u05DF \u05D5\u05D0\u05D9\u05D1\u05E8 \u05D0\u05D7\u05D3."
      },
      objects: [
        {
          key: "universe",
          ref: "sets/universe",
          at: {
            x: 0.5,
            y: 0.5
          },
          label: {
            en: "U",
            he: "U"
          }
        },
        {
          key: "a",
          ref: "sets/set",
          at: {
            x: 0.44,
            y: 0.5
          },
          color: "blue"
        },
        {
          key: "name-a",
          ref: "preset/caption",
          at: {
            x: 0.3525,
            y: 0.3
          },
          label: {
            en: "A",
            he: "A"
          }
        },
        {
          key: "b",
          ref: "sets/set",
          at: {
            x: 0.56,
            y: 0.5
          },
          color: "orange"
        },
        {
          key: "name-b",
          ref: "preset/caption",
          at: {
            x: 0.6475,
            y: 0.3
          },
          label: {
            en: "B",
            he: "B"
          }
        },
        {
          key: "both",
          ref: "sets/overlap-lens",
          at: {
            x: 0.5,
            y: 0.5
          }
        },
        {
          key: "x",
          ref: "sets/element",
          at: {
            x: 0.5,
            y: 0.5
          }
        }
      ],
      links: [],
      steps: [
        {
          caption: {
            en: "The universe U holds everything",
            he: "\u05D4\u05DE\u05E8\u05D7\u05D1 U \u05DE\u05DB\u05D9\u05DC \u05D4\u05DB\u05D5\u05DC"
          },
          show: [
            "universe",
            "a",
            "name-a",
            "b",
            "name-b",
            "both",
            "x"
          ],
          effects: [
            {
              effect: "glow",
              target: "universe"
            }
          ]
        },
        {
          caption: {
            en: "Set A",
            he: "\u05D4\u05E7\u05D1\u05D5\u05E6\u05D4 A"
          },
          show: [],
          effects: [
            {
              effect: "glow",
              target: "a"
            }
          ]
        },
        {
          caption: {
            en: "Set B",
            he: "\u05D4\u05E7\u05D1\u05D5\u05E6\u05D4 B"
          },
          show: [],
          effects: [
            {
              effect: "glow",
              target: "b"
            }
          ]
        },
        {
          caption: {
            en: "The overlap is A and B together",
            he: "\u05D4\u05D7\u05D9\u05EA\u05D5\u05DA \u05D4\u05D5\u05D0 A \u05D5-B \u05D9\u05D7\u05D3"
          },
          show: [],
          effects: [
            {
              effect: "pulse",
              target: "both"
            }
          ]
        }
      ]
    },
    {
      id: "sets-venn-3",
      name: {
        en: "Venn: three sets",
        he: "\u05D5\u05DF: \u05E9\u05DC\u05D5\u05E9 \u05E7\u05D1\u05D5\u05E6\u05D5\u05EA"
      },
      category: "sets",
      description: {
        en: "Three sets that all overlap.",
        he: "\u05E9\u05DC\u05D5\u05E9 \u05E7\u05D1\u05D5\u05E6\u05D5\u05EA \u05E9\u05DB\u05D5\u05DC\u05DF \u05D7\u05D5\u05E4\u05E4\u05D5\u05EA."
      },
      objects: [
        {
          key: "universe",
          ref: "sets/universe",
          at: {
            x: 0.5,
            y: 0.5
          },
          label: {
            en: "U",
            he: "U"
          }
        },
        {
          key: "a",
          ref: "sets/set",
          at: {
            x: 0.44,
            y: 0.42
          },
          color: "blue"
        },
        {
          key: "name-a",
          ref: "preset/caption",
          at: {
            x: 0.44,
            y: 0.3
          },
          label: {
            en: "A",
            he: "A"
          },
          width: 0.05
        },
        {
          key: "b",
          ref: "sets/set",
          at: {
            x: 0.56,
            y: 0.42
          },
          color: "orange"
        },
        {
          key: "name-b",
          ref: "preset/caption",
          at: {
            x: 0.56,
            y: 0.3
          },
          label: {
            en: "B",
            he: "B"
          },
          width: 0.05
        },
        {
          key: "c",
          ref: "sets/set",
          at: {
            x: 0.5,
            y: 0.58
          },
          color: "green"
        },
        {
          key: "name-c",
          ref: "preset/caption",
          at: {
            x: 0.5,
            y: 0.69
          },
          label: {
            en: "C",
            he: "C"
          },
          width: 0.05
        }
      ],
      links: [],
      steps: [
        {
          caption: {
            en: "The universe U",
            he: "\u05D4\u05DE\u05E8\u05D7\u05D1 U"
          },
          show: [
            "universe",
            "a",
            "name-a",
            "b",
            "name-b",
            "c",
            "name-c"
          ],
          effects: []
        },
        {
          caption: {
            en: "Set A",
            he: "\u05D4\u05E7\u05D1\u05D5\u05E6\u05D4 A"
          },
          show: [],
          effects: [
            {
              effect: "glow",
              target: "a"
            }
          ]
        },
        {
          caption: {
            en: "Set B overlaps A",
            he: "\u05D4\u05E7\u05D1\u05D5\u05E6\u05D4 B \u05D7\u05D5\u05E4\u05E4\u05EA \u05D0\u05EA A"
          },
          show: [],
          effects: [
            {
              effect: "glow",
              target: "b"
            }
          ]
        },
        {
          caption: {
            en: "Set C overlaps both",
            he: "\u05D4\u05E7\u05D1\u05D5\u05E6\u05D4 C \u05D7\u05D5\u05E4\u05E4\u05EA \u05D0\u05EA \u05E9\u05EA\u05D9\u05D4\u05DF"
          },
          show: [],
          effects: [
            {
              effect: "glow",
              target: "c"
            }
          ]
        }
      ]
    },
    {
      id: "sets-nested-classes",
      name: {
        en: "Nested classes",
        he: "\u05DE\u05D7\u05DC\u05E7\u05D5\u05EA \u05DE\u05E7\u05D5\u05E0\u05E0\u05D5\u05EA"
      },
      category: "sets",
      description: {
        en: "P sits inside NP inside PSPACE.",
        he: "P \u05D1\u05EA\u05D5\u05DA NP \u05D1\u05EA\u05D5\u05DA PSPACE."
      },
      objects: [
        {
          key: "pspace",
          ref: "sets/universe",
          at: {
            x: 0.5,
            y: 0.5
          },
          label: {
            en: "PSPACE",
            he: "PSPACE"
          }
        },
        {
          key: "np",
          ref: "sets/set",
          at: {
            x: 0.5,
            y: 0.55
          },
          label: {
            en: "NP",
            he: "NP"
          }
        },
        {
          key: "p",
          ref: "sets/element",
          at: {
            x: 0.5,
            y: 0.627
          },
          label: {
            en: "P",
            he: "P"
          }
        }
      ],
      links: [],
      steps: [
        {
          caption: {
            en: "PSPACE is the largest class",
            he: "PSPACE \u05D4\u05D9\u05D0 \u05D4\u05DE\u05D7\u05DC\u05E7\u05D4 \u05D4\u05D2\u05D3\u05D5\u05DC\u05D4"
          },
          show: [
            "pspace",
            "np",
            "p"
          ],
          effects: [
            {
              effect: "glow",
              target: "pspace"
            }
          ]
        },
        {
          caption: {
            en: "NP sits inside PSPACE",
            he: "NP \u05E0\u05DE\u05E6\u05D0\u05EA \u05D1\u05EA\u05D5\u05DA PSPACE"
          },
          show: [],
          effects: [
            {
              effect: "glow",
              target: "np"
            }
          ]
        },
        {
          caption: {
            en: "P sits inside NP",
            he: "P \u05E0\u05DE\u05E6\u05D0\u05EA \u05D1\u05EA\u05D5\u05DA NP"
          },
          show: [],
          effects: [
            {
              effect: "pulse",
              target: "p"
            }
          ]
        }
      ]
    }
  ]
};

// src/core/visualBuilder/diagramPacks/shapes.pack.json
var shapes_pack_default = {
  format: 1,
  id: "shapes",
  name: { en: "Shapes", he: "\u05E6\u05D5\u05E8\u05D5\u05EA" },
  category: "shapes",
  color: "blue",
  objects: [
    { id: "pentagon", label: { en: "Pentagon", he: "\u05DE\u05D7\u05D5\u05DE\u05E9" }, size: { w: 0.15, h: 0.125 }, kind: "closed", svg: '<polygon points="0 -50 60 -12 37.2 50 -37.2 50 -60 -12"/>', labelAt: "center", keywords: ["polygon", "five"] },
    { id: "hexagon", label: { en: "Hexagon", he: "\u05DE\u05E9\u05D5\u05E9\u05D4" }, size: { w: 0.175, h: 0.1 }, kind: "closed", svg: '<polygon points="-35 -40 35 -40 70 0 35 40 -35 40 -70 0"/>', labelAt: "center", keywords: ["polygon", "six"] },
    { id: "star", label: { en: "Star", he: "\u05DB\u05D5\u05DB\u05D1" }, size: { w: 0.125, h: 0.125 }, kind: "closed", svg: '<polygon points="0 -50 12.37 -12.61 50 -11.81 20 12.1 30.9 50 0 27.38 -30.9 50 -20 12.1 -50 -11.81 -12.37 -12.61"/>', labelAt: "below", keywords: ["rating", "favourite"] },
    { id: "callout", label: { en: "Callout", he: "\u05D1\u05D5\u05E2\u05EA \u05D3\u05D9\u05D1\u05D5\u05E8" }, size: { w: 0.175, h: 0.125 }, kind: "closed", svg: '<polygon points="-70 -50 70 -50 70 28 -30.8 28 -42 50 -53.2 28 -70 28"/>', labelAt: "center", keywords: ["speech", "bubble", "comment"] }
  ]
};

// src/core/visualBuilder/diagramPacks/system.pack.json
var system_pack_default = {
  format: 1,
  id: "system",
  name: { en: "System design", he: "\u05EA\u05DB\u05E0\u05D5\u05DF \u05DE\u05E2\u05E8\u05DB\u05D5\u05EA" },
  category: "system",
  color: "blue",
  objects: [
    { id: "microservice", label: { en: "Microservice", he: "\u05DE\u05D9\u05E7\u05E8\u05D5-\u05E9\u05D9\u05E8\u05D5\u05EA" }, size: { w: 0.15, h: 0.1 }, kind: "closed", svg: '<polygon points="-30 -40 30 -40 60 0 30 40 -30 40 -60 0"/>', labelAt: "center", keywords: ["service", "api"] },
    { id: "api-gateway", label: { en: "API gateway", he: "\u05E9\u05E2\u05E8 API" }, size: { w: 0.17, h: 0.08 }, kind: "box", svg: '<rect x="-68" y="-32" width="{w}" height="{h}" rx="16"/><line x1="-46" y1="-24" x2="-46" y2="24"/>', labelAt: "center", keywords: ["gateway", "proxy", "edge"] },
    { id: "load-balancer", label: { en: "Load balancer", he: "\u05DE\u05D0\u05D6\u05DF \u05E2\u05D5\u05DE\u05E1\u05D9\u05DD" }, size: { w: 0.14, h: 0.1 }, kind: "closed", svg: '<polygon points="0 -40 56 0 0 40 -56 0"/><path d="M -22.4 0 L 22.4 0"/>', labelAt: "center", keywords: ["balancer", "traffic", "lb"] },
    { id: "cache", label: { en: "Cache", he: "\u05DE\u05D8\u05DE\u05D5\u05DF" }, size: { w: 0.07, h: 0.09 }, kind: "closed", svg: '<path d="M -28.000000000000004 -25.92 C -28.000000000000004 -31.49 -15.46 -36 0 -36 C 15.46 -36 28.000000000000004 -31.49 28.000000000000004 -25.92 L 28.000000000000004 25.92 C 28.000000000000004 31.49 15.46 36 0 36 C -15.46 36 -28.000000000000004 31.49 -28.000000000000004 25.92 Z"/><path d="M -28.000000000000004 -25.92 C -28.000000000000004 -20.35 -15.46 -15.84 0 -15.84 C 15.46 -15.84 28.000000000000004 -20.35 28.000000000000004 -25.92"/>', labelAt: "below", keywords: ["redis", "memory"] },
    { id: "message-queue", label: { en: "Message queue", he: "\u05EA\u05D5\u05E8 \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA" }, size: { w: 0.17, h: 0.07 }, kind: "box", svg: '<polygon points="-40.8 -28 68 -28 40.8 28 -68 28"/><path d="M -13.6 -28 L -27.2 28 M 13.6 -28 L 0 28"/>', labelAt: "center", keywords: ["kafka", "broker", "stream"] },
    { id: "storage-bucket", label: { en: "Storage bucket", he: "\u05D3\u05DC\u05D9 \u05D0\u05D7\u05E1\u05D5\u05DF" }, size: { w: 0.07, h: 0.09 }, kind: "closed", svg: '<path d="M -28.000000000000004 -25.92 C -28.000000000000004 -31.49 -15.46 -36 0 -36 C 15.46 -36 28.000000000000004 -31.49 28.000000000000004 -25.92 L 28.000000000000004 25.92 C 28.000000000000004 31.49 15.46 36 0 36 C -15.46 36 -28.000000000000004 31.49 -28.000000000000004 25.92 Z"/><path d="M -28.000000000000004 -25.92 C -28.000000000000004 -20.35 -15.46 -15.84 0 -15.84 C 15.46 -15.84 28.000000000000004 -20.35 28.000000000000004 -25.92"/>', labelAt: "below", keywords: ["s3", "object", "blob"] }
  ]
};

// src/core/visualBuilder/diagramPacks/uml.pack.json
var uml_pack_default = {
  format: 1,
  id: "uml",
  name: { en: "UML", he: "UML" },
  category: "uml",
  color: "purple",
  objects: [
    { id: "actor", label: { en: "Actor", he: "\u05E9\u05D7\u05E7\u05DF" }, size: { w: 0.05, h: 0.12 }, kind: "closed", svg: '<path d="M 8.8 -39.2 C 8.8 -34.34 4.86 -30.4 0 -30.4 C -4.86 -30.4 -8.8 -34.34 -8.8 -39.2 C -8.8 -44.06 -4.86 -48 0 -48 C 4.86 -48 8.8 -44.06 8.8 -39.2 M 0 -30.4 L 0 8.52 M -20 -16.44 L 20 -16.44 M 0 8.52 L -14 48 M 0 8.52 L 14 48"/>', view: { w: 40, h: 96 }, outline: { polygon: [[0.5, 0], [0.72, 0.092], [0.56, 0.2], [1, 0.329], [0.56, 0.36], [0.6, 0.6], [0.85, 1], [0.5, 0.7], [0.15, 1], [0.4, 0.6], [0, 0.329], [0.44, 0.36], [0.44, 0.2], [0.28, 0.092]] }, anchors: [{ id: "top", x: 0.5, y: 0, nx: 0, ny: -1 }, { id: "foot-left", x: 0.15, y: 1, nx: 0, ny: 1 }, { id: "foot-right", x: 0.85, y: 1, nx: 0, ny: 1 }, { id: "left", x: 0, y: 0.329, nx: -1, ny: 0 }, { id: "right", x: 1, y: 0.329, nx: 1, ny: 0 }], labelAt: "below", keywords: ["user", "person", "stick"] },
    { id: "class", label: { en: "Class", he: "\u05DE\u05D7\u05DC\u05E7\u05D4" }, size: { w: 0.2, h: 0.16 }, kind: "box", svg: '<rect x="-80" y="-64" width="{w}" height="{h}"/><line x1="-80" y1="-21.33" x2="80" y2="-21.33"/><line x1="-80" y1="21.33" x2="80" y2="21.33"/>', labelAt: "center", lines: 3, keywords: ["object", "attributes", "methods"] },
    { id: "fork-join", label: { en: "Fork / join", he: "\u05E4\u05D9\u05E6\u05D5\u05DC / \u05D0\u05D9\u05D7\u05D5\u05D3" }, size: { w: 0.12, h: 0.02 }, kind: "box", view: { w: 96, h: 16 }, outline: "rect", anchors: [{ id: "top", x: 0.5, y: 0, nx: 0, ny: -1 }, { id: "right", x: 1, y: 0.5, nx: 1, ny: 0 }, { id: "bottom", x: 0.5, y: 1, nx: 0, ny: 1 }, { id: "left", x: 0, y: 0.5, nx: -1, ny: 0 }], svg: '<rect x="-48" y="-8" width="{w}" height="{h}" fill="currentColor" stroke="none" data-role="solid"/>', labelAt: "none", keywords: ["bar", "synchronisation", "parallel"] },
    { id: "interface-lollipop", label: { en: "Interface", he: "\u05DE\u05DE\u05E9\u05E7" }, size: { w: 0.1, h: 0.05 }, kind: "closed", view: { w: 80, h: 40 }, outline: "rect", anchors: [{ id: "top", x: 0.75, y: 0, nx: 0, ny: -1 }, { id: "right", x: 1, y: 0.5, nx: 1, ny: 0 }, { id: "bottom", x: 0.75, y: 1, nx: 0, ny: 1 }, { id: "left", x: 0, y: 0.5, nx: -1, ny: 0 }], svg: '<path d="M -40 0 L 0 0 M 40 0 C 40 11.05 31.05 20 20 20 C 8.95 20 0 11.05 0 0 C 0 -11.05 8.95 -20 20 -20 C 31.05 -20 40 -11.05 40 0 Z"/>', labelAt: "below", keywords: ["lollipop", "provided", "contract"] },
    { id: "package", label: { en: "Package", he: "\u05D7\u05D1\u05D9\u05DC\u05D4" }, size: { w: 0.22, h: 0.16 }, kind: "box", view: { w: 176, h: 128 }, outline: { polygon: [[0, 0], [0.4, 0], [0.4, 0.16], [1, 0.16], [1, 1], [0, 1]] }, anchors: [{ id: "top", x: 0.7, y: 0.16, nx: 0, ny: -1 }, { id: "right", x: 1, y: 0.5, nx: 1, ny: 0 }, { id: "bottom", x: 0.5, y: 1, nx: 0, ny: 1 }, { id: "left", x: 0, y: 0.5, nx: -1, ny: 0 }], svg: '<polygon points="-88 -64 -17.6 -64 -17.6 -43.52 88 -43.52 88 64 -88 64"/><path d="M -88 -43.52 L -17.6 -43.52"/>', labelAt: "center", keywords: ["namespace", "module"] },
    { id: "lifeline", label: { en: "Lifeline", he: "\u05E7\u05D5 \u05D7\u05D9\u05D9\u05DD" }, size: { w: 0.12, h: 0.5 }, kind: "box", svg: '<rect x="-48" y="-200" width="{w}" height="{h}" fill="none" stroke="none"/><rect x="-48" y="-200" width="{w}" height="40"/><line x1="0" y1="-160" x2="0" y2="200" stroke-dasharray="6 6"/>', labelAt: "top", keywords: ["sequence", "participant"] },
    { id: "activation", label: { en: "Activation bar", he: "\u05E4\u05E1 \u05D4\u05E4\u05E2\u05DC\u05D4" }, size: { w: 0.02, h: 0.1 }, kind: "box", svg: '<rect x="-8" y="-40" width="{w}" height="{h}"/>', labelAt: "none", keywords: ["sequence", "execution"] },
    { id: "note-uml", label: { en: "UML note", he: "\u05D4\u05E2\u05E8\u05EA UML" }, size: { w: 0.15, h: 0.08 }, kind: "text", svg: '<polygon points="-60 -32 40 -32 60 -12 60 32 -60 32"/><path d="M 40 -32 L 40 -12 L 60 -12"/>', labelAt: "center", keywords: ["comment", "annotation"] }
  ]
};

// src/core/visualBuilder/diagramPacks/stylePackFormat.ts
var PACK_FORMAT_VERSION = 1;
var PACK_COLORS = ["blue", "purple", "orange", "green", "pink"];
var PACK_LABEL_SLOTS = ["center", "below", "top", "left", "right", "none"];
var PACK_SECOND_LABEL_SLOTS = ["below", "left"];
var PACK_EFFECT_TONES = ["fill", "flow", "zig", "look"];
var PACK_EASINGS = ["linear", "easeInQuad", "easeOutQuad", "easeInOutQuad", "easeInOutSine"];
var PACK_ANIME_RANGES = {
  translateX: [-400, 400],
  translateY: [-400, 400],
  rotate: [-360, 360],
  scale: [0, 4],
  opacity: [0, 1]
};
var PACK_LIMITS = {
  idChars: { min: 2, max: 40 },
  labelChars: 40,
  iconChars: 40,
  objects: { min: 1, max: 64 },
  effects: { min: 0, max: 16 },
  objectSize: [0.02, 0.95],
  lines: [1, 4],
  strokeWidth: [0, 8],
  labelPrefixChars: 8,
  listItems: 8,
  keywordChars: 40,
  duration: [100, 5e3],
  animeValues: { min: 2, max: 5 },
  outlinePoints: { min: 3, max: 32 },
  anchors: { min: 0, max: 8 },
  viewUnits: [1, 1e3],
  svgChars: 2e3,
  svgPrimitives: 12,
  svgDepth: 2,
  pathChars: 600,
  templates: { min: 0, max: 16 },
  templateObjects: { min: 1, max: 24 },
  templateLinks: { min: 0, max: 32 },
  templateSteps: { min: 1, max: 8 },
  templateEffects: { min: 0, max: 8 },
  templateKeyChars: { min: 1, max: 24 }
};
var PACK_TEMPLATE_COLORS = ["blue", "purple", "cyan", "green", "yellow", "orange", "pink", "red"];
var PACK_TEMPLATE_LINK_ROUTES = ["straight", "elbow", "curve", "loop"];
var PACK_TEMPLATE_LINK_SIDES = ["n", "e", "s", "w"];
var PACK_TEMPLATE_CORE_EFFECTS = [
  "fill",
  "reveal",
  "remove",
  "draw",
  "travel",
  "flow",
  "spark",
  "frame",
  "pulse",
  "glow",
  "sweep",
  "callout",
  "fade",
  "tint",
  "outline",
  "soften",
  "move",
  "grow",
  "bounce",
  "typeIn"
];
var PACK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var PACK_STROKE_SCALINGS = ["fixed", "scaled"];
var PACK_DASHES = ["none", "dashed", "dotted"];
var PACK_STYLE_PAINTS = [...PACK_COLORS, "none"];

// src/core/visualBuilder/diagramPacks/validatePackPrimitives.ts
var packIssue = (path5, code, message) => ({ path: path5, code, message });
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function checkUnknownFields(value, allowed, path5) {
  return Object.keys(value).filter((key) => !allowed.includes(key)).map((key) => packIssue(`${path5}.${key}`, "unknown-field", `${key} is not a pack field`));
}
function checkId(value, path5) {
  const { min, max } = PACK_LIMITS.idChars;
  const valid = typeof value === "string" && value.length >= min && value.length <= max && PACK_ID_PATTERN.test(value);
  return valid ? [] : [packIssue(path5, "bad-id", `id must be kebab-case, ${min} to ${max} characters`)];
}
var hasControlCharacter = (text) => [...text].some((char) => {
  const code = char.charCodeAt(0);
  return code < 32 || code === 127;
});
function checkLabelText(value, path5, maxChars = PACK_LIMITS.labelChars) {
  const valid = typeof value === "string" && value.length >= 1 && value.length <= maxChars && !/[<>]/.test(value) && !hasControlCharacter(value);
  return valid ? [] : [packIssue(path5, "bad-label", `text must be 1 to ${maxChars} characters with no angle brackets or control characters`)];
}
function checkLocalizedLabel(value, path5) {
  if (!isRecord(value)) return [packIssue(path5, "bad-label", "label must be an object with an en text")];
  const languages = Object.keys(value).filter((key) => LANGUAGE_CODE_PATTERN.test(key));
  const translationIssues = languages.filter((code) => code !== FALLBACK_LANGUAGE && value[code] !== void 0).flatMap((code) => checkLabelText(value[code], `${path5}.${code}`));
  return [
    ...checkUnknownFields(value, languages, path5),
    ...checkLabelText(value[FALLBACK_LANGUAGE], `${path5}.${FALLBACK_LANGUAGE}`),
    ...translationIssues
  ];
}
function checkNumberIn(value, range, path5, code) {
  const valid = typeof value === "number" && Number.isFinite(value) && value >= range[0] && value <= range[1];
  return valid ? [] : [packIssue(path5, code, `must be a number from ${range[0]} to ${range[1]}`)];
}
function checkEnum(value, allowed, path5, code) {
  const valid = typeof value === "string" && allowed.includes(value);
  return valid ? [] : [packIssue(path5, code, `must be one of ${allowed.join(", ")}`)];
}
function checkArray(value, bounds, path5, code, checkItem) {
  if (!Array.isArray(value) || value.length < bounds[0] || value.length > bounds[1]) {
    return [packIssue(path5, code, `must be a list of ${bounds[0]} to ${bounds[1]} items`)];
  }
  return value.flatMap((item, index) => checkItem(item, `${path5}[${index}]`));
}

// src/core/visualBuilder/objectKinds.ts
var OBJECT_KINDS = ["arrow", "closed", "box", "text", "path"];

// src/core/visualBuilder/diagramPacks/validatePackGeometry.ts
var UNIT_RANGE = [0, 1];
var SIGNED_UNIT_RANGE = [-1, 1];
function checkView(value, path5) {
  if (!isRecord(value)) return [packIssue(path5, "bad-size", "view must be an object with w and h")];
  const range = PACK_LIMITS.viewUnits;
  return [
    ...checkUnknownFields(value, ["w", "h"], path5),
    ...checkNumberIn(value.w, range, `${path5}.w`, "bad-size"),
    ...checkNumberIn(value.h, range, `${path5}.h`, "bad-size")
  ];
}
function checkStrokeScaling(value, path5) {
  return checkEnum(value, PACK_STROKE_SCALINGS, path5, "bad-enum");
}
function checkOutline(value, path5) {
  if (value === "rect" || value === "ellipse") return [];
  if (!isRecord(value) || !Array.isArray(value.polygon)) {
    return [packIssue(path5, "bad-shape", "outline is rect, ellipse or an object with a polygon")];
  }
  const { min, max } = PACK_LIMITS.outlinePoints;
  return [
    ...checkUnknownFields(value, ["polygon"], path5),
    ...checkArray(value.polygon, [min, max], `${path5}.polygon`, "too-many", (point, pointPath) => checkPoint(point, pointPath, UNIT_RANGE))
  ];
}
function checkAnchors(value, path5) {
  const { min, max } = PACK_LIMITS.anchors;
  return checkArray(value, [min, max], path5, "too-many", checkAnchor);
}
function checkAnchor(value, path5) {
  if (!isRecord(value)) return [packIssue(path5, "bad-value", "anchor must be an object")];
  return [
    ...checkUnknownFields(value, ["id", "x", "y", "nx", "ny"], path5),
    ...checkId(value.id, `${path5}.id`),
    ...checkNumberIn(value.x, UNIT_RANGE, `${path5}.x`, "bad-value"),
    ...checkNumberIn(value.y, UNIT_RANGE, `${path5}.y`, "bad-value"),
    ...checkNumberIn(value.nx, SIGNED_UNIT_RANGE, `${path5}.nx`, "bad-value"),
    ...checkNumberIn(value.ny, SIGNED_UNIT_RANGE, `${path5}.ny`, "bad-value")
  ];
}
function checkPoint(value, path5, range) {
  if (!Array.isArray(value) || value.length !== 2) return [packIssue(path5, "bad-value", "point must be [x, y]")];
  return [
    ...checkNumberIn(value[0], range, `${path5}[0]`, "bad-value"),
    ...checkNumberIn(value[1], range, `${path5}[1]`, "bad-value")
  ];
}

// src/core/visualBuilder/diagramPacks/parseSvgTemplate.ts
var TAG_PATTERN = /^<(\/?)([A-Za-z][\w-]*)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>/;
var ATTR_PATTERN = /([\w:.-]+)="([^"]*)"/g;
function parseSvgTemplate(svg) {
  const root = { tag: "", attrs: [], children: [] };
  const open = [root];
  let cursor = 0;
  while (cursor < svg.length) {
    const next = svg.indexOf("<", cursor);
    const textEnd = next === -1 ? svg.length : next;
    if (svg.slice(cursor, textEnd).trim() !== "") return { ok: false, error: "text is not allowed outside elements" };
    if (next === -1) break;
    const match = TAG_PATTERN.exec(svg.slice(next));
    if (!match) return { ok: false, error: `malformed tag at offset ${next}` };
    const error = applyTag(match, open);
    if (error) return { ok: false, error };
    cursor = next + match[0].length;
  }
  if (open.length !== 1) return { ok: false, error: "an element is not closed" };
  if (root.children.length === 0) return { ok: false, error: "svg is empty" };
  return { ok: true, nodes: root.children };
}
function applyTag(match, open) {
  const [, closing = "", tag = "", attrText = "", selfClosing = ""] = match;
  const top = open[open.length - 1];
  if (closing) {
    if (open.length < 2 || top.tag !== tag) return `unexpected closing tag </${tag}>`;
    open.pop();
    return null;
  }
  const node = {
    tag,
    attrs: [...attrText.matchAll(ATTR_PATTERN)].map((attr) => [attr[1] ?? "", attr[2] ?? ""]),
    children: []
  };
  top.children.push(node);
  if (!selfClosing) open.push(node);
  return null;
}

// src/core/visualBuilder/diagramPacks/validatePackSvg.ts
var SVG_TAGS = /* @__PURE__ */ new Set(["rect", "circle", "ellipse", "path", "polygon", "polyline", "line", "g"]);
var SVG_TOKENS = /* @__PURE__ */ new Set(["w", "h", "hw", "hh", "y3a", "y3b", "x4b", "inner"]);
var FORBIDDEN_PATTERNS = [
  { pattern: /<\s*\/?\s*(script|foreignObject|image|use|style)\b/i, message: "script, foreignObject, image, use and style are not allowed" },
  { pattern: /<\s*[!?]/, message: "comments, doctype and processing instructions are not allowed" },
  { pattern: /\son[a-z]+\s*=/i, message: "event handler attributes are not allowed" },
  { pattern: /\sstyle\s*=/i, message: "style attributes are not allowed" },
  { pattern: /\b(?:xlink:)?href\s*=\s*"(?!#)/i, message: "external references are not allowed" },
  { pattern: /url\s*\(/i, message: "url() is not allowed" },
  { pattern: /javascript:|data:/i, message: "javascript: and data: URLs are not allowed" },
  { pattern: /&/, message: "entities are not allowed" }
];
var NUMBER_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?$/i;
var TOKEN_PATTERN = /^\{(\w+)\}$/;
var POINTS_PATTERN = /^\s*-?[\d.]+(?:[\s,]+-?[\d.]+)*\s*$/;
var DASH_PATTERN = /^\s*\d+(?:[\s,]+\d+)*\s*$/;
var PATH_CHARS_PATTERN = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.e-]+$/;
var TRANSFORM_CALL = /(translate|scale|rotate)\(\s*(-?[\d.]+(?:[\s,]+-?[\d.]+){0,2})\s*\)/g;
var THEME_COLOUR_PATTERN = /^var\(--[a-z][a-z0-9-]*\)$/;
var passIf = (valid, code) => valid ? null : code;
function numericCheck(value) {
  const token = TOKEN_PATTERN.exec(value);
  if (token) return passIf(SVG_TOKENS.has(token[1] ?? ""), "svg-token");
  return passIf(NUMBER_PATTERN.test(value), "svg-attr");
}
function transformCheck(value) {
  const calls = value.match(TRANSFORM_CALL) ?? [];
  const leftover = value.replace(TRANSFORM_CALL, "").replace(/[\s,]/g, "");
  return passIf(calls.length > 0 && leftover === "", "svg-attr");
}
function pathCheck(value) {
  const valid = value.trim() !== "" && value.length <= PACK_LIMITS.pathChars && PATH_CHARS_PATTERN.test(value);
  return passIf(valid, "svg-path");
}
function colourCheck(value) {
  return passIf(value === "none" || value === "currentColor" || THEME_COLOUR_PATTERN.test(value), "svg-colour");
}
var ATTR_CHECKS = new Map([
  ...["x", "y", "cx", "cy", "r", "rx", "ry", "width", "height", "x1", "y1", "x2", "y2", "stroke-width"].map((name) => [name, numericCheck]),
  ["points", (value) => passIf(POINTS_PATTERN.test(value), "svg-attr")],
  ["stroke-dasharray", (value) => passIf(DASH_PATTERN.test(value), "svg-attr")],
  ["transform", transformCheck],
  ["d", pathCheck],
  ["fill", colourCheck],
  ["stroke", colourCheck],
  ["data-role", (value) => passIf(["line", "solid", "none"].includes(value), "svg-attr")]
]);
function validatePackSvg(svg, path5) {
  if (svg.length > PACK_LIMITS.svgChars) return [packIssue(path5, "svg-too-big", `svg is longer than ${PACK_LIMITS.svgChars} characters`)];
  const forbidden = FORBIDDEN_PATTERNS.find(({ pattern }) => pattern.test(svg));
  if (forbidden) return [packIssue(path5, "svg-forbidden", forbidden.message)];
  const parsed = parseSvgTemplate(svg);
  if (!parsed.ok) return [packIssue(path5, "svg-syntax", parsed.error)];
  return [...limitIssues(parsed.nodes, path5), ...parsed.nodes.flatMap((node) => nodeIssues(node, path5))];
}
function nodeIssues(node, path5) {
  const tagIssue = SVG_TAGS.has(node.tag) ? [] : [packIssue(path5, "svg-tag", `<${node.tag}> is not allowed`)];
  const attrIssues = node.attrs.flatMap(([name, value]) => attrIssue(name, value, path5));
  return [...tagIssue, ...attrIssues, ...node.children.flatMap((child) => nodeIssues(child, path5))];
}
function attrIssue(name, value, path5) {
  const check = ATTR_CHECKS.get(name);
  if (!check) return [packIssue(path5, "svg-attr", `attribute ${name} is not allowed`)];
  const code = check(value);
  return code ? [packIssue(path5, code, `${name} value is not allowed`)] : [];
}
function limitIssues(nodes, path5) {
  const tooMany = countPrimitives(nodes) > PACK_LIMITS.svgPrimitives;
  const tooDeep = maxDepth(nodes, 1) > PACK_LIMITS.svgDepth;
  return tooMany || tooDeep ? [packIssue(path5, "svg-too-big", "svg has too many elements or nests too deep")] : [];
}
function countPrimitives(nodes) {
  return nodes.reduce((sum, node) => sum + 1 + countPrimitives(node.children), 0);
}
function maxDepth(nodes, depth) {
  return nodes.reduce((deepest, node) => Math.max(deepest, depth, maxDepth(node.children, depth + 1)), 0);
}

// src/core/visualBuilder/diagramPacks/validatePackObjects.ts
var PRESET_SHAPES = SHAPE_PRESETS.map((preset) => preset.shape);
var OBJECT_FIELDS = ["id", "label", "category", "size", "kind", "color", "svg", "preset", "view", "strokeScaling", "outline", "anchors", "labelAt", "label2At", "lines", "labelPrefix", "aliases", "defaultStyle", "endLabels", "keywords"];
var REQUIRED_FIELDS = ["id", "label", "size", "kind"];
var HEIGHTLESS_KINDS = ["path", "arrow"];
var FIELD_CHECKS = /* @__PURE__ */ new Map([
  ["id", (value, path5) => checkId(value, path5)],
  ["label", (value, path5) => checkLocalizedLabel(value, path5)],
  ["category", (value, path5) => checkId(value, path5)],
  ["kind", (value, path5) => checkEnum(value, OBJECT_KINDS, path5, "bad-enum")],
  ["color", (value, path5) => checkEnum(value, PACK_COLORS, path5, "bad-enum")],
  ["svg", (value, path5) => typeof value === "string" ? validatePackSvg(value, path5) : [packIssue(path5, "svg-syntax", "svg must be a string")]],
  ["preset", (value, path5) => checkEnum(value, PRESET_SHAPES, path5, "bad-enum")],
  ["view", (value, path5) => checkView(value, path5)],
  ["strokeScaling", (value, path5) => checkStrokeScaling(value, path5)],
  ["outline", (value, path5) => checkOutline(value, path5)],
  ["anchors", (value, path5) => checkAnchors(value, path5)],
  ["labelAt", (value, path5) => checkEnum(value, PACK_LABEL_SLOTS, path5, "bad-enum")],
  ["label2At", (value, path5) => checkEnum(value, PACK_SECOND_LABEL_SLOTS, path5, "bad-enum")],
  ["lines", (value, path5) => Number.isInteger(value) ? checkNumberIn(value, PACK_LIMITS.lines, path5, "bad-value") : [packIssue(path5, "bad-value", "lines must be a whole number")]],
  ["labelPrefix", (value, path5) => checkLabelText(value, path5, PACK_LIMITS.labelPrefixChars)],
  ["aliases", (value, path5) => checkArray(value, [0, PACK_LIMITS.listItems], path5, "bad-value", (item, itemPath) => checkId(item, itemPath))],
  ["defaultStyle", (value, path5) => objectStyleIssues(value, path5)],
  ["endLabels", (value, path5) => typeof value === "boolean" ? [] : [packIssue(path5, "bad-value", "endLabels must be true or false")]],
  ["keywords", (value, path5) => checkArray(value, [0, PACK_LIMITS.listItems], path5, "bad-value", (item, itemPath) => checkLabelText(item, itemPath, PACK_LIMITS.keywordChars))]
]);
function validatePackObjects(value, path5) {
  const { min, max } = PACK_LIMITS.objects;
  return checkArray(value, [min, max], path5, "too-many", validatePackObject);
}
function validatePackObject(value, path5) {
  if (!isRecord(value)) return [packIssue(path5, "bad-value", "object must be an object")];
  return [
    ...checkUnknownFields(value, OBJECT_FIELDS, path5),
    ...requiredIssues(value, path5),
    ...presentFieldIssues(value, path5),
    ...sizeIssues(value.size, value.kind, `${path5}.size`),
    ...shapeSourceIssues(value, path5),
    ...endLabelIssues(value, path5)
  ];
}
function requiredIssues(value, path5) {
  return REQUIRED_FIELDS.filter((field) => value[field] === void 0).map((field) => packIssue(`${path5}.${field}`, "bad-value", `${field} is required`));
}
function presentFieldIssues(value, path5) {
  return Object.entries(value).flatMap(([key, field]) => FIELD_CHECKS.get(key)?.(field, `${path5}.${key}`) ?? []);
}
function sizeIssues(size, kind, path5) {
  if (!isRecord(size)) return [packIssue(path5, "bad-size", "size must be an object with w and h")];
  const [min, max] = PACK_LIMITS.objectSize;
  const range = [min, max];
  const heightless = size.h === 0 && typeof kind === "string" && HEIGHTLESS_KINDS.includes(kind);
  return [
    ...checkUnknownFields(size, ["w", "h"], path5),
    ...checkNumberIn(size.w, range, `${path5}.w`, "bad-size"),
    ...heightless ? [] : checkNumberIn(size.h, range, `${path5}.h`, "bad-size")
  ];
}
function shapeSourceIssues(value, path5) {
  const hasSvg = value.svg !== void 0;
  const hasPreset = value.preset !== void 0;
  return hasSvg === hasPreset ? [packIssue(path5, "bad-shape", "an object has exactly one of svg or preset")] : [];
}
function endLabelIssues(value, path5) {
  return value.endLabels === true && value.kind !== "arrow" ? [packIssue(`${path5}.endLabels`, "bad-value", "endLabels is only for arrow objects")] : [];
}
var STYLE_FIELD_CHECKS = {
  fill: (value, path5) => checkEnum(value, PACK_STYLE_PAINTS, path5, "bad-enum"),
  stroke: (value, path5) => checkEnum(value, PACK_STYLE_PAINTS, path5, "bad-enum"),
  strokeWidth: (value, path5) => checkNumberIn(value, PACK_LIMITS.strokeWidth, path5, "bad-value"),
  dash: (value, path5) => checkEnum(value, PACK_DASHES, path5, "bad-enum")
};
function objectStyleIssues(value, path5) {
  if (!isRecord(value)) return [packIssue(path5, "bad-value", "defaultStyle must be an object")];
  const fieldIssues = Object.entries(value).flatMap(([key, field]) => STYLE_FIELD_CHECKS[key]?.(field, `${path5}.${key}`) ?? []);
  return [...checkUnknownFields(value, Object.keys(STYLE_FIELD_CHECKS), path5), ...fieldIssues];
}

// src/core/visualBuilder/diagramPacks/validatePackEffects.ts
var EFFECT_FIELDS = ["id", "label", "description", "kinds", "duration", "icon", "tone", "anime"];
var ANIME_FIELDS = [...Object.keys(PACK_ANIME_RANGES), "easing"];
function validatePackEffects(value, path5) {
  const { min, max } = PACK_LIMITS.effects;
  return checkArray(value, [min, max], path5, "too-many", validatePackEffect);
}
function validatePackEffect(value, path5) {
  if (!isRecord(value)) return [packIssue(path5, "bad-effect", "effect must be an object")];
  return [
    ...checkUnknownFields(value, EFFECT_FIELDS, path5),
    ...checkId(value.id, `${path5}.id`),
    ...checkLocalizedLabel(value.label, `${path5}.label`),
    ...checkLocalizedLabel(value.description, `${path5}.description`),
    ...kindIssues(value.kinds, `${path5}.kinds`),
    ...checkNumberIn(value.duration, PACK_LIMITS.duration, `${path5}.duration`, "bad-effect"),
    ...checkLabelText(value.icon, `${path5}.icon`, PACK_LIMITS.iconChars),
    ...checkEnum(value.tone, PACK_EFFECT_TONES, `${path5}.tone`, "bad-enum"),
    ...validatePackAnime(value.anime, `${path5}.anime`)
  ];
}
function kindIssues(value, path5) {
  return checkArray(value, [1, OBJECT_KINDS.length], path5, "bad-effect", (item, itemPath) => checkEnum(item, OBJECT_KINDS, itemPath, "bad-enum"));
}
function validatePackAnime(value, path5) {
  if (!isRecord(value)) return [packIssue(path5, "bad-effect", "anime must be an object")];
  const { min, max } = PACK_LIMITS.animeValues;
  const easingIssues = value.easing === void 0 ? [] : checkEnum(value.easing, PACK_EASINGS, `${path5}.easing`, "bad-enum");
  const propertyIssues = Object.entries(PACK_ANIME_RANGES).flatMap(
    ([prop, range]) => value[prop] === void 0 ? [] : checkArray(value[prop], [min, max], `${path5}.${prop}`, "bad-effect", (item, itemPath) => checkNumberIn(item, range, itemPath, "bad-effect"))
  );
  return [...checkUnknownFields(value, ANIME_FIELDS, path5), ...easingIssues, ...propertyIssues];
}

// src/core/visualBuilder/diagramPacks/categories/automata-graph.category.json
var automata_graph_category_default = {
  format: 1,
  id: "automata-graph",
  label: { en: "Automata and graphs", he: "\u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05DD \u05D5\u05D2\u05E8\u05E4\u05D9\u05DD" },
  icon: '<g fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/></g>',
  order: 60,
  description: { en: "States, transitions and graph nodes", he: "\u05DE\u05E6\u05D1\u05D9\u05DD, \u05DE\u05E2\u05D1\u05E8\u05D9\u05DD \u05D5\u05E6\u05DE\u05EA\u05D9 \u05D2\u05E8\u05E3" }
};

// src/core/visualBuilder/diagramPacks/categories/data.category.json
var data_category_default = {
  format: 1,
  id: "data",
  label: { en: "Data structures", he: "\u05DE\u05D1\u05E0\u05D9 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD" },
  icon: '<g fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="9" width="5" height="6"/><rect x="9.5" y="9" width="5" height="6"/><rect x="17" y="9" width="5" height="6"/></g>',
  order: 70,
  description: { en: "Arrays, lists, trees and heaps", he: "\u05DE\u05E2\u05E8\u05DB\u05D9\u05DD, \u05E8\u05E9\u05D9\u05DE\u05D5\u05EA, \u05E2\u05E6\u05D9\u05DD \u05D5\u05E2\u05E8\u05D9\u05DE\u05D5\u05EA" }
};

// src/core/visualBuilder/diagramPacks/categories/flowchart.category.json
var flowchart_category_default = {
  format: 1,
  id: "flowchart",
  label: { en: "Flowchart", he: "\u05EA\u05E8\u05E9\u05D9\u05DD \u05D6\u05E8\u05D9\u05DE\u05D4" },
  icon: '<g fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="10" rx="5"/></g>',
  order: 80,
  description: { en: "Input and output shapes", he: "\u05E6\u05D5\u05E8\u05D5\u05EA \u05E7\u05DC\u05D8 \u05D5\u05E4\u05DC\u05D8" }
};

// src/core/visualBuilder/diagramPacks/categories/network.category.json
var network_category_default = {
  format: 1,
  id: "network",
  label: { en: "Network", he: "\u05E8\u05E9\u05EA" },
  icon: '<g fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><line x1="12" y1="8" x2="6" y2="16"/><line x1="12" y1="8" x2="18" y2="16"/></g>',
  order: 40,
  description: { en: "Routers, hosts and links", he: "\u05E0\u05EA\u05D1\u05D9\u05DD, \u05DE\u05D7\u05E9\u05D1\u05D9\u05DD \u05D5\u05E7\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD" }
};

// src/core/visualBuilder/diagramPacks/categories/sets.category.json
var sets_category_default = {
  format: 1,
  id: "sets",
  label: { en: "Sets and Venn", he: "\u05E7\u05D1\u05D5\u05E6\u05D5\u05EA \u05D5-\u05D5\u05DF" },
  icon: '<g fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></g>',
  order: 30,
  description: { en: "Venn, universe, elements", he: "\u05D5\u05DF, \u05DE\u05E8\u05D7\u05D1 \u05D5\u05D0\u05D9\u05D1\u05E8\u05D9\u05DD" }
};

// src/core/visualBuilder/diagramPacks/categories/shapes.category.json
var shapes_category_default = {
  format: 1,
  id: "shapes",
  label: { en: "Shapes", he: "\u05E6\u05D5\u05E8\u05D5\u05EA" },
  icon: '<g fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="10" height="10"/><circle cx="16" cy="16" r="5"/></g>',
  order: 10,
  description: { en: "Basic shapes and arrows", he: "\u05E6\u05D5\u05E8\u05D5\u05EA \u05D1\u05E1\u05D9\u05E1\u05D9\u05D5\u05EA \u05D5\u05D7\u05E6\u05D9\u05DD" }
};

// src/core/visualBuilder/diagramPacks/categories/system.category.json
var system_category_default = {
  format: 1,
  id: "system",
  label: { en: "System design", he: "\u05EA\u05DB\u05E0\u05D5\u05DF \u05DE\u05E2\u05E8\u05DB\u05D5\u05EA" },
  icon: '<g fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5"/></g>',
  order: 50,
  description: { en: "Servers, queues and caches", he: "\u05E9\u05E8\u05EA\u05D9\u05DD, \u05EA\u05D5\u05E8\u05D9\u05DD \u05D5\u05DE\u05D8\u05DE\u05D5\u05E0\u05D9\u05DD" }
};

// src/core/visualBuilder/diagramPacks/categories/uml.category.json
var uml_category_default = {
  format: 1,
  id: "uml",
  label: { en: "UML", he: "\u05EA\u05E8\u05E9\u05D9\u05DE\u05D9 UML" },
  icon: '<g fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="3" width="16" height="18"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/></g>',
  order: 20,
  description: { en: "Class, interface and package boxes", he: "\u05DE\u05D7\u05DC\u05E7\u05D5\u05EA, \u05DE\u05DE\u05E9\u05E7\u05D9\u05DD \u05D5\u05D7\u05D1\u05D9\u05DC\u05D5\u05EA" }
};

// src/core/visualBuilder/diagramPacks/packCategoryFormat.ts
var PACK_CATEGORY_FORMAT_VERSION = 1;
var PACK_CATEGORY_ID_MAX_CHARS = 24;
var PACK_CATEGORY_ORDER_MAX = 999;
var PACK_CATEGORY_FIELDS = ["format", "id", "label", "icon", "order", "description"];

// src/core/visualBuilder/diagramPacks/validatePackCategory.ts
function validatePackCategory(raw) {
  try {
    const issues = collectIssues(raw);
    if (issues.length === 0) return { ok: true, category: raw };
    return { ok: false, errors: issues };
  } catch {
    return { ok: false, errors: [packIssue("category", "bad-value", "category could not be read")] };
  }
}
function collectIssues(raw) {
  if (!isRecord(raw)) return [packIssue("category", "bad-value", "category must be an object")];
  return [
    ...checkUnknownFields(raw, PACK_CATEGORY_FIELDS, "category"),
    ...formatIssues(raw.format),
    ...idIssues(raw.id),
    ...checkLocalizedLabel(raw.label, "category.label"),
    ...orderIssues(raw.order),
    ...iconIssues(raw.icon),
    ...descriptionIssues(raw.description)
  ];
}
function formatIssues(format) {
  return format === PACK_CATEGORY_FORMAT_VERSION ? [] : [packIssue("category.format", "bad-value", `format must be ${PACK_CATEGORY_FORMAT_VERSION}`)];
}
function idIssues(id) {
  const { min } = PACK_LIMITS.idChars;
  const valid = typeof id === "string" && id.length >= min && id.length <= PACK_CATEGORY_ID_MAX_CHARS && PACK_ID_PATTERN.test(id);
  return valid ? [] : [packIssue("category.id", "bad-id", `id must be kebab-case, ${min} to ${PACK_CATEGORY_ID_MAX_CHARS} characters`)];
}
function orderIssues(order) {
  const valid = typeof order === "number" && Number.isInteger(order) && order >= 0 && order <= PACK_CATEGORY_ORDER_MAX;
  return valid ? [] : [packIssue("category.order", "bad-value", `order must be a whole number from 0 to ${PACK_CATEGORY_ORDER_MAX}`)];
}
function iconIssues(icon) {
  if (typeof icon !== "string" || icon.trim() === "") return [packIssue("category.icon", "bad-value", "icon must be an svg template")];
  return validatePackSvg(icon, "category.icon");
}
function descriptionIssues(description) {
  return description === void 0 ? [] : checkLocalizedLabel(description, "category.description");
}

// src/core/visualBuilder/diagramPacks/categoryRegistry.ts
var BUILT_IN_CATEGORY_SOURCES = [
  { file: "shapes.category.json", raw: shapes_category_default },
  { file: "uml.category.json", raw: uml_category_default },
  { file: "sets.category.json", raw: sets_category_default },
  { file: "network.category.json", raw: network_category_default },
  { file: "system.category.json", raw: system_category_default },
  { file: "automata-graph.category.json", raw: automata_graph_category_default },
  { file: "data.category.json", raw: data_category_default },
  { file: "flowchart.category.json", raw: flowchart_category_default }
];
var CategoryRegistryError = class extends Error {
  issues;
  constructor(issues) {
    super(formatLoadIssues(issues));
    this.name = "CategoryRegistryError";
    this.issues = issues;
  }
};
function createCategoryRegistry(sources) {
  const categories = loadCategories(sources);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  return {
    listCategories: () => categories,
    categoryById: (categoryId) => categoriesById.get(categoryId)
  };
}
function loadCategories(sources) {
  const issues = [];
  const declaringFileById = /* @__PURE__ */ new Map();
  const declaringFileByOrder = /* @__PURE__ */ new Map();
  const categories = [];
  for (const { file, raw } of sources) {
    const result = validatePackCategory(raw);
    if (!result.ok) {
      issues.push(...result.errors.map((error) => ({ ...error, file })));
      continue;
    }
    const { category } = result;
    const takenId = declaringFileById.get(category.id);
    if (takenId !== void 0) {
      issues.push({ file, path: "category.id", code: "duplicate-id", message: `${category.id} is already declared by ${takenId}` });
      continue;
    }
    const takenOrder = declaringFileByOrder.get(category.order);
    if (takenOrder !== void 0) {
      issues.push({ file, path: "category.order", code: "bad-value", message: `order ${category.order} is already used by ${takenOrder}` });
      continue;
    }
    declaringFileById.set(category.id, file);
    declaringFileByOrder.set(category.order, file);
    categories.push(category);
  }
  if (issues.length > 0) throw new CategoryRegistryError(issues);
  return [...categories].sort((a, b) => a.order - b.order);
}
function formatLoadIssues(issues) {
  const lines = issues.map((issue) => `  ${issue.file} ${issue.path}: ${issue.message}`);
  return [`Invalid pack categor${issues.length === 1 ? "y" : "ies"} (${issues.length}):`, ...lines].join("\n");
}
var builtInRegistry = createCategoryRegistry(BUILT_IN_CATEGORY_SOURCES);
var listCategories = builtInRegistry.listCategories;
var categoryById = builtInRegistry.categoryById;

// src/core/visualBuilder/diagramPacks/validatePackTemplates.ts
var TEMPLATE_FIELDS = ["id", "name", "category", "description", "objects", "links", "steps"];
var OBJECT_FIELDS2 = ["key", "ref", "at", "label", "color", "width"];
var LINK_FIELDS = ["from", "to", "label", "route", "fromPort", "toPort", "arrow"];
var STEP_FIELDS = ["caption", "show", "effects"];
var EFFECT_FIELDS2 = ["effect", "target"];
var FRACTION = [0, 1];
function templateContextOf(pack) {
  const idsOf = (list) => Array.isArray(list) ? list.flatMap((item) => isRecord(item) && typeof item.id === "string" ? [item.id] : []) : [];
  const packId = typeof pack.id === "string" ? pack.id : "";
  return {
    packId,
    objectIds: new Set(idsOf(pack.objects)),
    effectIds: /* @__PURE__ */ new Set([...PACK_TEMPLATE_CORE_EFFECTS, ...idsOf(pack.effects).map((id) => `${packId}/${id}`)])
  };
}
function validatePackTemplates(value, path5, context) {
  const items = listIssues(value, PACK_LIMITS.templates, path5, (item, itemPath) => validateTemplate(item, itemPath, context));
  return [...items, ...duplicateSlots(templateIdSlots(value, path5), "template of this pack")];
}
var listIssues = (value, limit, path5, check) => checkArray(value, [limit.min, limit.max], path5, "too-many", check);
function validateTemplate(value, path5, context) {
  if (!isRecord(value)) return [packIssue(path5, "bad-value", "template must be an object")];
  const keys = { objects: stringSet(value.objects, "key"), links: linkTargets(value.links) };
  return [
    ...checkUnknownFields(value, TEMPLATE_FIELDS, path5),
    ...checkId(value.id, `${path5}.id`),
    ...checkLocalizedLabel(value.name, `${path5}.name`),
    ...checkLocalizedLabel(value.description, `${path5}.description`),
    ...categoryIssues(value.category, `${path5}.category`),
    ...listIssues(value.objects, PACK_LIMITS.templateObjects, `${path5}.objects`, (item, p) => objectIssues(item, p, context)),
    ...listIssues(value.links, PACK_LIMITS.templateLinks, `${path5}.links`, (item, p) => linkIssues(item, p, keys.objects)),
    ...listIssues(value.steps, PACK_LIMITS.templateSteps, `${path5}.steps`, (item, p) => stepIssues(item, p, keys, context)),
    ...duplicateSlots(keySlots(value.objects, `${path5}.objects`), "object key"),
    ...showCoverageIssues(value.steps, keys.objects, `${path5}.steps`)
  ];
}
function stringSet(list, field) {
  const items = Array.isArray(list) ? list : [];
  return new Set(items.flatMap((item) => isRecord(item) && typeof item[field] === "string" ? [item[field]] : []));
}
function linkTargets(links) {
  const items = Array.isArray(links) ? links : [];
  return new Set(items.flatMap((item) => isRecord(item) && typeof item.from === "string" && typeof item.to === "string" ? [`${item.from}->${item.to}`] : []));
}
function categoryIssues(value, path5) {
  const idIssues2 = checkId(value, path5);
  if (idIssues2.length > 0) return idIssues2;
  return categoryById(value) ? [] : [packIssue(path5, "bad-value", `category ${String(value)} does not exist`)];
}
function checkKey(value, path5) {
  const { min, max } = PACK_LIMITS.templateKeyChars;
  const valid = typeof value === "string" && value.length >= min && value.length <= max && PACK_ID_PATTERN.test(value);
  return valid ? [] : [packIssue(path5, "bad-id", `key must be kebab-case, ${min} to ${max} characters`)];
}
function objectIssues(value, path5, context) {
  if (!isRecord(value)) return [packIssue(path5, "bad-value", "template object must be an object")];
  return [
    ...checkUnknownFields(value, OBJECT_FIELDS2, path5),
    ...checkKey(value.key, `${path5}.key`),
    ...refIssues(value.ref, `${path5}.ref`, context),
    ...atIssues(value.at, `${path5}.at`),
    ...value.label === void 0 ? [] : checkLocalizedLabel(value.label, `${path5}.label`),
    ...value.color === void 0 ? [] : checkEnum(value.color, PACK_TEMPLATE_COLORS, `${path5}.color`, "bad-enum"),
    ...value.width === void 0 ? [] : checkNumberIn(value.width, [0.02, 0.5], `${path5}.width`, "bad-size")
  ];
}
function refIssues(value, path5, context) {
  const prefix = `${context.packId}/`;
  const text = typeof value === "string" ? value : "";
  const known = text.startsWith(prefix) && context.objectIds.has(text.slice(prefix.length)) || presetOfRef(text) !== void 0;
  return known ? [] : [packIssue(path5, "bad-value", `ref must name an object of pack ${context.packId} as ${prefix}<objectId>, or a basic shape as preset/<shape>`)];
}
function atIssues(value, path5) {
  if (!isRecord(value)) return [packIssue(path5, "bad-size", "at must be an object with x and y")];
  return [
    ...checkUnknownFields(value, ["x", "y"], path5),
    ...checkNumberIn(value.x, FRACTION, `${path5}.x`, "bad-size"),
    ...checkNumberIn(value.y, FRACTION, `${path5}.y`, "bad-size")
  ];
}
function keyRefIssue(value, path5, keys) {
  return typeof value === "string" && keys.has(value) ? [] : [packIssue(path5, "bad-value", "must name an object key of this template")];
}
function linkIssues(value, path5, keys) {
  if (!isRecord(value)) return [packIssue(path5, "bad-value", "link must be an object")];
  return [
    ...checkUnknownFields(value, LINK_FIELDS, path5),
    ...keyRefIssue(value.from, `${path5}.from`, keys),
    ...keyRefIssue(value.to, `${path5}.to`, keys),
    ...value.label === void 0 ? [] : checkLocalizedLabel(value.label, `${path5}.label`),
    ...value.route === void 0 ? [] : checkEnum(value.route, PACK_TEMPLATE_LINK_ROUTES, `${path5}.route`, "bad-enum"),
    ...value.fromPort === void 0 ? [] : checkEnum(value.fromPort, PACK_TEMPLATE_LINK_SIDES, `${path5}.fromPort`, "bad-enum"),
    ...value.toPort === void 0 ? [] : checkEnum(value.toPort, PACK_TEMPLATE_LINK_SIDES, `${path5}.toPort`, "bad-enum"),
    ...value.arrow === void 0 || typeof value.arrow === "boolean" ? [] : [packIssue(`${path5}.arrow`, "bad-value", "arrow must be true or false")]
  ];
}
function stepIssues(value, path5, keys, context) {
  if (!isRecord(value)) return [packIssue(path5, "bad-value", "step must be an object")];
  const showLimit = { min: 0, max: PACK_LIMITS.templateObjects.max };
  return [
    ...checkUnknownFields(value, STEP_FIELDS, path5),
    ...checkLocalizedLabel(value.caption, `${path5}.caption`),
    ...listIssues(value.show, showLimit, `${path5}.show`, (item, p) => keyRefIssue(item, p, keys.objects)),
    ...listIssues(value.effects, PACK_LIMITS.templateEffects, `${path5}.effects`, (item, p) => effectIssues(item, p, keys, context))
  ];
}
function effectIssues(value, path5, keys, context) {
  if (!isRecord(value)) return [packIssue(path5, "bad-effect", "effect must be an object")];
  const effectKnown = typeof value.effect === "string" && context.effectIds.has(value.effect);
  const targetKnown = typeof value.target === "string" && (keys.objects.has(value.target) || keys.links.has(value.target));
  return [
    ...checkUnknownFields(value, EFFECT_FIELDS2, path5),
    ...effectKnown ? [] : [packIssue(`${path5}.effect`, "bad-effect", "effect must be a built-in effect id or <packId>/<effectId> of this pack")],
    ...targetKnown ? [] : [packIssue(`${path5}.target`, "bad-value", "target must be an object key or fromKey->toKey of a link")]
  ];
}
function templateIdSlots(templates, path5) {
  const items = Array.isArray(templates) ? templates : [];
  return items.map((item, index) => ({ value: isRecord(item) ? item.id : void 0, path: `${path5}[${index}].id` }));
}
function keySlots(objects, path5) {
  const items = Array.isArray(objects) ? objects : [];
  return items.map((item, index) => ({ value: isRecord(item) ? item.key : void 0, path: `${path5}[${index}].key` }));
}
function duplicateSlots(slots, what) {
  const seen = /* @__PURE__ */ new Set();
  return slots.flatMap(({ value, path: path5 }) => {
    if (typeof value !== "string") return [];
    if (!seen.has(value)) {
      seen.add(value);
      return [];
    }
    return [packIssue(path5, "duplicate-id", `${value} is already a ${what}`)];
  });
}
function showCoverageIssues(steps, keys, path5) {
  if (!Array.isArray(steps)) return [];
  const shown = steps.flatMap((step) => isRecord(step) && Array.isArray(step.show) ? step.show.filter((key) => typeof key === "string") : []);
  const missing = [...keys].filter((key) => !shown.includes(key));
  const repeated = shown.filter((key, index) => shown.indexOf(key) !== index);
  return [...missing, ...repeated].map((key) => packIssue(path5, "bad-value", `object ${key} must be shown in exactly one step`));
}

// src/core/visualBuilder/diagramPacks/validateStylePack.ts
var MAX_PACK_ISSUES = 50;
var PACK_FIELDS = ["format", "id", "name", "category", "color", "objects", "effects", "templates", "defaultStyle"];
function validateStylePack(raw) {
  try {
    const issues = collectIssues2(raw);
    if (issues.length === 0) return { ok: true, pack: raw };
    return { ok: false, errors: issues.slice(0, MAX_PACK_ISSUES) };
  } catch {
    return { ok: false, errors: [packIssue("pack", "bad-value", "pack could not be read")] };
  }
}
function collectIssues2(raw) {
  if (!isRecord(raw)) return [packIssue("pack", "bad-value", "pack must be an object")];
  return [
    ...checkUnknownFields(raw, PACK_FIELDS, "pack"),
    ...formatIssues2(raw.format),
    ...checkId(raw.id, "pack.id"),
    ...checkLocalizedLabel(raw.name, "pack.name"),
    ...checkId(raw.category, "pack.category"),
    ...checkEnum(raw.color, PACK_COLORS, "pack.color", "bad-enum"),
    ...objectIssues2(raw),
    ...optionalEffectIssues(raw.effects),
    ...optionalTemplateIssues(raw),
    ...optionalDefaultStyleIssues(raw.defaultStyle),
    ...duplicateIdIssues(objectIdSlots(raw.objects)),
    ...duplicateIdIssues(effectIdSlots(raw.effects))
  ];
}
function objectIssues2(raw) {
  const templatesOnly = Array.isArray(raw.objects) && raw.objects.length === 0 && Array.isArray(raw.templates) && raw.templates.length > 0;
  return templatesOnly ? [] : validatePackObjects(raw.objects, "pack.objects");
}
function formatIssues2(format) {
  return format === PACK_FORMAT_VERSION ? [] : [packIssue("pack.format", "bad-value", `format must be ${PACK_FORMAT_VERSION}`)];
}
function optionalEffectIssues(effects) {
  return effects === void 0 ? [] : validatePackEffects(effects, "pack.effects");
}
function optionalTemplateIssues(raw) {
  return raw.templates === void 0 ? [] : validatePackTemplates(raw.templates, "pack.templates", templateContextOf(raw));
}
function optionalDefaultStyleIssues(defaultStyle) {
  return defaultStyle === void 0 ? [] : checkId(defaultStyle, "pack.defaultStyle");
}
function objectIdSlots(objects) {
  if (!Array.isArray(objects)) return [];
  return objects.flatMap((object, index) => {
    if (!isRecord(object)) return [];
    const aliases = Array.isArray(object.aliases) ? object.aliases : [];
    const slots = [{ id: object.id, path: `pack.objects[${index}].id` }];
    aliases.forEach((alias, aliasIndex) => slots.push({ id: alias, path: `pack.objects[${index}].aliases[${aliasIndex}]` }));
    return slots;
  });
}
function effectIdSlots(effects) {
  if (!Array.isArray(effects)) return [];
  return effects.flatMap((effect, index) => isRecord(effect) ? [{ id: effect.id, path: `pack.effects[${index}].id` }] : []);
}
function duplicateIdIssues(slots) {
  const seen = /* @__PURE__ */ new Set();
  return slots.flatMap(({ id, path: path5 }) => {
    if (typeof id !== "string") return [];
    if (seen.has(id)) return [packIssue(path5, "duplicate-id", `${id} is already used in this pack`)];
    seen.add(id);
    return [];
  });
}

// src/core/visualBuilder/diagramPacks/stylePackRegistry.ts
var BUILT_IN_PACK_SOURCES = [
  { file: "automataSeed.pack.json", raw: automataSeed_pack_default },
  { file: "basicTemplates.pack.json", raw: basicTemplates_pack_default },
  { file: "flowchart.pack.json", raw: flowchart_pack_default },
  { file: "memory.pack.json", raw: memory_pack_default },
  { file: "network.pack.json", raw: network_pack_default },
  { file: "sets.pack.json", raw: sets_pack_default },
  { file: "shapes.pack.json", raw: shapes_pack_default },
  { file: "system.pack.json", raw: system_pack_default },
  { file: "uml.pack.json", raw: uml_pack_default }
];
var StylePackRegistryError = class extends Error {
  issues;
  constructor(issues) {
    super(formatLoadIssues2(issues));
    this.name = "StylePackRegistryError";
    this.issues = issues;
  }
};
function createStylePackRegistry(sources) {
  const packs = loadPacks(sources);
  const packsById = new Map(packs.map((pack) => [pack.id, pack]));
  return {
    listPacks: () => packs,
    packById: (packId) => packsById.get(packId),
    packObject: (packId, objectId) => packsById.get(packId)?.objects.find((object) => object.id === objectId || object.aliases?.includes(objectId))
  };
}
function loadPacks(sources) {
  const issues = [];
  const fileByPackId = /* @__PURE__ */ new Map();
  const packs = [];
  for (const { file, raw } of sources) {
    const result = validateStylePack(raw);
    if (!result.ok) {
      issues.push(...result.errors.map((error) => ({ ...error, file })));
      continue;
    }
    const declaringFile = fileByPackId.get(result.pack.id);
    if (declaringFile !== void 0) {
      issues.push({ file, path: "pack.id", code: "duplicate-id", message: `${result.pack.id} is already declared by ${declaringFile}` });
      continue;
    }
    fileByPackId.set(result.pack.id, file);
    packs.push(result.pack);
  }
  if (issues.length > 0) throw new StylePackRegistryError(issues);
  return packs;
}
function formatLoadIssues2(issues) {
  const lines = issues.map((issue) => `  ${issue.file} ${issue.path}: ${issue.message}`);
  return [`Invalid style pack${issues.length === 1 ? "" : "s"} (${issues.length}):`, ...lines].join("\n");
}
var builtInRegistry2 = createStylePackRegistry(BUILT_IN_PACK_SOURCES);
var listPacks = builtInRegistry2.listPacks;
var packById = builtInRegistry2.packById;
var packObject = builtInRegistry2.packObject;
function packObjectByRef(ref) {
  const [packId = "", objectId = ""] = (ref ?? "").split("/");
  return packObject(packId, objectId);
}

// src/core/visualBuilder/connectors.ts
var LOOP_SHAPE = {
  halfAngle: 0.6,
  reach: 3.2,
  bulge: 0.8
};
var LOOP_HALF_ANGLE = LOOP_SHAPE.halfAngle;
var LOOP_REACH = LOOP_SHAPE.reach;
var LOOP_BULGE = LOOP_SHAPE.bulge;
var LOOP_CANDIDATES = [-90, 180, 0, 90, -135, -45, 135, 45].map((deg) => deg * Math.PI / 180);
var SIDE_ANGLE = { e: 0, s: Math.PI / 2, w: Math.PI, n: -Math.PI / 2 };

// src/core/visualBuilder/diagramPacks/packLabelSlots.ts
function slotsOf(spec, parentId) {
  return spec.elements.filter((el) => el.builder?.parent === parentId && el.kind === "math");
}
function cutLabelLineProblems(spec, objectOf) {
  return spec.elements.flatMap((el) => {
    const ref = el.builder?.pack;
    const object = ref === void 0 ? void 0 : objectOf(ref);
    if (!object || object.lines === void 0) return [];
    const rows = slotsOf(spec, el.id).flatMap((slot) => (slot.content ?? "").split("\n"));
    return rows.length > object.lines ? [`element "${el.id}": ${rows.length} label lines but "${ref}" has ${object.lines} slots; the extra lines are cut`] : [];
  });
}

// src/core/visualBuilder/diagramPacks/packEffectSpecs.ts
var EASE_NAMES = {
  linear: "linear",
  easeInQuad: "inQuad",
  easeOutQuad: "outQuad",
  easeInOutQuad: "inOutQuad",
  easeInOutSine: "inOutSine"
};
var DEFAULT_EASE = "outQuad";
var refOf = (packId, effect) => `${packId}/${effect.id}`;
function packEffects() {
  return listPacks().flatMap(
    (pack) => (pack.effects ?? []).map((effect) => ({
      id: refOf(pack.id, effect),
      label: effect.label.en,
      description: effect.description.en,
      kinds: effect.kinds,
      duration: effect.duration,
      icon: effect.icon,
      tone: effect.tone,
      action: "pack",
      anime: effect.anime,
      source: pack.id
    }))
  );
}
function packEffectByRef(ref) {
  return packEffects().find((effect) => effect.id === ref);
}
var PROPS = Object.keys(PACK_ANIME_RANGES);
function animeToTweens(anime, targets, at, duration) {
  const tracks = PROPS.flatMap((prop) => anime[prop] && anime[prop].length >= 2 ? [[prop, anime[prop]]] : []);
  const segments = Math.max(0, ...tracks.map(([, values]) => values.length - 1));
  const slice = Math.max(1, Math.round(duration / Math.max(1, segments)));
  const ease = EASE_NAMES[anime.easing ?? ""] ?? DEFAULT_EASE;
  return Array.from({ length: segments }, (_, segment2) => {
    const params = Object.fromEntries(tracks.map(([prop, values]) => [prop, values[Math.round((segment2 + 1) * (values.length - 1) / segments)]]));
    return {
      targets: targets.length === 1 ? targets[0] : targets,
      params: { ...params, duration: slice, ease },
      at: at + segment2 * slice,
      builder: { generated: true }
    };
  });
}

// src/core/visualBuilder/blockTweens.ts
var SPEED_MS = { fast: 250, normal: 500, slow: 900 };
var durationOf = (block) => block.duration ?? SPEED_MS[block.speed ?? "normal"];
function expandTargets(spec, id, includeChildren) {
  const children = includeChildren ? spec.elements.filter((el) => el.builder?.parent === id).map((el) => el.id) : [];
  return [id, ...children];
}
function tween(targets, params, block, at) {
  return {
    targets: targets.length === 1 ? targets[0] : targets,
    params: { ...params, duration: durationOf(block), ease: "outQuad" },
    at,
    builder: { generated: true }
  };
}
var withChildren = (spec, element) => expandTargets(spec, element.id, true);
var setParam = (name, value) => (spec, element, block, at) => [tween(withChildren(spec, element), { [name]: value }, block, at)];
var setOpacity = (opacity) => setParam("opacity", opacity);
var FADED_OPACITY = 0.3;
var OUTLINE_WIDTH = 4;
var SOFT_FILL_OPACITY = 0.25;
var SOFT_FILL_RISE = 0.6;
var GROW_SCALE = 1.3;
var BOUNCE_HEIGHT = 24;
function tintProperties(element) {
  if (element.kind === "text" || TEXT_SHAPES.includes(element.builder?.shape ?? "")) return ["fill"];
  return element.kind === "path" ? ["stroke"] : ["stroke", "fill"];
}
var TEXT_SHAPES = ["text", "heading", "caption", "note"];
var tint = (_spec, element, block, at) => {
  if (!block.color) return [];
  const params = Object.fromEntries(tintProperties(element).map((property) => [property, block.color]));
  return [tween([element.id], params, { ...block, duration: 1 }, at)];
};
var soften = (_spec, element, block, at) => {
  const start = Number(element.style?.fillOpacity ?? 1);
  const target = start <= SOFT_FILL_OPACITY ? SOFT_FILL_RISE : SOFT_FILL_OPACITY;
  return [tween([element.id], { fillOpacity: target }, block, at)];
};
var emphasis = (opacity, filter) => (spec, element, block, at) => {
  const children = withChildren(spec, element).slice(1);
  const own = tween([element.id], { opacity, filter }, block, at);
  return children.length > 0 ? [own, tween(children, { opacity }, block, at)] : [own];
};
var draw = (spec, element, block, at) => {
  const labelIds = element.builder?.link ? withChildren(spec, element).slice(1) : [];
  const reveal = labelIds.length > 0 ? [tween(labelIds, { opacity: 1 }, block, at)] : [];
  return [tween([element.id], { strokeDashoffset: 0 }, block, at), ...reveal];
};
var hide = (spec, element, block, at) => {
  const overlays = element.builder?.link ? overlayIdsOfLink(spec, element.id) : [];
  return [tween([...withChildren(spec, element), ...overlays], { opacity: 0 }, block, at)];
};
var move = (spec, element, block, at) => {
  if (!block.to) return [];
  const center2 = boxCenter(elementBox(element));
  const params = { translateX: Math.round(block.to.x - center2.x), translateY: Math.round(block.to.y - center2.y) };
  return [tween(withChildren(spec, element), params, block, at)];
};
var bounce = (spec, element, block, at) => {
  const half = Math.round(durationOf(block) / 2);
  const targets = withChildren(spec, element);
  return [tween(targets, { translateY: -BOUNCE_HEIGHT }, { ...block, duration: half }, at), tween(targets, { translateY: 0 }, { ...block, duration: half }, at + half)];
};
var typeIn = (_spec, element, block, at) => [tween([element.id], { typeText: 1 }, block, at)];
var fill = (_spec, element, block, at) => [tween([element.id], { fillOpacity: 0.9 }, block, at)];
function pulse(_spec, element, block, at) {
  const half = Math.round(durationOf(block) / 2);
  return [tween([element.id], { scale: 1.2 }, { ...block, duration: half }, at), tween([element.id], { scale: 1 }, { ...block, duration: half }, at + half)];
}
var overlayEffect = (params) => (spec, element, block, at) => {
  const overlay = overlayId(block.action, element.id);
  return spec.elements.some((el) => el.id === overlay) ? [tween([overlay], params, block, at)] : [];
};
var SWEEP_GLOSS = 0.55;
var SWEEP_FADE_MS = 120;
function sweep(spec, element, block, at) {
  const bar = spec.elements.find((el) => el.id === overlayId("sweep", element.id));
  if (!bar) return [];
  const id = bar.id;
  const distance = Math.round(elementBox(element).w - Number(bar.attrs.width));
  const instant = { ...block, duration: 1 };
  return [
    tween([id], { opacity: SWEEP_GLOSS, translateX: 0 }, instant, at),
    tween([id], { translateX: distance }, block, at + 1),
    tween([id], { opacity: 0 }, { ...block, duration: SWEEP_FADE_MS }, at + durationOf(block))
  ];
}
var TRAVEL_STEPS = 10;
function travel(spec, element, block, at) {
  const tokenId = overlayId("travel", element.id);
  const token = spec.elements.find((el) => el.id === tokenId);
  const [shaft] = flattenPath(String(element.attrs.d ?? ""));
  if (!token || !shaft) return [];
  const slice = Math.max(1, Math.round(durationOf(block) / TRAVEL_STEPS));
  const base = { x: Number(token.attrs.cx), y: Number(token.attrs.cy) };
  const show = tween([tokenId], { opacity: 1 }, { ...block, duration: 1 }, at);
  const moves = pointsAlong(shaft, TRAVEL_STEPS).slice(1).map((stop, i) => ({
    ...tween([tokenId], {}, block, at + i * slice),
    params: { translateX: Math.round(stop.x - base.x), translateY: Math.round(stop.y - base.y), duration: slice, ease: "linear" }
  }));
  return [show, ...moves];
}
var packEffectTween = (spec, element, block, at) => {
  const anime = block.params ?? packEffectByRef(block.effect)?.anime;
  return anime ? animeToTweens(anime, withChildren(spec, element), at, durationOf(block)) : [];
};
var MAKERS = {
  show: setOpacity(1),
  hide,
  highlight: emphasis(1, GLOW_ON),
  dim: emphasis(DIMMED_OPACITY, GLOW_OFF),
  calm: emphasis(1, GLOW_OFF),
  fill,
  pulse,
  flow: overlayEffect({ opacity: 1, strokeDashoffset: -90 }),
  spark: overlayEffect({ opacity: 1, strokeDashoffset: 0 }),
  frame: overlayEffect({ opacity: 1, strokeDashoffset: -60 }),
  sweep,
  callout: overlayEffect({ opacity: 1 }),
  travel,
  draw,
  move,
  fade: setParam("opacity", FADED_OPACITY),
  tint,
  outline: setParam("strokeWidth", OUTLINE_WIDTH),
  soften,
  grow: setParam("scale", GROW_SCALE),
  bounce,
  typeIn,
  pack: packEffectTween
};

// src/core/visualBuilder/effects.ts
var CORE = "core";
var CORE_EFFECTS = [
  { id: "fill", label: "Fill", action: "fill", kinds: ["closed", "box"], duration: 900, description: "The shape fills with colour.", icon: "\u25D0", tone: "fill", source: CORE },
  { id: "reveal", label: "Reveal", action: "show", kinds: OBJECT_KINDS, duration: 500, description: "The shape fades in.", icon: "\u25CC", tone: "look", source: CORE },
  { id: "remove", label: "Remove", action: "hide", kinds: OBJECT_KINDS, duration: 500, description: "The shape fades out and stays gone.", icon: "\u25CD", tone: "look", source: CORE },
  { id: "draw", label: "Draw in", action: "draw", kinds: ["arrow", "path"], duration: 700, description: "The arrow draws from start to end.", icon: "\u2571", tone: "fill", source: CORE },
  { id: "travel", label: "Travel", action: "travel", kinds: ["arrow", "path"], duration: 900, description: "A token rides along the arrow.", icon: "\u25CF", tone: "zig", source: CORE },
  { id: "flow", label: "Flow", action: "flow", kinds: ["arrow", "path"], duration: 1200, description: "Dashes stream along the arrow.", icon: "\u21E2", tone: "flow", source: CORE },
  { id: "spark", label: "Zigzag", action: "spark", kinds: ["arrow", "path"], duration: 800, description: "A zigzag spark runs along the arrow.", icon: "\u03DF", tone: "zig", source: CORE },
  { id: "frame", label: "Zigzag outline", action: "frame", kinds: ["box"], duration: 600, description: "A marching dashed frame, like the swap marker.", icon: "\u25A8", tone: "zig", source: CORE },
  { id: "pulse", label: "Pulse", action: "pulse", kinds: ["closed", "box", "text"], duration: 600, description: "The shape swells and settles.", icon: "\u25CE", tone: "look", source: CORE },
  { id: "glow", label: "Glow", action: "highlight", kinds: OBJECT_KINDS, duration: 400, description: "Glows until the step ends or you calm it down.", icon: "\u273A", tone: "look", source: CORE },
  { id: "sweep", label: "Highlight sweep", action: "sweep", kinds: ["closed", "box"], duration: 700, description: "A bar of light crosses the shape from left to right.", icon: "\u25B6", tone: "look", source: CORE },
  { id: "callout", label: "Callout", action: "callout", kinds: OBJECT_KINDS, duration: 400, description: "A short note appears beside the shape for the step.", icon: "\u270E", tone: "look", defaults: { text: "Look here" }, source: CORE },
  { id: "fade", label: "Fade", action: "fade", kinds: OBJECT_KINDS, duration: 500, description: "The object dims to make the rest stand out.", icon: "\u25D4", tone: "look", source: CORE },
  { id: "tint", label: "Colour change", action: "tint", kinds: OBJECT_KINDS, duration: 400, description: "The object switches to another colour.", icon: "\u25C9", tone: "look", defaults: { color: "var(--viz-orange)" }, source: CORE },
  { id: "outline", label: "Emphasise outline", action: "outline", kinds: ["arrow", "closed", "box", "path"], duration: 400, description: "The outline thickens.", icon: "\u25A2", tone: "look", source: CORE },
  { id: "soften", label: "Soft highlight", action: "soften", kinds: ["closed", "box"], duration: 500, description: "The fill brightens softly.", icon: "\u25D6", tone: "look", source: CORE },
  { id: "move", label: "Move", action: "move", kinds: ["closed", "box", "text"], duration: 900, description: "The object slides to a new spot.", icon: "\u279C", tone: "look", defaults: { moveDy: 120 }, source: CORE },
  { id: "grow", label: "Grow or shrink", action: "grow", kinds: ["closed", "box"], duration: 500, description: "The object grows to a larger size.", icon: "\u2922", tone: "look", source: CORE },
  { id: "bounce", label: "Bounce", action: "bounce", kinds: ["closed", "box", "text"], duration: 600, description: "The object hops up and settles back.", icon: "\u2912", tone: "look", source: CORE },
  { id: "typeIn", label: "Type in", action: "typeIn", kinds: ["text"], duration: 800, description: "The words appear one letter at a time.", icon: "T|", tone: "look", source: CORE }
];
var EFFECTS = [...CORE_EFFECTS, ...packEffects()];
var SHAPE_KIND = {
  circle: "closed",
  ellipse: "closed",
  diamond: "closed",
  triangle: "closed",
  pointer: "closed",
  box: "box",
  rounded: "box",
  line: "path",
  arrow: "path",
  text: "text",
  heading: "text",
  caption: "text",
  note: "text"
};
var SVG_KIND = { circle: "closed", ellipse: "closed", rect: "box", path: "path", text: "text", math: "text", bubble: "text" };
function objectKindOf(element) {
  const { link, shape, pack } = element.builder ?? {};
  if (link) return "arrow";
  if (shape === "pack") return packObjectByRef(pack)?.kind ?? SVG_KIND[element.kind];
  return shape && SHAPE_KIND[shape] || SVG_KIND[element.kind];
}
var KIND_PLURAL = { arrow: "arrows", closed: "shapes", box: "boxes", text: "text", path: "lines" };
function kindsWord(kinds) {
  if (kinds.length === OBJECT_KINDS.length) return "any object";
  return kinds.map((kind) => KIND_PLURAL[kind]).join(" or ");
}

// src/core/validation/visualSpec/speedValidation.ts
var MIN_SPEC_SPEED = 0.25;
var MAX_SPEC_SPEED = 8;
function speedProblems(spec) {
  if (spec.speed === void 0) return [];
  const speed = spec.speed;
  const valid = typeof speed === "number" && Number.isFinite(speed) && speed >= MIN_SPEC_SPEED && speed <= MAX_SPEC_SPEED;
  return valid ? [] : [`speed must be a number from ${MIN_SPEC_SPEED} to ${MAX_SPEC_SPEED} (got ${String(speed)})`];
}

// src/core/validation/visualSpec/visualSpecValidation.ts
var ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
function validateElements(spec) {
  const problems = [];
  const seen = /* @__PURE__ */ new Set();
  for (const element of spec.elements) {
    if (!ID_PATTERN.test(element.id)) problems.push(`element id "${element.id}" must match ${ID_PATTERN}`);
    if (seen.has(element.id)) problems.push(`duplicate element id "${element.id}"`);
    seen.add(element.id);
  }
  return problems;
}
function validateParams(stepId, params) {
  return Object.entries(params).filter(([, value]) => typeof value !== "number" && typeof value !== "string").map(([key]) => `step "${stepId}": param "${key}" must be a number or string`);
}
function validateTween(stepId, tween2, knownIds) {
  const problems = [];
  const targets = Array.isArray(tween2.targets) ? tween2.targets : [tween2.targets];
  if (targets.length === 0) problems.push(`step "${stepId}": tween needs at least one target`);
  for (const target of targets) {
    if (!knownIds.has(target)) problems.push(`step "${stepId}": unknown target "${target}"`);
  }
  problems.push(...validateParams(stepId, tween2.params));
  if (tween2.at !== void 0 && !(Number.isFinite(tween2.at) && tween2.at >= 0)) {
    problems.push(`step "${stepId}": tween "at" must be a finite number >= 0`);
  }
  return problems;
}
function validateSteps(spec) {
  if (spec.steps.length === 0) return ["spec has no steps"];
  const knownIds = new Set(spec.elements.map((element) => element.id));
  const stageIds = new Set((spec.pipeline?.stages ?? []).map((stage) => stage.id));
  const problems = [];
  spec.steps.forEach((step) => {
    if (step.activeStage && !stageIds.has(step.activeStage)) {
      problems.push(`step "${step.id}": unknown activeStage "${step.activeStage}"`);
    }
    for (const tween2 of step.tweens) problems.push(...validateTween(step.id, tween2, knownIds));
  });
  return problems;
}
function effectFitProblem(stepId, block, elements) {
  if (block.action === "pack") return packBlockProblems(stepId, block, elements);
  return fitProblem(stepId, EFFECTS.find((candidate) => candidate.action === block.action), block, elements);
}
function packBlockProblems(stepId, block, elements) {
  const effect = EFFECTS.find((candidate) => candidate.action === "pack" && candidate.id === block.effect);
  if (!effect) return [`step "${stepId}": unknown pack effect "${block.effect ?? ""}"`];
  const params = block.params ? validatePackAnime(block.params, "params").map((issue) => `step "${stepId}": pack effect ${issue.path} ${issue.message}`) : [];
  return [...params, ...fitProblem(stepId, effect, block, elements)];
}
function fitProblem(stepId, effect, block, elements) {
  const element = block.target === void 0 ? void 0 : elements.get(block.target);
  if (!effect || !element) return [];
  const kind = objectKindOf(element);
  if (effect.kinds.includes(kind)) return [];
  return [`step "${stepId}": effect "${effect.label}" does not fit "${element.id}" (${kindsWord([kind])}); it fits ${kindsWord(effect.kinds)}`];
}
function validateEffectFit(spec) {
  const elements = new Map(spec.elements.map((element) => [element.id, element]));
  return spec.steps.flatMap((step) => blocksOf(step).flatMap((block) => effectFitProblem(step.id, block, elements)));
}
function validateVisualSpec(spec) {
  return [...validateElements(spec), ...validateSteps(spec), ...speedProblems(spec), ...validateEffectFit(spec), ...cutLabelLineProblems(spec, packObjectByRef)];
}

// src/core/types/visualSpec.ts
var VISUAL_ELEMENT_KINDS = ["ellipse", "circle", "rect", "path", "text", "math", "bubble"];

// src/core/validation/visualSpec/visualSpecJson.ts
var ELEMENT_KINDS = VISUAL_ELEMENT_KINDS;
var isRecord2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function firstProblem(items, check) {
  for (let index = 0; index < items.length; index += 1) {
    const problem = check(items[index], index);
    if (problem) return problem;
  }
  return null;
}
function elementShapeProblem(element, index) {
  const where = `elements[${index}]`;
  if (!isRecord2(element) || typeof element.id !== "string" || typeof element.kind !== "string") {
    return `${where} needs string "id" and "kind"`;
  }
  if (!ELEMENT_KINDS.includes(element.kind)) return `${where}.kind must be one of ${ELEMENT_KINDS.join(", ")}`;
  if (!isRecord2(element.attrs)) return `${where}.attrs must be an object`;
  if (element.style !== void 0 && !isRecord2(element.style)) return `${where}.style must be an object`;
  return null;
}
function tweenShapeProblem(tween2, where) {
  if (!isRecord2(tween2)) return `${where} must be an object`;
  const targetsOk = typeof tween2.targets === "string" || Array.isArray(tween2.targets) && tween2.targets.every((target) => typeof target === "string");
  if (!targetsOk) return `${where}.targets must be a string or an array of strings`;
  if (!isRecord2(tween2.params)) return `${where}.params must be an object`;
  return null;
}
function stepShapeProblem(step, index) {
  const where = `steps[${index}]`;
  if (!isRecord2(step) || typeof step.id !== "string") return `${where} needs a string "id"`;
  if (!Array.isArray(step.tweens)) return `${where}.tweens must be an array`;
  return firstProblem(step.tweens, (tween2, tweenIndex) => tweenShapeProblem(tween2, `${where}.tweens[${tweenIndex}]`));
}
function pipelineShapeProblem(pipeline2) {
  if (pipeline2 === void 0) return null;
  if (!isRecord2(pipeline2) || !Array.isArray(pipeline2.stages)) return 'pipeline must be an object with an array "stages"';
  const bad = pipeline2.stages.findIndex((stage) => !isRecord2(stage) || typeof stage.id !== "string");
  return bad === -1 ? null : `pipeline.stages[${bad}] needs a string "id"`;
}
function shapeProblem(value) {
  if (!isRecord2(value)) return "Spec must be a JSON object";
  if (typeof value.id !== "string" || typeof value.viewBox !== "string") return 'Spec needs string "id" and "viewBox"';
  if (!Array.isArray(value.elements) || !Array.isArray(value.steps)) return 'Spec needs array "elements" and "steps"';
  return firstProblem(value.elements, elementShapeProblem) ?? firstProblem(value.steps, stepShapeProblem) ?? pipelineShapeProblem(value.pipeline);
}
function checkVisualSpec(value) {
  const problem = shapeProblem(value);
  if (problem) return { spec: null, problems: [problem] };
  const spec = migrateSpec(value);
  return { spec, problems: validateVisualSpec(spec) };
}

// src/core/validation/visualSpec/visualSpecLayout.ts
var TEXT_KINDS = ["math", "bubble"];
var SLOT_GROUP = /^(bubble|strip)-\d+$/;
var num2 = (value) => Number(value ?? 0);
var viewBoxSize = (viewBox) => parseViewBox(viewBox);
var frameOf = (a) => ({ x: num2(a.x), y: num2(a.y), w: num2(a.width), h: num2(a.height) });
var BOX_READERS = {
  circle: (a) => ({ x: num2(a.cx) - num2(a.r), y: num2(a.cy) - num2(a.r), w: num2(a.r) * 2, h: num2(a.r) * 2 }),
  ellipse: (a) => ({ x: num2(a.cx) - num2(a.rx), y: num2(a.cy) - num2(a.ry), w: num2(a.rx) * 2, h: num2(a.ry) * 2 }),
  rect: frameOf,
  math: frameOf,
  bubble: frameOf
};
function placedBox(placed) {
  const box = BOX_READERS[placed.el.kind]?.(placed.el.attrs);
  return box ? { ...box, x: box.x + placed.dx, y: box.y + placed.dy } : null;
}
var overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
var areaOf = (box) => box.w * box.h;
var insideAreaOf = (box, frame) => {
  const width = Math.min(box.x + box.w, frame.x + frame.w) - Math.max(box.x, frame.x);
  const height = Math.min(box.y + box.h, frame.y + frame.h) - Math.max(box.y, frame.y);
  return Math.max(0, width) * Math.max(0, height);
};
var isPartlyOutside = (box, frame) => {
  const inside = insideAreaOf(box, frame);
  return inside > 0 && inside * 2 >= areaOf(box);
};
var contains = (outer, inner) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
function crossesEllipse(box, shape) {
  const rx = shape.w / 2;
  const ry = shape.h / 2;
  const left = (box.x - (shape.x + rx)) / rx;
  const right = (box.x + box.w - (shape.x + rx)) / rx;
  const top = (box.y - (shape.y + ry)) / ry;
  const bottom = (box.y + box.h - (shape.y + ry)) / ry;
  const nearest = Math.hypot(Math.max(left, 0, -right), Math.max(top, 0, -bottom));
  const farthest = Math.hypot(Math.max(Math.abs(left), Math.abs(right)), Math.max(Math.abs(top), Math.abs(bottom)));
  return nearest <= 1 && farthest >= 1;
}
var crossesRect = (box, shape) => overlaps(box, shape) && !contains(shape, box) && !contains(box, shape);
var OUTLINE_CROSSERS = {
  circle: crossesEllipse,
  ellipse: crossesEllipse,
  rect: crossesRect
};
function segmentHitsBox([x1, y1, x2, y2], box) {
  const checks = [
    [x1 - x2, x1 - box.x],
    [x2 - x1, box.x + box.w - x1],
    [y1 - y2, y1 - box.y],
    [y2 - y1, box.y + box.h - y1]
  ];
  let enter = 0;
  let leave = 1;
  for (const [p, q] of checks) {
    if (p === 0 && q < 0) return false;
    if (p === 0) continue;
    if (p < 0) enter = Math.max(enter, q / p);
    else leave = Math.min(leave, q / p);
  }
  return enter <= leave;
}
var slotGroup = (id) => SLOT_GROUP.test(id) ? id.replace(/-\d+$/, "") : null;
function sameSlotGroup(a, b) {
  const group = slotGroup(a);
  return group !== null && group === slotGroup(b);
}
var hasOutline = (el) => el.style?.stroke !== void 0 && el.style.stroke !== "none";
function sitsOnOutline(box, other) {
  const shape = hasOutline(other.el) ? placedBox(other) : null;
  return shape !== null && OUTLINE_CROSSERS[other.el.kind]?.(box, shape) === true;
}
function crossedByLine(box, other) {
  if (other.el.kind !== "path") return false;
  return pathSegments(String(other.el.attrs.d ?? ""), other.dx, other.dy).some((segment2) => segmentHitsBox(segment2, box));
}
var isRelated = (a, b) => a.builder?.parent === b.id || b.builder?.parent === a.id || a.builder?.group !== void 0 && a.builder.group === b.builder?.group;
function crossingIssue(text, box, other) {
  if (other.el.builder?.fx === true || isRelated(text.el, other.el)) return null;
  if (sitsOnOutline(box, other)) return { ids: [text.el.id], other: other.el.id, kind: "outline", message: `"${text.el.id}" sits on the outline of "${other.el.id}"` };
  return crossedByLine(box, other) ? { ids: [text.el.id], other: other.el.id, kind: "crossed", message: `"${text.el.id}" is crossed by the line "${other.el.id}"` } : null;
}
function outlineIssues(texts, shown) {
  return texts.flatMap((text) => {
    const box = placedBox(text);
    return shown.map((other) => crossingIssue(text, box, other)).filter((issue) => issue !== null);
  });
}
function overlapIssues(texts) {
  return texts.flatMap(
    (first, index) => texts.slice(index + 1).filter((second) => !sameSlotGroup(first.el.id, second.el.id) && !isRelated(first.el, second.el) && overlaps(placedBox(first), placedBox(second))).map((second) => ({ ids: [first.el.id, second.el.id], kind: "overlap", message: `"${first.el.id}" overlaps "${second.el.id}"` }))
  );
}
function boundsIssues(shown, viewBox) {
  const frame = { x: 0, y: 0, ...viewBoxSize(viewBox) };
  return shown.flatMap((placed) => {
    const box = placedBox(placed);
    if (box === null || contains(frame, box)) return [];
    const id = placed.el.id;
    return isPartlyOutside(box, frame) ? [{ ids: [id], kind: "partlyOutside", message: `"${id}" partly leaves the viewBox` }] : [{ ids: [id], kind: "outside", message: `"${id}" leaves the viewBox` }];
  });
}
var isOrphan = (el, ids) => {
  const builder = el.builder;
  if (builder === void 0) return false;
  if (builder.parent !== void 0 && !ids.has(builder.parent)) return true;
  return builder.link !== void 0 && (!ids.has(builder.link.from) || !ids.has(builder.link.to));
};
function orphanIssues(spec) {
  const ids = new Set(spec.elements.map((el) => el.id));
  return spec.elements.filter((el) => isOrphan(el, ids)).map((el) => ({ ids: [el.id], kind: "orphan", message: `"${el.id}" has a missing parent or link end` }));
}
var PARAM_SETTERS = {
  opacity: (state, value) => void (state.opacity = value),
  translateX: (state, value) => void (state.dx = value),
  translateY: (state, value) => void (state.dy = value)
};
function applyParams(state, params) {
  const next = { ...state, el: { ...state.el, attrs: { ...state.el.attrs } } };
  for (const [key, value] of Object.entries(params)) {
    if (PARAM_SETTERS[key]) PARAM_SETTERS[key](next, num2(value));
    else if (typeof value === "number" && key in next.el.attrs) next.el.attrs[key] = value;
  }
  return next;
}
function applyTween(states, tween2) {
  const targets = Array.isArray(tween2.targets) ? tween2.targets : [tween2.targets];
  for (const id of targets) {
    const state = states.get(id);
    if (state) states.set(id, applyParams(state, tween2.params));
  }
}
function startingStates(spec) {
  return new Map(spec.elements.map((el) => [el.id, { el, opacity: num2(el.style?.opacity ?? 1), dx: 0, dy: 0 }]));
}
function stepIssues2(states, viewBox) {
  const shown = [...states.values()].filter((placed) => placed.opacity > 0);
  const texts = shown.filter((placed) => TEXT_KINDS.includes(placed.el.kind));
  return [...outlineIssues(texts, shown), ...overlapIssues(texts), ...boundsIssues(shown, viewBox)];
}
function findLayoutIssues(spec) {
  const states = startingStates(spec);
  const issues = spec.steps.flatMap((step) => {
    step.tweens.forEach((tween2) => applyTween(states, tween2));
    return stepIssues2(states, spec.viewBox);
  });
  return [...new Map([...orphanIssues(spec), ...issues].map((issue) => [issue.message, issue])).values()];
}
var checkVisualSpecLayout = (spec) => findLayoutIssues(spec).map((issue) => issue.message);

// src/core/validation/visualSpec/visualSpecPublishCheck.ts
function checkVisualSpecForPublish(value) {
  const checked = checkVisualSpec(value);
  if (!checked.spec || checked.problems.length > 0) return checked;
  return { spec: checked.spec, problems: checkVisualSpecLayout(checked.spec) };
}

// src/core/canvasBlocks/compileTopology.ts
var COLUMN_MIN_WIDTH = 180;
var COLUMN_GAP = 24;
var ZONE_PAD = 24;
var ZONE_HEADER = 30;
var LABEL_HEIGHT = 26;
var ROW_GAP = 36;
var MAX_DEVICES = 40;
var slug = (value) => value.trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
var normalized = (label) => label.trim().toLowerCase().replace(/\s+/g, " ");
function inputError(input) {
  const topology = input;
  if (!topology || !Array.isArray(topology.devices) || topology.devices.length === 0) return "topology.devices must be a non-empty array";
  if (topology.devices.length > MAX_DEVICES) return `topology.devices has ${topology.devices.length} entries; the limit is ${MAX_DEVICES}`;
  for (const device of topology.devices) {
    if (!device || typeof device.id !== "string" || !slug(device.id)) return "every device needs a string id";
    if (!isNetworkDevice(device.type)) return `device "${device.id}" has type "${device.type}"; use one of: ${NETWORK_DEVICES.join(", ")}`;
  }
  return null;
}
function dedupeDevices(raw) {
  const devices = [];
  const idMap = /* @__PURE__ */ new Map();
  const byLabel = /* @__PURE__ */ new Map();
  const merged = [];
  for (const entry of raw) {
    const id = slug(entry.id);
    const label = entry.label?.trim() || entry.id.trim();
    const sameId = devices.find((d) => d.id.toLowerCase() === id.toLowerCase());
    const sameLabel = byLabel.get(`${entry.type}|${normalized(label)}`);
    const existing = sameId ?? sameLabel;
    if (existing) {
      idMap.set(entry.id, existing.id);
      idMap.set(id, existing.id);
      merged.push(`"${entry.id}" is the same device as "${existing.id}"`);
      continue;
    }
    const device = { id, label, type: entry.type, zone: entry.zone?.trim() || void 0 };
    devices.push(device);
    byLabel.set(`${device.type}|${normalized(label)}`, device);
    idMap.set(entry.id, id);
    idMap.set(id, id);
  }
  return { devices, idMap, merged };
}
function resolveLinks(links, idMap) {
  const edges = [];
  const seen = /* @__PURE__ */ new Set();
  for (const link of links) {
    const from = idMap.get(String(link?.from));
    const to = idMap.get(String(link?.to));
    if (!from || !to) return `link ${String(link?.from)} -> ${String(link?.to)} names a device that is not in topology.devices`;
    const key = `${[from, to].sort().join("|")}|${link.label ?? ""}`;
    if (from === to || seen.has(key)) continue;
    seen.add(key);
    edges.push({ id: `link-${edges.length + 1}`, from, to, label: link.label, directed: false });
  }
  return edges;
}
function buildColumns(devices, zones) {
  const order = /* @__PURE__ */ new Map();
  for (const zone of zones) if (zone?.id) order.set(zone.id, zone.label?.trim() || zone.id);
  for (const device of devices) if (device.zone && !order.has(device.zone)) order.set(device.zone, device.zone);
  const columns = [...order].map(([id, label]) => ({ zone: { id, label }, devices: devices.filter((d) => d.zone === id) }));
  const loose = devices.filter((d) => !d.zone);
  return [...columns.filter((c) => c.devices.length > 0), ...loose.length > 0 ? [{ devices: loose }] : []];
}
var rowHeight = (device) => DEVICE_SIZE_PX[device.type].height + LABEL_HEIGHT + ROW_GAP;
function layoutColumns(columns) {
  const contentHeight = Math.max(...columns.map((c) => c.devices.reduce((sum, d) => sum + rowHeight(d), 0)));
  const nodes = [];
  const zones = [];
  let left = 0;
  for (const column of columns) {
    const columnWidth = Math.max(COLUMN_MIN_WIDTH, ...column.devices.map((d) => DEVICE_SIZE_PX[d.type].width + 2 * ZONE_PAD));
    let top = ZONE_HEADER + ZONE_PAD;
    for (const device of column.devices) {
      const size = DEVICE_SIZE_PX[device.type];
      nodes.push({ id: device.id, label: device.label, device: device.type, x: Math.round(left + (columnWidth - size.width) / 2), y: top, width: size.width, height: size.height });
      top += rowHeight(device);
    }
    if (column.zone) zones.push({ id: column.zone.id, label: column.zone.label, x: left, y: 0, width: columnWidth, height: ZONE_HEADER + 2 * ZONE_PAD + contentHeight });
    left += columnWidth + COLUMN_GAP;
  }
  return { nodes, zones, width: left - COLUMN_GAP, height: ZONE_HEADER + 2 * ZONE_PAD + contentHeight };
}
function compileTopology(input) {
  const problem = inputError(input);
  if (problem) return { error: problem };
  const topology = input;
  const { devices, idMap, merged } = dedupeDevices(topology.devices);
  const edges = resolveLinks(topology.links ?? [], idMap);
  if (typeof edges === "string") return { error: edges };
  const { nodes, zones, width, height } = layoutColumns(buildColumns(devices, topology.zones ?? []));
  return { state: { nodes, edges, ...zones.length > 0 ? { zones } : {} }, width, height, merged };
}

// server/mcp/servers/courseAuthorTools.ts
var SEGMENT = /^[a-z0-9][a-z0-9-]{0,63}$/;
var SECTIONS = ["lectures", "practice"];
var CONTENT_FIELDS = ["title", "concept", "whatChanged", "why"];
var COURSE_DEFAULTS = { icon: "BookOpen", color: "rgba(99, 102, 241, 0.15)", accent: "#6366f1", badge: "Course", subtitle: "" };
function segment(label, value) {
  if (typeof value !== "string" || !SEGMENT.test(value)) {
    throw new Error(`${label} must be lowercase letters, digits and hyphens, got ${JSON.stringify(value)}`);
  }
  return value;
}
function sectionOf(value) {
  const section = value ?? "lectures";
  if (typeof section !== "string" || !SECTIONS.includes(section)) throw new Error("section must be 'lectures' or 'practice'");
  return section;
}
function localized(label, value) {
  if (typeof value === "string" && value.trim()) return { en: value };
  const record = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const texts = Object.entries(record).filter((entry) => typeof entry[1] === "string");
  if (typeof record.en !== "string") throw new Error(`${label} must be a non-empty string or an object with an en text`);
  return { ...Object.fromEntries(texts), en: record.en };
}
function missingContentField(step) {
  const record = step ?? {};
  return CONTENT_FIELDS.find((field) => typeof record[field] !== "string" || !record[field].trim());
}
function assertContent(content) {
  if (!Array.isArray(content) || content.length === 0) throw new Error("content must be a non-empty array of steps");
  const bad = content.findIndex((step) => missingContentField(step));
  if (bad >= 0) throw new Error(`content[${bad}] is missing a non-empty "${missingContentField(content[bad])}"`);
}
function sceneWithId(scene, fallbackId) {
  if (scene && typeof scene === "object" && !Array.isArray(scene) && !("id" in scene)) return { ...scene, id: fallbackId };
  return scene;
}
function networkBlock(args, compiled, blocks) {
  const below = Math.max(0, ...blocks.map((b) => (b.y ?? 0) + (b.height ?? 0)));
  return {
    id: typeof args.blockId === "string" && args.blockId ? args.blockId : `network-${Date.now()}`,
    kind: "graph",
    x: typeof args.x === "number" ? args.x : 40,
    y: typeof args.y === "number" ? args.y : below > 0 ? below + 40 : 40,
    width: compiled.width,
    height: compiled.height,
    state: compiled.state
  };
}
function createCourseAuthorTools(dataDir) {
  const courseDir = (courseId) => path2.join(dataDir, courseId);
  const relative = (file) => path2.relative(dataDir, file).split(path2.sep).join("/");
  async function writeJson(file, value) {
    await fs2.mkdir(path2.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs2.writeFile(tmp, `${JSON.stringify(value, null, 2)}
`, "utf-8");
    await fs2.rename(tmp, file);
  }
  function requireCourse(courseId) {
    const dir = courseDir(courseId);
    if (!fsSync2.existsSync(path2.join(dir, "course.json"))) {
      throw new Error(`Course '${courseId}' does not exist; create it with create_course first`);
    }
    return dir;
  }
  async function readCatalog(dir) {
    const file = path2.join(dir, "catalog.json");
    if (!fsSync2.existsSync(file)) return {};
    return JSON.parse(await fs2.readFile(file, "utf-8"));
  }
  async function listCourses() {
    const entries = await fs2.readdir(dataDir, { withFileTypes: true });
    const courses = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !fsSync2.existsSync(path2.join(courseDir(entry.name), "course.json"))) continue;
      const catalog = await readCatalog(courseDir(entry.name));
      const weeks = Object.fromEntries(Object.entries(catalog).map(([key, week]) => [key, week.lectures.map((l) => l.id)]));
      courses.push({ id: entry.name, weeks });
    }
    return { courses };
  }
  async function createCourse(args) {
    const id = segment("id", args.id);
    const file = path2.join(courseDir(id), "course.json");
    if (fsSync2.existsSync(file)) throw new Error(`Course '${id}' already exists`);
    const fields = { code: id.toUpperCase(), description: "", ...COURSE_DEFAULTS };
    const course = { id, title: String(args.title ?? ""), ...fields };
    for (const key of Object.keys(fields)) {
      if (args[key] !== void 0) course[key] = String(args[key]);
    }
    if (!course.title.trim()) throw new Error("title is required");
    await writeJson(file, course);
    return { written: [relative(file)] };
  }
  async function writeLecture(args) {
    const dir = requireCourse(segment("courseId", args.courseId));
    const topicId = segment("topicId", args.topicId);
    const topicDir = path2.join(dir, segment("weekKey", args.weekKey), sectionOf(args.section), topicId);
    if (args.content === void 0 && args.scene === void 0) throw new Error("Provide content, scene, or both");
    const written = [];
    if (args.content !== void 0) {
      assertContent(args.content);
      await writeJson(path2.join(topicDir, "content.json"), args.content);
      written.push(relative(path2.join(topicDir, "content.json")));
    }
    if (args.scene !== void 0) {
      const scene = sceneWithId(args.scene, topicId);
      const check = validateSceneJson(scene);
      if (!check.valid) throw new Error(`Invalid scene: ${check.error}`);
      await writeJson(path2.join(topicDir, "scene.json"), scene);
      written.push(relative(path2.join(topicDir, "scene.json")));
    }
    return { written, next: "Call add_lecture_to_course_list so the lecture gets a proper title and description, then confirm with mcp__studyts-mcp__list_lectures (the database follows about a second after the files while the app server runs)." };
  }
  async function writeVisualLecture(args) {
    const dir = requireCourse(segment("courseId", args.courseId));
    const topicDir = path2.join(dir, segment("weekKey", args.weekKey), sectionOf(args.section), segment("topicId", args.topicId));
    const checked = checkVisualSpecForPublish(args.spec);
    if (!checked.spec || checked.problems.length > 0) throw new Error(`Invalid visual lecture: ${checked.problems.join("; ")}`);
    const file = path2.join(topicDir, "model.json");
    await writeJson(file, checked.spec);
    return { written: [relative(file)], next: "Call add_lecture_to_course_list so the lecture gets a proper title and description, then confirm with mcp__studyts-mcp__list_lectures." };
  }
  async function updateCatalog(args) {
    const dir = requireCourse(segment("courseId", args.courseId));
    const weekKey = segment("weekKey", args.weekKey);
    const section = sectionOf(args.section);
    const lecture = args.lecture ?? {};
    const entry = {
      id: segment("lecture.id", lecture.id),
      title: localized("lecture.title", lecture.title),
      description: localized("lecture.description", lecture.description)
    };
    const catalog = await readCatalog(dir);
    const week = catalog[weekKey] ?? { title: localized("weekTitle", args.weekTitle), lectures: [], practice: [] };
    if (args.weekTitle !== void 0) week.title = localized("weekTitle", args.weekTitle);
    week[section] = [...week[section].filter((e) => e.id !== entry.id), entry];
    catalog[weekKey] = week;
    const check = validateCatalogJson(catalog);
    if (!check.valid) throw new Error(`Invalid catalog: ${check.error}`);
    const file = path2.join(dir, "catalog.json");
    await writeJson(file, catalog);
    return { written: [relative(file)], next: "Confirm with mcp__studyts-mcp__list_lectures that the lecture appears; the database follows about a second later." };
  }
  async function addNetworkDiagram(args) {
    const dir = requireCourse(segment("courseId", args.courseId));
    const topicId = segment("topicId", args.topicId);
    const sceneFile = path2.join(dir, segment("weekKey", args.weekKey), sectionOf(args.section), topicId, "scene.json");
    const compiled = compileTopology(args.topology);
    if ("error" in compiled) throw new Error(compiled.error);
    const scene = fsSync2.existsSync(sceneFile) ? JSON.parse(await fs2.readFile(sceneFile, "utf-8")) : { id: topicId, blocks: [] };
    const blocks = Array.isArray(scene.blocks) ? scene.blocks : [];
    const block = networkBlock(args, compiled, blocks);
    const invalid = validateBlocks([block]);
    if (invalid) throw new Error(`Compiled diagram failed validation: ${invalid}`);
    const next = sceneWithId({ ...scene, blocks: [...blocks, block] }, topicId);
    const check = validateSceneJson(next);
    if (!check.valid) throw new Error(`Invalid scene: ${check.error}`);
    await writeJson(sceneFile, next);
    return { written: [relative(sceneFile)], devices: compiled.state.nodes.length, links: compiled.state.edges.length, merged: compiled.merged };
  }
  return { listCourses, createCourse, writeLecture, writeVisualLecture, updateCatalog, addNetworkDiagram };
}

// server/runtime/appPaths.ts
import fs3 from "fs";
import path3 from "path";
import { fileURLToPath } from "url";
function findPackageRoot(startDir) {
  let dir = startDir;
  while (!fs3.existsSync(path3.join(dir, "package.json"))) {
    const parent = path3.dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
  return dir;
}
var PACKAGE_ROOT = findPackageRoot(path3.dirname(fileURLToPath(import.meta.url)));
var DATA_ROOT = process.env.STUDYTS_HOME ? path3.resolve(process.env.STUDYTS_HOME) : PACKAGE_ROOT;

// server/mcp/servers/studyTsServer.ts
var DATA_DIR = path4.resolve(DATA_ROOT, "data");
var NOTEBOOKS_DIR = path4.resolve(DATA_DIR, "notebooks");
var LOCALIZED = {
  description: "Plain string, or an object with an en text plus any other language codes",
  oneOf: [{ type: "string" }, { type: "object" }]
};
var STUDYTS_TOOLS = [
  // --- Domain 1: Research & Notebooks ---
  {
    name: "save_note_to_notebook",
    description: "Uploads parsed document snippets, notes, or canvas definitions to a user research notebook.",
    inputSchema: {
      type: "object",
      properties: {
        notebookId: { type: "string", description: 'Notebook ID (defaults to "default")' },
        title: { type: "string", description: "Snippet title or heading" },
        content: { type: "string", description: "Markdown / text content or formula" },
        tags: { type: "array", items: { type: "string" }, description: "Optional categorization tags" }
      },
      required: ["title", "content"]
    }
  },
  {
    name: "search_notebook_notes",
    description: "Searches relevant context chunks across saved research notebooks.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term or keyword" },
        limit: { type: "number", description: "Maximum snippets to return (default 5)" }
      },
      required: ["query"]
    }
  },
  {
    name: "list_notebooks",
    description: "Lists all available notebook repositories and snippet counts.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  // --- Domain 2: SQLite Course Database ---
  ...SQLITE_TOOLS,
  // --- Domain 3: Course Authoring & Content ---
  {
    name: "list_courses",
    description: "Lists existing courses and, per week, the lecture ids already in each catalog.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "create_course",
    description: "Creates data/<id>/course.json for a new course. Fails if the course exists.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Lowercase kebab-case course id, e.g. computer-networking" },
        title: { type: "string" },
        code: { type: "string", description: "Course code, e.g. CS-305" },
        subtitle: { type: "string" },
        description: { type: "string" },
        icon: { type: "string", description: "lucide icon name" },
        color: { type: "string" },
        accent: { type: "string" },
        badge: { type: "string" }
      },
      required: ["id", "title"]
    }
  },
  {
    name: "save_lecture_content",
    description: "Writes content.json (array of {title, concept, whatChanged, why}) and/or scene.json (canvas scene with id, blocks, pages) for one lecture. Both are validated before saving; the running server reseeds automatically. For a UML/flow/ER/state diagram in an existing canvas prefer the app tool generate_uml_diagram over hand-writing graph nodes here; to change one block of an open canvas use apply_scene_ops. A canvas page is A4 (794x1123): content that does not fit goes on the NEXT page in `pages`, never squeezed in; move a block there later with the app tool apply_scene_ops moveBlockToPage.",
    inputSchema: {
      type: "object",
      properties: {
        courseId: { type: "string" },
        weekKey: { type: "string", description: "e.g. week-1" },
        topicId: { type: "string", description: "Lecture folder id, lowercase kebab-case" },
        section: { type: "string", enum: ["lectures", "practice"], description: "Defaults to 'lectures'" },
        content: { type: "array", items: { type: "object" } },
        scene: { type: "object" }
      },
      required: ["courseId", "weekKey", "topicId"]
    }
  },
  {
    name: "add_lecture_to_course_list",
    description: "Adds or replaces one lecture entry (id, title, description) in a course catalog.json. weekTitle is required when the week is new.",
    inputSchema: {
      type: "object",
      properties: {
        courseId: { type: "string" },
        weekKey: { type: "string" },
        weekTitle: LOCALIZED,
        section: { type: "string", enum: ["lectures", "practice"] },
        lecture: {
          type: "object",
          properties: { id: { type: "string" }, title: LOCALIZED, description: LOCALIZED },
          required: ["id", "title", "description"]
        }
      },
      required: ["courseId", "weekKey", "lecture"]
    }
  },
  {
    name: "save_animated_lecture",
    description: "Writes model.json for a step-player lecture: a VisualSpec {id, viewBox, elements, steps}. Element kinds: circle, ellipse, rect, path (absolute M/L commands), text, math (LaTeX label in a foreignObject), bubble (speech box). Colours are theme tokens such as var(--viz-blue), var(--accent-green), var(--accent). Each step has whatChanged, why and tweens [{targets, params, at?}]; params are numbers or strings (opacity, translateX, translateY, strokeDashoffset, duration, ease). Keep text boxes clear of shape outlines and lines and inside the viewBox; a step may show a bubble-N (all bubble-N share one slot, fade the old one out and the next in). The spec is validated and layout-checked before saving; fix the listed problems and call again.",
    inputSchema: {
      type: "object",
      properties: {
        courseId: { type: "string" },
        weekKey: { type: "string" },
        topicId: { type: "string", description: "Lecture folder id" },
        section: { type: "string", enum: ["lectures", "practice"] },
        spec: { type: "object", description: "The VisualSpec" }
      },
      required: ["courseId", "weekKey", "topicId", "spec"]
    }
  },
  {
    name: "add_network_diagram_to_lecture",
    description: "Adds a network diagram to a lecture scene.json as ONE graph block, drawn with real device icons (router, switch, firewall, server, pc, cloud, hub, database) and optional zone frames (LAN, DMZ, Internet). Describe it as devices, links and zones; never repeat a device. The same id, or the same type and label, is one device, so put extra text (an IP, an interface) on the link label, not in a second device. It is appended under the existing blocks of the scene; a page is A4, so when the diagram does not fit, put it on a following page (add a page to `pages`) instead of shrinking it.",
    inputSchema: {
      type: "object",
      properties: {
        courseId: { type: "string" },
        weekKey: { type: "string" },
        topicId: { type: "string", description: "Lecture folder id" },
        section: { type: "string", enum: ["lectures", "practice"] },
        topology: {
          type: "object",
          properties: {
            devices: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Unique, e.g. r1" },
                  type: { type: "string", enum: ["router", "switch", "firewall", "server", "pc", "cloud", "hub", "database"] },
                  label: { type: "string", description: "Shown under the icon; defaults to id" },
                  zone: { type: "string", description: "Zone id this device sits in" }
                },
                required: ["id", "type"]
              }
            },
            links: {
              type: "array",
              items: {
                type: "object",
                properties: { from: { type: "string" }, to: { type: "string" }, label: { type: "string" } },
                required: ["from", "to"]
              }
            },
            zones: {
              type: "array",
              items: {
                type: "object",
                properties: { id: { type: "string" }, label: { type: "string" } },
                required: ["id"]
              }
            }
          },
          required: ["devices"]
        },
        blockId: { type: "string" },
        x: { type: "number" },
        y: { type: "number" }
      },
      required: ["courseId", "weekKey", "topicId", "topology"]
    }
  }
];
var StudyTsServer = class extends BaseMcpServer {
  serverName = "StudyTs-MCP";
  serverVersion = "1.0.0";
  tools = STUDYTS_TOOLS;
  notebooks = createNotebookTools(NOTEBOOKS_DIR);
  sqlite = createSqliteTools(new PrismaClient2());
  author = createCourseAuthorTools(DATA_DIR);
  handlers = {
    // Notebooks
    save_note_to_notebook: (args) => this.notebooks.sendSnippet(args),
    search_notebook_notes: (args) => this.notebooks.querySources(args),
    list_notebooks: () => this.notebooks.listNotebooks(),
    // SQLite
    read_course_database: (args) => this.sqlite.queryCourseDb(args),
    show_database_tables: () => this.sqlite.describeDbSchema(),
    list_lectures: (args) => this.sqlite.listTopics(args),
    // Course Authoring
    list_courses: () => this.author.listCourses(),
    create_course: (args) => this.author.createCourse(args),
    save_lecture_content: (args) => this.author.writeLecture(args),
    add_lecture_to_course_list: (args) => this.author.updateCatalog(args),
    save_animated_lecture: (args) => this.author.writeVisualLecture(args),
    add_network_diagram_to_lecture: (args) => this.author.addNetworkDiagram(args)
  };
  async handleToolCall(name, args) {
    const handler = this.handlers[name];
    if (!handler) {
      throw new Error(`Unknown tool '${name}'`);
    }
    return handler(args);
  }
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  new StudyTsServer().start();
}
export {
  STUDYTS_TOOLS,
  StudyTsServer
};
