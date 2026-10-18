// server/index.ts
import express3 from "express";
import cors from "cors";
import crypto7 from "crypto";
import path18 from "path";
import fs12 from "fs";
import { PrismaClient as PrismaClient5 } from "@prisma/client";

// server/routes/index.ts
import { Router as Router20 } from "express";

// server/routes/registry.ts
import { Router } from "express";
import { Prisma } from "@prisma/client";

// server/utils/routeHandler.ts
var route = (fn) => {
  return (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// server/cache/cacheService.ts
import net from "net";

// server/utils/log.ts
import fs4 from "fs";
import path5 from "path";

// src/core/shared/redact.ts
var SENSITIVE_KEY_RE = /apikey|api_key|authorization|token|secret|password|bearer/i;
function redact(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  const result = {};
  for (const [k, v] of Object.entries(value)) {
    result[k] = SENSITIVE_KEY_RE.test(k) ? "[REDACTED]" : redact(v);
  }
  return result;
}

// server/logging/logConfig.ts
import path2 from "path";

// server/runtime/appPaths.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
function findPackageRoot(startDir) {
  let dir = startDir;
  while (!fs.existsSync(path.join(dir, "package.json"))) {
    const parent = path.dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
  return dir;
}
var PACKAGE_ROOT = findPackageRoot(path.dirname(fileURLToPath(import.meta.url)));
var DATA_ROOT = process.env.STUDYTS_HOME ? path.resolve(process.env.STUDYTS_HOME) : PACKAGE_ROOT;

// server/logging/logConfig.ts
var LOG_LIMITS = {
  maxRunLogs: 10,
  maxRuntimeErrors: 10,
  maxCrashLogs: 20,
  maxClientReportBytes: 16 * 1024,
  maxFieldChars: 2e3,
  clientReportsPerMinute: 30
};
var LOG_FILE_PREFIX = { run: "run-", crash: "crash-", digest: "runtime-errors" };
function resolveLogDir(env = process.env, cwd = DATA_ROOT) {
  return path2.resolve(env.STUDYTS_LOG_DIR ?? path2.join(cwd, ".logs"));
}
function makeRunId(now = /* @__PURE__ */ new Date(), pid = process.pid) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace("T", "-").replace(".", "-").replace("Z", "");
  return `${stamp}-p${pid}`;
}

// server/logging/rotation.ts
import fs2 from "fs";
import path3 from "path";
function mtimeOrZero(file) {
  try {
    return fs2.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}
function listCandidates(dir, prefix) {
  let names;
  try {
    names = fs2.readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter((name) => name.startsWith(prefix)).map((name) => ({ name, mtimeMs: mtimeOrZero(path3.join(dir, name)) }));
}
function byAge(a, b) {
  return a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name);
}
function pruneOldestFiles(dir, prefix, keep) {
  const result = { deleted: [], failed: [] };
  const sorted = listCandidates(dir, prefix).sort(byAge);
  const excess = sorted.slice(0, Math.max(0, sorted.length - Math.max(0, keep)));
  for (const { name } of excess) {
    try {
      fs2.unlinkSync(path3.join(dir, name));
      result.deleted.push(name);
    } catch (err) {
      result.failed.push({ name, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

// server/logging/serialWriter.ts
import fs3 from "fs";
import { appendFile, writeFile, rename } from "fs/promises";
var queues = /* @__PURE__ */ new Map();
var failureHandler = (file, err) => {
  process.stderr.write(`[logging] could not write ${file}: ${err instanceof Error ? err.message : String(err)}
`);
};
function onWriteFailure(handler) {
  failureHandler = handler;
}
function enqueue(file, job) {
  const previous = queues.get(file) ?? Promise.resolve();
  const next = previous.then(job).catch((err) => failureHandler(file, err));
  queues.set(file, next);
  void next.then(() => {
    if (queues.get(file) === next) queues.delete(file);
  });
  return next;
}
function appendSerial(file, text) {
  return enqueue(file, () => appendFile(file, text, "utf8"));
}
function rewriteAtomic(file, text) {
  return enqueue(file, async () => {
    const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tmp, text, "utf8");
    await rename(tmp, file);
  });
}
function appendSync(file, text) {
  fs3.appendFileSync(file, text, "utf8");
}

// server/logging/runtimeErrorDigest.ts
import { readFile } from "fs/promises";
import path4 from "path";
var ENTRY_SEPARATOR = "\n\n";
var pending = /* @__PURE__ */ new Map();
async function readEntries(file) {
  try {
    const text = await readFile(file, "utf8");
    return text.split(ENTRY_SEPARATOR).map((entry) => entry.trim()).filter((entry) => entry.startsWith("run: "));
  } catch {
    return [];
  }
}
function recordRuntimeError(opts) {
  const file = path4.join(opts.logDir, `${LOG_FILE_PREFIX.digest}.log`);
  const keep = opts.keep ?? LOG_LIMITS.maxRuntimeErrors;
  const previous = pending.get(file) ?? Promise.resolve();
  const next = previous.then(async () => {
    const entries = await readEntries(file);
    entries.push(`run: ${opts.runId}
${opts.block.trim()}`);
    await rewriteAtomic(file, entries.slice(-keep).join(ENTRY_SEPARATOR) + "\n");
  });
  pending.set(
    file,
    next.catch(() => void 0)
  );
  return next;
}

// server/utils/log.ts
var LOG_DIR = resolveLogDir();
var CRASH_DIR = path5.join(LOG_DIR, "crashes");
var RUN_ID = makeRunId();
var RUN_LOG = path5.join(LOG_DIR, `${LOG_FILE_PREFIX.run}${RUN_ID}.log`);
function reportFailure(what, detail) {
  process.stderr.write(`[logging] ${what}: ${detail}
`);
}
function startRun() {
  try {
    fs4.mkdirSync(CRASH_DIR, { recursive: true });
  } catch (err) {
    reportFailure(
      "log directory unavailable, file logging disabled",
      err instanceof Error ? err.message : String(err)
    );
    return;
  }
  const run = pruneOldestFiles(LOG_DIR, LOG_FILE_PREFIX.run, LOG_LIMITS.maxRunLogs - 1);
  for (const f of run.failed) {
    reportFailure(`could not delete old log ${f.name}`, f.reason);
  }
}
startRun();
onWriteFailure(
  (file, err) => reportFailure(`could not write ${path5.basename(file)}`, err instanceof Error ? err.message : String(err))
);
function consoleMethodFor(level) {
  if (level === "error" || level === "fatal") return console.error;
  if (level === "warn") return console.warn;
  if (level === "debug") return console.debug;
  return console.log;
}
var LEVEL_LABEL = {
  debug: "DEBUG",
  info: "OK   ",
  warn: "WARN ",
  error: "ERROR",
  fatal: "CRASH"
};
function formatValue(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
function describeError(err) {
  if (!(err instanceof Error)) return [`    cause: ${String(err)}`];
  const code = err.code;
  const stack = (err.stack ?? "").split("\n").slice(1).map((line) => `      ${line.trim()}`);
  return [`    cause: ${err.name}: ${err.message}${code ? ` (${code})` : ""}`, ...stack];
}
function formatReadable(ts, level, msg, fields, err) {
  const when = ts.slice(0, 19).replace("T", " ");
  const lines = [`${when}  ${LEVEL_LABEL[level]}  ${msg}`];
  const safe = fields ? redact(fields) : {};
  for (const [key, value] of Object.entries(safe)) {
    lines.push(`    ${key}: ${formatValue(value)}`);
  }
  if (err) {
    lines.push(...describeError(err));
  }
  return lines.join("\n");
}
function output(level, msg, fields, err, _options) {
  const ts = (/* @__PURE__ */ new Date()).toISOString();
  const text = formatReadable(ts, level, msg, fields, err);
  const showOnConsole = level === "error" || level === "fatal" || process.env.STUDYTS_VERBOSE_LOGS === "1";
  if (showOnConsole) {
    consoleMethodFor(level)(text);
  }
  void appendSerial(RUN_LOG, text + "\n");
  if (level === "error" || level === "fatal") {
    void recordRuntimeError({ logDir: LOG_DIR, runId: RUN_ID, block: text });
  }
}
var crashSeq = 0;
function formatCrashReport(crashId, origin, error) {
  const isError = error instanceof Error;
  const code = isError ? error.code : void 0;
  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  return [
    `CRASH REPORT ${crashId}`,
    `When:    ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")}`,
    `Where:   ${origin}`,
    `What:    ${isError ? `${error.name}: ${error.message}` : String(error)}${code ? ` (${code})` : ""}`,
    `Process: pid ${process.pid}, up ${Math.round(process.uptime())}s, ${rssMb} MB, node ${process.version} ${process.platform}`,
    "",
    "Stack:",
    ...isError ? (error.stack ?? "").split("\n").slice(1).map((line) => `  ${line.trim()}`) : ["  (not an Error, no stack)"],
    ""
  ].join("\n");
}
function writeCrashReport(error, origin) {
  const crashId = `${LOG_FILE_PREFIX.crash}${Date.now()}-${String(crashSeq++).padStart(6, "0")}`;
  const crashFile = path5.join(CRASH_DIR, `${crashId}.txt`);
  try {
    appendSync(crashFile, formatCrashReport(crashId, origin, error));
    const result = pruneOldestFiles(CRASH_DIR, LOG_FILE_PREFIX.crash, LOG_LIMITS.maxCrashLogs);
    for (const f of result.failed) {
      reportFailure(`could not delete old crash ${f.name}`, f.reason);
    }
    output("fatal", `Process crash recorded in ${crashFile}`, { crashId, origin }, error);
  } catch (err) {
    reportFailure(
      `failed to write crash report ${path5.basename(crashFile)}`,
      err instanceof Error ? err.message : String(err)
    );
    output("fatal", `Failed to write crash report for ${origin}`, { crashId }, error);
  }
  return crashFile;
}
var handlersInstalled = false;
var shutdownHook = null;
function handleUncaught(err, origin) {
  const reportPath = writeCrashReport(err, `uncaughtException: ${origin}`);
  process.stderr.write(`[FATAL CRASH] Uncaught exception logged to ${reportPath}
`);
  if (process.env.EXIT_ON_UNCAUGHT !== "1") return;
  void (shutdownHook ? shutdownHook() : Promise.resolve()).catch(() => void 0).finally(() => process.exit(1));
}
function setupProcessCrashHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;
  process.on("uncaughtException", handleUncaught);
  process.on("unhandledRejection", (reason) => {
    writeCrashReport(reason, "unhandledRejection");
    output("error", "Unhandled promise rejection intercepted", void 0, reason);
  });
}
var log = {
  runId: RUN_ID,
  logDir: LOG_DIR,
  debug: (msg, fields) => output("debug", msg, fields),
  info: (msg, fields, options) => output("info", msg, fields, void 0, options),
  warn: (msg, fields) => output("warn", msg, fields),
  error: (msg, fields, err) => output("error", msg, fields, err),
  fatal: (msg, fields, err) => output("fatal", msg, fields, err),
  crash: (err, origin = "runtime") => writeCrashReport(err, origin),
  initCrashHandlers: () => setupProcessCrashHandlers(),
  setShutdownHook: (fn) => {
    shutdownHook = fn;
  }
};

// server/cache/cacheService.ts
var InMemoryCacheAdapter = class {
  type = "memory";
  store = /* @__PURE__ */ new Map();
  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
  async set(key, value, ttlSeconds = 60) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1e3
    });
  }
  async delete(key) {
    this.store.delete(key);
  }
  async clear() {
    this.store.clear();
  }
};
var RedisCacheAdapter = class {
  type = "redis";
  host;
  port;
  isConnected = false;
  inMemoryFallback = new InMemoryCacheAdapter();
  get isReady() {
    return this.isConnected;
  }
  constructor(redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379") {
    try {
      const url = new URL(redisUrl);
      this.host = url.hostname || "127.0.0.1";
      this.port = Number(url.port) || 6379;
    } catch {
      this.host = "127.0.0.1";
      this.port = 6379;
    }
  }
  sendCommand(command) {
    return new Promise((resolve3) => {
      const socket = net.createConnection({ host: this.host, port: this.port, timeout: 500 });
      let response = "";
      socket.on("connect", () => {
        this.isConnected = true;
        let resp = `*${command.length}\r
`;
        for (const arg of command) {
          const str = String(arg);
          resp += `$${Buffer.byteLength(str, "utf8")}\r
${str}\r
`;
        }
        socket.write(resp);
      });
      socket.on("data", (chunk) => {
        response += chunk.toString("utf8");
        socket.end();
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve3(null);
      });
      socket.on("error", () => {
        this.isConnected = false;
        resolve3(null);
      });
      socket.on("close", () => {
        if (!response) {
          resolve3(null);
          return;
        }
        if (response.startsWith("+") || response.startsWith(":")) {
          resolve3(response.slice(1).trim());
        } else if (response.startsWith("$")) {
          const lines = response.split("\r\n");
          const length = Number(lines[0].slice(1));
          if (length === -1) {
            resolve3(null);
          } else {
            resolve3(lines[1] || null);
          }
        } else {
          resolve3(null);
        }
      });
    });
  }
  async get(key) {
    try {
      const raw = await this.sendCommand(["GET", key]);
      if (raw !== null) {
        return JSON.parse(raw);
      }
    } catch {
    }
    return this.inMemoryFallback.get(key);
  }
  async set(key, value, ttlSeconds = 60) {
    const json = JSON.stringify(value);
    try {
      await this.sendCommand(["SETEX", key, String(ttlSeconds), json]);
    } catch {
    }
    await this.inMemoryFallback.set(key, value, ttlSeconds);
  }
  async delete(key) {
    try {
      await this.sendCommand(["DEL", key]);
    } catch {
    }
    await this.inMemoryFallback.delete(key);
  }
  async clear() {
    try {
      await this.sendCommand(["FLUSHDB"]);
    } catch {
    }
    await this.inMemoryFallback.clear();
  }
};
var CacheService = class {
  adapter;
  constructor() {
    if (process.env.REDIS_URL) {
      log.info(`Connecting to Redis cache at ${process.env.REDIS_URL}`);
      this.adapter = new RedisCacheAdapter(process.env.REDIS_URL);
    } else {
      this.adapter = new InMemoryCacheAdapter();
    }
  }
  async get(key) {
    return this.adapter.get(key);
  }
  async set(key, value, ttlSeconds = 60) {
    return this.adapter.set(key, value, ttlSeconds);
  }
  async delete(key) {
    return this.adapter.delete(key);
  }
  async clear() {
    return this.adapter.clear();
  }
};
var cacheService = new CacheService();

// server/utils/registryCache.ts
var localMemoryCache = null;
var cacheTimestamp = 0;
var generation = 0;
var CACHE_TTL_MS = 6e4;
function registryGeneration() {
  return generation;
}
function getCachedRegistry() {
  if (localMemoryCache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return localMemoryCache;
  }
  return null;
}
function setCachedRegistry(data, readGeneration) {
  if (readGeneration !== void 0 && readGeneration !== generation) return;
  localMemoryCache = data;
  cacheTimestamp = Date.now();
  cacheService.set("course_registry_raw", data, 120).catch(() => {
  });
}
function invalidateRegistryCache() {
  generation++;
  localMemoryCache = null;
  cacheTimestamp = 0;
  return cacheService.clear().catch(() => {
  });
}

// server/routes/topicOrder.ts
var bySectionOrder = [{ position: "asc" }, { id: "asc" }];
function targetIndex(move2, from) {
  if (move2.direction === "up") return from - 1;
  if (move2.direction === "down") return from + 1;
  if (typeof move2.toIndex === "number" && Number.isInteger(move2.toIndex)) return move2.toIndex;
  return null;
}
async function moveTopicInSection(prisma3, weekId, section, topicId, move2) {
  const rows = await prisma3.topic.findMany({ where: { weekId, section }, orderBy: [...bySectionOrder], select: { id: true, topicId: true } });
  const from = rows.findIndex((row) => row.topicId === topicId);
  if (from < 0) return { error: `Topic '${topicId}' not found`, status: 404 };
  const to = targetIndex(move2, from);
  if (to === null) return { error: "move needs direction 'up'|'down' or an integer toIndex", status: 400 };
  if (to < 0 || to >= rows.length) return { error: `Cannot move '${topicId}' to position ${to}`, status: 400 };
  const [moved] = rows.splice(from, 1);
  rows.splice(to, 0, moved);
  await prisma3.$transaction(rows.map((row, position) => prisma3.topic.update({ where: { id: row.id }, data: { position } })));
  return { order: rows.map((row) => row.topicId) };
}

// src/core/shared/languageDefaults.ts
var FALLBACK_LANGUAGE = "en";
var DEFAULT_LANGUAGE = "en";
var BUILT_IN_LANGUAGE_CODES = ["he", "en"];
var LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(-[A-Z]{2})?$/;

// server/utils/i18nHelper.ts
var LANGUAGE_ALIASES = { iw: "he" };
var requestedLanguages = new Set(BUILT_IN_LANGUAGE_CODES);
function knownContentLanguages() {
  return [...requestedLanguages];
}
function languageFromAcceptHeader(header2) {
  const codes = header2.split(",").map((part) => part.split(";")[0].trim().split("-")[0].toLowerCase());
  const resolved = codes.map((code) => LANGUAGE_ALIASES[code] ?? code);
  return resolved.find((code) => LANGUAGE_CODE_PATTERN.test(code));
}
function remember(lang) {
  requestedLanguages.add(lang);
  return lang;
}
function resolveLangFromRequest(req) {
  const queryLang = req.query.lang;
  if (typeof queryLang === "string" && LANGUAGE_CODE_PATTERN.test(queryLang)) return remember(queryLang);
  const acceptLang = req.headers["accept-language"];
  const fromHeader = typeof acceptLang === "string" ? languageFromAcceptHeader(acceptLang) : void 0;
  return remember(fromHeader ?? DEFAULT_LANGUAGE);
}
function isBilingualObject(val) {
  if (!val || typeof val !== "object" || Array.isArray(val)) return false;
  const obj = val;
  const values = Object.values(obj);
  return typeof obj[FALLBACK_LANGUAGE] === "string" && values.length > 1 && values.every((v) => typeof v === "string");
}
function resolveServerText(val, lang = DEFAULT_LANGUAGE) {
  if (typeof val === "string") return val;
  if (!val || typeof val !== "object" || Array.isArray(val)) return "";
  const obj = val;
  const keys = [lang, FALLBACK_LANGUAGE, ...Object.keys(obj)];
  const found = keys.find((key) => typeof obj[key] === "string" && obj[key] !== "");
  return found ? obj[found] : "";
}
function localizePayload(payload, lang) {
  if (payload === null || payload === void 0) return payload;
  if (isBilingualObject(payload)) {
    return resolveServerText(payload, lang);
  }
  if (Array.isArray(payload)) {
    return payload.map((item) => localizePayload(item, lang));
  }
  if (typeof payload === "object") {
    const result = {};
    for (const [key, value] of Object.entries(payload)) {
      result[key] = localizePayload(value, lang);
    }
    return result;
  }
  return payload;
}

// server/routes/registry.ts
var registryRouter = Router();
registryRouter.get("/registry", route(async (req, res) => {
  const isResolved = req.query.resolve === "true" || Boolean(req.query.lang);
  const lang = resolveLangFromRequest(req);
  const cacheKey = `course_registry_${isResolved ? lang : "raw"}`;
  if (!isResolved) {
    const memoryHit = getCachedRegistry();
    if (memoryHit) return void res.json(memoryHit);
  }
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return void res.json(cached);
  }
  const readGeneration = registryGeneration();
  const prisma3 = req.prisma;
  const courses = await prisma3.course.findMany({
    include: {
      // Creation order: without it SQLite returns rows by its unique index (alphabetical), which put new sections first.
      weeks: {
        orderBy: { id: "asc" },
        include: {
          topics: {
            orderBy: [...bySectionOrder],
            select: {
              topicId: true,
              title: true,
              description: true,
              section: true,
              attachments: true
            }
          }
        }
      }
    }
  });
  const canvasTopics = await prisma3.topic.findMany({
    where: { NOT: { scene: { equals: Prisma.AnyNull } } },
    select: { weekId: true, section: true, topicId: true }
  });
  const canvasKeys = new Set(canvasTopics.map((t) => `${t.weekId}/${t.section}/${t.topicId}`));
  const fileTopics = await prisma3.topic.findMany({
    where: { NOT: { attachments: { equals: Prisma.AnyNull } } },
    select: { weekId: true, section: true, topicId: true }
  });
  const fileKeys = new Set(fileTopics.map((t) => `${t.weekId}/${t.section}/${t.topicId}`));
  const kindOf = (weekId, section, topicId) => {
    const key = `${weekId}/${section}/${topicId}`;
    if (canvasKeys.has(key)) return "canvas";
    return fileKeys.has(key) ? "file" : "stepPlayer";
  };
  const rawRegistry = {};
  for (const course of courses) {
    const catalog = {};
    for (const week of course.weeks) {
      const lectures = week.topics.filter((t) => t.section === "lectures").map((t) => {
        const item = t;
        return {
          id: t.topicId,
          title: t.title,
          description: t.description,
          ...item.attachments ? { attachments: item.attachments } : {},
          contentUrl: `/api/content/${course.id}/${week.weekKey}/lectures/${t.topicId}`,
          kind: kindOf(week.id, "lectures", t.topicId)
        };
      });
      const practice = week.topics.filter((t) => t.section === "practice").map((t) => {
        const item = t;
        return {
          id: t.topicId,
          title: t.title,
          description: t.description,
          ...item.attachments ? { attachments: item.attachments } : {},
          contentUrl: `/api/content/${course.id}/${week.weekKey}/practice/${t.topicId}`,
          kind: kindOf(week.id, "practice", t.topicId)
        };
      });
      catalog[week.weekKey] = {
        title: week.title,
        lectures,
        practice
      };
    }
    rawRegistry[course.id] = {
      id: course.id,
      code: course.code,
      title: course.title,
      subtitle: course.subtitle,
      description: course.description,
      icon: course.icon,
      color: course.color,
      accent: course.accent,
      badge: course.badge,
      catalog
    };
  }
  setCachedRegistry(rawRegistry, readGeneration);
  if (isResolved) {
    const localized = localizePayload(rawRegistry, lang);
    if (readGeneration === registryGeneration()) await cacheService.set(cacheKey, localized, 120);
    return void res.json(localized);
  }
  res.json(rawRegistry);
}));

// server/routes/content.ts
import { Router as Router2 } from "express";
var contentRouter = Router2();
contentRouter.get("/content/:courseId/:weekKey/:section/:topicId", route(async (req, res) => {
  const { courseId, weekKey, section, topicId } = req.params;
  const isResolved = req.query.resolve === "true" || Boolean(req.query.lang);
  const lang = resolveLangFromRequest(req);
  const cacheKey = `content_${courseId}_${weekKey}_${section}_${topicId}_${isResolved ? lang : "raw"}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return void res.json(cached);
  }
  const prisma3 = req.prisma;
  const week = await prisma3.week.findUnique({
    where: { courseId_weekKey: { courseId, weekKey } }
  });
  if (!week) {
    return void res.status(404).json({ error: "Week not found" });
  }
  const topic = await prisma3.topic.findUnique({
    where: { weekId_section_topicId: { weekId: week.id, section, topicId } }
  });
  if (!topic) {
    return void res.status(404).json({ error: "Topic not found" });
  }
  const scene = topic.scene ? { ...topic.scene, id: topic.topicId } : null;
  const rawPayload = {
    id: topic.topicId,
    title: topic.title,
    description: topic.description,
    scene,
    model: topic.model ?? null,
    content: topic.content ?? null,
    attachments: topic.attachments
  };
  await cacheService.set(`content_${courseId}_${weekKey}_${section}_${topicId}_raw`, rawPayload, 120);
  if (isResolved) {
    const localized = localizePayload(rawPayload, lang);
    await cacheService.set(cacheKey, localized, 120);
    return void res.json(localized);
  }
  res.json(rawPayload);
}));

// server/routes/courses.ts
import { Router as Router3 } from "express";

// server/routes/topicCrud.ts
import { Prisma as Prisma2 } from "@prisma/client";

// server/utils/fileSync.ts
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { join, dirname, resolve } from "path";
import { createHash } from "crypto";
var ROOT = DATA_ROOT;
var DATA_DIR = join(ROOT, "data");
function ensureDir(p) {
  const d = dirname(p);
  if (!existsSync(d)) {
    mkdirSync(d, { recursive: true });
  }
}
var ownWrites = /* @__PURE__ */ new Map();
var sha1 = (text) => createHash("sha1").update(text).digest("hex");
function writeTracked(path19, content) {
  writeFileSync(path19, content);
  ownWrites.set(resolve(path19), sha1(content));
}
function isOwnWrite(path19) {
  const expected = ownWrites.get(resolve(path19));
  if (!expected) return false;
  try {
    return sha1(readFileSync(path19, "utf8")) === expected;
  } catch {
    return false;
  }
}
function toJson(obj) {
  return JSON.stringify(obj, null, 2);
}
async function syncCourseToFile(prisma3, courseId) {
  const course = await prisma3.course.findUnique({
    where: { id: courseId },
    include: { weeks: { orderBy: { id: "asc" }, include: { topics: { orderBy: [{ position: "asc" }, { id: "asc" }] } } } }
  });
  if (!course) return;
  const catalogPath = join(DATA_DIR, courseId, "catalog.json");
  const weeks = {};
  for (const week of course.weeks) {
    weeks[week.weekKey] = {
      title: week.title,
      lectures: week.topics.filter((t) => t.section === "lectures").map((t) => ({
        id: t.topicId,
        title: t.title,
        description: t.description,
        ...t.attachments ? { attachments: t.attachments } : {}
      })),
      practice: week.topics.filter((t) => t.section === "practice").map((t) => ({
        id: t.topicId,
        title: t.title,
        description: t.description,
        ...t.attachments ? { attachments: t.attachments } : {}
      }))
    };
  }
  ensureDir(catalogPath);
  writeTracked(catalogPath, toJson(weeks));
}
async function syncTopicToFiles(prisma3, topicId) {
  const topic = await prisma3.topic.findUnique({
    where: { id: topicId },
    include: { week: { include: { course: true } } }
  });
  if (!topic) return;
  const { week, section, topicId: tId } = topic;
  const baseDir = join(DATA_DIR, week.courseId, week.weekKey, section, tId);
  if (topic.scene) {
    const scenePath = join(baseDir, "scene.json");
    ensureDir(scenePath);
    writeTracked(scenePath, toJson(topic.scene));
  }
  if (topic.model) {
    const modelPath = join(baseDir, "model.json");
    ensureDir(modelPath);
    writeTracked(modelPath, toJson(topic.model));
  }
  if (topic.content) {
    const contentPath = join(baseDir, "content.json");
    ensureDir(contentPath);
    writeTracked(contentPath, toJson(topic.content));
  }
}
function removeCourseFiles(courseId) {
  const courseDir = join(DATA_DIR, courseId);
  if (existsSync(courseDir)) {
    rmSync(courseDir, { recursive: true, force: true });
  }
}
function removeWeekFiles(courseId, weekKey) {
  const weekDir = join(DATA_DIR, courseId, weekKey);
  if (existsSync(weekDir)) {
    rmSync(weekDir, { recursive: true, force: true });
  }
}
function removeTopicFiles(courseId, weekKey, section, topicId) {
  const topicDir = join(DATA_DIR, courseId, weekKey, section, topicId);
  if (existsSync(topicDir)) {
    rmSync(topicDir, { recursive: true, force: true });
  }
}

// src/core/shared/topicAttachment.ts
var TOPIC_ATTACHMENT_TYPES = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt", "md"];
function isAttachmentRecord(value) {
  if (typeof value !== "object" || value === null) return false;
  const item = value;
  return typeof item.id === "string" && typeof item.name === "string" && TOPIC_ATTACHMENT_TYPES.includes(item.type) && typeof item.filePath === "string" && typeof item.uploadedAt === "string" && typeof item.sizeBytes === "number";
}
function isTopicAttachmentList(value) {
  return Array.isArray(value) && value.every(isAttachmentRecord);
}

// server/routes/topicCrud.ts
function sceneIdWhere(sceneId) {
  return {
    OR: [
      { topicId: sceneId },
      { scene: { path: "id", equals: sceneId } }
    ]
  };
}
function topicOrIdWhere(targetId) {
  const base = sceneIdWhere(targetId);
  const numericId = Number(targetId);
  if (Number.isInteger(numericId) && numericId > 0) {
    return { OR: [...base.OR, { id: numericId }] };
  }
  return base;
}
async function createTopic(prisma3, weekId, courseId, section, topic, res) {
  const existing = await prisma3.topic.findUnique({
    where: { weekId_section_topicId: { weekId, section, topicId: topic.id } }
  });
  if (existing) return void res.status(400).json({ error: `Topic '${topic.id}' already exists` });
  const contentType = topic.contentType === "stepPlayer" || topic.contentType === "file" ? topic.contentType : "canvas";
  const emptyScene = {
    id: topic.id,
    title: topic.title || { en: topic.id },
    canvasSize: { width: 794, height: 1123 },
    pageSize: "A4",
    blocks: []
  };
  const created = await prisma3.topic.create({
    data: {
      weekId,
      section,
      topicId: topic.id,
      position: await prisma3.topic.count({ where: { weekId, section } }),
      title: topic.title || { en: topic.id },
      description: topic.description || { en: "" },
      scene: contentType === "canvas" ? emptyScene : Prisma2.JsonNull,
      content: Prisma2.JsonNull,
      model: Prisma2.JsonNull,
      attachments: contentType === "file" ? [] : Prisma2.JsonNull
    }
  });
  await syncTopicToFiles(prisma3, created.id);
  await syncCourseToFile(prisma3, courseId);
  invalidateRegistryCache();
  res.json({ updatedId: created.topicId });
}
async function updateTopic(prisma3, weekId, courseId, section, topic, res) {
  const { id: topicId, ...fields } = topic;
  if (fields.attachments !== void 0 && !isTopicAttachmentList(fields.attachments)) {
    return void res.status(400).json({ error: "attachments must be a list of attachment records" });
  }
  const updated = await prisma3.topic.update({
    where: { weekId_section_topicId: { weekId, section, topicId } },
    data: {
      ...fields.title && { title: fields.title },
      ...fields.description && { description: fields.description },
      ...fields.attachments !== void 0 && { attachments: fields.attachments }
    }
  });
  await syncTopicToFiles(prisma3, updated.id);
  await syncCourseToFile(prisma3, courseId);
  invalidateRegistryCache();
  res.json({ updatedId: updated.topicId });
}
async function deleteTopic(prisma3, weekId, courseId, weekKey, section, topicId, res) {
  const topicRecord = await prisma3.topic.findUnique({
    where: { weekId_section_topicId: { weekId, section, topicId } }
  });
  if (!topicRecord) return void res.status(404).json({ error: `Topic '${topicId}' not found` });
  await prisma3.topic.delete({
    where: { weekId_section_topicId: { weekId, section, topicId } }
  });
  removeTopicFiles(courseId, weekKey, section, topicId);
  invalidateRegistryCache();
  res.json({ updatedId: topicId });
}
async function moveTopic(prisma3, weekId, courseId, section, topic, res) {
  const result = await moveTopicInSection(prisma3, weekId, section, topic.id, topic);
  if ("error" in result) return void res.status(result.status).json({ error: result.error });
  await syncCourseToFile(prisma3, courseId);
  invalidateRegistryCache();
  res.json({ updatedId: topic.id, order: result.order });
}
function isValidTopicPayload(courseId, weekKey, section, topicId) {
  return Boolean(courseId && weekKey && section && topicId);
}
async function handleTopicCrud(req, res) {
  const prisma3 = req.prisma;
  const { courseId, weekKey, section, action, topic } = req.body;
  if (!isValidTopicPayload(courseId, weekKey, section, topic?.id)) {
    return void res.status(400).json({ error: "courseId, weekKey, section, and topic.id are required" });
  }
  const week = await prisma3.week.findUnique({ where: { courseId_weekKey: { courseId, weekKey } } });
  if (!week) return void res.status(404).json({ error: `No course '${courseId}' or week '${weekKey}' found` });
  try {
    return await runTopicAction(prisma3, week.id, { courseId, weekKey, section, action, topic }, res);
  } finally {
    await forgetTopicContent(courseId, weekKey, section, topic.id);
  }
}
async function runTopicAction(prisma3, weekId, request, res) {
  const { courseId, weekKey, section, action, topic } = request;
  if (action === "create") return await createTopic(prisma3, weekId, courseId, section, topic, res);
  if (action === "update") return await updateTopic(prisma3, weekId, courseId, section, topic, res);
  if (action === "delete") return await deleteTopic(prisma3, weekId, courseId, weekKey, section, topic.id, res);
  if (action === "move") return await moveTopic(prisma3, weekId, courseId, section, topic, res);
  return void res.status(400).json({ error: "Invalid action" });
}
var CONTENT_LANGUAGES = ["en", "he"];
async function forgetTopicContent(courseId, weekKey, section, topicId) {
  const base = `content_${courseId}_${weekKey}_${section}_${topicId}`;
  const keys = [`${base}_raw`, ...CONTENT_LANGUAGES.map((lang) => `${base}_${lang}`)];
  await Promise.all(keys.map((key) => cacheService.delete(key)));
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
  const num2 = rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx;
  const den = rx * rx * dy * dy + ry * ry * dx * dx;
  const coef = (largeArc === sweep2 ? -1 : 1) * Math.sqrt(Math.max(0, num2 / den));
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
      const segment = segmentPoints(upper, values.slice(start, start + count), at, offset);
      points.push(...segment.points);
      at = segment.to;
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
var packIssue = (path19, code, message) => ({ path: path19, code, message });
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function checkUnknownFields(value, allowed, path19) {
  return Object.keys(value).filter((key) => !allowed.includes(key)).map((key) => packIssue(`${path19}.${key}`, "unknown-field", `${key} is not a pack field`));
}
function checkId(value, path19) {
  const { min, max } = PACK_LIMITS.idChars;
  const valid = typeof value === "string" && value.length >= min && value.length <= max && PACK_ID_PATTERN.test(value);
  return valid ? [] : [packIssue(path19, "bad-id", `id must be kebab-case, ${min} to ${max} characters`)];
}
var hasControlCharacter = (text) => [...text].some((char) => {
  const code = char.charCodeAt(0);
  return code < 32 || code === 127;
});
function checkLabelText(value, path19, maxChars = PACK_LIMITS.labelChars) {
  const valid = typeof value === "string" && value.length >= 1 && value.length <= maxChars && !/[<>]/.test(value) && !hasControlCharacter(value);
  return valid ? [] : [packIssue(path19, "bad-label", `text must be 1 to ${maxChars} characters with no angle brackets or control characters`)];
}
function checkLocalizedLabel(value, path19) {
  if (!isRecord(value)) return [packIssue(path19, "bad-label", "label must be an object with an en text")];
  const languages = Object.keys(value).filter((key) => LANGUAGE_CODE_PATTERN.test(key));
  const translationIssues = languages.filter((code) => code !== FALLBACK_LANGUAGE && value[code] !== void 0).flatMap((code) => checkLabelText(value[code], `${path19}.${code}`));
  return [
    ...checkUnknownFields(value, languages, path19),
    ...checkLabelText(value[FALLBACK_LANGUAGE], `${path19}.${FALLBACK_LANGUAGE}`),
    ...translationIssues
  ];
}
function checkNumberIn(value, range, path19, code) {
  const valid = typeof value === "number" && Number.isFinite(value) && value >= range[0] && value <= range[1];
  return valid ? [] : [packIssue(path19, code, `must be a number from ${range[0]} to ${range[1]}`)];
}
function checkEnum(value, allowed, path19, code) {
  const valid = typeof value === "string" && allowed.includes(value);
  return valid ? [] : [packIssue(path19, code, `must be one of ${allowed.join(", ")}`)];
}
function checkArray(value, bounds, path19, code, checkItem) {
  if (!Array.isArray(value) || value.length < bounds[0] || value.length > bounds[1]) {
    return [packIssue(path19, code, `must be a list of ${bounds[0]} to ${bounds[1]} items`)];
  }
  return value.flatMap((item, index) => checkItem(item, `${path19}[${index}]`));
}

// src/core/visualBuilder/objectKinds.ts
var OBJECT_KINDS = ["arrow", "closed", "box", "text", "path"];

// src/core/visualBuilder/diagramPacks/validatePackGeometry.ts
var UNIT_RANGE = [0, 1];
var SIGNED_UNIT_RANGE = [-1, 1];
function checkView(value, path19) {
  if (!isRecord(value)) return [packIssue(path19, "bad-size", "view must be an object with w and h")];
  const range = PACK_LIMITS.viewUnits;
  return [
    ...checkUnknownFields(value, ["w", "h"], path19),
    ...checkNumberIn(value.w, range, `${path19}.w`, "bad-size"),
    ...checkNumberIn(value.h, range, `${path19}.h`, "bad-size")
  ];
}
function checkStrokeScaling(value, path19) {
  return checkEnum(value, PACK_STROKE_SCALINGS, path19, "bad-enum");
}
function checkOutline(value, path19) {
  if (value === "rect" || value === "ellipse") return [];
  if (!isRecord(value) || !Array.isArray(value.polygon)) {
    return [packIssue(path19, "bad-shape", "outline is rect, ellipse or an object with a polygon")];
  }
  const { min, max } = PACK_LIMITS.outlinePoints;
  return [
    ...checkUnknownFields(value, ["polygon"], path19),
    ...checkArray(value.polygon, [min, max], `${path19}.polygon`, "too-many", (point, pointPath) => checkPoint(point, pointPath, UNIT_RANGE))
  ];
}
function checkAnchors(value, path19) {
  const { min, max } = PACK_LIMITS.anchors;
  return checkArray(value, [min, max], path19, "too-many", checkAnchor);
}
function checkAnchor(value, path19) {
  if (!isRecord(value)) return [packIssue(path19, "bad-value", "anchor must be an object")];
  return [
    ...checkUnknownFields(value, ["id", "x", "y", "nx", "ny"], path19),
    ...checkId(value.id, `${path19}.id`),
    ...checkNumberIn(value.x, UNIT_RANGE, `${path19}.x`, "bad-value"),
    ...checkNumberIn(value.y, UNIT_RANGE, `${path19}.y`, "bad-value"),
    ...checkNumberIn(value.nx, SIGNED_UNIT_RANGE, `${path19}.nx`, "bad-value"),
    ...checkNumberIn(value.ny, SIGNED_UNIT_RANGE, `${path19}.ny`, "bad-value")
  ];
}
function checkPoint(value, path19, range) {
  if (!Array.isArray(value) || value.length !== 2) return [packIssue(path19, "bad-value", "point must be [x, y]")];
  return [
    ...checkNumberIn(value[0], range, `${path19}[0]`, "bad-value"),
    ...checkNumberIn(value[1], range, `${path19}[1]`, "bad-value")
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
function validatePackSvg(svg, path19) {
  if (svg.length > PACK_LIMITS.svgChars) return [packIssue(path19, "svg-too-big", `svg is longer than ${PACK_LIMITS.svgChars} characters`)];
  const forbidden = FORBIDDEN_PATTERNS.find(({ pattern }) => pattern.test(svg));
  if (forbidden) return [packIssue(path19, "svg-forbidden", forbidden.message)];
  const parsed = parseSvgTemplate(svg);
  if (!parsed.ok) return [packIssue(path19, "svg-syntax", parsed.error)];
  return [...limitIssues(parsed.nodes, path19), ...parsed.nodes.flatMap((node) => nodeIssues(node, path19))];
}
function nodeIssues(node, path19) {
  const tagIssue = SVG_TAGS.has(node.tag) ? [] : [packIssue(path19, "svg-tag", `<${node.tag}> is not allowed`)];
  const attrIssues = node.attrs.flatMap(([name, value]) => attrIssue(name, value, path19));
  return [...tagIssue, ...attrIssues, ...node.children.flatMap((child) => nodeIssues(child, path19))];
}
function attrIssue(name, value, path19) {
  const check = ATTR_CHECKS.get(name);
  if (!check) return [packIssue(path19, "svg-attr", `attribute ${name} is not allowed`)];
  const code = check(value);
  return code ? [packIssue(path19, code, `${name} value is not allowed`)] : [];
}
function limitIssues(nodes, path19) {
  const tooMany = countPrimitives(nodes) > PACK_LIMITS.svgPrimitives;
  const tooDeep = maxDepth(nodes, 1) > PACK_LIMITS.svgDepth;
  return tooMany || tooDeep ? [packIssue(path19, "svg-too-big", "svg has too many elements or nests too deep")] : [];
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
  ["id", (value, path19) => checkId(value, path19)],
  ["label", (value, path19) => checkLocalizedLabel(value, path19)],
  ["category", (value, path19) => checkId(value, path19)],
  ["kind", (value, path19) => checkEnum(value, OBJECT_KINDS, path19, "bad-enum")],
  ["color", (value, path19) => checkEnum(value, PACK_COLORS, path19, "bad-enum")],
  ["svg", (value, path19) => typeof value === "string" ? validatePackSvg(value, path19) : [packIssue(path19, "svg-syntax", "svg must be a string")]],
  ["preset", (value, path19) => checkEnum(value, PRESET_SHAPES, path19, "bad-enum")],
  ["view", (value, path19) => checkView(value, path19)],
  ["strokeScaling", (value, path19) => checkStrokeScaling(value, path19)],
  ["outline", (value, path19) => checkOutline(value, path19)],
  ["anchors", (value, path19) => checkAnchors(value, path19)],
  ["labelAt", (value, path19) => checkEnum(value, PACK_LABEL_SLOTS, path19, "bad-enum")],
  ["label2At", (value, path19) => checkEnum(value, PACK_SECOND_LABEL_SLOTS, path19, "bad-enum")],
  ["lines", (value, path19) => Number.isInteger(value) ? checkNumberIn(value, PACK_LIMITS.lines, path19, "bad-value") : [packIssue(path19, "bad-value", "lines must be a whole number")]],
  ["labelPrefix", (value, path19) => checkLabelText(value, path19, PACK_LIMITS.labelPrefixChars)],
  ["aliases", (value, path19) => checkArray(value, [0, PACK_LIMITS.listItems], path19, "bad-value", (item, itemPath) => checkId(item, itemPath))],
  ["defaultStyle", (value, path19) => objectStyleIssues(value, path19)],
  ["endLabels", (value, path19) => typeof value === "boolean" ? [] : [packIssue(path19, "bad-value", "endLabels must be true or false")]],
  ["keywords", (value, path19) => checkArray(value, [0, PACK_LIMITS.listItems], path19, "bad-value", (item, itemPath) => checkLabelText(item, itemPath, PACK_LIMITS.keywordChars))]
]);
function validatePackObjects(value, path19) {
  const { min, max } = PACK_LIMITS.objects;
  return checkArray(value, [min, max], path19, "too-many", validatePackObject);
}
function validatePackObject(value, path19) {
  if (!isRecord(value)) return [packIssue(path19, "bad-value", "object must be an object")];
  return [
    ...checkUnknownFields(value, OBJECT_FIELDS, path19),
    ...requiredIssues(value, path19),
    ...presentFieldIssues(value, path19),
    ...sizeIssues(value.size, value.kind, `${path19}.size`),
    ...shapeSourceIssues(value, path19),
    ...endLabelIssues(value, path19)
  ];
}
function requiredIssues(value, path19) {
  return REQUIRED_FIELDS.filter((field) => value[field] === void 0).map((field) => packIssue(`${path19}.${field}`, "bad-value", `${field} is required`));
}
function presentFieldIssues(value, path19) {
  return Object.entries(value).flatMap(([key, field]) => FIELD_CHECKS.get(key)?.(field, `${path19}.${key}`) ?? []);
}
function sizeIssues(size, kind, path19) {
  if (!isRecord(size)) return [packIssue(path19, "bad-size", "size must be an object with w and h")];
  const [min, max] = PACK_LIMITS.objectSize;
  const range = [min, max];
  const heightless = size.h === 0 && typeof kind === "string" && HEIGHTLESS_KINDS.includes(kind);
  return [
    ...checkUnknownFields(size, ["w", "h"], path19),
    ...checkNumberIn(size.w, range, `${path19}.w`, "bad-size"),
    ...heightless ? [] : checkNumberIn(size.h, range, `${path19}.h`, "bad-size")
  ];
}
function shapeSourceIssues(value, path19) {
  const hasSvg = value.svg !== void 0;
  const hasPreset = value.preset !== void 0;
  return hasSvg === hasPreset ? [packIssue(path19, "bad-shape", "an object has exactly one of svg or preset")] : [];
}
function endLabelIssues(value, path19) {
  return value.endLabels === true && value.kind !== "arrow" ? [packIssue(`${path19}.endLabels`, "bad-value", "endLabels is only for arrow objects")] : [];
}
var STYLE_FIELD_CHECKS = {
  fill: (value, path19) => checkEnum(value, PACK_STYLE_PAINTS, path19, "bad-enum"),
  stroke: (value, path19) => checkEnum(value, PACK_STYLE_PAINTS, path19, "bad-enum"),
  strokeWidth: (value, path19) => checkNumberIn(value, PACK_LIMITS.strokeWidth, path19, "bad-value"),
  dash: (value, path19) => checkEnum(value, PACK_DASHES, path19, "bad-enum")
};
function objectStyleIssues(value, path19) {
  if (!isRecord(value)) return [packIssue(path19, "bad-value", "defaultStyle must be an object")];
  const fieldIssues = Object.entries(value).flatMap(([key, field]) => STYLE_FIELD_CHECKS[key]?.(field, `${path19}.${key}`) ?? []);
  return [...checkUnknownFields(value, Object.keys(STYLE_FIELD_CHECKS), path19), ...fieldIssues];
}

// src/core/visualBuilder/diagramPacks/validatePackEffects.ts
var EFFECT_FIELDS = ["id", "label", "description", "kinds", "duration", "icon", "tone", "anime"];
var ANIME_FIELDS = [...Object.keys(PACK_ANIME_RANGES), "easing"];
function validatePackEffects(value, path19) {
  const { min, max } = PACK_LIMITS.effects;
  return checkArray(value, [min, max], path19, "too-many", validatePackEffect);
}
function validatePackEffect(value, path19) {
  if (!isRecord(value)) return [packIssue(path19, "bad-effect", "effect must be an object")];
  return [
    ...checkUnknownFields(value, EFFECT_FIELDS, path19),
    ...checkId(value.id, `${path19}.id`),
    ...checkLocalizedLabel(value.label, `${path19}.label`),
    ...checkLocalizedLabel(value.description, `${path19}.description`),
    ...kindIssues(value.kinds, `${path19}.kinds`),
    ...checkNumberIn(value.duration, PACK_LIMITS.duration, `${path19}.duration`, "bad-effect"),
    ...checkLabelText(value.icon, `${path19}.icon`, PACK_LIMITS.iconChars),
    ...checkEnum(value.tone, PACK_EFFECT_TONES, `${path19}.tone`, "bad-enum"),
    ...validatePackAnime(value.anime, `${path19}.anime`)
  ];
}
function kindIssues(value, path19) {
  return checkArray(value, [1, OBJECT_KINDS.length], path19, "bad-effect", (item, itemPath) => checkEnum(item, OBJECT_KINDS, itemPath, "bad-enum"));
}
function validatePackAnime(value, path19) {
  if (!isRecord(value)) return [packIssue(path19, "bad-effect", "anime must be an object")];
  const { min, max } = PACK_LIMITS.animeValues;
  const easingIssues = value.easing === void 0 ? [] : checkEnum(value.easing, PACK_EASINGS, `${path19}.easing`, "bad-enum");
  const propertyIssues = Object.entries(PACK_ANIME_RANGES).flatMap(
    ([prop, range]) => value[prop] === void 0 ? [] : checkArray(value[prop], [min, max], `${path19}.${prop}`, "bad-effect", (item, itemPath) => checkNumberIn(item, range, itemPath, "bad-effect"))
  );
  return [...checkUnknownFields(value, ANIME_FIELDS, path19), ...easingIssues, ...propertyIssues];
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
function validatePackTemplates(value, path19, context) {
  const items = listIssues(value, PACK_LIMITS.templates, path19, (item, itemPath) => validateTemplate(item, itemPath, context));
  return [...items, ...duplicateSlots(templateIdSlots(value, path19), "template of this pack")];
}
var listIssues = (value, limit, path19, check) => checkArray(value, [limit.min, limit.max], path19, "too-many", check);
function validateTemplate(value, path19, context) {
  if (!isRecord(value)) return [packIssue(path19, "bad-value", "template must be an object")];
  const keys = { objects: stringSet(value.objects, "key"), links: linkTargets(value.links) };
  return [
    ...checkUnknownFields(value, TEMPLATE_FIELDS, path19),
    ...checkId(value.id, `${path19}.id`),
    ...checkLocalizedLabel(value.name, `${path19}.name`),
    ...checkLocalizedLabel(value.description, `${path19}.description`),
    ...categoryIssues(value.category, `${path19}.category`),
    ...listIssues(value.objects, PACK_LIMITS.templateObjects, `${path19}.objects`, (item, p) => objectIssues(item, p, context)),
    ...listIssues(value.links, PACK_LIMITS.templateLinks, `${path19}.links`, (item, p) => linkIssues(item, p, keys.objects)),
    ...listIssues(value.steps, PACK_LIMITS.templateSteps, `${path19}.steps`, (item, p) => stepIssues(item, p, keys, context)),
    ...duplicateSlots(keySlots(value.objects, `${path19}.objects`), "object key"),
    ...showCoverageIssues(value.steps, keys.objects, `${path19}.steps`)
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
function categoryIssues(value, path19) {
  const idIssues2 = checkId(value, path19);
  if (idIssues2.length > 0) return idIssues2;
  return categoryById(value) ? [] : [packIssue(path19, "bad-value", `category ${String(value)} does not exist`)];
}
function checkKey(value, path19) {
  const { min, max } = PACK_LIMITS.templateKeyChars;
  const valid = typeof value === "string" && value.length >= min && value.length <= max && PACK_ID_PATTERN.test(value);
  return valid ? [] : [packIssue(path19, "bad-id", `key must be kebab-case, ${min} to ${max} characters`)];
}
function objectIssues(value, path19, context) {
  if (!isRecord(value)) return [packIssue(path19, "bad-value", "template object must be an object")];
  return [
    ...checkUnknownFields(value, OBJECT_FIELDS2, path19),
    ...checkKey(value.key, `${path19}.key`),
    ...refIssues(value.ref, `${path19}.ref`, context),
    ...atIssues(value.at, `${path19}.at`),
    ...value.label === void 0 ? [] : checkLocalizedLabel(value.label, `${path19}.label`),
    ...value.color === void 0 ? [] : checkEnum(value.color, PACK_TEMPLATE_COLORS, `${path19}.color`, "bad-enum"),
    ...value.width === void 0 ? [] : checkNumberIn(value.width, [0.02, 0.5], `${path19}.width`, "bad-size")
  ];
}
function refIssues(value, path19, context) {
  const prefix = `${context.packId}/`;
  const text = typeof value === "string" ? value : "";
  const known = text.startsWith(prefix) && context.objectIds.has(text.slice(prefix.length)) || presetOfRef(text) !== void 0;
  return known ? [] : [packIssue(path19, "bad-value", `ref must name an object of pack ${context.packId} as ${prefix}<objectId>, or a basic shape as preset/<shape>`)];
}
function atIssues(value, path19) {
  if (!isRecord(value)) return [packIssue(path19, "bad-size", "at must be an object with x and y")];
  return [
    ...checkUnknownFields(value, ["x", "y"], path19),
    ...checkNumberIn(value.x, FRACTION, `${path19}.x`, "bad-size"),
    ...checkNumberIn(value.y, FRACTION, `${path19}.y`, "bad-size")
  ];
}
function keyRefIssue(value, path19, keys) {
  return typeof value === "string" && keys.has(value) ? [] : [packIssue(path19, "bad-value", "must name an object key of this template")];
}
function linkIssues(value, path19, keys) {
  if (!isRecord(value)) return [packIssue(path19, "bad-value", "link must be an object")];
  return [
    ...checkUnknownFields(value, LINK_FIELDS, path19),
    ...keyRefIssue(value.from, `${path19}.from`, keys),
    ...keyRefIssue(value.to, `${path19}.to`, keys),
    ...value.label === void 0 ? [] : checkLocalizedLabel(value.label, `${path19}.label`),
    ...value.route === void 0 ? [] : checkEnum(value.route, PACK_TEMPLATE_LINK_ROUTES, `${path19}.route`, "bad-enum"),
    ...value.fromPort === void 0 ? [] : checkEnum(value.fromPort, PACK_TEMPLATE_LINK_SIDES, `${path19}.fromPort`, "bad-enum"),
    ...value.toPort === void 0 ? [] : checkEnum(value.toPort, PACK_TEMPLATE_LINK_SIDES, `${path19}.toPort`, "bad-enum"),
    ...value.arrow === void 0 || typeof value.arrow === "boolean" ? [] : [packIssue(`${path19}.arrow`, "bad-value", "arrow must be true or false")]
  ];
}
function stepIssues(value, path19, keys, context) {
  if (!isRecord(value)) return [packIssue(path19, "bad-value", "step must be an object")];
  const showLimit = { min: 0, max: PACK_LIMITS.templateObjects.max };
  return [
    ...checkUnknownFields(value, STEP_FIELDS, path19),
    ...checkLocalizedLabel(value.caption, `${path19}.caption`),
    ...listIssues(value.show, showLimit, `${path19}.show`, (item, p) => keyRefIssue(item, p, keys.objects)),
    ...listIssues(value.effects, PACK_LIMITS.templateEffects, `${path19}.effects`, (item, p) => effectIssues(item, p, keys, context))
  ];
}
function effectIssues(value, path19, keys, context) {
  if (!isRecord(value)) return [packIssue(path19, "bad-effect", "effect must be an object")];
  const effectKnown = typeof value.effect === "string" && context.effectIds.has(value.effect);
  const targetKnown = typeof value.target === "string" && (keys.objects.has(value.target) || keys.links.has(value.target));
  return [
    ...checkUnknownFields(value, EFFECT_FIELDS2, path19),
    ...effectKnown ? [] : [packIssue(`${path19}.effect`, "bad-effect", "effect must be a built-in effect id or <packId>/<effectId> of this pack")],
    ...targetKnown ? [] : [packIssue(`${path19}.target`, "bad-value", "target must be an object key or fromKey->toKey of a link")]
  ];
}
function templateIdSlots(templates, path19) {
  const items = Array.isArray(templates) ? templates : [];
  return items.map((item, index) => ({ value: isRecord(item) ? item.id : void 0, path: `${path19}[${index}].id` }));
}
function keySlots(objects, path19) {
  const items = Array.isArray(objects) ? objects : [];
  return items.map((item, index) => ({ value: isRecord(item) ? item.key : void 0, path: `${path19}[${index}].key` }));
}
function duplicateSlots(slots, what) {
  const seen = /* @__PURE__ */ new Set();
  return slots.flatMap(({ value, path: path19 }) => {
    if (typeof value !== "string") return [];
    if (!seen.has(value)) {
      seen.add(value);
      return [];
    }
    return [packIssue(path19, "duplicate-id", `${value} is already a ${what}`)];
  });
}
function showCoverageIssues(steps, keys, path19) {
  if (!Array.isArray(steps)) return [];
  const shown = steps.flatMap((step) => isRecord(step) && Array.isArray(step.show) ? step.show.filter((key) => typeof key === "string") : []);
  const missing = [...keys].filter((key) => !shown.includes(key));
  const repeated = shown.filter((key, index) => shown.indexOf(key) !== index);
  return [...missing, ...repeated].map((key) => packIssue(path19, "bad-value", `object ${key} must be shown in exactly one step`));
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
  return slots.flatMap(({ id, path: path19 }) => {
    if (typeof id !== "string") return [];
    if (seen.has(id)) return [packIssue(path19, "duplicate-id", `${id} is already used in this pack`)];
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
  return Array.from({ length: segments }, (_, segment) => {
    const params = Object.fromEntries(tracks.map(([prop, values]) => [prop, values[Math.round((segment + 1) * (values.length - 1) / segments)]]));
    return {
      targets: targets.length === 1 ? targets[0] : targets,
      params: { ...params, duration: slice, ease },
      at: at + segment * slice,
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
  const bad2 = pipeline2.stages.findIndex((stage) => !isRecord2(stage) || typeof stage.id !== "string");
  return bad2 === -1 ? null : `pipeline.stages[${bad2}] needs a string "id"`;
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

// server/routes/topicVisual.ts
async function dropContentCache(courseId, weekKey, section, topicId) {
  const base = `content_${courseId}_${weekKey}_${section}_${topicId}`;
  const variants = ["raw", ...knownContentLanguages()];
  await Promise.all(variants.map((variant) => cacheService.delete(`${base}_${variant}`)));
}
async function findStepPlayerTopic(prisma3, courseId, weekKey, section, topicId) {
  const week = await prisma3.week.findUnique({ where: { courseId_weekKey: { courseId, weekKey } } });
  if (!week) return { problem: { status: 404, body: { error: `No course '${courseId}' or week '${weekKey}' found` } } };
  const topic = await prisma3.topic.findUnique({ where: { weekId_section_topicId: { weekId: week.id, section, topicId } } });
  if (!topic) return { problem: { status: 404, body: { error: `Topic '${topicId}' not found` } } };
  if (topic.scene) return { problem: { status: 409, body: { error: `Topic '${topicId}' is a canvas topic, not a step player` } } };
  return { topic };
}
function badRequest(body) {
  return { problem: { status: 400, body } };
}
var COORDINATES = ["courseId", "weekKey", "section", "topicId"];
function readSaveRequest(raw) {
  const body = raw ?? {};
  if (COORDINATES.some((key) => !body[key])) return badRequest({ error: "courseId, weekKey, section and topicId are required" });
  const checked = checkVisualSpec(body.spec);
  if (!checked.spec || checked.problems.length > 0) return badRequest({ error: "Invalid VisualSpec", problems: checked.problems });
  return body;
}
async function handleTopicVisualSave(req, res) {
  const prisma3 = req.prisma;
  const request = readSaveRequest(req.body);
  if ("problem" in request) return void res.status(request.problem.status).json(request.problem.body);
  const { courseId, weekKey, section, topicId, spec } = request;
  const found = await findStepPlayerTopic(prisma3, courseId, weekKey, section, topicId);
  if ("problem" in found) return void res.status(found.problem.status).json(found.problem.body);
  const updated = await prisma3.topic.update({ where: { id: found.topic.id }, data: { model: spec } });
  await syncTopicToFiles(prisma3, updated.id);
  invalidateRegistryCache();
  await dropContentCache(courseId, weekKey, section, topicId);
  res.json({ updatedId: found.topic.topicId });
}

// server/routes/courses.ts
async function createWeek(prisma3, courseId, weekKey, title, res) {
  const existing = await prisma3.week.findUnique({
    where: { courseId_weekKey: { courseId, weekKey } }
  });
  if (existing) return void res.status(400).json({ error: `Week '${weekKey}' already exists in course '${courseId}'` });
  const created = await prisma3.week.create({
    data: { courseId, weekKey, title: title || { en: weekKey } }
  });
  await syncCourseToFile(prisma3, courseId);
  invalidateRegistryCache();
  res.json({ updatedId: created.weekKey });
}
async function updateWeek(prisma3, courseId, weekKey, title, res) {
  const updated = await prisma3.week.update({
    where: { courseId_weekKey: { courseId, weekKey } },
    data: { ...title && { title } }
  });
  await syncCourseToFile(prisma3, courseId);
  invalidateRegistryCache();
  res.json({ updatedId: updated.weekKey });
}
async function deleteWeek(prisma3, courseId, weekKey, cascade, res) {
  const week = await prisma3.week.findUnique({
    where: { courseId_weekKey: { courseId, weekKey } }
  });
  if (!week) return void res.status(404).json({ error: `Week '${weekKey}' not found` });
  if (!cascade) {
    const topicCount = await prisma3.topic.count({ where: { weekId: week.id } });
    if (topicCount > 0) {
      return void res.status(409).json({ error: `Week '${weekKey}' has ${topicCount} topics. Use cascade: true to delete.` });
    }
  }
  await prisma3.week.delete({ where: { id: week.id } });
  removeWeekFiles(courseId, weekKey);
  invalidateRegistryCache();
  res.json({ updatedId: weekKey });
}
function isValidWeekPayload(courseId, weekKey) {
  return Boolean(courseId && typeof courseId === "string" && weekKey && typeof weekKey === "string");
}
async function handleWeekCrud(req, res) {
  const prisma3 = req.prisma;
  const { courseId, action, weekKey, title, cascade = false } = req.body;
  if (!isValidWeekPayload(courseId, weekKey)) {
    return void res.status(400).json({ error: "courseId and weekKey must be non-empty strings" });
  }
  const course = await prisma3.course.findUnique({ where: { id: courseId } });
  if (!course) return void res.status(404).json({ error: `No course '${courseId}' found` });
  if (action === "create") {
    await createWeek(prisma3, courseId, weekKey, title, res);
  } else if (action === "update") {
    await updateWeek(prisma3, courseId, weekKey, title, res);
  } else if (action === "delete") {
    await deleteWeek(prisma3, courseId, weekKey, cascade, res);
  } else {
    res.status(400).json({ error: `Unknown action '${action}'. Expected 'create', 'update', or 'delete'.` });
  }
}
async function createCourse(prisma3, id, course, res) {
  const existing = await prisma3.course.findUnique({ where: { id } });
  if (existing) {
    res.status(400).json({ error: `Course '${id}' already exists` });
    return;
  }
  const created = await prisma3.course.create({
    data: {
      id,
      code: course.code || id.toUpperCase(),
      title: course.title || { en: id },
      subtitle: course.subtitle || { en: "" },
      description: course.description || { en: "" },
      icon: course.icon || "BookOpen",
      color: course.color || "rgba(100,100,100,0.15)",
      accent: course.accent || "#888888",
      badge: course.badge || { en: "" }
    }
  });
  await syncCourseToFile(prisma3, created.id);
  invalidateRegistryCache();
  res.json({ updatedId: created.id });
}
async function updateCourse(prisma3, id, course, res) {
  const updated = await prisma3.course.update({
    where: { id },
    data: {
      ...course.code && { code: course.code },
      ...course.title && { title: course.title },
      ...course.subtitle && { subtitle: course.subtitle },
      ...course.description && { description: course.description },
      ...course.icon && { icon: course.icon },
      ...course.color && { color: course.color },
      ...course.accent && { accent: course.accent },
      ...course.badge && { badge: course.badge }
    }
  });
  await syncCourseToFile(prisma3, updated.id);
  invalidateRegistryCache();
  res.json({ updatedId: updated.id });
}
async function deleteCourse(prisma3, id, res) {
  await prisma3.course.delete({ where: { id } });
  removeCourseFiles(id);
  invalidateRegistryCache();
  res.json({ updatedId: id });
}
async function handleCourseCrud(req, res) {
  const prisma3 = req.prisma;
  const { action, id, course = {} } = req.body;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Course id must be a non-empty string" });
    return;
  }
  if (action === "create") return await createCourse(prisma3, id, course, res);
  if (action === "update") return await updateCourse(prisma3, id, course, res);
  if (action === "delete") return await deleteCourse(prisma3, id, res);
  res.status(400).json({ error: "Invalid action" });
}
var coursesRouter = Router3();
coursesRouter.post("/content-editor/course", route(handleCourseCrud));
coursesRouter.post("/content-editor/week", route(handleWeekCrud));
coursesRouter.post("/content-editor/topic", route(handleTopicCrud));
coursesRouter.put("/content-editor/topic-visual", route(handleTopicVisualSave));

// server/routes/scenes.ts
import { Router as Router5 } from "express";

// server/utils/dropEditorDoc.ts
async function dropEditorDoc(db, topicKey) {
  await db.canvasStoreDoc.deleteMany({ where: { key: topicKey } });
}

// server/utils/commitScene.ts
async function commitScene(prisma3, topic, scene, writer) {
  await prisma3.topic.update({ where: { id: topic.id }, data: { scene } });
  if (writer !== "editor") await dropEditorDoc(prisma3, topic.topicId);
  if (writer !== "seed") await syncTopicToFiles(prisma3, topic.id);
}

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
var deviceShapeId = (device) => device === "database" ? "cylinder" : device;
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

// server/routes/sceneHistoryManager.ts
var MAX_HISTORY_PER_TOPIC = 10;
async function snapshotScene(prisma3, topic) {
  if (!topic.scene || Object.keys(topic.scene).length === 0) {
    return;
  }
  await prisma3.sceneHistory.create({
    data: { topicId: topic.id, scene: topic.scene }
  });
  const excess = await prisma3.sceneHistory.findMany({
    where: { topicId: topic.id },
    orderBy: { createdAt: "desc" },
    skip: MAX_HISTORY_PER_TOPIC,
    select: { id: true }
  });
  if (excess.length > 0) {
    await prisma3.sceneHistory.deleteMany({ where: { id: { in: excess.map((e) => e.id) } } });
  }
}

// src/core/geometry/blockPlacement.ts
function sideSpots(c, x, y, width, height, bounds) {
  const spots = [];
  if (c.x - width >= 0) spots.push({ x: c.x - width, y });
  if (c.x + c.width + width <= bounds.width) spots.push({ x: c.x + c.width, y });
  if (c.y - height >= 0) spots.push({ x, y: c.y - height });
  if (c.y + c.height + height <= bounds.height) spots.push({ x, y: c.y + c.height });
  return spots;
}
function nearestFreeSpot(target, at, bounds, others, colliding) {
  const { width, height } = target;
  const candidates = [];
  for (const c of colliding) {
    for (const spot of sideSpots(c, at.x, at.y, width, height, bounds)) {
      const p = clampPosition({ ...spot, width, height }, bounds);
      if (others.some((o) => o !== c && isOverlapping({ ...target, ...p }, o, 1))) continue;
      candidates.push({ ...p, dist: Math.hypot(p.x - target.x, p.y - target.y) });
    }
  }
  candidates.sort((p, q) => p.dist - q.dist);
  return candidates.length > 0 ? { x: candidates[0].x, y: candidates[0].y } : null;
}
function resolveNonOverlappingPosition(target, bounds, others = [], origPos) {
  const clamped = clampPosition(target, bounds);
  const at = { x: clamped.x, y: clamped.y };
  if (others.length === 0) return at;
  const { width, height } = target;
  const snapped = snapBlockToGrid({ ...at, width, height }, others);
  const clampedSnap = clampPosition({ ...target, x: snapped.x, y: snapped.y }, bounds);
  if (!others.some((other) => isOverlapping({ ...target, ...clampedSnap }, other, 1))) return clampedSnap;
  const colliding = others.filter((other) => isOverlapping({ ...target, ...at }, other, 1));
  if (colliding.length === 0) return at;
  const free = nearestFreeSpot(target, at, bounds, others, colliding);
  if (free) return free;
  return origPos ? clampPosition({ ...target, ...origPos }, bounds) : at;
}
var MIN_BLOCK_WIDTH = 80;
var MIN_BLOCK_HEIGHT = 60;
var SNAP_DISTANCE = 10;
function clampPosition(rect, bounds) {
  const maxX = Math.max(0, bounds.width - rect.width);
  const maxY = Math.max(0, bounds.height - rect.height);
  return {
    x: Math.min(Math.max(rect.x, 0), maxX),
    y: Math.min(Math.max(rect.y, 0), maxY)
  };
}
function clampSize(rect, bounds, minWidth = MIN_BLOCK_WIDTH, minHeight = MIN_BLOCK_HEIGHT) {
  const maxWidth = bounds.width - rect.x;
  const maxHeight = bounds.height - rect.y;
  return {
    width: Math.min(Math.max(rect.width, minWidth), maxWidth),
    height: Math.min(Math.max(rect.height, minHeight), maxHeight)
  };
}
function isOverlapping(a, b, tolerance = 1) {
  return a.x < b.x + b.width - tolerance && a.x + a.width > b.x + tolerance && a.y < b.y + b.height - tolerance && a.y + a.height > b.y + tolerance;
}
function snapBlockToGrid(rect, others, snapDist = SNAP_DISTANCE) {
  let { x, y } = rect;
  const { width, height } = rect;
  for (const other of others) {
    if (Math.abs(x - (other.x + other.width)) <= snapDist) {
      x = other.x + other.width;
    } else if (Math.abs(x + width - other.x) <= snapDist) {
      x = other.x - width;
    } else if (Math.abs(x - other.x) <= snapDist) {
      x = other.x;
    } else if (Math.abs(x + width - (other.x + other.width)) <= snapDist) {
      x = other.x + other.width - width;
    }
    if (Math.abs(y - (other.y + other.height)) <= snapDist) {
      y = other.y + other.height;
    } else if (Math.abs(y + height - other.y) <= snapDist) {
      y = other.y - height;
    } else if (Math.abs(y - other.y) <= snapDist) {
      y = other.y;
    } else if (Math.abs(y + height - (other.y + other.height)) <= snapDist) {
      y = other.y + other.height - height;
    }
  }
  return { x, y };
}

// src/core/geometry/tableColumns.ts
var GLYPH_EM = 0.55;
var CELL_PAD_PX = 9;
var MIN_FRACTION = 0.05;
var longest = (texts) => texts.reduce((max, text) => Math.max(max, text.length), 0);
function needOf(grid, col, fontPx2) {
  const cells = grid.map((row) => row[col] ?? "");
  const lines = cells.flatMap((cell) => cell.split("\n"));
  const words = lines.flatMap((line) => line.split(/\s+/));
  const toPx2 = (chars) => chars * fontPx2 * GLYPH_EM + CELL_PAD_PX;
  return { widest: toPx2(longest(lines)), narrowest: toPx2(longest(words)) };
}
var equal = (cols) => Array.from({ length: Math.max(1, cols) }, () => 1 / Math.max(1, cols));
function normalise(widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return equal(widths.length);
  const floored = widths.map((w) => Math.max(MIN_FRACTION, w / total));
  const sum = floored.reduce((a, b) => a + b, 0);
  return floored.map((w) => w / sum);
}
function autoColumnFractions(grid, cols, { widthPx, fontPx: fontPx2 }) {
  if (cols <= 1 || grid.length === 0) return equal(cols);
  const needs = Array.from({ length: cols }, (_, c) => needOf(grid, c, fontPx2));
  const widest = needs.reduce((sum, n) => sum + n.widest, 0);
  if (widest <= widthPx) return normalise(needs.map((n) => n.widest));
  const narrowest = needs.reduce((sum, n) => sum + n.narrowest, 0);
  const spare = Math.max(0, widthPx - narrowest);
  const gain = needs.reduce((sum, n) => sum + (n.widest - n.narrowest), 0);
  return normalise(needs.map((n) => n.narrowest + (gain > 0 ? spare * (n.widest - n.narrowest) / gain : 0)));
}
function minFitWidthPx(grid, cols, fontPx2) {
  if (grid.length === 0) return 0;
  return Math.ceil(Array.from({ length: Math.max(1, cols) }, (_, c) => needOf(grid, c, fontPx2).widest).reduce((a, b) => a + b, 0));
}

// src/core/geometry/tidyLayout.ts
var DEFAULT_GAP = 12;
var DEFAULT_MARGIN = 24;
var DEFAULT_FONT_PT = 12;
var PT_TO_PX = 96 / 72;
var LINE_HEIGHT = 1.35;
var PAD_X = 10;
var PAD_Y = 6;
var GLYPH_EM2 = 0.55;
var WIDTH_SLACK = 1.08;
var MATH_LINE_FACTOR = 1.8;
var MIN_FIT_WIDTH = 40;
var HEIGHT_TOLERANCE = 1.2;
var TABLE_CELL_PAD_X = 9;
var TABLE_CELL_PAD_Y = 4.5;
var TABLE_MIN_ROW = 30;
var TABLE_DEFAULT_PT = 11;
var COLUMN_OVERLAP = 0.25;
function bodyText(block) {
  const body = block.body;
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const localized = body;
    return String(localized.en ?? localized.he ?? "");
  }
  return "";
}
var fontPx = (block) => (typeof block.fontSize === "number" ? block.fontSize : DEFAULT_FONT_PT) * PT_TO_PX;
function estimateTextHeight(block) {
  const px = fontPx(block);
  const perLine = Math.max(1, Math.floor((block.width - PAD_X) / (px * GLYPH_EM2)));
  const lines = bodyText(block).split("\n").reduce((sum, line) => {
    const rows = Math.max(1, Math.ceil(line.length / perLine));
    return sum + rows * (line.includes("$") ? MATH_LINE_FACTOR : 1);
  }, 0);
  return Math.ceil(lines * px * LINE_HEIGHT) + PAD_Y;
}
function fitTextWidth(block) {
  if (block.kind !== "richText" || block.autoFit === false) return block.width;
  const longest2 = Math.max(1, ...bodyText(block).split("\n").map((line) => line.length));
  const natural = Math.ceil(longest2 * fontPx(block) * GLYPH_EM2 * WIDTH_SLACK) + PAD_X;
  return Math.max(MIN_FIT_WIDTH, Math.min(block.width, natural));
}
var cellText = (cell) => {
  if (typeof cell === "string") return cell;
  if (cell && typeof cell === "object") {
    const localized = cell;
    return String(localized.en ?? localized.he ?? "");
  }
  return cell === void 0 || cell === null ? "" : String(cell);
};
var tableFontPx = (block) => (typeof block.fontSize === "number" ? block.fontSize : TABLE_DEFAULT_PT) * PT_TO_PX;
function tableGrid(block) {
  const header2 = Array.isArray(block.columns) ? [block.columns] : [];
  const body = Array.isArray(block.rows) ? block.rows : [];
  return [...header2, ...body].filter(Array.isArray);
}
var tableCols = (grid) => Math.max(1, ...grid.map((row) => row.length));
function storedColumnFractions(block, cols) {
  const given = block.colWidths;
  const valid = Array.isArray(given) && given.length === cols && given.every((n) => typeof n === "number" && n > 0);
  return valid ? given : null;
}
function columnWidths(block, grid, cols) {
  const stored = storedColumnFractions(block, cols);
  const texts = grid.map((row) => row.map(cellText));
  const fractions = stored ?? (block.autoFit === false ? Array.from({ length: cols }, () => 1) : autoColumnFractions(texts, cols, { widthPx: block.width, fontPx: tableFontPx(block) }));
  const total = fractions.reduce((a, b) => a + b, 0);
  return fractions.map((w) => block.width * w / total);
}
function fitTableWidth(block) {
  const grid = tableGrid(block);
  const cols = tableCols(grid);
  if (block.autoFit === false || storedColumnFractions(block, cols)) return block.width;
  const natural = minFitWidthPx(grid.map((row) => row.map(cellText)), cols, tableFontPx(block));
  return natural > 0 ? Math.max(MIN_FIT_WIDTH, Math.min(block.width, natural)) : block.width;
}
function fitBlockWidth(block) {
  if (block.kind === "data" && block.format === "table") return fitTableWidth(block);
  return fitTextWidth(block);
}
function estimateTableHeight(block) {
  const grid = tableGrid(block);
  const cols = tableCols(grid);
  const widths = columnWidths(block, grid, cols);
  const px = tableFontPx(block);
  return Math.ceil(grid.reduce((sum, row) => {
    const lines = Math.max(1, ...row.map((cell, c) => {
      const perLine = Math.max(1, Math.floor((widths[c] - TABLE_CELL_PAD_X) / (px * GLYPH_EM2)));
      return cellText(cell).split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / perLine)), 0);
    }));
    return sum + Math.max(TABLE_MIN_ROW, lines * px * LINE_HEIGHT + TABLE_CELL_PAD_Y);
  }, 0));
}
function fittedSize(block, fitText) {
  if (block.kind === "data" && block.format === "table") {
    const width2 = fitText ? fitTableWidth(block) : block.width;
    return { width: width2, height: estimateTableHeight({ ...block, width: width2 }) };
  }
  if (block.kind !== "richText" || block.autoFit === false) return { width: block.width, height: block.height };
  const width = fitText ? fitTextWidth(block) : block.width;
  const needed = estimateTextHeight({ ...block, width });
  const keep = block.height >= needed && block.height <= needed * HEIGHT_TOLERANCE;
  return { width, height: keep ? block.height : needed };
}
function sameColumn(a, b) {
  const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  return overlap >= Math.min(a.width, b.width) * COLUMN_OVERLAP;
}
function isLaidOut(block) {
  return block.kind !== "connector" && [block.x, block.y, block.width, block.height].every((n) => typeof n === "number");
}
function topOf(block, above, options) {
  if (above.length === 0) return options.closeGaps ? Math.min(block.y, options.margin) : block.y;
  const clear = Math.max(...above.map((p) => p.change.y + p.change.height + options.gap));
  return options.closeGaps ? clear : Math.max(block.y, clear);
}
var DEFAULT_PAGE_HEIGHT = 1123;
function spilledBlocks(placed, limit) {
  return placed.filter((p, i) => p.change.y + p.change.height > limit && placed.slice(0, i).some((q) => sameColumn(q.block, p.block)));
}
function layoutOnNextPage(spilled, rules) {
  const moved = tidyLayout(spilled.map((p) => ({ ...p.block, ...p.change })), { gap: rules.gap, margin: rules.margin, closeGaps: true, fitText: false });
  return new Map(spilled.map((p) => [p.block.id, { ...p.change, ...moved.get(p.block.id), overflow: true }]));
}
function tidyLayout(blocks, options = {}) {
  const rules = { gap: options.gap ?? DEFAULT_GAP, margin: options.margin ?? DEFAULT_MARGIN, closeGaps: options.closeGaps ?? true };
  const ordered = blocks.filter(isLaidOut).sort((a, b) => a.y - b.y || a.x - b.x);
  const placed = [];
  for (const block of ordered) {
    const size = fittedSize(block, options.fitText ?? true);
    const above = placed.filter((p) => sameColumn(p.block, block));
    placed.push({ block, change: { y: topOf(block, above, rules), ...size } });
  }
  const leaving = options.overflow === "newPage" ? movesToNextPage(placed, options.pageHeight ?? DEFAULT_PAGE_HEIGHT, rules) : /* @__PURE__ */ new Map();
  return collectChanges(placed, leaving);
}
function movesToNextPage(placed, pageHeight, rules) {
  const spilled = spilledBlocks(placed, pageHeight - rules.margin);
  return spilled.length > 0 ? layoutOnNextPage(spilled, rules) : /* @__PURE__ */ new Map();
}
function collectChanges(placed, leaving) {
  const changes = /* @__PURE__ */ new Map();
  for (const { block, change } of placed) {
    const moved = change.y !== block.y || change.height !== block.height || change.width !== block.width;
    const next = leaving.get(block.id) ?? (moved ? change : void 0);
    if (next) changes.set(block.id, next);
  }
  return changes;
}

// server/routes/scenePagination.ts
import crypto from "crypto";
var PAGE_HEIGHT = 1123;
var TOP_MARGIN = 24;
var MAX_PAGES_TOUCHED = 50;
var blocksOf2 = (page) => {
  if (!Array.isArray(page.blocks)) page.blocks = [];
  return page.blocks;
};
function ensurePages(state) {
  if (!state.pages || state.pages.length === 0) state.pages = [{ id: "page-1", name: "Page 1", blocks: [...state.blocks] }];
  return state.pages;
}
function settleList(list, options) {
  const changes = tidyLayout(list, options);
  const spilled = [];
  for (const block of list) {
    const change = changes.get(String(block.id));
    if (!change) continue;
    const { overflow, ...geometry } = change;
    Object.assign(block, geometry);
    if (overflow) spilled.push(block);
  }
  spilled.forEach((block) => list.splice(list.indexOf(block), 1));
  return spilled;
}
function placeAtTop(list, moved) {
  const tops = list.map((b) => b.y).filter((y) => typeof y === "number");
  const minY = Math.min(TOP_MARGIN, ...tops);
  const lift = minY < TOP_MARGIN ? TOP_MARGIN - minY + 1 : 0;
  moved.forEach((block) => {
    if (typeof block.y === "number") block.y -= lift;
  });
  list.unshift(...moved);
}
function pushToNextPage(pages, from, spilled) {
  if (!pages[from + 1]) pages.push({ id: `page-${crypto.randomUUID()}`, name: `Page ${pages.length + 1}`, blocks: [] });
  placeAtTop(blocksOf2(pages[from + 1]), spilled);
}
function settlePages(state, from, only, options) {
  const pages = state.pages ?? [];
  const settle = { ...options, overflow: options.overflow ?? "newPage", pageHeight: PAGE_HEIGHT };
  for (let i = from; i < pages.length && i < from + MAX_PAGES_TOUCHED; i++) {
    const spilled = settleList(blocksOf2(pages[i]), settle);
    if (spilled.length > 0) pushToNextPage(pages, i, spilled);
    else if (only) return;
  }
}
function settleUnpaged(state, options) {
  const probe = tidyLayout(state.blocks, { ...options, overflow: options.overflow ?? "newPage", pageHeight: PAGE_HEIGHT });
  if ([...probe.values()].some((change) => change.overflow)) {
    ensurePages(state);
    settlePages(state, 0, true, options);
    return;
  }
  settleList(state.blocks, { ...options, overflow: "none" });
}
function moveBlockToPage(op, state) {
  const { targetId, pageId } = op;
  if (!targetId || !pageId) return 'moveBlockToPage needs targetId and pageId, e.g. {"op":"moveBlockToPage","targetId":"b1","pageId":"page-2"}';
  const pages = ensurePages(state);
  const fromIdx = pages.findIndex((page) => blocksOf2(page).some((b) => b.id === targetId));
  if (fromIdx < 0) return `block "${targetId}" not found`;
  let toIdx = pages.findIndex((page) => page.id === pageId);
  if (toIdx < 0) {
    if (!op.create) return `page "${pageId}" not found: add it first with addPage, or pass create:true`;
    pages.splice(fromIdx + 1, 0, { id: pageId, name: `Page ${pages.length + 1}`, blocks: [] });
    toIdx = fromIdx + 1;
  }
  if (toIdx === fromIdx) return null;
  const source = blocksOf2(pages[fromIdx]);
  const [block] = source.splice(source.findIndex((b) => b.id === targetId), 1);
  block.y = typeof op.y === "number" ? op.y : TOP_MARGIN;
  const target = blocksOf2(pages[toIdx]);
  const after = op.afterId ? target.findIndex((b) => b.id === op.afterId) : -1;
  if (after >= 0) target.splice(after + 1, 0, block);
  else placeAtTop(target, [block]);
  settlePages(state, toIdx, true, { closeGaps: false, fitText: false });
  return null;
}

// server/routes/sceneOpsApplier.ts
import crypto2 from "crypto";
function applyAddPage(op, state) {
  if (!state.pages) state.pages = [];
  const newPageId = op.id || `page-${crypto2.randomUUID()}`;
  const newPageName = op.name || `Page ${state.pages.length + 1}`;
  if (state.pages.some((p) => p.id === newPageId)) return `page "${newPageId}" already exists`;
  const newPage = { id: newPageId, name: newPageName, blocks: [] };
  if (op.afterPageId) {
    const idx = state.pages.findIndex((p) => p.id === op.afterPageId);
    if (idx >= 0) {
      state.pages.splice(idx + 1, 0, newPage);
      return null;
    }
  }
  state.pages.push(newPage);
  return null;
}
function applyDeletePage(op, state) {
  if (!state.pages || state.pages.length === 0) return "no pages to delete";
  if (state.pages.length <= 1) return "cannot delete the only remaining page";
  const idx = state.pages.findIndex((p) => p.id === op.pageId);
  if (idx === -1) return `page "${op.pageId}" not found`;
  const page = state.pages[idx];
  if (Array.isArray(page.blocks) && page.blocks.length > 0) {
    return `page "${op.pageId}" is not empty (${page.blocks.length} block(s)) \u2014 delete or move its blocks first`;
  }
  state.pages.splice(idx, 1);
  return null;
}
function applyMovePage(op, state) {
  if (!state.pages || state.pages.length === 0) return "no pages";
  const idx = state.pages.findIndex((p) => p.id === op.pageId);
  if (idx === -1) return `page "${op.pageId}" not found`;
  if (op.toIndex < 0 || op.toIndex >= state.pages.length) return `toIndex ${op.toIndex} out of range`;
  const [removed] = state.pages.splice(idx, 1);
  state.pages.splice(op.toIndex, 0, removed);
  return null;
}
function applyRenamePage(op, state) {
  if (!state.pages || state.pages.length === 0) return "no pages";
  const page = state.pages.find((p) => p.id === op.pageId);
  if (!page) return `page "${op.pageId}" not found`;
  if (!op.newName || !op.newName.trim()) return "page name cannot be empty";
  page.name = op.newName.trim();
  return null;
}
function findBox(state, id) {
  const block = state.blocks.find((b) => b.id === id && b.kind === "box");
  if (block) return block;
  const node = state.sceneNodes[id];
  return node?.kind === "box" ? node : null;
}
function findParentOf(state, id) {
  const holds = (n) => n?.kind === "box" && Array.isArray(n.childIds) && n.childIds.includes(id);
  const found = state.blocks.find(holds) ?? Object.values(state.sceneNodes).find(holds);
  return found ?? null;
}
function applyInsertItem(op, state) {
  const { parentBoxId, index, item } = op;
  if (!parentBoxId || typeof index !== "number" || !item) return "insertItem needs parentBoxId, a numeric index and an item object";
  const parent = findBox(state, parentBoxId);
  if (!parent) return `parent box "${parentBoxId}" not found`;
  if (!Array.isArray(parent.childIds)) parent.childIds = [];
  state.sceneNodes[item.id] = item;
  const insertPos = Math.max(0, Math.min(index, parent.childIds.length));
  parent.childIds.splice(insertPos, 0, item.id);
  return null;
}
function removeNodeFromParents(state, itemId) {
  for (const b of state.blocks) if (b.kind === "box" && Array.isArray(b.childIds)) b.childIds = b.childIds.filter((c) => c !== itemId);
  for (const n of Object.values(state.sceneNodes)) if (n?.kind === "box" && Array.isArray(n.childIds)) n.childIds = n.childIds.filter((c) => c !== itemId);
}
function applyMoveItem(op, state) {
  const { itemId, toParentBoxId, toIndex } = op;
  if (!itemId || !toParentBoxId || typeof toIndex !== "number") return "moveItem needs itemId, toParentBoxId and a numeric toIndex";
  const targetParent = findBox(state, toParentBoxId);
  if (!targetParent) return `destination box "${toParentBoxId}" not found`;
  removeNodeFromParents(state, itemId);
  if (!Array.isArray(targetParent.childIds)) targetParent.childIds = [];
  const insertPos = Math.max(0, Math.min(toIndex, targetParent.childIds.length));
  targetParent.childIds.splice(insertPos, 0, itemId);
  return null;
}
function mapTexts(body, transform) {
  const mapped = { en: "" };
  for (const [language, text] of Object.entries(body)) mapped[language] = transform(text ?? "");
  return mapped;
}
function splitTextBody(oldBody, caretOffset) {
  if (typeof oldBody === "string") {
    const nextAfterBody2 = oldBody.slice(caretOffset);
    return { nextBeforeBody: oldBody.slice(0, caretOffset), nextAfterBody: nextAfterBody2, hasAfter: Boolean(nextAfterBody2.trim()) };
  }
  const body = oldBody ?? {};
  const nextBeforeBody = mapTexts(body, (text) => text.slice(0, caretOffset));
  const nextAfterBody = mapTexts(body, (text) => text.slice(caretOffset));
  const hasAfter = Object.values(nextAfterBody).some((text) => text.trim() !== "");
  return { nextBeforeBody, nextAfterBody, hasAfter };
}
function applySplitText(op, state) {
  const { targetId, caretOffset, insertItem } = op;
  if (!targetId || typeof caretOffset !== "number" || !insertItem) return "splitText needs targetId, a numeric caretOffset and an insertItem object";
  const targetNode = state.sceneNodes[targetId];
  if (!targetNode || targetNode.kind !== "text") return `target text node "${targetId}" not found`;
  const parent = findParentOf(state, targetId);
  if (!parent) return `parent box of "${targetId}" not found`;
  const idx = parent.childIds.indexOf(targetId);
  const { nextBeforeBody, nextAfterBody, hasAfter } = splitTextBody(targetNode.body, caretOffset);
  targetNode.body = nextBeforeBody;
  state.sceneNodes[insertItem.id] = insertItem;
  const nextChildIds = [...parent.childIds];
  let insertIndex = idx + 1;
  nextChildIds.splice(insertIndex, 0, insertItem.id);
  insertIndex++;
  if (hasAfter) {
    const afterNodeId = `${targetId}-after-${Date.now()}`;
    state.sceneNodes[afterNodeId] = { id: afterNodeId, kind: "text", body: nextAfterBody };
    nextChildIds.splice(insertIndex, 0, afterNodeId);
  }
  parent.childIds = nextChildIds;
  return null;
}
function cleanSubtreeNodes(targetBox2, newNodes, state) {
  const oldReachable = /* @__PURE__ */ new Set();
  const getOldSubtreeIds = (cid) => {
    oldReachable.add(cid);
    const node = state.sceneNodes[cid];
    if (node?.kind === "box" && Array.isArray(node.childIds)) node.childIds.forEach(getOldSubtreeIds);
  };
  if (Array.isArray(targetBox2.childIds)) targetBox2.childIds.forEach(getOldSubtreeIds);
  for (const oldId of oldReachable) if (!newNodes[oldId]) delete state.sceneNodes[oldId];
}
function validateNewChildIds(newChildIds, newNodes, state) {
  for (const cid of newChildIds) {
    if (!newNodes[cid] && !state.sceneNodes[cid]) return false;
  }
  return true;
}
function applyReplaceBoxContent(op, state) {
  const { boxId, nodes: newNodes, childIds: newChildIds } = op;
  if (!boxId || !newNodes || !Array.isArray(newChildIds)) return "replaceBoxContent needs boxId, nodes and childIds";
  const targetBox2 = findBox(state, boxId);
  if (!targetBox2) return `box "${boxId}" not found`;
  if (!validateNewChildIds(newChildIds, newNodes, state)) return "childId not found in nodes";
  cleanSubtreeNodes(targetBox2, newNodes, state);
  Object.assign(state.sceneNodes, newNodes);
  targetBox2.childIds = newChildIds;
  return null;
}
var CANVAS_BOUNDS = { width: 794, height: 1123 };
function blockLists(state) {
  const pageLists = (state.pages ?? []).map((p) => p.blocks).filter(Array.isArray);
  return [state.blocks, ...pageLists];
}
function blockCopies(state, id) {
  return blockLists(state).flatMap((list) => list.filter((b) => b.id === id));
}
function applySetField(op, state) {
  const { targetId, fields: patchFields } = op;
  if (!targetId || !patchFields || typeof patchFields !== "object") return 'setField needs targetId and a fields object, e.g. {"op":"setField","targetId":"b1","fields":{"body":"text"}}';
  const copies = blockCopies(state, targetId);
  if (copies.length > 0) copies.forEach((block) => Object.assign(block, patchFields));
  else if (state.sceneNodes[targetId]) Object.assign(state.sceneNodes[targetId], patchFields);
  else return `target "${targetId}" not found in blocks or nodes`;
  return null;
}
function otherRects(state, excludeId) {
  return state.blocks.filter((b) => b.id !== excludeId && [b.x, b.y, b.width, b.height].every((n) => typeof n === "number")).map((b) => ({ x: b.x, y: b.y, width: b.width, height: b.height }));
}
function applySetGeometry(op, state) {
  const { targetId, x, y, width, height } = op;
  if (!targetId || ![x, y, width, height].every((n) => typeof n === "number")) return "setGeometry needs targetId and numeric x, y, width, height";
  const copies = blockCopies(state, targetId);
  if (copies.length === 0) return `block "${targetId}" not found`;
  const size = clampSize({ x, y, width, height }, CANVAS_BOUNDS);
  const pos = resolveNonOverlappingPosition({ x, y, ...size }, CANVAS_BOUNDS, otherRects(state, targetId));
  copies.forEach((block) => Object.assign(block, { ...size, ...pos }));
  return null;
}
function findOrCreateTargetPage(state, pageId) {
  if (!Array.isArray(state.pages)) {
    state.pages = [{ id: pageId, name: "Page 1", blocks: [] }];
  }
  const targetPage = state.pages.find((p) => p.id === pageId);
  if (targetPage) return targetPage;
  if (state.pages.length === 1 && (!state.pages[0].blocks || state.pages[0].blocks.length === 0)) {
    state.pages[0].id = pageId;
    return state.pages[0];
  }
  return `page "${pageId}" not found`;
}
function insertIntoList(list, blockRecord, afterId) {
  const idx = afterId ? list.findIndex((b) => b.id === afterId) : -1;
  if (idx >= 0) list.splice(idx + 1, 0, blockRecord);
  else list.push(blockRecord);
}
function defaultPageId(state, afterId) {
  const pages = state.pages ?? [];
  const holder = afterId ? pages.find((p) => Array.isArray(p.blocks) && p.blocks.some((b) => b.id === afterId)) : void 0;
  return (holder ?? pages[0])?.id ?? void 0;
}
function applyInsertBlock(op, state) {
  const { block, afterId, pageId } = op;
  const err = validateBlock(block, 0, state.sceneNodes);
  if (err) return `invalid block: ${err}`;
  const clamped = clampSize(block, CANVAS_BOUNDS);
  const size = { ...clamped, width: fitBlockWidth({ ...block, ...clamped }) };
  const pos = resolveNonOverlappingPosition({ x: block.x, y: block.y, ...size }, CANVAS_BOUNDS, otherRects(state));
  const cap = isAutoFitBlock(block) ? { maxWidth: clamped.width } : {};
  const blockRecord = { ...block, ...size, ...pos, ...cap };
  const targetPageId = pageId ?? defaultPageId(state, afterId);
  if (targetPageId) {
    const res = findOrCreateTargetPage(state, targetPageId);
    if (typeof res === "string") return res;
    if (!Array.isArray(res.blocks)) res.blocks = [];
    insertIntoList(res.blocks, blockRecord, afterId);
    clearOverlapsAround(state, String(blockRecord.id));
    return null;
  }
  insertIntoList(state.blocks, blockRecord, afterId);
  clearOverlapsAround(state, String(blockRecord.id));
  return null;
}
function isAutoFitBlock(block) {
  const fits = block.kind === "richText" || block.kind === "data" && block.format === "table";
  return fits && block.autoFit !== false;
}
function clearOverlapsAround(state, blockId) {
  const options = { closeGaps: false, fitText: false };
  const pageIdx = (state.pages ?? []).findIndex((p) => (p.blocks ?? []).some((b) => b.id === blockId));
  if (pageIdx >= 0) settlePages(state, pageIdx, true, options);
  else settleUnpaged(state, options);
}
function applyReplaceBlock(op, state) {
  const { targetId, block } = op;
  if (!targetId || !block || typeof block !== "object") return 'replaceBlock needs targetId and a block object, e.g. {"op":"replaceBlock","targetId":"b1","block":{"kind":"data","format":"table","columns":["A"],"rows":[["1"]]}}';
  const old = blockCopies(state, targetId)[0];
  if (!old) return `block "${targetId}" not found`;
  const { x, y, width, height } = old;
  const next = { x, y, width, height, ...block, id: targetId };
  const err = validateBlock(next, 0, state.sceneNodes);
  if (err) return `invalid block: ${err}`;
  if (isAutoFitBlock(next)) Object.assign(next, { maxWidth: next.width, width: fitBlockWidth(next) });
  for (const list of blockLists(state)) {
    const at = list.findIndex((b) => b.id === targetId);
    if (at >= 0) list[at] = { ...next };
  }
  clearOverlapsAround(state, targetId);
  return null;
}
function applyTidyLayout(op, state) {
  const options = { gap: op.gap, overflow: op.overflow ?? "newPage" };
  if (!state.pages || state.pages.length === 0) {
    settleUnpaged(state, options);
    return null;
  }
  const from = op.pageId ? state.pages.findIndex((p) => p.id === op.pageId) : 0;
  if (from < 0) return `page "${op.pageId}" not found`;
  settlePages(state, from, Boolean(op.pageId), options);
  return null;
}
function applyMoveBlockToPage(op, state) {
  return moveBlockToPage(op, state);
}
function applyDeleteNode(op, state) {
  const { targetId } = op;
  if (!targetId) return "missing targetId";
  state.blocks = state.blocks.filter((b) => b.id !== targetId && (b.kind !== "connector" || b.fromBlockId !== targetId && b.toBlockId !== targetId));
  delete state.sceneNodes[targetId];
  removeNodeFromParents(state, targetId);
  if (Array.isArray(state.pages)) {
    for (const page of state.pages) {
      if (Array.isArray(page.blocks)) {
        page.blocks = page.blocks.filter((b) => b.id !== targetId);
      }
    }
  }
  return null;
}
function applyReplaceScene(op, state) {
  const err = validateBlocks(op.blocks, state.sceneNodes);
  if (err) return `invalid blocks: ${err}`;
  state.blocks = op.blocks;
  return null;
}
var OP_HANDLERS = {
  setField: applySetField,
  setGeometry: applySetGeometry,
  insertBlock: applyInsertBlock,
  replaceBlock: applyReplaceBlock,
  tidyLayout: applyTidyLayout,
  moveBlockToPage: applyMoveBlockToPage,
  deleteNode: applyDeleteNode,
  insertItem: applyInsertItem,
  moveItem: applyMoveItem,
  splitText: applySplitText,
  replaceBoxContent: applyReplaceBoxContent,
  replaceScene: applyReplaceScene,
  addPage: applyAddPage,
  deletePage: applyDeletePage,
  movePage: applyMovePage,
  renamePage: applyRenamePage
};
function applySingleSceneOp(op, state) {
  const opName = op.op;
  const handler = OP_HANDLERS[opName];
  if (!handler) return `unrecognized op "${opName}"`;
  return handler(op, state);
}
function pruneDanglingConnectors(blocks) {
  const existingIds = new Set(blocks.filter((b) => b && b.kind !== "connector" && typeof b.id === "string").map((b) => b.id));
  return blocks.filter((b) => {
    if (b && b.kind === "connector") {
      return typeof b.fromBlockId === "string" && typeof b.toBlockId === "string" && existingIds.has(b.fromBlockId) && existingIds.has(b.toBlockId);
    }
    return true;
  });
}

// server/routes/assetUpload.ts
import { Router as Router4 } from "express";
import express from "express";
import fs5 from "fs/promises";
import path7 from "path";

// vite-plugins/uploadValidation.ts
import path6 from "path";
import { randomBytes } from "crypto";
var InvalidUploadError = class extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
    this.name = "InvalidUploadError";
  }
  reason;
};
var InvalidSlugError = class extends Error {
  constructor(slug, reason) {
    super(`Invalid slug '${slug}': ${reason}`);
    this.slug = slug;
    this.reason = reason;
    this.name = "InvalidSlugError";
  }
  slug;
  reason;
};
var SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;
var RESERVED_WINDOWS_NAMES = /* @__PURE__ */ new Set([
  "con",
  "nul",
  "aux",
  "prn",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9"
]);
var PURELY_NUMERIC_RE = /^[0-9]+$/;
var MAX_SLUG_LENGTH = 64;
function validateSlug(slug) {
  if (slug.length === 0) {
    throw new InvalidSlugError(slug, "must not be empty");
  }
  if (slug.length > MAX_SLUG_LENGTH) {
    throw new InvalidSlugError(slug, `must be at most ${MAX_SLUG_LENGTH} characters`);
  }
  if (!SLUG_RE.test(slug)) {
    throw new InvalidSlugError(slug, "must match /^[a-z0-9][a-z0-9_-]*$/");
  }
  if (RESERVED_WINDOWS_NAMES.has(slug.toLowerCase())) {
    throw new InvalidSlugError(slug, "is a reserved Windows device name");
  }
  if (/[. ]$/.test(slug)) {
    throw new InvalidSlugError(slug, "must not end with a dot or space");
  }
  if (PURELY_NUMERIC_RE.test(slug)) {
    throw new InvalidSlugError(slug, "must not be purely numeric");
  }
}
var VALID_EXTENSIONS = /* @__PURE__ */ new Set(["png", "jpg", "jpeg", "webp", "mp4", "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt", "md"]);
function assertValidExtension(filename) {
  const ext = path6.extname(filename).slice(1).toLowerCase();
  if (!ext || !VALID_EXTENSIONS.has(ext)) {
    throw new InvalidUploadError(
      `Extension '${ext || "(none)"}' is not allowed. Allowed: ${[...VALID_EXTENSIONS].join(", ")}`
    );
  }
  return ext;
}
function isOleCompound(buf) {
  return buf.length >= 4 && buf[0] === 208 && buf[1] === 207 && buf[2] === 17 && buf[3] === 224;
}
function isPlainText(buf) {
  return !buf.subarray(0, 4096).includes(0);
}
function isZipContainer(buf) {
  return buf.length >= 4 && buf[0] === 80 && buf[1] === 75 && buf[2] === 3 && buf[3] === 4;
}
var MAGIC_BYTES = {
  png: (buf) => buf.length >= 8 && buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71,
  jpg: (buf) => buf.length >= 3 && buf[0] === 255 && buf[1] === 216 && buf[2] === 255,
  jpeg: (buf) => MAGIC_BYTES.jpg(buf),
  webp: (buf) => buf.length >= 12 && buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP",
  mp4: (buf) => buf.length >= 8 && buf.slice(4, 8).toString("ascii") === "ftyp",
  pdf: (buf) => buf.length >= 5 && buf.slice(0, 5).toString("ascii") === "%PDF-",
  // Office Open XML files are zip containers; the zip local-header signature is the only check available here.
  docx: isZipContainer,
  pptx: isZipContainer,
  xlsx: isZipContainer,
  // Legacy Office files are OLE compound documents, not zip containers.
  doc: isOleCompound,
  ppt: isOleCompound,
  xls: isOleCompound,
  // Plain text has no signature; a NUL byte in the opening bytes means it is binary.
  csv: isPlainText,
  txt: isPlainText,
  md: isPlainText
};
function assertValidMagicBytes(buffer, extension) {
  const check = MAGIC_BYTES[extension];
  if (!check || !check(buffer)) {
    throw new InvalidUploadError(`File content does not match the expected signature for '.${extension}'`);
  }
}
var DOCUMENT_EXTENSIONS = /* @__PURE__ */ new Set(["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt", "md"]);
function isDocumentExtension(extension) {
  return DOCUMENT_EXTENSIONS.has(extension);
}
function safeDocumentName(originalFilename) {
  const unsafe = '<>:|?*"/' + String.fromCharCode(92);
  const base = Array.from(path6.basename(originalFilename)).map((c) => unsafe.includes(c) || c.charCodeAt(0) < 32 ? "_" : c).join("").trim();
  if (base.length === 0 || base === "." || base === "..") {
    throw new InvalidUploadError("Filename is empty after removing unsafe characters");
  }
  return base;
}
function sanitizeUploadFilename(originalFilename) {
  const ext = assertValidExtension(originalFilename);
  const randomSlug = randomBytes(8).toString("hex");
  return `${randomSlug}.${ext}`;
}
function resolveUploadPath(publicAssetsRoot, courseId, topicId, filename) {
  validateSlug(courseId);
  validateSlug(topicId);
  const joined = path6.join(publicAssetsRoot, courseId, topicId, filename);
  const resolvedRoot = path6.resolve(publicAssetsRoot);
  const resolvedPath = path6.resolve(joined);
  if (!resolvedPath.startsWith(resolvedRoot + path6.sep) && resolvedPath !== resolvedRoot) {
    throw new InvalidUploadError("Resolved upload path escapes the assets root");
  }
  return joined;
}

// server/routes/assetUpload.ts
var assetUploadRouter = Router4();
var UPLOAD_ASSETS_ROOT = path7.resolve(DATA_ROOT, "data", "assets");
var MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
var uploadRawParser = express.raw({
  type: [
    "image/png",
    "image/jpeg",
    "image/webp",
    "video/mp4",
    "application/pdf",
    "application/octet-stream",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ],
  limit: MAX_UPLOAD_BYTES
});
function decodeFilenameHeader(encoded) {
  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new InvalidUploadError("x-upload-filename is not valid percent-encoding");
  }
}
async function handleUploadAsset(req, res) {
  const courseId = req.header("x-upload-course");
  const topicId = req.header("x-upload-topic");
  const originalFilename = req.header("x-upload-filename");
  if (!courseId || !topicId || !originalFilename) {
    return void res.status(400).json({ error: "x-upload-course, x-upload-topic, and x-upload-filename headers are required" });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return void res.status(400).json({ error: "Request body must be the raw file bytes" });
  }
  try {
    const extension = assertValidExtension(originalFilename);
    assertValidMagicBytes(req.body, extension);
    const generatedName = isDocumentExtension(extension) ? safeDocumentName(decodeFilenameHeader(originalFilename)) : sanitizeUploadFilename(originalFilename);
    const destPath = resolveUploadPath(UPLOAD_ASSETS_ROOT, courseId, topicId, generatedName);
    await fs5.mkdir(path7.dirname(destPath), { recursive: true });
    await fs5.writeFile(destPath, req.body);
    res.json({ path: `/assets/${courseId}/${topicId}/${generatedName}` });
  } catch (err) {
    if (err instanceof InvalidSlugError || err instanceof InvalidUploadError) {
      return void res.status(400).json({ error: err.message });
    }
    throw err;
  }
}
assetUploadRouter.post("/canvas-editor/upload", uploadRawParser, route(handleUploadAsset));

// server/routes/scenes.ts
function resolvePagesForSave(opsRequested, reqBodyPages, scenePages) {
  if (!opsRequested && Array.isArray(reqBodyPages)) {
    return reqBodyPages;
  }
  if (Array.isArray(scenePages)) {
    return scenePages.map((p) => ({
      ...p,
      blocks: Array.isArray(p.blocks) ? p.blocks.map((b) => ({ ...b })) : []
    }));
  }
  return void 0;
}
function buildMutationState(scene, reqBody) {
  const opsRequested = Array.isArray(reqBody.ops) && reqBody.ops.length > 0;
  return {
    blocks: (scene.blocks || []).map((b) => ({ ...b })),
    sceneNodes: { ...scene.nodes || {}, ...reqBody.nodes || {} },
    pages: resolvePagesForSave(opsRequested, reqBody.pages, scene.pages)
  };
}
function applyOptionalSceneFields(scene, reqBody, mutationPages) {
  if (reqBody.pageSize !== void 0) scene.pageSize = reqBody.pageSize;
  if (reqBody.boundaryVisible !== void 0) scene.boundaryVisible = Boolean(reqBody.boundaryVisible);
  if (reqBody.margin !== void 0) {
    const margin = Number(reqBody.margin);
    scene.margin = Number.isFinite(margin) ? Math.max(0, margin) : 0;
  }
  if (mutationPages !== void 0 || reqBody.pages !== void 0) {
    scene.pages = mutationPages ?? reqBody.pages;
  }
}
function collectAllIncomingBlockIds(req) {
  const blockLists2 = [req.body.replaceBlocks, req.body.addedBlocks];
  if (Array.isArray(req.body.pages)) blockLists2.push(...req.body.pages.map((page) => page?.blocks));
  const ids = /* @__PURE__ */ new Set();
  for (const list of blockLists2) {
    if (!Array.isArray(list)) continue;
    for (const b of list) {
      const id = b && typeof b === "object" ? b.id : void 0;
      if (typeof id === "string") ids.add(id);
    }
  }
  return ids;
}
function findConnectorAnchorError(list, allIds) {
  for (const [i, raw] of list.entries()) {
    const b = raw;
    if (b.kind !== "connector") continue;
    for (const side of ["fromBlockId", "toBlockId"]) {
      if (!allIds.has(b[side])) return `Invalid blocks: connector at index ${i} ("${b.id}"): ${side} "${b[side]}" does not match any block in this request`;
    }
  }
  return null;
}
function validateInitialBlocks(req) {
  if (typeof req.body?.sceneId !== "string") return "sceneId must be a string";
  const allIds = collectAllIncomingBlockIds(req);
  for (const list of [req.body.replaceBlocks, req.body.addedBlocks]) {
    if (!Array.isArray(list) || list.length === 0) continue;
    const err = validateBlocks(list, req.body.nodes);
    if (err) return `Invalid blocks: ${err}`;
    const anchorError = findConnectorAnchorError(list, allIds);
    if (anchorError) return anchorError;
  }
  return null;
}
function patchDeletes(blocks, deletedIds) {
  if (!deletedIds || deletedIds.length === 0) return blocks;
  const deleteSet = new Set(deletedIds);
  return blocks.filter((b) => !deleteSet.has(b.id)).filter((b) => b.kind !== "connector" || !deleteSet.has(b.fromBlockId) && !deleteSet.has(b.toBlockId));
}
function patchContent(blocks, patches) {
  if (!patches || patches.length === 0) return;
  for (const patch of patches) {
    const block = blocks.find((b) => b.id === patch.id);
    if (block && patch.fields) Object.assign(block, patch.fields);
  }
}
function patchGeometry(blocks, patches) {
  if (!patches || patches.length === 0) return;
  for (const patch of patches) {
    const block = blocks.find((b) => b.id === patch.id);
    if (block) Object.assign(block, { x: patch.x, y: patch.y, width: patch.width, height: patch.height });
  }
}
function applyLegacyPatches(initialBlocks, body) {
  const { replaceBlocks, deletedIds, addedBlocks, contentPatches, geometryPatches } = body;
  if (replaceBlocks && replaceBlocks.length > 0) return replaceBlocks;
  let blocks = patchDeletes(initialBlocks, deletedIds);
  if (addedBlocks && addedBlocks.length > 0) blocks = [...blocks, ...addedBlocks];
  patchContent(blocks, contentPatches);
  patchGeometry(blocks, geometryPatches);
  return blocks;
}
function checkOptimisticConcurrency(scene, topic, expectedVersion, expectedUpdatedAt) {
  if (expectedVersion !== void 0) {
    const currentVersion = typeof scene.version === "number" ? scene.version : 0;
    if (currentVersion !== expectedVersion) {
      return {
        error: `Conflict: scene version mismatch. Expected version ${expectedVersion}, but server has version ${currentVersion}.`,
        currentVersion,
        expectedVersion
      };
    }
  }
  if (expectedUpdatedAt !== void 0) {
    const currentUpdatedAt = (typeof scene.updatedAt === "string" ? scene.updatedAt : topic.updatedAt?.toISOString()) ?? null;
    if (currentUpdatedAt && currentUpdatedAt !== expectedUpdatedAt) {
      return {
        error: `Conflict: scene timestamp mismatch. Expected updatedAt ${expectedUpdatedAt}, but server has ${currentUpdatedAt}.`,
        currentUpdatedAt,
        expectedUpdatedAt
      };
    }
  }
  return null;
}
var scenesRouter = Router5();
var MAX_OPS = 1e3;
scenesRouter.use(assetUploadRouter);
function executeMutationOps(req, mutationState) {
  const { ops } = req.body;
  if (Array.isArray(ops) && ops.length > 0) {
    if (ops.length > MAX_OPS) {
      return `Too many scene operations in request (max ${MAX_OPS})`;
    }
    for (let i = 0; i < ops.length; i++) {
      const err = applySingleSceneOp(ops[i], mutationState);
      if (err) return `Op ${i}: ${err}`;
    }
    return null;
  }
  mutationState.blocks = applyLegacyPatches(mutationState.blocks, req.body);
  return null;
}
function prepareSceneObject(topic) {
  const scene = topic.scene || {};
  if (!scene.canvasSize) scene.canvasSize = { width: 1200, height: 800 };
  return scene;
}
async function persistSceneMutation(prisma3, topic, scene, mutationState, req, res) {
  await snapshotScene(prisma3, topic);
  scene.version = (typeof scene.version === "number" ? scene.version : 0) + 1;
  scene.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const hasPages = Array.isArray(mutationState.pages) && mutationState.pages.length > 0;
  if (!hasPages) scene.blocks = mutationState.blocks;
  scene.nodes = mutationState.sceneNodes;
  applyOptionalSceneFields(scene, req.body, mutationState.pages);
  await commitScene(prisma3, topic, scene, "ai-ops");
  res.json({ updatedIds: mutationState.blocks.map((b) => b.id), version: scene.version, updatedAt: scene.updatedAt, scene });
}
async function fetchTopicAndScene(prisma3, sceneId, reqBody) {
  const topic = await prisma3.topic.findFirst({ where: sceneIdWhere(sceneId) });
  if (!topic) return { status: 404, error: `No topic found with scene id '${sceneId}'`, topic: null, scene: null };
  const scene = prepareSceneObject(topic);
  const conflict = checkOptimisticConcurrency(scene, topic, reqBody.expectedVersion ?? reqBody.version, reqBody.expectedUpdatedAt ?? reqBody.updatedAt);
  if (conflict) return { status: 409, conflict, topic: null, scene: null };
  return { status: 200, topic, scene };
}
async function handleSaveScene(req, res) {
  const prisma3 = req.prisma;
  const initialError = validateInitialBlocks(req);
  if (initialError) return void res.status(400).json({ error: initialError });
  const sceneFetch = await fetchTopicAndScene(prisma3, req.body.sceneId, req.body);
  if (sceneFetch.status !== 200) {
    if (sceneFetch.error) return void res.status(sceneFetch.status).json({ error: sceneFetch.error });
    if (sceneFetch.conflict) return void res.status(sceneFetch.status).json(sceneFetch.conflict);
    return;
  }
  const { topic, scene } = sceneFetch;
  if (!topic || !scene) return void res.status(500).json({ error: "Internal server error" });
  const mutationState = buildMutationState(scene, req.body);
  const opErr = executeMutationOps(req, mutationState);
  if (opErr) return void res.status(400).json({ error: opErr });
  mutationState.blocks = pruneDanglingConnectors(mutationState.blocks);
  const validationError = validateBlocks(mutationState.blocks, mutationState.sceneNodes);
  if (validationError) return void res.status(400).json({ error: `Invalid scene state after operations: ${validationError}` });
  await persistSceneMutation(prisma3, topic, scene, mutationState, req, res);
}
scenesRouter.post("/canvas-editor/save", route(handleSaveScene));
async function findTopicForTarget(prisma3, targetId) {
  return await prisma3.topic.findFirst({ where: topicOrIdWhere(targetId) });
}
function formatSceneResult(topic, scene) {
  return {
    scene,
    topicId: topic.topicId,
    version: typeof scene.version === "number" ? scene.version : 0,
    updatedAt: (typeof scene.updatedAt === "string" ? scene.updatedAt : topic.updatedAt?.toISOString()) ?? null
  };
}
async function handleGetScene(req, res) {
  const prisma3 = req.prisma;
  const rawTarget = req.query.sceneId || req.query.topicId || req.query.path;
  if (typeof rawTarget !== "string" || !rawTarget) {
    return void res.status(400).json({ error: "sceneId, topicId, or path query parameter must be a string" });
  }
  const topic = await findTopicForTarget(prisma3, rawTarget);
  if (!topic) return void res.status(404).json({ error: `No topic found with scene id '${rawTarget}'` });
  const scene = topic.scene;
  if (!scene || Object.keys(scene).length === 0) return void res.status(404).json({ error: `Topic '${rawTarget}' has no canvas scene data` });
  res.json(formatSceneResult(topic, scene));
}
scenesRouter.get("/canvas-editor/scene", route(handleGetScene));

// server/routes/chat.ts
import { Router as Router6 } from "express";
var chatRouter = Router6();
var SESSION_ID = "default";
var NULL_CHAR = String.fromCharCode(0);
function stripNullBytes(value) {
  if (typeof value === "string") return value.split(NULL_CHAR).join("");
  if (Array.isArray(value)) return value.map(stripNullBytes);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = stripNullBytes(v);
    return out;
  }
  return value;
}
chatRouter.get("/chat-session", route(async (req, res) => {
  const prisma3 = req.prisma;
  const session = await prisma3.chatSession.findUnique({ where: { id: SESSION_ID } });
  if (!session) {
    return void res.json({ displayMessages: [], conversationHistory: [] });
  }
  res.json({
    displayMessages: session.displayMessages,
    conversationHistory: session.conversationHistory
  });
}));
chatRouter.put("/chat-session", route(async (req, res) => {
  const prisma3 = req.prisma;
  const { displayMessages, conversationHistory } = req.body;
  if (!Array.isArray(displayMessages) || !Array.isArray(conversationHistory)) {
    return void res.status(400).json({ error: "displayMessages and conversationHistory must be arrays" });
  }
  await prisma3.chatSession.upsert({
    where: { id: SESSION_ID },
    create: {
      id: SESSION_ID,
      displayMessages: stripNullBytes(displayMessages),
      conversationHistory: stripNullBytes(conversationHistory)
    },
    update: {
      displayMessages: stripNullBytes(displayMessages),
      conversationHistory: stripNullBytes(conversationHistory)
    }
  });
  res.json({ success: true });
}));
chatRouter.delete("/chat-session", route(async (req, res) => {
  const prisma3 = req.prisma;
  await prisma3.chatSession.deleteMany({ where: { id: SESSION_ID } });
  res.json({ success: true });
}));

// server/routes/aiChatProxy.ts
import { Router as Router7 } from "express";

// src/core/shared/aiTypes.ts
function classifyAiErrorStatus(status) {
  if (status === 408 || status === 504) return "timeout";
  if (status === 429) return "rate-limit";
  if (status === 401 || status === 403) return "auth";
  if (status === 400 || status === 422) return "bad-request";
  if (status >= 500) return "provider";
  return "network";
}
var AiProviderError = class extends Error {
  constructor(status, providerMessage, category) {
    super(`AI provider error (${status}): ${providerMessage}`);
    this.status = status;
    this.providerMessage = providerMessage;
    this.name = "AiProviderError";
    this.category = category ?? classifyAiErrorStatus(status);
  }
  status;
  providerMessage;
  category;
};

// src/core/shared/aiProviders.ts
var PROVIDER_KEYS = {
  ANTHROPIC: "anthropic",
  OPENAI: "openai",
  GEMINI: "gemini",
  DEEPSEEK: "deepseek",
  XAI: "xai",
  MISTRAL: "mistral",
  GROQ: "groq",
  COHERE: "cohere",
  META: "meta",
  PERPLEXITY: "perplexity"
};
var PROVIDER_ENDPOINTS = {
  [PROVIDER_KEYS.ANTHROPIC]: "https://api.anthropic.com/v1",
  [PROVIDER_KEYS.OPENAI]: "https://api.openai.com/v1",
  [PROVIDER_KEYS.GEMINI]: "https://generativelanguage.googleapis.com/v1beta/models",
  [PROVIDER_KEYS.DEEPSEEK]: "https://api.deepseek.com/v1",
  [PROVIDER_KEYS.XAI]: "https://api.x.ai/v1",
  [PROVIDER_KEYS.MISTRAL]: "https://api.mistral.ai/v1",
  [PROVIDER_KEYS.GROQ]: "https://api.groq.com/openai/v1",
  [PROVIDER_KEYS.COHERE]: "https://api.cohere.ai/compatibility/v1",
  [PROVIDER_KEYS.META]: "https://api.llama.com/compat/v1",
  [PROVIDER_KEYS.PERPLEXITY]: "https://api.perplexity.ai"
};
var ENV_KEY_BY_PROVIDER = {
  [PROVIDER_KEYS.ANTHROPIC]: "ANTHROPIC_API_KEY",
  [PROVIDER_KEYS.OPENAI]: "OPENAI_API_KEY",
  [PROVIDER_KEYS.GEMINI]: "GEMINI_API_KEY",
  [PROVIDER_KEYS.DEEPSEEK]: "DEEPSEEK_API_KEY",
  [PROVIDER_KEYS.XAI]: "XAI_API_KEY",
  [PROVIDER_KEYS.MISTRAL]: "MISTRAL_API_KEY",
  [PROVIDER_KEYS.GROQ]: "GROQ_API_KEY",
  [PROVIDER_KEYS.COHERE]: "COHERE_API_KEY",
  [PROVIDER_KEYS.META]: "META_API_KEY",
  [PROVIDER_KEYS.PERPLEXITY]: "PERPLEXITY_API_KEY"
};
var VAULT_KEY_BY_PROVIDER = Object.fromEntries(
  Object.values(PROVIDER_KEYS).map((id) => [id, id === "openai" ? "openAiApiKey" : `${id}ApiKey`])
);
var DEFAULT_MODEL_BY_PROVIDER = {
  gemini: "gemini-3.8-flash",
  anthropic: "claude-sonnet-5",
  openai: "gpt-4o",
  deepseek: "deepseek-chat",
  xai: "grok-4",
  mistral: "mistral-large-latest",
  groq: "llama-3.3-70b-versatile",
  cohere: "command-r-plus",
  meta: "Llama-3.3-70B-Instruct",
  perplexity: "sonar-pro"
};
var KEY_PREFIXES = [
  ["AIza", "gemini"],
  ["sk-ant-", "anthropic"],
  ["sk-proj-", "openai"],
  ["xai-", "xai"],
  ["gsk_", "groq"],
  ["pplx-", "perplexity"],
  ["sk-", "openai"],
  ["sess-", "openai"]
];
function detectProviderFromKey(apiKey) {
  if (!apiKey || typeof apiKey !== "string") return null;
  const key = apiKey.trim();
  return KEY_PREFIXES.find(([prefix]) => key.startsWith(prefix))?.[1] ?? null;
}

// server/ai/providers/providerCommon.ts
function parseToolArguments(raw) {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}
function trimTrailingSlashes(url) {
  return url.replace(/\/+$/, "");
}

// server/ai/providers/openAiProvider.ts
function chatEndpoint(baseUrl) {
  const base = trimTrailingSlashes(baseUrl);
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
}
function toAiResponse(data) {
  const choiceMessage = data?.choices?.[0]?.message;
  const toolCalls = choiceMessage?.tool_calls;
  return {
    text: choiceMessage?.content ?? "",
    toolCalls: Array.isArray(toolCalls) && toolCalls.length > 0 ? toolCalls : void 0,
    rawMessage: choiceMessage,
    usage: {
      inputTokens: data?.usage?.prompt_tokens ?? 0,
      outputTokens: data?.usage?.completion_tokens ?? 0
    }
  };
}
async function sendOpenAICompatibleMessage(baseUrl, apiKey, model, input, tools, fetchFn = fetch) {
  const messages = typeof input === "string" ? [{ role: "user", content: input }] : input;
  const requestBody = { model, messages };
  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.temperature = 0.2;
  }
  const response = await fetchFn(chatEndpoint(baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AiProviderError(response.status, data?.error?.message ?? data?.message ?? "Unknown error");
  }
  return toAiResponse(data);
}

// server/ai/apiVersions.ts
var API_VERSIONS = {
  anthropic: { version: "2023-06-01", headerName: "anthropic-version", changelogUrl: "https://docs.anthropic.com/en/api/versioning" },
  gemini: { version: "v1beta", basePath: "v1beta", changelogUrl: "https://ai.google.dev/gemini-api/docs/changelog" },
  openAiCompatible: { version: "v1", changelogUrl: "https://platform.openai.com/docs/changelog" }
};

// server/ai/providers/anthropicProvider.ts
var toolUseBlock = (tc) => ({
  type: "tool_use",
  id: tc.id,
  name: tc.function.name,
  input: parseToolArguments(tc.function.arguments)
});
function toAnthropicMessage(msg) {
  if (msg.role === "tool") {
    return {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: msg.tool_call_id || "unknown_tool_call", content: msg.content || "" }]
    };
  }
  if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
    const text = msg.content ? [{ type: "text", text: msg.content }] : [];
    return { role: "assistant", content: [...text, ...msg.tool_calls.map(toolUseBlock)] };
  }
  return { role: msg.role === "assistant" ? "assistant" : "user", content: msg.content || "" };
}
function toConversation(input) {
  if (typeof input === "string") return { messages: [{ role: "user", content: input }] };
  let system;
  const messages = [];
  for (const msg of input) {
    if (msg.role === "system") system = msg.content || "";
    else messages.push(toAnthropicMessage(msg));
  }
  return { system, messages };
}
function buildRequestBody(model, input, tools) {
  const { system, messages } = toConversation(input);
  const body = { model, messages, max_tokens: 8192 };
  if (system) body.system = system;
  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters
    }));
    body.temperature = 0.2;
  }
  return body;
}
function messagesEndpoint(baseUrl) {
  const base = trimTrailingSlashes(baseUrl);
  return base.endsWith("/messages") ? base : `${base}/messages`;
}
function toAiResponse2(data) {
  const blocks = data?.content ?? [];
  const toolUse = blocks.filter((c) => c.type === "tool_use");
  return {
    text: blocks.find((c) => c.type === "text")?.text ?? "",
    toolCalls: toolUse.length > 0 ? toolUse.map((b) => ({
      id: b.id,
      type: "function",
      function: { name: b.name, arguments: JSON.stringify(b.input) }
    })) : void 0,
    usage: {
      inputTokens: data?.usage?.input_tokens ?? 0,
      outputTokens: data?.usage?.output_tokens ?? 0
    }
  };
}
async function sendAnthropicMessage(apiKey, model, input, tools, baseUrl = "https://api.anthropic.com/v1", fetchFn = fetch) {
  const response = await fetchFn(messagesEndpoint(baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      [API_VERSIONS.anthropic.headerName]: API_VERSIONS.anthropic.version
    },
    body: JSON.stringify(buildRequestBody(model, input, tools))
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AiProviderError(response.status, data?.error?.message ?? data?.message ?? "Unknown error");
  }
  return toAiResponse2(data);
}

// server/ai/providers/geminiDirectProvider.ts
var SKIP_SIGNATURE_VALIDATION = "skip_thought_signature_validator";
var functionCallPart = (tc) => ({
  functionCall: { name: tc.function.name, args: parseToolArguments(tc.function.arguments) },
  thoughtSignature: tc.thoughtSignature ?? SKIP_SIGNATURE_VALIDATION
});
function toGeminiContent(msg) {
  if (msg.role === "tool") {
    return {
      role: "user",
      parts: [{ functionResponse: { name: msg.name || "tool_result", response: { output: msg.content || "" } } }]
    };
  }
  if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
    const text = msg.content ? [{ text: msg.content }] : [];
    return { role: "model", parts: [...text, ...msg.tool_calls.map(functionCallPart)] };
  }
  return { role: msg.role === "assistant" ? "model" : "user", parts: [{ text: msg.content || "" }] };
}
function appendContent(contents, next, isToolResult) {
  const last = contents[contents.length - 1];
  const lastIsToolResult = last?.parts.every((p) => "functionResponse" in p);
  if (isToolResult && last && lastIsToolResult) last.parts.push(...next.parts);
  else contents.push(next);
}
function toConversation2(input) {
  if (typeof input === "string") return { contents: [{ role: "user", parts: [{ text: input }] }] };
  const systemParts = [];
  const contents = [];
  for (const msg of input) {
    if (msg.role === "system") systemParts.push(msg.content || "");
    else appendContent(contents, toGeminiContent(msg), msg.role === "tool");
  }
  return { system: systemParts.join("\n\n") || void 0, contents };
}
var UNSUPPORTED_SCHEMA_KEYS = /* @__PURE__ */ new Set(["$schema", "$id", "$ref", "$defs", "additionalProperties", "default", "examples", "patternProperties"]);
function toGeminiSchema(node) {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (!node || typeof node !== "object") return node;
  const entries = Object.entries(node).filter(([key]) => !UNSUPPORTED_SCHEMA_KEYS.has(key));
  return Object.fromEntries(entries.map(([key, value]) => key === "const" ? ["enum", [value]] : [key, toGeminiSchema(value)]));
}
function buildPayload(input, tools) {
  const { system, contents } = toConversation2(input);
  const payload = { contents };
  if (system) payload.systemInstruction = { parts: [{ text: system }] };
  if (tools && tools.length > 0) {
    payload.tools = [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: toGeminiSchema(t.function.parameters)
        }))
      }
    ];
  }
  return payload;
}
var newToolCallId = () => `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
function toAiResponse3(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  const toolCalls = parts.filter((p) => !p.text && p.functionCall).map((p) => ({
    id: newToolCallId(),
    type: "function",
    function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall?.args || {}) },
    thoughtSignature: p.thoughtSignature
  }));
  return {
    text: parts.filter((p) => p.text).map((p) => p.text).join("\n"),
    toolCalls: toolCalls.length > 0 ? toolCalls : void 0,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0
    }
  };
}
async function sendGeminiDirectMessage(apiKey, model, input, tools, baseUrl = "https://generativelanguage.googleapis.com/v1beta/models", fetchFn = fetch) {
  const url = `${trimTrailingSlashes(baseUrl)}/${model}:generateContent`;
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(buildPayload(input, tools))
  });
  if (!res.ok) {
    throw new AiProviderError(res.status, `Gemini API error: ${await res.text()}`);
  }
  return toAiResponse3(await res.json());
}

// server/ai/providers/directProvider.ts
var PROVIDER_DISPATCH = {
  [PROVIDER_KEYS.ANTHROPIC]: (apiKey, model, input, tools, customBaseUrl, fetchFn) => sendAnthropicMessage(apiKey, model, input, tools, customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.ANTHROPIC], fetchFn),
  [PROVIDER_KEYS.OPENAI]: (apiKey, model, input, tools, customBaseUrl, fetchFn) => sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.OPENAI], apiKey, model, input, tools, fetchFn),
  [PROVIDER_KEYS.GEMINI]: (apiKey, model, input, tools, customBaseUrl, fetchFn) => sendGeminiDirectMessage(apiKey, model, input, tools, customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.GEMINI], fetchFn),
  [PROVIDER_KEYS.DEEPSEEK]: (apiKey, model, input, tools, customBaseUrl, fetchFn) => sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.DEEPSEEK], apiKey, model, input, tools, fetchFn),
  [PROVIDER_KEYS.XAI]: (apiKey, model, input, tools, customBaseUrl, fetchFn) => sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.XAI], apiKey, model, input, tools, fetchFn),
  [PROVIDER_KEYS.MISTRAL]: (apiKey, model, input, tools, customBaseUrl, fetchFn) => sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.MISTRAL], apiKey, model, input, tools, fetchFn),
  [PROVIDER_KEYS.GROQ]: (apiKey, model, input, tools, customBaseUrl, fetchFn) => sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.GROQ], apiKey, model, input, tools, fetchFn),
  [PROVIDER_KEYS.COHERE]: (apiKey, model, input, tools, customBaseUrl, fetchFn) => sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.COHERE], apiKey, model, input, tools, fetchFn),
  [PROVIDER_KEYS.META]: (apiKey, model, input, tools, customBaseUrl, fetchFn) => sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.META], apiKey, model, input, tools, fetchFn),
  [PROVIDER_KEYS.PERPLEXITY]: (apiKey, model, input, tools, customBaseUrl, fetchFn) => sendOpenAICompatibleMessage(customBaseUrl || PROVIDER_ENDPOINTS[PROVIDER_KEYS.PERPLEXITY], apiKey, model, input, tools, fetchFn)
};
async function sendDirectMessage(provider, apiKey, model, input, tools, customBaseUrlOrFetch, fetchFn, signal) {
  const startedAt = Date.now();
  log.info(`Direct AI call: provider=${provider}, model=${model}`, { provider, model, hasTools: !!(tools && tools.length > 0) });
  let customBaseUrl;
  let effectiveFetch = fetch;
  if (typeof customBaseUrlOrFetch === "function") {
    effectiveFetch = customBaseUrlOrFetch;
  } else if (typeof customBaseUrlOrFetch === "string") {
    customBaseUrl = customBaseUrlOrFetch;
    if (fetchFn) {
      effectiveFetch = fetchFn;
    }
  }
  if (signal) {
    const baseFetch = effectiveFetch;
    effectiveFetch = ((url, opts) => baseFetch(url, { ...opts, signal }));
  }
  const sender = PROVIDER_DISPATCH[provider];
  if (!sender) {
    throw new AiProviderError(400, `Unsupported direct provider: ${provider}`);
  }
  try {
    const result = await sender(apiKey, model, input, tools, customBaseUrl, effectiveFetch);
    const durationMs = Date.now() - startedAt;
    log.info(`Direct AI call complete (${durationMs}ms)`, {
      provider,
      model,
      durationMs,
      tokensIn: result.usage?.inputTokens,
      tokensOut: result.usage?.outputTokens,
      toolCallsCount: result.toolCalls?.length || 0
    });
    return result;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    log.error(`Direct AI call failed (${durationMs}ms)`, {
      provider,
      model,
      durationMs,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

// src/core/shared/appViewContext.ts
var VALIDATORS = {
  hub: () => true,
  courseHome: (o) => typeof o.courseId === "string" && o.courseId.length > 0,
  courseViewer: (o) => typeof o.courseId === "string" && typeof o.topicId === "string",
  canvas: (o) => typeof o.sceneId === "string" && typeof o.selectedCount === "number",
  stepPlayer: (o) => typeof o.specId === "string" && typeof o.stepIndex === "number" && Number.isInteger(o.stepIndex) && typeof o.totalSteps === "number",
  visualAuthoring: (o) => typeof o.specId === "string"
};
function isAppViewContext(value) {
  if (!value || typeof value !== "object") return false;
  const obj = value;
  const validator = typeof obj.kind === "string" ? VALIDATORS[obj.kind] : void 0;
  return validator ? validator(obj) : false;
}

// src/core/shared/appViewProfiles.ts
var APP_VIEW_PROFILES = {
  canvas: {
    guidance: "The user is editing a canvas document. Prefer apply_scene_ops on selected block ids over rebuilding the entire scene.",
    excludedToolNames: ["content_editor_course", "content_editor_week"]
  },
  stepPlayer: {
    guidance: "The user is viewing an interactive step player visualization.",
    excludedToolNames: ["apply_scene_ops", "create_custom_canvas", "generate_uml_diagram"]
  },
  visualAuthoring: {
    guidance: "The user is editing a visual step spec.",
    excludedToolNames: ["apply_scene_ops", "create_custom_canvas", "generate_uml_diagram"]
  },
  hub: {
    guidance: "The user is on the main course hub.",
    excludedToolNames: ["apply_scene_ops", "create_custom_canvas"]
  },
  courseHome: {
    guidance: "The user is on the course overview dashboard.",
    excludedToolNames: ["apply_scene_ops", "create_custom_canvas"]
  },
  courseViewer: {
    guidance: "The user is reading course topic content.",
    excludedToolNames: []
  }
};
function filterToolsForView(tools, kind) {
  if (!kind || !APP_VIEW_PROFILES[kind]) return tools;
  const excluded = new Set(APP_VIEW_PROFILES[kind].excludedToolNames);
  return tools.filter((tool) => !excluded.has(tool.function.name));
}

// server/secrets/vaultService.ts
import fs6 from "fs";
import path8 from "path";
import crypto3 from "crypto";
var ALGORITHM = "aes-256-gcm";
var KEY_LENGTH = 32;
var IV_LENGTH = 12;
var SALT_LENGTH = 32;
var PBKDF2_ITERATIONS = 1e5;
var PBKDF2_DIGEST = "sha256";
function deriveKey(passphrase, salt) {
  return crypto3.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);
}
function encryptPayload(data, passphrase) {
  const salt = crypto3.randomBytes(SALT_LENGTH);
  const iv = crypto3.randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);
  const cipher = crypto3.createCipheriv(ALGORITHM, key, iv);
  const jsonStr = JSON.stringify(data);
  const ciphertext = Buffer.concat([cipher.update(jsonStr, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = {
    version: 1,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    salt: salt.toString("hex"),
    ciphertext: ciphertext.toString("hex")
  };
  return JSON.stringify(payload, null, 2);
}
function decryptPayload(encryptedJson, passphrase) {
  let payload;
  try {
    payload = JSON.parse(encryptedJson);
  } catch {
    throw new Error("Invalid vault file format: malformed JSON");
  }
  if (payload.version !== 1 || !payload.iv || !payload.authTag || !payload.salt || !payload.ciphertext) {
    throw new Error("Invalid vault payload: missing required cryptographic fields");
  }
  const salt = Buffer.from(payload.salt, "hex");
  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.authTag, "hex");
  const ciphertext = Buffer.from(payload.ciphertext, "hex");
  const key = deriveKey(passphrase, salt);
  const decipher = crypto3.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    throw new Error("Failed to decrypt vault: incorrect passphrase or corrupted data");
  }
}
var SECRETS_DIR = path8.resolve(DATA_ROOT, ".secrets");
var VAULT_FILE = path8.join(SECRETS_DIR, "vault.enc");
var MACHINE_SALT_FILE = path8.join(SECRETS_DIR, "salt.bin");
var VaultService = class {
  inMemoryVault = null;
  isLoaded = false;
  getEffectivePassphrase(customPassphrase) {
    if (customPassphrase && customPassphrase.trim()) {
      return customPassphrase.trim();
    }
    if (process.env.STUDYTS_MASTER_KEY && process.env.STUDYTS_MASTER_KEY.trim()) {
      return process.env.STUDYTS_MASTER_KEY.trim();
    }
    if (!fs6.existsSync(SECRETS_DIR)) {
      fs6.mkdirSync(SECRETS_DIR, { recursive: true });
    }
    if (!fs6.existsSync(MACHINE_SALT_FILE)) {
      const machineSalt = crypto3.randomBytes(32).toString("hex");
      fs6.writeFileSync(MACHINE_SALT_FILE, machineSalt, { encoding: "utf8", mode: 384 });
      return machineSalt;
    }
    return fs6.readFileSync(MACHINE_SALT_FILE, "utf8").trim();
  }
  initialize(passphrase) {
    if (!fs6.existsSync(VAULT_FILE)) {
      this.inMemoryVault = {};
      this.isLoaded = true;
      return false;
    }
    try {
      const encryptedJson = fs6.readFileSync(VAULT_FILE, "utf8");
      const pass = this.getEffectivePassphrase(passphrase);
      this.inMemoryVault = decryptPayload(encryptedJson, pass);
      this.isLoaded = true;
      log.info("Encrypted secrets vault loaded into memory", {
        keysCount: Object.keys(this.inMemoryVault).length
      });
      return true;
    } catch (err) {
      this.inMemoryVault = {};
      this.isLoaded = true;
      log.warn("Could not decrypt secrets vault on startup", {
        error: err instanceof Error ? err.message : String(err)
      });
      return false;
    }
  }
  getKey(providerOrKey) {
    if (!this.isLoaded) {
      this.initialize();
    }
    if (!this.inMemoryVault) return void 0;
    const normalized = String(providerOrKey).toLowerCase();
    const targetKey = VAULT_KEY_BY_PROVIDER[normalized] || String(providerOrKey);
    return this.inMemoryVault[targetKey];
  }
  setKey(keyName, value, passphrase) {
    if (!this.isLoaded) {
      this.initialize(passphrase);
    }
    this.inMemoryVault = this.inMemoryVault || {};
    const normalized = String(keyName).toLowerCase();
    const targetKey = VAULT_KEY_BY_PROVIDER[normalized] || String(keyName);
    this.inMemoryVault[targetKey] = value;
    if (!fs6.existsSync(SECRETS_DIR)) {
      fs6.mkdirSync(SECRETS_DIR, { recursive: true });
    }
    const pass = this.getEffectivePassphrase(passphrase);
    const encryptedJson = encryptPayload(this.inMemoryVault, pass);
    fs6.writeFileSync(VAULT_FILE, encryptedJson, { encoding: "utf8", mode: 384 });
  }
  removeKey(providerOrKey, passphrase) {
    if (!this.isLoaded) {
      this.initialize(passphrase);
    }
    if (!this.inMemoryVault) return;
    const normalized = String(providerOrKey).toLowerCase();
    const targetKey = VAULT_KEY_BY_PROVIDER[normalized] || String(providerOrKey);
    delete this.inMemoryVault[targetKey];
    if (!fs6.existsSync(SECRETS_DIR)) {
      fs6.mkdirSync(SECRETS_DIR, { recursive: true });
    }
    const pass = this.getEffectivePassphrase(passphrase);
    const encryptedJson = encryptPayload(this.inMemoryVault, pass);
    fs6.writeFileSync(VAULT_FILE, encryptedJson, { encoding: "utf8", mode: 384 });
  }
  listMaskedKeys() {
    if (!this.isLoaded) {
      this.initialize();
    }
    const result = {};
    if (!this.inMemoryVault) return result;
    for (const [k, v] of Object.entries(this.inMemoryVault)) {
      if (typeof v === "string" && v.length > 0) {
        if (v.length <= 8) {
          result[k] = "***";
        } else {
          result[k] = `${v.slice(0, 6)}...${v.slice(-3)}`;
        }
      }
    }
    return result;
  }
  isVaultConfigured() {
    return fs6.existsSync(VAULT_FILE);
  }
  purge() {
    this.inMemoryVault = {};
    this.isLoaded = false;
    if (fs6.existsSync(SECRETS_DIR)) {
      fs6.rmSync(SECRETS_DIR, { recursive: true, force: true });
      log.info("Secrets vault purged from disk");
    }
  }
};
var vaultService = new VaultService();

// server/ai/requestCredentials.ts
function serverKeyFor(provider) {
  const envVar = ENV_KEY_BY_PROVIDER[provider];
  return vaultService.getKey(provider) || envVar && process.env[envVar] || "";
}
function firstProviderWithServerKey() {
  for (const p of Object.keys(ENV_KEY_BY_PROVIDER)) {
    const key = serverKeyFor(p);
    if (key) return { provider: p, key };
  }
  return null;
}
function missingKeyError(provider) {
  const envVar = ENV_KEY_BY_PROVIDER[provider];
  const detail = envVar ? `${envVar} is not set on the server or in encrypted vault` : `no server-side default exists for provider "${provider}"`;
  return `No API key provided and ${detail}`;
}
function resolveProvider(provider, key) {
  if (provider && provider !== "auto") return { provider, key };
  const detected = key ? detectProviderFromKey(key) : null;
  if (detected) return { provider: detected, key };
  const fallback = firstProviderWithServerKey();
  return { provider: fallback?.provider ?? null, key: key || fallback?.key || "" };
}
function resolveCredentials(provider, apiKey) {
  const supplied = typeof apiKey === "string" ? apiKey.trim() : "";
  const { provider: resolved, key } = resolveProvider(provider, supplied);
  if (!resolved) return { error: "Unable to determine AI provider from key or request" };
  const finalKey = key || serverKeyFor(resolved);
  return finalKey ? { provider: resolved, key: finalKey } : { error: missingKeyError(resolved) };
}

// server/ai/describeAiFailure.ts
function describeAiFailure(err, state) {
  if (state.timedOut) {
    return {
      status: 504,
      body: { error: "AI provider request timed out after 120s", category: "timeout" },
      log: { message: "AI provider request timed out" }
    };
  }
  if (state.clientAborted || err instanceof DOMException && err.name === "AbortError") {
    return { status: 499, body: { error: "Request aborted" } };
  }
  if (err instanceof AiProviderError) {
    return {
      status: 502,
      body: { error: err.providerMessage, category: err.category },
      log: { message: "AI provider call failed", fields: { vendorStatus: err.status, category: err.category, error: err.providerMessage } }
    };
  }
  const error = err instanceof Error ? err.message : "AI provider request failed";
  return { status: 502, body: { error, category: "network" }, log: { message: "AI provider call failed", fields: { error } } };
}

// server/ai/providers/modelFallback.ts
var MODEL_FALLBACK_CHAINS = {
  gemini: {
    "gemini-3-pro": ["gemini-3.8-flash", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"],
    "gemini-2.5-pro": ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"],
    "gemini-2.5-flash": ["gemini-3.8-flash", "gemini-2.0-flash", "gemini-1.5-flash"],
    "gemini-2.0-flash": ["gemini-3.8-flash", "gemini-1.5-flash"],
    "gemini-1.5-pro": ["gemini-3.8-flash", "gemini-1.5-flash"],
    default: ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
  },
  anthropic: {
    "claude-sonnet-5": ["claude-opus-5", "claude-sonnet-4-6", "claude-sonnet-4-5", "claude-haiku-4-5-20251001"],
    "claude-opus-5": ["claude-sonnet-5", "claude-sonnet-4-6", "claude-sonnet-4-5"],
    "claude-sonnet-4-6": ["claude-sonnet-4-5", "claude-haiku-4-5-20251001"],
    "claude-sonnet-4-5": ["claude-haiku-4-5-20251001"],
    default: ["claude-sonnet-5", "claude-sonnet-4-6", "claude-sonnet-4-5", "claude-haiku-4-5-20251001"]
  },
  openai: {
    "gpt-5": ["gpt-5-mini", "gpt-4.1", "gpt-4o", "gpt-4o-mini"],
    "gpt-5-mini": ["gpt-4o-mini"],
    "gpt-4.1": ["gpt-4o", "gpt-4o-mini"],
    "gpt-4o": ["gpt-4o-mini", "gpt-4-turbo"],
    default: ["gpt-4o", "gpt-4o-mini"]
  },
  deepseek: {
    "deepseek-chat": ["deepseek-coder"],
    default: ["deepseek-chat"]
  }
};
var MODEL_FAILURE_TERMS = ["not found", "deprecated", "does not exist", "unsupported", "free tier", "free plan", "limit: 0", "not available"];
function mentionsModelFailure(message, extra = []) {
  return message.includes("model") && [...MODEL_FAILURE_TERMS, ...extra].some((term) => message.includes(term));
}
function isModelError(err) {
  if (!err) return false;
  if (err instanceof AiProviderError) {
    return err.status === 404 || mentionsModelFailure((err.providerMessage || "").toLowerCase());
  }
  if (err instanceof Error) return mentionsModelFailure(err.message.toLowerCase(), ["404"]);
  return false;
}
function listFallbackModels(provider, initialModel) {
  const providerChains = MODEL_FALLBACK_CHAINS[provider];
  const candidateList = providerChains ? providerChains[initialModel] || providerChains["default"] || [] : [];
  return candidateList.filter((m) => m !== initialModel);
}
async function tryFallbackModel(sendFn, params, fallbackModel) {
  const { provider, apiKey, model: initialModel, messages, tools, customBaseUrl, fetchFn, signal } = params;
  log.warn(`AI model ${initialModel} failed with model error, falling back to ${fallbackModel}`, {
    provider,
    originalModel: initialModel,
    fallbackModel
  });
  try {
    const res = await sendFn(provider, apiKey, fallbackModel, messages, tools, customBaseUrl, fetchFn, signal);
    return { ...res, appliedFallbackModel: fallbackModel, originalModel: initialModel };
  } catch (fallbackErr) {
    if (!isModelError(fallbackErr)) throw fallbackErr;
    return null;
  }
}
async function executeWithModelFallback(sendFn, params) {
  const { provider, apiKey, model: initialModel, messages, tools, customBaseUrl, fetchFn, signal } = params;
  try {
    const res = await sendFn(provider, apiKey, initialModel, messages, tools, customBaseUrl, fetchFn, signal);
    return { ...res, originalModel: initialModel };
  } catch (err) {
    if (!isModelError(err)) throw err;
    for (const fallbackModel of listFallbackModels(provider, initialModel)) {
      const result = await tryFallbackModel(sendFn, params, fallbackModel);
      if (result) return result;
    }
    throw err;
  }
}

// server/routes/aiChatProxy.ts
var aiChatProxyRouter = Router7();
var inFlight = /* @__PURE__ */ new Map();
var AI_TIMEOUT_MS = 12e4;
function abortAllInFlight() {
  for (const [, controller] of inFlight.entries()) {
    try {
      controller.abort();
    } catch {
    }
  }
  inFlight.clear();
}
function validateProxyBody(body) {
  if (typeof body.requestId !== "string" || !body.requestId || !Array.isArray(body.messages)) {
    return "requestId and messages array are required";
  }
  if (body.viewContext !== void 0 && !isAppViewContext(body.viewContext)) {
    return "Invalid viewContext format";
  }
  return null;
}
function resolveModel(provider, requestedModel) {
  return typeof requestedModel === "string" && requestedModel.trim() ? requestedModel.trim() : DEFAULT_MODEL_BY_PROVIDER[provider] || "gemini-3.8-flash";
}
aiChatProxyRouter.post("/ai/chat", route(async (req, res) => {
  const body = req.body;
  const validationError = validateProxyBody(body);
  if (validationError) return void res.status(400).json({ error: validationError });
  const { requestId, provider, apiKey, model, messages, tools, customBaseUrl, viewContext } = body;
  const creds = resolveCredentials(provider, apiKey);
  if ("error" in creds) return void res.status(400).json({ error: creds.error });
  const { provider: effectiveProvider, key: effectiveKey } = creds;
  const effectiveModel = resolveModel(effectiveProvider, model);
  const effectiveTools = Array.isArray(tools) ? filterToolsForView(tools, viewContext ? viewContext.kind : null) : void 0;
  const clientController = new AbortController();
  const timeoutSignal = AbortSignal.timeout(AI_TIMEOUT_MS);
  const combinedSignal = AbortSignal.any([clientController.signal, timeoutSignal]);
  inFlight.set(requestId, clientController);
  try {
    const response = await executeWithModelFallback(sendDirectMessage, {
      provider: effectiveProvider,
      apiKey: effectiveKey,
      model: effectiveModel,
      messages,
      tools: effectiveTools,
      customBaseUrl,
      signal: combinedSignal
    });
    res.json(response);
  } catch (err) {
    const failure = describeAiFailure(err, { timedOut: timeoutSignal.aborted, clientAborted: clientController.signal.aborted });
    if (failure.log) log.error(failure.log.message, { requestId, provider: effectiveProvider, model: effectiveModel, ...failure.log.fields });
    res.status(failure.status).json(failure.body);
  } finally {
    inFlight.delete(requestId);
  }
}));
aiChatProxyRouter.delete("/ai/chat/:requestId", (req, res) => {
  const controller = inFlight.get(req.params.requestId);
  controller?.abort();
  res.json({ ok: true });
});

// server/routes/aiModels.ts
import { Router as Router8 } from "express";

// server/ai/providers/modelListing.ts
var MODELS_TIMEOUT_MS = 8e3;
var NON_CHAT_MODEL_PATTERN = /embed|whisper|tts|dall-e|moderation|rerank|transcribe|image|audio/i;
async function getJson(url, headers, fetchFn, signal) {
  const timeout = AbortSignal.timeout(MODELS_TIMEOUT_MS);
  const response = await fetchFn(url, { method: "GET", headers, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new AiProviderError(response.status, data?.error?.message ?? data?.message ?? "Model list request failed");
  return data;
}
var byId = (a, b) => a.id.localeCompare(b.id);
function readArray(data, field) {
  const value = data?.[field];
  return Array.isArray(value) ? value : [];
}
async function listOpenAiStyleModels(baseUrl, apiKey, fetchFn = fetch, signal) {
  const data = await getJson(`${trimTrailingSlashes(baseUrl)}/models`, { Authorization: `Bearer ${apiKey}` }, fetchFn, signal);
  return readArray(data, "data").map((m) => String(m.id ?? "")).filter((id) => id && !NON_CHAT_MODEL_PATTERN.test(id)).map((id) => ({ id, label: id })).sort(byId);
}

// server/ai/providers/adapters/openAiCompatibleAdapter.ts
function createOpenAiCompatibleAdapter(id, displayName) {
  const defaultBaseUrl = PROVIDER_ENDPOINTS[id];
  return {
    id,
    displayName,
    defaultBaseUrl,
    apiVersion: API_VERSIONS.openAiCompatible.version,
    send: (r) => sendOpenAICompatibleMessage(r.baseUrl || defaultBaseUrl, r.apiKey, r.model, r.input, r.tools, r.fetchFn),
    listModels: (r) => listOpenAiStyleModels(r.baseUrl || defaultBaseUrl, r.apiKey, r.fetchFn, r.signal)
  };
}

// server/ai/providers/providerRegistry.ts
var ADAPTERS = /* @__PURE__ */ new Map();
var registryIds = [
  PROVIDER_KEYS.ANTHROPIC,
  PROVIDER_KEYS.GEMINI,
  PROVIDER_KEYS.OPENAI,
  PROVIDER_KEYS.DEEPSEEK,
  PROVIDER_KEYS.XAI,
  PROVIDER_KEYS.MISTRAL,
  PROVIDER_KEYS.GROQ,
  PROVIDER_KEYS.COHERE,
  PROVIDER_KEYS.META,
  PROVIDER_KEYS.PERPLEXITY
];
for (const id of registryIds) {
  if (id === PROVIDER_KEYS.ANTHROPIC || id === PROVIDER_KEYS.GEMINI) {
    ADAPTERS.set(id, { id, displayName: id, defaultBaseUrl: "", send: async () => ({ text: "", usage: { inputTokens: 0, outputTokens: 0 } }), listModels: async () => [] });
  } else {
    ADAPTERS.set(id, createOpenAiCompatibleAdapter(id, id.charAt(0).toUpperCase() + id.slice(1)));
  }
}
function getAdapter(id) {
  const adapter = ADAPTERS.get(id);
  if (!adapter) throw new AiProviderError(400, "Unsupported direct provider: " + id);
  return adapter;
}

// src/core/shared/aiModelFallbacks.ts
var FALLBACK_MODELS = {
  anthropic: [
    { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { id: "claude-opus-5", label: "Claude Opus 5" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" }
  ],
  openai: [
    { id: "gpt-5", label: "GPT-5" },
    { id: "gpt-5-mini", label: "GPT-5 Mini" },
    { id: "gpt-4.1", label: "GPT-4.1" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { id: "o3", label: "o3" },
    { id: "o4-mini", label: "o4-mini" }
  ],
  deepseek: [
    { id: "deepseek-chat", label: "DeepSeek Chat" },
    { id: "deepseek-coder", label: "DeepSeek Coder" }
  ],
  gemini: [
    { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-3-pro", label: "Gemini 3 Pro (paid)" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" }
  ],
  xai: [
    { id: "grok-4", label: "Grok 4" },
    { id: "grok-4-fast", label: "Grok 4 Fast" },
    { id: "grok-3", label: "Grok 3" },
    { id: "grok-3-mini", label: "Grok 3 Mini" }
  ],
  mistral: [
    { id: "mistral-large-latest", label: "Mistral Large" },
    { id: "mistral-medium-latest", label: "Mistral Medium" },
    { id: "mistral-small-latest", label: "Mistral Small" },
    { id: "codestral-latest", label: "Codestral" }
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)" },
    { id: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 Distill 70B (Groq)" },
    { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B (Groq)" }
  ],
  cohere: [
    { id: "command-a-03-2025", label: "Command A" },
    { id: "command-r-plus", label: "Command R+" },
    { id: "command-r", label: "Command R" }
  ],
  meta: [
    { id: "Llama-4-Maverick-17B-128E-Instruct-FP8", label: "Llama 4 Maverick" },
    { id: "Llama-4-Scout-17B-16E-Instruct-FP8", label: "Llama 4 Scout" },
    { id: "Llama-3.3-70B-Instruct", label: "Llama 3.3 70B" }
  ],
  perplexity: [
    { id: "sonar-pro", label: "Sonar Pro" },
    { id: "sonar", label: "Sonar" },
    { id: "sonar-reasoning-pro", label: "Sonar Reasoning Pro" }
  ]
};
function pickDefaultModel(live, preferred) {
  if (live.length === 0) return preferred;
  if (live.some((m) => m.id === preferred)) return preferred;
  return live[0]?.id ?? preferred;
}

// server/ai/providers/modelCatalogCache.ts
import crypto4 from "crypto";
var MODEL_CACHE_TTL_MS = 6e5;
var NEGATIVE_CACHE_TTL_MS = 6e4;
var cache = /* @__PURE__ */ new Map();
function buildCacheKey(provider, baseUrl = "", apiKey = "") {
  const keyHash = apiKey ? crypto4.createHash("sha256").update(apiKey).digest("hex").slice(0, 16) : "none";
  return `${provider}|${baseUrl}|${keyHash}`;
}
function getCached(key, now = Date.now()) {
  const entry = cache.get(key);
  if (!entry) return void 0;
  const ttl = entry.isNegative ? NEGATIVE_CACHE_TTL_MS : MODEL_CACHE_TTL_MS;
  if (now - entry.at > ttl) {
    cache.delete(key);
    return void 0;
  }
  return entry;
}
function setCached(key, models, now = Date.now()) {
  cache.set(key, {
    at: now,
    models,
    isNegative: false
  });
}
function setNegativeCached(key, warning, now = Date.now()) {
  cache.set(key, {
    at: now,
    models: [],
    isNegative: true,
    warning
  });
}

// server/routes/aiModels.ts
var aiModelsRouter = Router8();
var VALID_PROVIDERS = new Set(Object.values(PROVIDER_KEYS));
function respondCached(res, ctx, cached) {
  if (cached.isNegative) {
    res.status(200).json({
      provider: ctx.provider,
      source: "fallback",
      models: ctx.fallbackList,
      defaultModel: ctx.preferredDefault,
      warning: cached.warning
    });
    return;
  }
  res.status(200).json({
    provider: ctx.provider,
    source: "cache",
    models: cached.models,
    defaultModel: pickDefaultModel(cached.models, ctx.preferredDefault)
  });
}
function handleFetchError(res, ctx, cacheKey, err) {
  const status = err instanceof AiProviderError ? err.status : 500;
  const providerMsg = err instanceof AiProviderError ? err.providerMessage : err instanceof Error ? err.message : String(err);
  const warning = status === 429 ? "Rate limited \u2014 using offline model list" : `${status}: ${providerMsg}`;
  if (status === 429) {
    setNegativeCached(cacheKey, warning);
  }
  res.status(200).json({
    provider: ctx.provider,
    source: "fallback",
    models: ctx.fallbackList,
    defaultModel: ctx.preferredDefault,
    warning
  });
}
async function fetchAndRespondLive(res, ctx, effectiveKey, customBaseUrl, cacheKey) {
  try {
    const adapter = getAdapter(ctx.provider);
    const liveModels = await adapter.listModels({ apiKey: effectiveKey, baseUrl: customBaseUrl });
    if (!Array.isArray(liveModels) || liveModels.length === 0) {
      res.status(200).json({
        provider: ctx.provider,
        source: "fallback",
        models: ctx.fallbackList,
        defaultModel: ctx.preferredDefault,
        warning: "Provider returned no models \u2014 using offline list"
      });
      return;
    }
    setCached(cacheKey, liveModels);
    res.status(200).json({
      provider: ctx.provider,
      source: "live",
      models: liveModels,
      defaultModel: pickDefaultModel(liveModels, ctx.preferredDefault)
    });
  } catch (err) {
    handleFetchError(res, ctx, cacheKey, err);
  }
}
aiModelsRouter.post("/ai/models", route(async (req, res) => {
  const { provider, apiKey, customBaseUrl, refresh } = req.body;
  if (!provider || typeof provider !== "string" || !VALID_PROVIDERS.has(provider)) {
    return void res.status(400).json({ error: `Unsupported direct provider: ${String(provider)}` });
  }
  const ctx = {
    provider,
    fallbackList: FALLBACK_MODELS[provider] || [],
    preferredDefault: DEFAULT_MODEL_BY_PROVIDER[provider] || ""
  };
  const creds = resolveCredentials(provider, apiKey);
  if ("error" in creds) {
    return void res.status(200).json({
      provider,
      source: "fallback",
      models: ctx.fallbackList,
      defaultModel: ctx.preferredDefault,
      warning: creds.error
    });
  }
  const cacheKey = buildCacheKey(provider, customBaseUrl || "", creds.key);
  if (!refresh) {
    const cached = getCached(cacheKey);
    if (cached) {
      return void respondCached(res, ctx, cached);
    }
  }
  await fetchAndRespondLive(res, ctx, creds.key, customBaseUrl, cacheKey);
}));

// server/routes/aiKeys.ts
import { Router as Router9 } from "express";
var aiKeysRouter = Router9();
var VALID_PROVIDERS2 = new Set(Object.values(PROVIDER_KEYS));
aiKeysRouter.get("/ai/keys", route(async (_req, res) => {
  const maskedKeys = vaultService.listMaskedKeys();
  const configured = [];
  for (const provider of Object.values(PROVIDER_KEYS)) {
    const envVar = ENV_KEY_BY_PROVIDER[provider];
    const hasKey = Boolean(vaultService.getKey(provider) || envVar && process.env[envVar]);
    if (hasKey) {
      configured.push(provider);
    }
  }
  res.status(200).json({
    keys: maskedKeys,
    configured
  });
}));
aiKeysRouter.put("/ai/keys/:provider", route(async (req, res) => {
  const { provider } = req.params;
  const { apiKey } = req.body;
  if (!provider || !VALID_PROVIDERS2.has(provider)) {
    return void res.status(400).json({ error: `Unsupported provider: ${String(provider)}` });
  }
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return void res.status(400).json({ error: "apiKey must be a non-empty string" });
  }
  const trimmed = apiKey.trim();
  if (trimmed.length > 512) {
    return void res.status(400).json({ error: "apiKey exceeds maximum length of 512 characters" });
  }
  vaultService.setKey(provider, trimmed);
  res.status(200).json({ ok: true });
}));
aiKeysRouter.delete("/ai/keys/:provider", route(async (req, res) => {
  const { provider } = req.params;
  if (!provider || !VALID_PROVIDERS2.has(provider)) {
    return void res.status(400).json({ error: `Unsupported provider: ${String(provider)}` });
  }
  vaultService.removeKey(provider);
  res.status(200).json({ ok: true });
}));

// server/routes/updateStatus.ts
import path10 from "path";
import { Router as Router10 } from "express";
import { createRequire as createRequire2 } from "module";

// server/update/updateModule.ts
import { createRequire } from "module";
import path9 from "path";
var require2 = createRequire(import.meta.url);
var { checkForUpdate, readCurrentVersion } = require2(path9.join(PACKAGE_ROOT, "scripts", "update", "checkForUpdate.cjs"));
var { readUpdateConfig } = require2(path9.join(PACKAGE_ROOT, "scripts", "update", "updateConfig.cjs"));
var { readUpdateState, writeUpdateState } = require2(path9.join(PACKAGE_ROOT, "scripts", "update", "launchCheck.cjs"));
async function checkStatus(force = false) {
  const root = PACKAGE_ROOT;
  const config = readUpdateConfig(process.env);
  const stateDir = path9.join(root, config.stateDirName || ".update");
  const state = readUpdateState(stateDir);
  const checkRes = await checkForUpdate({ root, config, force });
  let lastResult;
  const resultPath = path9.join(stateDir, "result.json");
  try {
    const fs13 = require2("fs");
    if (fs13.existsSync(resultPath)) {
      lastResult = JSON.parse(fs13.readFileSync(resultPath, "utf8"));
    }
  } catch {
  }
  return {
    status: checkRes.status,
    currentVersion: checkRes.currentVersion || readCurrentVersion(root),
    latest: checkRes.latest ? {
      version: checkRes.latest.version,
      tag: checkRes.latest.tag,
      pageUrl: checkRes.latest.pageUrl,
      notes: checkRes.latest.notes
    } : void 0,
    mode: config.mode,
    checkedAt: checkRes.checkedAt,
    pendingVersion: state.pendingVersion,
    skippedVersion: state.skippedVersion,
    lastResult
  };
}
function writeState(partial) {
  const root = PACKAGE_ROOT;
  const config = readUpdateConfig(process.env);
  const stateDir = path9.join(root, config.stateDirName || ".update");
  const current = readUpdateState(stateDir);
  writeUpdateState(stateDir, { ...current, ...partial });
}
function clearLastResult() {
  const root = PACKAGE_ROOT;
  const config = readUpdateConfig(process.env);
  const resultPath = path9.join(root, config.stateDirName || ".update", "result.json");
  try {
    const fs13 = require2("fs");
    if (fs13.existsSync(resultPath)) {
      fs13.rmSync(resultPath, { force: true });
    }
  } catch {
  }
}

// server/routes/updateStatus.ts
var require3 = createRequire2(import.meta.url);
var { parseVersion } = require3(path10.join(PACKAGE_ROOT, "scripts", "update", "versionCompare.cjs"));
var updateStatusRouter = Router10();
updateStatusRouter.get("/update/status", route(async (_req, res) => {
  const result = await checkStatus(false);
  res.status(200).json(result);
}));
var FORCED_CHECK_MIN_INTERVAL_MS = 3e4;
var lastForcedCheckAt = 0;
updateStatusRouter.post("/update/check", route(async (_req, res) => {
  const now = Date.now();
  if (now - lastForcedCheckAt < FORCED_CHECK_MIN_INTERVAL_MS) {
    const cached = await checkStatus(false);
    return void res.status(200).json({ ...cached, throttled: true });
  }
  lastForcedCheckAt = now;
  res.status(200).json(await checkStatus(true));
}));
updateStatusRouter.post("/update/schedule", route(async (req, res) => {
  const { version } = req.body;
  if (typeof version !== "string" || !parseVersion(version)) {
    return void res.status(400).json({ error: "Valid semver version string required" });
  }
  const currentStatus = await checkStatus(false);
  const latest = currentStatus.latest;
  if (!latest || latest.version !== version && latest.tag !== version) {
    return void res.status(409).json({ error: "Requested version does not match available release" });
  }
  writeState({ pendingVersion: version });
  res.status(200).json({ ok: true });
}));
updateStatusRouter.post("/update/skip", route(async (req, res) => {
  const { version } = req.body;
  if (typeof version !== "string" || !parseVersion(version)) {
    return void res.status(400).json({ error: "Valid semver version string required" });
  }
  writeState({ skippedVersion: version });
  res.status(200).json({ ok: true });
}));
updateStatusRouter.post("/update/clear-result", route(async (_req, res) => {
  clearLastResult();
  res.status(200).json({ ok: true });
}));
updateStatusRouter.post("/update/restart", route(async (_req, res) => {
  if (process.env.STUDYTS_SUPERVISED !== "1") {
    return void res.status(409).json({ error: "Restart needs run.bat or npm start" });
  }
  res.status(200).json({ ok: true });
  setTimeout(() => process.exit(75), 300);
}));

// server/routes/pdfIngestion.ts
import { Router as Router11 } from "express";

// server/utils/pdfIngestion.ts
import fs7 from "fs/promises";
import path11 from "path";
import crypto5 from "crypto";
var PDF_MAGIC_BYTES = Buffer.from("%PDF-");
var DEFAULT_TEMP_DIR = path11.resolve(DATA_ROOT, "temp", "pdf_ingest");
var MAX_ORPHAN_AGE_MS = 60 * 60 * 1e3;
function validatePdfBuffer(buffer) {
  return !!buffer && buffer.length >= 5 && buffer.subarray(0, 5).equals(PDF_MAGIC_BYTES);
}
function sanitizeFilename(filename) {
  if (!filename) return "document.pdf";
  const clean = path11.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  return clean.endsWith(".pdf") ? clean : `${clean}.pdf`;
}
async function createSecureTempPdf(buffer, originalName = "upload.pdf", customTempDir = DEFAULT_TEMP_DIR) {
  if (!validatePdfBuffer(buffer)) throw new Error("Invalid PDF: file header does not match %PDF- signature");
  await fs7.mkdir(customTempDir, { recursive: true, mode: 448 });
  const tempPath = path11.join(customTempDir, `${crypto5.randomUUID()}_${sanitizeFilename(originalName)}`);
  await fs7.writeFile(tempPath, buffer, { mode: 384 });
  return {
    tempPath,
    cleanup: async () => {
      try {
        await fs7.unlink(tempPath);
      } catch (err) {
        log.warn("Failed temp PDF cleanup", { tempPath, err });
      }
    }
  };
}
function extractMarkdownTables(text, sectionTitle = "General") {
  const tables = [];
  const lines = text.split("\n");
  let curLines = [];
  const flush = () => {
    if (curLines.length >= 2) {
      const parsed = curLines.map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
      const data = parsed.filter((r) => !r.every((c) => /^:?-+:?$/.test(c)));
      if (data.length > 0) {
        tables.push({
          id: `tbl-${crypto5.randomUUID().slice(0, 8)}`,
          section: sectionTitle,
          headers: data[0],
          rows: data.slice(1),
          rawMarkdown: curLines.join("\n")
        });
      }
    }
    curLines = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) curLines.push(trimmed);
    else if (curLines.length) flush();
  }
  if (curLines.length) flush();
  return tables;
}
function extractFormulas(text, sectionTitle = "General") {
  const formulas = [];
  const blockRegex = /\$\$([\s\S]*?)\$\$/g;
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    if (match[1]?.trim()) {
      formulas.push({ id: `form-blk-${crypto5.randomUUID().slice(0, 8)}`, type: "block", content: match[1].trim(), section: sectionTitle });
    }
  }
  const inlineRegex = /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g;
  while ((match = inlineRegex.exec(text)) !== null) {
    if (match[1]?.trim()) {
      formulas.push({ id: `form-inl-${crypto5.randomUUID().slice(0, 8)}`, type: "inline", content: match[1].trim(), section: sectionTitle });
    }
  }
  return formulas;
}
function partitionMarkdownAst(markdown) {
  const sections = [];
  let currentTitle = "Introduction";
  let currentLevel = 1;
  let currentContentLines = [];
  const flush = () => {
    const content = currentContentLines.join("\n").trim();
    if (content.length > 0 || currentTitle !== "Introduction") {
      sections.push({
        id: `sec-${sections.length + 1}-${currentTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        level: currentLevel,
        title: currentTitle,
        content,
        characterCount: content.length,
        tables: extractMarkdownTables(content, currentTitle),
        formulas: extractFormulas(content, currentTitle)
      });
    }
    currentContentLines = [];
  };
  for (const line of markdown.split("\n")) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flush();
      currentLevel = headingMatch[1].length;
      currentTitle = headingMatch[2].trim();
    } else {
      currentContentLines.push(line);
    }
  }
  flush();
  return sections;
}
function processZeroLossIngestion(filename, fileSizeBytes, markdownText) {
  const cleanMarkdown = markdownText.trim();
  const sections = partitionMarkdownAst(cleanMarkdown);
  return {
    filename,
    fileSizeBytes,
    rawMarkdown: cleanMarkdown,
    characterCount: cleanMarkdown.length,
    sections,
    coverageIndex: {
      totalSections: sections.length,
      totalTables: sections.reduce((acc, s) => acc + s.tables.length, 0),
      totalFormulas: sections.reduce((acc, s) => acc + s.formulas.length, 0),
      isExhaustive: sections.length > 0 && sections.every((s) => s.title.length > 0),
      sectionIds: sections.map((s) => s.id)
    }
  };
}

// server/routes/pdfIngestion.ts
var pdfIngestionRouter = Router11();
pdfIngestionRouter.post("/ai/pdf-extract", route(async (req, res) => {
  const { filename = "document.pdf", pdfBase64, rawMarkdown } = req.body;
  if (rawMarkdown && typeof rawMarkdown === "string") {
    const result = processZeroLossIngestion(filename, Buffer.byteLength(rawMarkdown, "utf8"), rawMarkdown);
    return void res.json(result);
  }
  if (!pdfBase64 || typeof pdfBase64 !== "string") {
    return void res.status(400).json({ error: "Either rawMarkdown or pdfBase64 must be provided" });
  }
  let buffer;
  try {
    buffer = Buffer.from(pdfBase64, "base64");
  } catch {
    return void res.status(400).json({ error: "Invalid base64 payload" });
  }
  if (!validatePdfBuffer(buffer)) {
    return void res.status(400).json({ error: "File header does not match %PDF- format" });
  }
  const { cleanup } = await createSecureTempPdf(buffer, filename);
  try {
    const extractedText = `# ${filename.replace(/\.pdf$/i, "")}

Ingested PDF document with ${buffer.length} bytes.`;
    const result = processZeroLossIngestion(filename, buffer.length, extractedText);
    res.json(result);
  } finally {
    await cleanup();
  }
}));

// server/routes/aiAttachments.ts
import { Router as Router12 } from "express";

// src/core/shared/attachmentPolicy.ts
var ATTACHMENT_POLICY = {
  maxCount: 10,
  maxFileBytes: 5 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  allowedExtensions: [".pdf", ".txt", ".md", ".ts", ".tsx", ".js", ".json"],
  blockedExtensions: [".zip", ".rar", ".7z", ".gz", ".tgz", ".tar", ".bz2", ".xz"],
  blockedMimes: [
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/vnd.rar",
    "application/x-7z-compressed",
    "application/gzip",
    "application/x-gzip",
    "application/x-tar",
    "application/x-bzip2",
    "application/x-xz"
  ],
  // Signatures checked at offset 0 unless an offset is given. PK covers zip, empty zip, spanned zip and all zip containers (docx, jar, apk).
  archiveSignatures: [
    { name: "zip", offset: 0, bytes: [80, 75, 3, 4] },
    { name: "zip-empty", offset: 0, bytes: [80, 75, 5, 6] },
    { name: "zip-spanned", offset: 0, bytes: [80, 75, 7, 8] },
    { name: "rar", offset: 0, bytes: [82, 97, 114, 33, 26, 7] },
    { name: "7z", offset: 0, bytes: [55, 122, 188, 175, 39, 28] },
    { name: "gzip", offset: 0, bytes: [31, 139] },
    // ponytail: bzip2 starts with BZh; rare collision with plain English word list accepted
    { name: "bzip2", offset: 0, bytes: [66, 90, 104] },
    { name: "xz", offset: 0, bytes: [253, 55, 122, 88, 90, 0] },
    { name: "tar", offset: 257, bytes: [117, 115, 116, 97, 114] }
  ],
  pdfSignature: [37, 80, 68, 70, 45],
  textSniffBytes: 8192
};
var reject = (reason) => ({ ok: false, reason });
var OK = { ok: true };
var lowerName = (name) => name.toLowerCase();
var hasExtension = (name, list) => list.some((ext) => lowerName(name).endsWith(ext));
var startsWith = (bytes, sig, offset = 0) => bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);
function checkSize(size) {
  if (size === 0) return reject("empty");
  if (size > ATTACHMENT_POLICY.maxFileBytes) return reject("too-large");
  return null;
}
function checkDisguisedArchives(name, mime, bytes) {
  if (hasExtension(name, ATTACHMENT_POLICY.blockedExtensions)) return reject("archive-extension");
  if (ATTACHMENT_POLICY.blockedMimes.includes(mime.toLowerCase())) return reject("archive-mime");
  if (ATTACHMENT_POLICY.archiveSignatures.some((s) => startsWith(bytes, s.bytes, s.offset))) return reject("archive-signature");
  return null;
}
function checkContentSignature(name, bytes) {
  if (!hasExtension(name, ATTACHMENT_POLICY.allowedExtensions)) return reject("unsupported-extension");
  if (lowerName(name).endsWith(".pdf")) return startsWith(bytes, ATTACHMENT_POLICY.pdfSignature) ? OK : reject("pdf-signature");
  return bytes.subarray(0, ATTACHMENT_POLICY.textSniffBytes).includes(0) ? reject("binary-content") : OK;
}
function validateAttachment({ name, mime, bytes, size }) {
  const sizeVerdict = checkSize(size ?? bytes.length);
  if (sizeVerdict) return sizeVerdict;
  const archiveVerdict = checkDisguisedArchives(name, mime, bytes);
  if (archiveVerdict) return archiveVerdict;
  return checkContentSignature(name, bytes);
}
function validateAttachmentBatch(existing, incoming) {
  if (existing.length >= ATTACHMENT_POLICY.maxCount) return reject("too-many");
  if (existing.some((f) => f.name === incoming.name)) return reject("duplicate");
  const incomingSize = incoming.size ?? incoming.bytes.length;
  const total = existing.reduce((sum, f) => sum + f.size, 0) + incomingSize;
  return total > ATTACHMENT_POLICY.maxTotalBytes ? reject("total-too-large") : validateAttachment(incoming);
}

// server/routes/aiAttachments.ts
var aiAttachmentsRouter = Router12();
var decodeText = (bytes) => {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, text };
  } catch {
    return { ok: false };
  }
};
var processFile = (file, acceptedList) => {
  const bytes = new Uint8Array(Buffer.from(file.base64, "base64"));
  const candidate = {
    name: file.name,
    mime: file.mime || "",
    bytes
  };
  const verdict = validateAttachmentBatch(acceptedList, candidate);
  if (!verdict.ok) {
    return { name: file.name, ok: false, reason: verdict.reason };
  }
  acceptedList.push({ name: file.name, size: bytes.length });
  if (file.name.toLowerCase().endsWith(".pdf")) {
    return { name: file.name, ok: true, text: null };
  }
  const decoded = decodeText(bytes);
  if (!decoded.ok) {
    return { name: file.name, ok: false, reason: "binary-content" };
  }
  return { name: file.name, ok: true, text: decoded.text };
};
aiAttachmentsRouter.post("/ai/attachments/validate", (req, res) => {
  const { files } = req.body;
  if (!Array.isArray(files)) {
    return res.status(400).json({ error: "files array is required" });
  }
  if (files.length > ATTACHMENT_POLICY.maxCount) {
    return res.status(400).json({ error: `Exceeded maximum attachment count (${ATTACHMENT_POLICY.maxCount})` });
  }
  const validStructure = files.every(
    (f) => f && typeof f === "object" && typeof f.name === "string" && typeof f.base64 === "string"
  );
  if (!validStructure) {
    return res.status(400).json({ error: "Invalid file payload structure" });
  }
  const acceptedList = [];
  const results = files.map(
    (file) => processFile(file, acceptedList)
  );
  return res.json({ results });
});

// server/routes/mcp.ts
import { Router as Router13 } from "express";

// server/mcp/linker.ts
import fs8 from "fs/promises";
import fsSync from "fs";
import path12 from "path";

// server/mcp/mcpProcess.ts
import { spawn } from "child_process";
var JsonRpcProtocol = class {
  constructor(stdin, stdout, defaultTimeoutMs = 15e3) {
    this.stdin = stdin;
    this.defaultTimeoutMs = defaultTimeoutMs;
    stdout.on("data", (chunk) => this.handleData(chunk));
    stdout.on("error", (err) => this.handleStreamError(err));
  }
  stdin;
  defaultTimeoutMs;
  nextId = 1;
  pending = /* @__PURE__ */ new Map();
  buffer = "";
  handleData(chunk) {
    this.buffer += chunk.toString("utf-8");
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== void 0 && this.pending.has(msg.id)) {
          const req = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          clearTimeout(req.timer);
          req.resolve(msg);
        }
      } catch {
      }
    }
  }
  handleStreamError(err) {
    this.rejectAll(new Error(`MCP stdout error: ${err.message}`));
  }
  rejectAll(error) {
    for (const [id, req] of this.pending.entries()) {
      clearTimeout(req.timer);
      req.reject(error);
      this.pending.delete(id);
    }
  }
  sendRequest(method, params, timeoutMs) {
    const id = this.nextId++;
    const req = { jsonrpc: "2.0", id, method, params };
    const timeout = timeoutMs ?? this.defaultTimeoutMs;
    return new Promise((resolve3, reject2) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject2(new Error(`MCP JSON-RPC request '${method}' timed out after ${timeout}ms`));
        }
      }, timeout);
      this.pending.set(id, { resolve: resolve3, reject: reject2, timer });
      try {
        this.stdin.write(JSON.stringify(req) + "\n");
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject2(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
  sendNotification(method, params) {
    const notification = { jsonrpc: "2.0", method, params };
    this.stdin.write(JSON.stringify(notification) + "\n");
  }
  close() {
    this.rejectAll(new Error("MCP protocol closed"));
  }
};
function quoteWinCommand(command, args) {
  const quote = (s) => /[\s"&|<>^]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  return [command, ...args].map(quote).join(" ");
}
var McpProcess = class {
  constructor(config) {
    this.config = config;
  }
  config;
  child = null;
  protocol = null;
  _status = "stopped";
  _tools = [];
  _errorMessage;
  _lastPingMs;
  get status() {
    return this._status;
  }
  get tools() {
    return this._tools;
  }
  get errorMessage() {
    return this._errorMessage;
  }
  get lastPingMs() {
    return this._lastPingMs;
  }
  get pid() {
    return this.child?.pid;
  }
  async start() {
    if (this._status === "connected" || this._status === "connecting") return;
    this._status = "connecting";
    this._errorMessage = void 0;
    try {
      const isWin = process.platform === "win32";
      const child = isWin ? spawn(quoteWinCommand(this.config.command, this.config.args), { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, ...this.config.env }, cwd: this.config.cwd || PACKAGE_ROOT, shell: true }) : spawn(this.config.command, this.config.args, { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, ...this.config.env }, cwd: this.config.cwd || PACKAGE_ROOT });
      this.child = child;
      if (!child.stdin || !child.stdout) throw new Error("Child process stdio streams not available");
      this.protocol = new JsonRpcProtocol(child.stdin, child.stdout);
      child.stderr?.on("data", (data) => {
        log.warn(`[MCP:${this.config.name}] stderr:`, { output: data.toString("utf-8").trim() });
      });
      child.on("exit", (code, signal) => {
        log.info(`[MCP:${this.config.name}] process exited`, { code, signal });
        this.handleExit(code, signal);
      });
      child.on("error", (err) => {
        log.error(`[MCP:${this.config.name}] process spawn error:`, { error: err.message });
        this._status = "error";
        this._errorMessage = err.message;
        this.protocol?.rejectAll(err);
      });
      await this.initializeHandshake();
      await this.refreshTools();
      this._status = "connected";
    } catch (err) {
      this.stop();
      this._status = "error";
      this._errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }
  async initializeHandshake() {
    if (!this.protocol) throw new Error("Protocol not initialized");
    await this.protocol.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "Complexity_web", version: "1.0.0" }
    });
    this.protocol.sendNotification("notifications/initialized");
  }
  async refreshTools() {
    if (!this.protocol) throw new Error("MCP server is not connected");
    const res = await this.protocol.sendRequest("tools/list", {});
    const result = res.result;
    const rawTools = result?.tools || [];
    this._tools = rawTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema || { type: "object", properties: {} },
      serverId: this.config.id,
      serverName: this.config.name
    }));
    return this._tools;
  }
  async callTool(toolName, args) {
    if (!this.protocol || this._status !== "connected") {
      throw new Error(`MCP server '${this.config.name}' is not connected`);
    }
    const res = await this.protocol.sendRequest("tools/call", {
      name: toolName,
      arguments: args
    });
    if (res.error) throw new Error(`MCP tool error: ${res.error.message}`);
    return res.result;
  }
  async ping() {
    if (!this.protocol || this._status !== "connected") throw new Error("MCP server is not connected");
    const start = Date.now();
    await this.protocol.sendRequest("ping", {});
    this._lastPingMs = Date.now() - start;
    return this._lastPingMs;
  }
  handleExit(code, signal) {
    this._status = code === 0 ? "stopped" : "error";
    if (code !== 0 && !this._errorMessage) {
      this._errorMessage = `Process exited with code ${code ?? signal ?? "unknown"}`;
    }
    this.protocol?.close();
    this.protocol = null;
    this.child = null;
  }
  stop() {
    if (this.child) {
      this.protocol?.close();
      this.terminate(this.child);
      this.child = null;
      this.protocol = null;
    }
    this._status = "stopped";
    this._tools = [];
  }
  /** Asks the child to exit: taskkill on Windows, SIGTERM (then SIGKILL after 1s) elsewhere. */
  terminate(child) {
    try {
      if (!child.pid) {
        child.kill("SIGTERM");
      } else if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
        setTimeout(() => killIfStillRunning(child), 1e3);
      }
    } catch (err) {
      log.warn(`[MCP:${this.config.name}] error killing process`, { error: String(err) });
    }
  }
};
function killIfStillRunning(child) {
  try {
    if (!child.killed) child.kill("SIGKILL");
  } catch {
  }
}

// server/mcp/linker.ts
var CONFIG_PATH = path12.resolve(DATA_ROOT, "data", "mcp-servers.json");
var LEGACY_ID_MAP = {
  "notebook-bridge": "studyts-mcp",
  "sqlite-course-db": "studyts-mcp",
  "course-author": "studyts-mcp"
};
var MCP_BUNDLE = path12.join(PACKAGE_ROOT, "dist-server", "mcp", "servers", "studyTsServer.mjs");
var STUDYTS_MCP_LAUNCH = fsSync.existsSync(MCP_BUNDLE) ? { command: process.execPath, args: [MCP_BUNDLE] } : { command: "npx", args: ["tsx", "server/mcp/servers/studyTsServer.ts"] };
var DEFAULT_SERVERS = [
  {
    id: "studyts-mcp",
    name: "StudyTs-MCP",
    command: STUDYTS_MCP_LAUNCH.command,
    args: STUDYTS_MCP_LAUNCH.args,
    enabled: true,
    autoStart: true
  }
];
function hasLegacyServers(configs) {
  return Array.isArray(configs) && configs.some((c) => Boolean(LEGACY_ID_MAP[c.id]));
}
var MCPLinkerManager = class {
  processes = /* @__PURE__ */ new Map();
  configs = /* @__PURE__ */ new Map();
  async init() {
    await this.loadConfigs();
    for (const config of this.configs.values()) {
      if (config.enabled && config.autoStart) {
        this.startServer(config.id).catch((err) => {
          log.warn(`Auto-start failed for MCP server '${config.name}'`, { error: String(err) });
        });
      }
    }
  }
  async loadConfigs() {
    try {
      if (!fsSync.existsSync(CONFIG_PATH)) {
        await fs8.mkdir(path12.dirname(CONFIG_PATH), { recursive: true });
        await fs8.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_SERVERS, null, 2), "utf-8");
        for (const s of DEFAULT_SERVERS) this.configs.set(s.id, s);
        return;
      }
      const raw = await fs8.readFile(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      this.configs.clear();
      if (hasLegacyServers(parsed)) {
        const cleaned = parsed.filter((c) => !LEGACY_ID_MAP[c.id]);
        if (!cleaned.some((c) => c.id === "studyts-mcp")) {
          cleaned.unshift(...DEFAULT_SERVERS);
        }
        for (const s of cleaned) this.configs.set(s.id, s);
        await this.saveConfigs();
        return;
      }
      for (const s of parsed) this.configs.set(s.id, s);
    } catch (err) {
      log.error("Failed to load MCP server configs", { error: String(err) });
      for (const s of DEFAULT_SERVERS) this.configs.set(s.id, s);
    }
  }
  async saveConfigs() {
    try {
      await fs8.mkdir(path12.dirname(CONFIG_PATH), { recursive: true });
      const list = Array.from(this.configs.values());
      await fs8.writeFile(CONFIG_PATH, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      log.error("Failed to save MCP server configs", { error: String(err) });
    }
  }
  getServers() {
    return Array.from(this.configs.values()).map((config) => {
      const proc = this.processes.get(config.id);
      return {
        config,
        status: proc?.status || "stopped",
        tools: proc?.tools || [],
        lastPingMs: proc?.lastPingMs,
        errorMessage: proc?.errorMessage,
        pid: proc?.pid
      };
    });
  }
  async addServer(config) {
    this.configs.set(config.id, config);
    await this.saveConfigs();
    if (config.enabled && config.autoStart) await this.startServer(config.id);
    return this.getServers().find((s) => s.config.id === config.id);
  }
  async updateServer(config) {
    if (this.processes.has(config.id)) {
      this.stopServer(config.id);
    }
    this.configs.set(config.id, config);
    await this.saveConfigs();
    return this.getServers().find((s) => s.config.id === config.id);
  }
  async removeServer(id) {
    this.stopServer(id);
    this.configs.delete(id);
    await this.saveConfigs();
  }
  async startServer(id) {
    const targetId = this.configs.has(id) ? id : LEGACY_ID_MAP[id] ?? id;
    const config = this.configs.get(targetId);
    if (!config) throw new Error(`MCP server '${id}' not found`);
    let proc = this.processes.get(targetId);
    if (!proc) {
      proc = new McpProcess(config);
      this.processes.set(targetId, proc);
    }
    await proc.start();
    return this.getServers().find((s) => s.config.id === targetId);
  }
  stopServer(id) {
    const targetId = this.processes.has(id) ? id : LEGACY_ID_MAP[id] ?? id;
    const proc = this.processes.get(targetId);
    if (proc) {
      proc.stop();
      this.processes.delete(targetId);
    }
  }
  async pingServer(id) {
    const targetId = this.processes.has(id) ? id : LEGACY_ID_MAP[id] ?? id;
    const proc = this.processes.get(targetId);
    if (!proc) throw new Error(`MCP server '${id}' is not running`);
    return await proc.ping();
  }
  getAllTools() {
    const tools = [];
    for (const proc of this.processes.values()) {
      if (proc.status === "connected") {
        tools.push(...proc.tools);
      }
    }
    return tools;
  }
  async callTool(serverId, toolName, args) {
    const targetId = this.processes.has(serverId) ? serverId : LEGACY_ID_MAP[serverId] ?? serverId;
    const proc = this.processes.get(targetId);
    if (!proc) throw new Error(`MCP server '${serverId}' is not running`);
    return await proc.callTool(toolName, args);
  }
  shutdownAll() {
    log.info("Shutting down all MCP subprocesses");
    for (const proc of this.processes.values()) {
      try {
        proc.stop();
      } catch (err) {
        log.warn("Error stopping MCP process during shutdown", { error: String(err) });
      }
    }
    this.processes.clear();
  }
};
var mcpLinker = new MCPLinkerManager();

// server/routes/mcp.ts
var mcpRouter = Router13();
mcpRouter.get("/mcp/servers", (_req, res) => {
  res.json({ servers: mcpLinker.getServers() });
});
mcpRouter.post("/mcp/servers", async (req, res) => {
  try {
    const config = req.body;
    if (!config.id || !config.name || !config.command) {
      return void res.status(400).json({ error: "Missing required fields: id, name, command" });
    }
    const server2 = await mcpLinker.addServer(config);
    return void res.json({ server: server2 });
  } catch (err) {
    log.error("Error adding MCP server", { error: String(err) });
    return void res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
mcpRouter.delete("/mcp/servers/:id", async (req, res) => {
  try {
    await mcpLinker.removeServer(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
mcpRouter.post("/mcp/servers/:id/start", async (req, res) => {
  try {
    const server2 = await mcpLinker.startServer(req.params.id);
    res.json({ server: server2 });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
mcpRouter.post("/mcp/servers/:id/stop", (req, res) => {
  try {
    mcpLinker.stopServer(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
mcpRouter.post("/mcp/servers/:id/ping", async (req, res) => {
  try {
    const pingMs = await mcpLinker.pingServer(req.params.id);
    res.json({ pingMs });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
mcpRouter.get("/mcp/tools", (_req, res) => {
  res.json({ tools: mcpLinker.getAllTools() });
});
mcpRouter.post("/mcp/tools/call", async (req, res) => {
  try {
    const { serverId, toolName, args } = req.body;
    if (!serverId || !toolName) {
      return void res.status(400).json({ error: "Missing required fields: serverId, toolName" });
    }
    const result = await mcpLinker.callTool(serverId, toolName, args || {});
    return void res.json({ success: true, result });
  } catch (err) {
    log.error("Error executing MCP tool", { error: String(err) });
    return void res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// server/routes/canvasStore.ts
import { Router as Router14 } from "express";

// src/core/canvasBlocks/stripMarkdown.ts
var MATH_SPAN = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/;
var LINE_RULES = [
  [/^\s*```.*$/gm, ""],
  [/^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/gm, ""],
  [/^\s{0,3}#{1,6}\s*/gm, ""],
  [/^\s*>\s?/gm, ""],
  [/^(\s*)[-*+]\s+/gm, "$1\u2022 "],
  [/^\s*\|\s?/gm, ""],
  [/\s?\|\s*$/gm, ""]
];
var INLINE_RULES = [
  [/(\*\*\*|\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "$2"],
  [/(?<![\w*])\*(?=\S)([^*\n]+?)\*(?!\w)/g, "$1"],
  [/`([^`\n]*)`/g, "$1"],
  [/\*{2,}|_{2,}/g, ""]
];
function stripPlainSegment(segment) {
  return [...LINE_RULES, ...INLINE_RULES].reduce((out, [re, rep]) => out.replace(re, rep), segment);
}
function stripMarkdown(text) {
  return text.split(MATH_SPAN).map((part, i) => i % 2 === 1 ? part : stripPlainSegment(part)).join("").replace(/\n{3,}/g, "\n\n").trim();
}

// src/core/canvasBlocks/convertedSceneObject.ts
var PX_TO_MM = 25.4 / 96;
function toMm(px, fallback) {
  const num2 = typeof px === "number" && Number.isFinite(px) ? px : fallback;
  return Math.round(num2 * PX_TO_MM * 10) / 10;
}

// src/core/canvasBlocks/networkDeviceObjects.ts
var fontSizeOf = (block, fallback) => {
  const size = block.fontSize;
  return typeof size === "number" && size >= 6 && size <= 72 ? size : fallback;
};
function convertDeviceNode(node, device, startX, startY) {
  const id = String(node.id || `node-${Math.random().toString(36).slice(2, 7)}`);
  const size = DEVICE_SIZE_PX[device];
  return {
    id,
    type: "shape",
    x: startX + toMm(node.x, 0),
    y: startY + toMm(node.y, 0),
    w: toMm(size.width, 18),
    h: toMm(size.height, 18),
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      shape: deviceShapeId(device),
      label: String(node.label || id),
      labelPlacement: "below",
      fill: "transparent",
      stroke: "var(--text-1)",
      strokeWidth: 0.4,
      labelColor: "var(--text-1)",
      fontSize: 10
    }
  };
}
function convertGraphZone(zone, blockId, startX, startY) {
  return {
    id: `zone-${blockId}-${String(zone.id)}`,
    type: "shape",
    x: startX + toMm(zone.x, 0),
    y: startY + toMm(zone.y, 0),
    w: toMm(zone.width, 60),
    h: toMm(zone.height, 40),
    rotation: 0,
    zIndex: 0,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      shape: "rounded",
      label: String(zone.label ?? zone.id),
      labelPlacement: "top",
      fill: "transparent",
      stroke: "var(--text-2)",
      strokeWidth: 0.3,
      strokeStyle: "dashed",
      labelColor: "var(--text-2)",
      fontSize: 10
    }
  };
}
function convertShapeBlock(block, d) {
  const device = isNetworkDevice(block.shape) ? block.shape : null;
  const outline = block.shape === "rect" || block.shape === "diamond" ? block.shape : "ellipse";
  return {
    ...d,
    type: "shape",
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      shape: device ? deviceShapeId(device) : outline,
      label: String(block.label ?? ""),
      ...device ? { labelPlacement: "below" } : {},
      fill: "transparent",
      stroke: "var(--text-1)",
      strokeWidth: 0.4,
      labelColor: "var(--text-1)",
      fontSize: fontSizeOf(block, 11)
    }
  };
}

// src/core/canvasBlocks/blockToSceneObject.ts
function readLocalizedText(val) {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const loc = val;
    return loc.en || loc.he || "";
  }
  return "";
}
function resolveBlockText(block) {
  const body = readLocalizedText(block.body);
  const title = readLocalizedText(block.title);
  const combined = title && body && !body.includes(title) ? `${title}

${body}` : body || title;
  return block.variant === "code" ? combined : stripMarkdown(combined);
}
function blockFontSize(block, fallback) {
  const size = block.fontSize;
  return typeof size === "number" && size >= 6 && size <= 72 ? size : fallback;
}
function validColWidths(raw, cols) {
  return Array.isArray(raw) && raw.length === cols && raw.every((n) => typeof n === "number" && n > 0);
}
function convertGraphNode(node, startX, startY) {
  if (isNetworkDevice(node.device)) return convertDeviceNode(node, node.device, startX, startY);
  const id = String(node.id || `node-${Math.random().toString(36).slice(2, 7)}`);
  return {
    id,
    type: "node",
    x: startX + toMm(node.x, 0),
    y: startY + toMm(node.y, 0),
    w: 18,
    h: 18,
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      label: String(node.label || id),
      shape: "circle",
      fill: node.color || "transparent",
      stroke: "var(--text-1)",
      strokeWidth: 0.4,
      textColor: "var(--text-1)",
      fontSize: 11,
      start: Boolean(node.start),
      accept: Boolean(node.accept)
    }
  };
}
function convertGraphEdge(edge) {
  const id = String(edge.id || `edge-${Math.random().toString(36).slice(2, 7)}`);
  return {
    id,
    type: "edge",
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    rotation: 0,
    zIndex: 4,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      sourceId: String(edge.from || ""),
      targetId: String(edge.to || ""),
      sourcePort: null,
      targetPort: null,
      directed: edge.directed !== false,
      curvature: 0,
      label: edge.label || "",
      stroke: "var(--text-1)",
      strokeWidth: 0.5,
      dash: false
    }
  };
}
function convertGraphBlock(block, startX, startY) {
  const state = block.state ?? {};
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];
  const edges = Array.isArray(state.edges) ? state.edges : [];
  const zones = Array.isArray(state.zones) ? state.zones : [];
  return [
    ...zones.map((z) => convertGraphZone(z, String(block.id ?? "graph"), startX, startY)),
    ...nodes.map((n) => convertGraphNode(n, startX, startY)),
    ...edges.map(convertGraphEdge)
  ];
}
function convertUmlBlock(block, d) {
  return {
    ...d,
    type: "uml-class",
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      className: String(block.className || block.name || "Class"),
      fields: Array.isArray(block.fields) ? block.fields : [],
      methods: Array.isArray(block.methods) ? block.methods : []
    }
  };
}
var asBool = (v) => v === true;
var stringOr = (v, fallback) => typeof v === "string" ? v : fallback;
var numberOr = (v, fallback) => typeof v === "number" ? v : fallback;
function convertNodeBlock(block, d) {
  return {
    ...d,
    type: "node",
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      label: String(block.label ?? d.id),
      shape: block.shape === "rect" ? "rect" : "circle",
      fill: stringOr(block.fill, "transparent"),
      stroke: stringOr(block.stroke, "var(--text-1)"),
      strokeWidth: numberOr(block.strokeWidth, 0.4),
      textColor: stringOr(block.textColor, "var(--text-1)"),
      fontSize: blockFontSize(block, 11),
      start: asBool(block.start),
      accept: asBool(block.accept)
    }
  };
}
function convertEdgeBlock(block, d) {
  return {
    ...d,
    type: "edge",
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    rotation: 0,
    zIndex: 4,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      sourceId: String(block.sourceId ?? block.from ?? ""),
      targetId: String(block.targetId ?? block.to ?? ""),
      sourcePort: block.sourcePort ?? null,
      targetPort: block.targetPort ?? null,
      directed: block.directed !== false,
      curvature: numberOr(block.curvature, 0),
      label: String(block.label ?? ""),
      stroke: stringOr(block.stroke, "var(--text-1)"),
      strokeWidth: numberOr(block.strokeWidth, 0.5),
      dash: asBool(block.dash)
    }
  };
}
function convertConnectorBlock(block, d) {
  return convertEdgeBlock(
    { ...block, sourceId: block.fromBlockId, targetId: block.toBlockId, directed: block.style !== "line" },
    d
  );
}
function convertMediaBlock(block, d) {
  return {
    ...d,
    type: "image",
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: { src: String(block.src || ""), fit: "contain", opacity: 1 }
  };
}
function convertFormulaBlock(block, d) {
  return {
    ...d,
    type: "formula",
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: { latex: String(block.latex || block.body || ""), display: true, fontSize: 16 }
  };
}
function convertTextBlock(block, d) {
  return {
    ...d,
    type: "text",
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      text: resolveBlockText(block),
      fontSize: blockFontSize(block, 12),
      color: "var(--text-1)",
      align: "left",
      variant: block.variant === "sticky" ? "sticky" : "text",
      ...typeof block.fill === "string" && block.fill ? { fill: block.fill } : {},
      ...block.autoFit === false ? { autoFit: false } : {},
      ...typeof block.maxWidth === "number" ? { maxWidth: toMm(block.maxWidth, 0) } : {}
    }
  };
}
var MAX_TABLE_ROWS = 30;
var MAX_TABLE_COLS = 12;
var PT_TO_PX2 = 96 / 72;
var MIN_TABLE_W_MM = 8;
function tableFit(block, cells, cols, givenW) {
  const fits = block.autoFit !== false && !validColWidths(block.colWidths, cols);
  if (!fits) return { w: givenW };
  const cap = typeof block.maxWidth === "number" ? toMm(block.maxWidth, 0) : givenW;
  const natural = toMm(minFitWidthPx(cells, cols, blockFontSize(block, 11) * PT_TO_PX2), 0);
  return { w: natural > 0 ? Math.max(MIN_TABLE_W_MM, Math.min(cap, natural)) : givenW, maxWidth: cap };
}
function convertTableBlock(block, d) {
  const header2 = Array.isArray(block.columns) ? block.columns.map(readLocalizedText) : [];
  const body = Array.isArray(block.rows) ? block.rows.map((row) => Array.isArray(row) ? row.map(readLocalizedText) : []) : [];
  const grid = (header2.length > 0 ? [header2, ...body] : body).slice(0, MAX_TABLE_ROWS);
  const cols = Math.min(MAX_TABLE_COLS, Math.max(1, ...grid.map((row) => row.length)));
  const cells = grid.map((row) => Array.from({ length: cols }, (_, c) => row[c] ?? ""));
  const { w, ...fit } = tableFit(block, cells, cols, d.w);
  return {
    ...d,
    w,
    type: "table",
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    props: {
      rows: Math.max(1, cells.length),
      cols,
      cells,
      headerRow: header2.length > 0,
      ...validColWidths(block.colWidths, cols) ? { colWidths: block.colWidths } : {},
      ...fit,
      ...block.autoFit === false ? { autoFit: false } : {},
      fontSize: blockFontSize(block, 11),
      color: "var(--text-1)",
      fill: "var(--ac-18)",
      stroke: "var(--text-1)",
      strokeWidth: 0.3
    }
  };
}
var BLOCK_CONVERTERS = {
  umlClass: convertUmlBlock,
  "uml-class": convertUmlBlock,
  image: convertMediaBlock,
  pdf: convertMediaBlock,
  video: convertMediaBlock,
  formula: convertFormulaBlock,
  node: convertNodeBlock,
  shape: convertShapeBlock,
  edge: convertEdgeBlock,
  connector: convertConnectorBlock,
  data: (block, d) => block.format === "json" ? convertTextBlock(block, d) : convertTableBlock(block, d)
};
function convertSingleBlock(block, fallbackId) {
  const kind = String(block.kind || "richText");
  const d = {
    id: String(block.id || fallbackId),
    x: toMm(block.x, 20),
    y: toMm(block.y, 20),
    w: Math.max(10, toMm(block.width, 100)),
    h: Math.max(10, toMm(block.height, 50))
  };
  if (kind === "graph") return convertGraphBlock(block, d.x, d.y);
  const convert = BLOCK_CONVERTERS[kind] ?? convertTextBlock;
  return [convert(block, d)];
}

// src/core/canvasBlocks/sceneDocConverter.ts
function appendPageBlocks(blocks, prefix, objects) {
  const ids = [];
  for (let idx = 0; idx < blocks.length; idx++) {
    const list = convertSingleBlock(blocks[idx], `${prefix}-${idx}`);
    for (const obj of list) {
      objects[obj.id] = obj;
      ids.push(obj.id);
    }
  }
  return ids;
}
function convertSceneToDocState(scene) {
  const paperSize = scene.pageSize || "A4";
  const objects = {};
  const rawPages = Array.isArray(scene.pages) && scene.pages.length > 0 ? scene.pages : null;
  if (rawPages) {
    const pages = rawPages.map((pageData, pIdx) => {
      const pageId = pageData.id || `page-${pIdx + 1}`;
      const pageBlocks = Array.isArray(pageData.blocks) ? pageData.blocks : [];
      const objIds2 = appendPageBlocks(pageBlocks, `blk-${pIdx}`, objects);
      return { id: pageId, orientation: "portrait", paperSize, margin: 20, objects: objIds2 };
    });
    return { pages, objects };
  }
  const rawBlocks = Array.isArray(scene.blocks) ? scene.blocks : [];
  const objIds = appendPageBlocks(rawBlocks, "blk", objects);
  return {
    pages: [{ id: "page-1", orientation: "portrait", paperSize, margin: 20, objects: objIds }],
    objects
  };
}
var MM_TO_PX = 96 / 25.4;
function toPx(mm) {
  return Math.round(mm * MM_TO_PX);
}
var OBJECT_TO_BLOCK_MAP = {
  text: (b) => ({
    id: b.id,
    kind: "richText",
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    body: String(b.props.text || ""),
    variant: String(b.props.variant || "text"),
    style: "card",
    ...typeof b.props.fontSize === "number" ? { fontSize: b.props.fontSize } : {},
    ...typeof b.props.fill === "string" ? { fill: b.props.fill } : {},
    ...b.props.autoFit === false ? { autoFit: false } : {},
    ...typeof b.props.maxWidth === "number" ? { maxWidth: toPx(b.props.maxWidth) } : {}
  }),
  formula: (b) => ({
    id: b.id,
    kind: "richText",
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    body: String(b.props.latex || ""),
    variant: "formula"
  }),
  image: (b) => ({
    id: b.id,
    kind: "image",
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    src: String(b.props.src || "")
  }),
  table: (b) => {
    const cells = Array.isArray(b.props.cells) ? b.props.cells : [];
    const hasHeader = b.props.headerRow !== false && cells.length > 0;
    return {
      id: b.id,
      kind: "data",
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      format: "table",
      columns: hasHeader ? cells[0] : [],
      rows: hasHeader ? cells.slice(1) : cells,
      ...typeof b.props.fontSize === "number" ? { fontSize: b.props.fontSize } : {},
      ...Array.isArray(b.props.colWidths) ? { colWidths: b.props.colWidths } : {},
      ...b.props.autoFit === false ? { autoFit: false } : {},
      ...typeof b.props.maxWidth === "number" ? { maxWidth: toPx(b.props.maxWidth) } : {}
    };
  },
  "uml-class": (b) => ({
    id: b.id,
    kind: "umlClass",
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    className: String(b.props.className || "Class"),
    fields: Array.isArray(b.props.fields) ? b.props.fields : [],
    methods: Array.isArray(b.props.methods) ? b.props.methods : []
  })
};
function objectToCanvasBlock(obj, original) {
  const b = {
    id: obj.id,
    x: toPx(obj.x),
    y: toPx(obj.y),
    width: toPx(obj.w),
    height: toPx(obj.h),
    props: obj.props || {}
  };
  const convert = OBJECT_TO_BLOCK_MAP[obj.type];
  const fresh = convert ? convert(b) : { id: b.id, kind: obj.type, x: b.x, y: b.y, width: b.width, height: b.height, ...b.props };
  if (!original || original.kind !== fresh.kind) return fresh;
  return { ...original, ...fresh, variant: original.variant ?? fresh.variant, style: original.style ?? fresh.style };
}
function blocksById(scene) {
  const pages = Array.isArray(scene.pages) ? scene.pages : [];
  const all = [...pages.flatMap((p) => p.blocks ?? []), ...Array.isArray(scene.blocks) ? scene.blocks : []];
  return new Map(all.map((block) => [String(block.id), block]));
}
function convertDocStateToCanvasScene(doc, existingScene) {
  const existing = existingScene ?? {};
  const originals = blocksById(existing);
  const pagesData = (doc.pages || []).map((page, pIdx) => {
    const pageBlocks = (page.objects || []).map((id) => doc.objects[id]).filter(Boolean).map((obj) => objectToCanvasBlock(obj, originals.get(obj.id)));
    return {
      id: page.id || `page-${pIdx + 1}`,
      name: `Page ${pIdx + 1}`,
      blocks: pageBlocks
    };
  });
  const allBlocks = pagesData.flatMap((p) => p.blocks);
  return {
    ...existing,
    pageSize: doc.pages?.[0]?.paperSize || existing.pageSize || "A4",
    canvasSize: existing.canvasSize || { width: 794, height: 1123 },
    blocks: allBlocks,
    ...pagesData.length > 1 || Array.isArray(existing.pages) ? { pages: pagesData } : {},
    version: (typeof existing.version === "number" ? existing.version : 0) + 1,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// server/routes/canvasStore.ts
var canvasStoreRouter = Router14();
function sceneVersion(scene) {
  return typeof scene.version === "number" ? scene.version : 0;
}
function sceneBlockCount(scene) {
  const pages = Array.isArray(scene.pages) ? scene.pages : [];
  const pageBlocks = pages.reduce((n, page) => n + (page.blocks?.length ?? 0), 0);
  return pageBlocks + (Array.isArray(scene.blocks) ? scene.blocks.length : 0);
}
function docObjectCount(doc) {
  const objects = doc.objects;
  return objects && typeof objects === "object" ? Object.keys(objects).length : 0;
}
function editorSaveConflict(scene, doc, baseVersion) {
  if (typeof baseVersion === "number" && baseVersion !== sceneVersion(scene)) {
    return `Conflict: the scene changed since it was loaded (editor had version ${baseVersion}, server has ${sceneVersion(scene)}). Reload the scene.`;
  }
  if (baseVersion === void 0 && docObjectCount(doc) === 0 && sceneBlockCount(scene) > 0) {
    return "Refusing to replace a non-empty scene with an empty document. Reload the scene.";
  }
  return null;
}
async function handleSave(req, res) {
  const prisma3 = req.prisma;
  const { key, doc, baseVersion } = req.body;
  if (typeof key !== "string" || !key) {
    return void res.status(400).json({ error: "key must be a non-empty string" });
  }
  if (!doc || typeof doc !== "object") {
    return void res.status(400).json({ error: "doc must be an object" });
  }
  const topic = prisma3.topic ? await prisma3.topic.findFirst({ where: sceneIdWhere(key) }) : null;
  const existingScene = topic?.scene || {};
  const conflict = topic ? editorSaveConflict(existingScene, doc, baseVersion) : null;
  if (conflict) {
    return void res.status(409).json({ error: conflict, currentVersion: sceneVersion(existingScene) });
  }
  await prisma3.canvasStoreDoc.upsert({
    where: { key },
    create: { key, doc },
    update: { doc }
  });
  if (!topic) return void res.json({ success: true });
  const updatedScene = convertDocStateToCanvasScene(doc, existingScene);
  await commitScene(prisma3, topic, updatedScene, "editor");
  res.json({ success: true, version: sceneVersion(updatedScene) });
}
async function handleLoad(req, res) {
  const prisma3 = req.prisma;
  const key = req.query.key;
  if (typeof key !== "string" || !key) {
    return void res.status(400).json({ error: "key query parameter must be a non-empty string" });
  }
  const topic = prisma3.topic ? await prisma3.topic.findFirst({ where: sceneIdWhere(key) }) : null;
  const scene = topic?.scene && typeof topic.scene === "object" ? topic.scene : null;
  const version = scene ? sceneVersion(scene) : void 0;
  const record = await prisma3.canvasStoreDoc.findUnique({ where: { key } });
  if (record?.doc) return void res.json({ doc: record.doc, version });
  if (scene) return void res.json({ doc: convertSceneToDocState(scene), version });
  return void res.status(404).json({ error: `No canvas-store doc found for key '${key}'` });
}
canvasStoreRouter.post("/canvas-store/save", route(handleSave));
canvasStoreRouter.get("/canvas-store/load", route(handleLoad));

// server/routes/visualSpecs.ts
import { Router as Router15 } from "express";

// server/utils/visualSpecFiles.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2, readdirSync } from "fs";
import { join as join2 } from "path";

// src/core/validation/visualSpec/visualSpecKey.ts
var VISUAL_SPEC_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
function isVisualSpecKey(value) {
  return typeof value === "string" && VISUAL_SPEC_KEY_PATTERN.test(value);
}

// server/utils/visualSpecFiles.ts
function createVisualSpecFileStore(directory) {
  const pathFor = (key) => {
    if (!isVisualSpecKey(key)) throw new Error(`Invalid visual spec key "${key}"`);
    return join2(directory, `${key}.json`);
  };
  return {
    write(key, spec) {
      const path19 = pathFor(key);
      mkdirSync2(directory, { recursive: true });
      writeTracked(path19, JSON.stringify(spec, null, 2));
    },
    read(key) {
      const path19 = pathFor(key);
      if (!existsSync2(path19)) return null;
      return { spec: JSON.parse(readFileSync2(path19, "utf8")) };
    },
    listKeys() {
      if (!existsSync2(directory)) return [];
      return readdirSync(directory).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -".json".length)).filter(isVisualSpecKey);
    }
  };
}
var visualSpecFiles = createVisualSpecFileStore(join2(DATA_ROOT, "data", "_shared", "visual-specs"));

// server/routes/visualSpecs.ts
var visualSpecsRouter = Router15();
var invalidKeyBody = { error: `key must match ${VISUAL_SPEC_KEY_PATTERN}` };
async function handleList(req, res) {
  const prisma3 = req.prisma;
  const rows = await prisma3.visualSpecDoc.findMany({ select: { key: true } });
  const keys = /* @__PURE__ */ new Set([...rows.map((row) => row.key), ...visualSpecFiles.listKeys()]);
  res.json({ keys: [...keys].sort() });
}
async function handleLoad2(req, res) {
  const prisma3 = req.prisma;
  const key = req.params.key;
  if (!isVisualSpecKey(key)) return void res.status(400).json(invalidKeyBody);
  const row = await prisma3.visualSpecDoc.findUnique({ where: { key } });
  if (row) return void res.json({ spec: row.spec });
  const mirrored = visualSpecFiles.read(key);
  if (mirrored) return void res.json({ spec: mirrored.spec });
  return void res.status(404).json({ error: `No visual spec found for key '${key}'` });
}
async function handleSave2(req, res) {
  const prisma3 = req.prisma;
  const key = req.params.key;
  if (!isVisualSpecKey(key)) return void res.status(400).json(invalidKeyBody);
  const checked = checkVisualSpec(req.body?.spec);
  if (!checked.spec || checked.problems.length > 0) {
    return void res.status(400).json({ error: "Invalid VisualSpec", problems: checked.problems });
  }
  const spec = req.body.spec;
  await prisma3.visualSpecDoc.upsert({ where: { key }, create: { key, spec }, update: { spec } });
  visualSpecFiles.write(key, spec);
  res.json({ success: true });
}
visualSpecsRouter.get("/visual-specs", route(handleList));
visualSpecsRouter.get("/visual-specs/:key", route(handleLoad2));
visualSpecsRouter.put("/visual-specs/:key", route(handleSave2));

// server/routes/clientErrors.ts
import { Router as Router16 } from "express";
var SOURCES = ["window.onerror", "unhandledrejection", "error-boundary"];
var WINDOW_MS = 6e4;
function createClientErrorLimiter(now = Date.now) {
  let windowStart = now();
  let count = 0;
  return () => {
    if (now() - windowStart > WINDOW_MS) {
      windowStart = now();
      count = 0;
    }
    count += 1;
    return count <= LOG_LIMITS.clientReportsPerMinute;
  };
}
var clip = (value) => typeof value === "string" ? value.slice(0, LOG_LIMITS.maxFieldChars) : void 0;
function isSource(value) {
  return typeof value === "string" && SOURCES.includes(value);
}
function checkReportValidation(req) {
  const declared = Number(req.headers["content-length"] ?? 0);
  if (declared > LOG_LIMITS.maxClientReportBytes) return { status: 413 };
  const body = req.body;
  if (!body || typeof body.message !== "string" || !body.message) {
    return { status: 400, error: "message is required" };
  }
  if (body.source !== void 0 && !isSource(body.source)) {
    return { status: 400, error: "unknown source" };
  }
  return null;
}
var clientErrorsRouter = Router16();
var allow = createClientErrorLimiter();
clientErrorsRouter.post("/client-errors", (req, res) => {
  const validationProblem = checkReportValidation(req);
  if (validationProblem) {
    if (validationProblem.error) return void res.status(validationProblem.status).json({ error: validationProblem.error });
    return void res.status(validationProblem.status).end();
  }
  if (!allow()) return void res.status(429).end();
  const body = req.body;
  log.error("Client error", {
    source: body.source ?? "window.onerror",
    clientMessage: clip(body.message),
    stack: clip(body.stack),
    componentStack: clip(body.componentStack),
    url: clip(body.url),
    userAgent: clip(req.headers["user-agent"])
  });
  return void res.status(204).end();
});

// server/routes/logs.ts
import { Router as Router17 } from "express";
import fs9 from "fs";
import { readFile as readFile2 } from "fs/promises";
import path13 from "path";
var logsRouter = Router17();
async function readSafeFile(filePath) {
  try {
    return await readFile2(filePath, "utf8");
  } catch {
    return "";
  }
}
function listRunLogs(logDir) {
  try {
    return fs9.readdirSync(logDir).filter((name) => name.startsWith(LOG_FILE_PREFIX.run) && name.endsWith(".log")).sort().reverse();
  } catch {
    return [];
  }
}
function resolveRunFile(logDir, requestedFile) {
  if (!requestedFile) {
    return path13.join(logDir, `${LOG_FILE_PREFIX.run}${log.runId}.log`);
  }
  const cleanName = path13.basename(requestedFile);
  if (!cleanName.startsWith(LOG_FILE_PREFIX.run) || !cleanName.endsWith(".log")) {
    return path13.join(logDir, `${LOG_FILE_PREFIX.run}${log.runId}.log`);
  }
  return path13.join(logDir, cleanName);
}
logsRouter.get("/logs", async (req, res) => {
  const logDir = log.logDir;
  const targetRunFile = resolveRunFile(logDir, typeof req.query.run === "string" ? req.query.run : void 0);
  const digestFile = path13.join(logDir, `${LOG_FILE_PREFIX.digest}.log`);
  const [runLog, runtimeErrors] = await Promise.all([
    readSafeFile(targetRunFile),
    readSafeFile(digestFile)
  ]);
  res.json({
    runId: log.runId,
    activeFile: path13.basename(targetRunFile),
    runLog,
    runtimeErrors,
    runs: listRunLogs(logDir)
  });
});

// server/routes/localeRoutes.ts
import { Router as Router18 } from "express";

// server/utils/localeDirectory.ts
import fs10 from "node:fs";
import path14 from "node:path";

// src/core/shared/localePackLimits.ts
var LOCALE_PACK_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxStringLength: 4e3,
  maxKeys: 2e4
};
var LOCALE_CODE_PATTERN = /^[a-z]{2,3}(-[A-Z]{2})?$/;
var RESERVED_LOCALE_CODES = [
  "en",
  "he",
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf"
];
var DEFAULT_RTL_CODES = ["ar", "fa", "ur", "yi", "ps", "dv"];

// src/core/shared/localePack.ts
function placeholdersOf(text) {
  const matches = text.match(/\{([a-zA-Z0-9_-]+)\}/g);
  if (!matches) return [];
  const unique = new Set(matches.map((m) => m.slice(1, -1)));
  return Array.from(unique).sort();
}
function validateCode(code) {
  if (typeof code !== "string" || !LOCALE_CODE_PATTERN.test(code)) {
    return { code: "", issues: [{ level: "error", message: `Invalid locale code: "${String(code)}"` }] };
  }
  if (RESERVED_LOCALE_CODES.includes(code.toLowerCase())) {
    return { code: "", issues: [{ level: "error", message: `Reserved locale code: "${code}"` }] };
  }
  return { code, issues: [] };
}
function resolveDirection(code, dir) {
  if (dir === void 0 || dir === null || dir === "") {
    const isDefaultRtl = DEFAULT_RTL_CODES.includes(code.split("-")[0].toLowerCase());
    return { dir: isDefaultRtl ? "rtl" : "ltr", valid: true };
  }
  if (dir === "ltr" || dir === "rtl") {
    return { dir, valid: true };
  }
  return { dir: "ltr", valid: false };
}
function validateMeta(raw) {
  const issues = [];
  const codeRes = validateCode(raw.code);
  issues.push(...codeRes.issues);
  const nativeName = typeof raw.nativeName === "string" ? raw.nativeName.trim() : "";
  const englishName = typeof raw.englishName === "string" ? raw.englishName.trim() : "";
  if (!nativeName || !englishName) {
    issues.push({ level: "error", message: "meta.nativeName and meta.englishName are required non-empty strings" });
  }
  const dirRes = resolveDirection(codeRes.code, raw.dir);
  if (!dirRes.valid) {
    issues.push({ level: "error", message: `Invalid dir: "${String(raw.dir)}". Must be "ltr" or "rtl"` });
  }
  const flag = typeof raw.flag === "string" ? raw.flag.trim() : "";
  if (issues.some((i) => i.level === "error")) {
    return { meta: null, issues };
  }
  return {
    meta: {
      code: codeRes.code,
      nativeName,
      englishName,
      dir: dirRes.dir,
      flag
    },
    issues
  };
}
function validateStrings(rawStrings, knownKeys) {
  const issues = [];
  const strings = /* @__PURE__ */ Object.create(null);
  const entries = Object.entries(rawStrings);
  if (entries.length > LOCALE_PACK_LIMITS.maxKeys) {
    issues.push({ level: "error", message: `Key count exceeds limit of ${LOCALE_PACK_LIMITS.maxKeys}` });
    return { strings: {}, issues };
  }
  for (const [key, value] of entries) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (!knownKeys.has(key)) {
      issues.push({ level: "warning", key, message: `Unknown translation key: "${key}"` });
      continue;
    }
    if (typeof value !== "string" || value.trim() === "") {
      issues.push({ level: "warning", key, message: `Non-string or empty translation for key "${key}"` });
      continue;
    }
    if (value.length > LOCALE_PACK_LIMITS.maxStringLength) {
      issues.push({ level: "warning", key, message: `Translation string exceeds max length for key "${key}"` });
      continue;
    }
    strings[key] = value;
  }
  return { strings, issues };
}
function checkRootStructure(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { obj: null, issue: { level: "error", message: "Locale pack must be an object" } };
  }
  const obj = raw;
  if (!obj.meta || typeof obj.meta !== "object" || Array.isArray(obj.meta)) {
    return { obj: null, issue: { level: "error", message: "Locale pack missing meta object" } };
  }
  if (!obj.strings || typeof obj.strings !== "object" || Array.isArray(obj.strings)) {
    return { obj: null, issue: { level: "error", message: "Locale pack missing strings object" } };
  }
  return { obj };
}
function validateLocalePack(raw, knownKeys) {
  const root = checkRootStructure(raw);
  if (!root.obj) {
    return { pack: null, issues: [root.issue] };
  }
  const metaRes = validateMeta(root.obj.meta);
  const stringsRes = validateStrings(root.obj.strings, knownKeys);
  const issues = [...metaRes.issues, ...stringsRes.issues];
  if (!metaRes.meta || issues.some((i) => i.level === "error")) {
    return { pack: null, issues };
  }
  return { pack: { meta: metaRes.meta, strings: stringsRes.strings }, issues };
}

// server/utils/localeDirectory.ts
function resolveLocalesDir(env = process.env) {
  return env.STUDYTS_LOCALES_DIR ? path14.resolve(env.STUDYTS_LOCALES_DIR) : path14.resolve(PACKAGE_ROOT, "locales");
}
function findPlaceholderMismatches(pack, leaves2) {
  const issues = [];
  for (const [key, translatedText] of Object.entries(pack.strings)) {
    const leaf = leaves2.get(key);
    if (!leaf) continue;
    const expected = placeholdersOf(leaf.en);
    const actual = placeholdersOf(translatedText);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      issues.push({
        level: "warning",
        key,
        message: `Placeholder mismatch for "${key}": expected [${expected.join(", ")}], got [${actual.join(", ")}]`
      });
    }
  }
  return issues;
}
var dirCache = /* @__PURE__ */ new Map();
function getDirMaxMtime(dir) {
  if (!fs10.existsSync(dir)) return 0;
  const stat = fs10.statSync(dir);
  let maxMtime = stat.mtimeMs;
  const entries = fs10.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      const fileStat = fs10.statSync(path14.join(dir, entry.name));
      if (fileStat.mtimeMs > maxMtime) maxMtime = fileStat.mtimeMs;
    }
  }
  return maxMtime;
}
function parseJsonFile(filePath) {
  const stat = fs10.statSync(filePath);
  if (stat.size > LOCALE_PACK_LIMITS.maxBytes) {
    return { parseError: `File size exceeds limit of ${LOCALE_PACK_LIMITS.maxBytes} bytes` };
  }
  let rawText = fs10.readFileSync(filePath, "utf8");
  if (rawText.charCodeAt(0) === 65279) rawText = rawText.slice(1);
  try {
    return { parsed: JSON.parse(rawText) };
  } catch (err) {
    return { parseError: `Invalid JSON syntax: ${err.message}` };
  }
}
function loadPackFile(dir, file, knownKeys, seenCodes, leaves2) {
  const filePath = path14.join(dir, file);
  const { parsed, parseError } = parseJsonFile(filePath);
  if (parseError) {
    return { rejection: { file, issues: [{ level: "error", message: parseError }] } };
  }
  const { pack, issues } = validateLocalePack(parsed, knownKeys);
  if (!pack) {
    return { rejection: { file, issues } };
  }
  const fileStem = path14.basename(file, ".json").toLowerCase();
  if (fileStem !== pack.meta.code.toLowerCase()) {
    return {
      rejection: {
        file,
        issues: [{ level: "error", message: `File name "${file}" does not match locale code "${pack.meta.code}"` }]
      }
    };
  }
  if (seenCodes.has(fileStem)) {
    return {
      rejection: {
        file,
        issues: [{ level: "error", message: `Duplicate locale code "${pack.meta.code}" already loaded` }]
      }
    };
  }
  seenCodes.add(fileStem);
  if (leaves2) {
    const placeholderIssues = findPlaceholderMismatches(pack, leaves2);
    issues.push(...placeholderIssues);
    for (const issue of placeholderIssues) {
      if (issue.key) delete pack.strings[issue.key];
    }
  }
  return { pack: { pack, issues, file } };
}
async function readLocalePacks(dir, knownKeys, leaves2) {
  if (!fs10.existsSync(dir)) return { packs: [], rejected: [] };
  const currentMtime = getDirMaxMtime(dir);
  const cached = dirCache.get(dir);
  if (cached && cached.mtime === currentMtime) {
    return { packs: cached.packs, rejected: cached.rejected };
  }
  const rawFiles = fs10.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(".json") && !e.name.startsWith("_") && !e.name.startsWith(".")).map((e) => e.name).sort();
  const packs = [];
  const rejected = [];
  const seenCodes = /* @__PURE__ */ new Set();
  for (const file of rawFiles) {
    const res = loadPackFile(dir, file, knownKeys, seenCodes, leaves2);
    if (res.rejection) rejected.push(res.rejection);
    else if (res.pack) packs.push(res.pack);
  }
  const result = { packs, rejected };
  dirCache.set(dir, { mtime: currentMtime, ...result });
  return result;
}

// src/core/shared/translationLeafSnapshot.json
var translationLeafSnapshot_default = {
  "AI_TEXT.assistantTitle": {
    en: "AI Assistant",
    he: "\u05E2\u05D5\u05D6\u05E8 AI"
  },
  "AI_TEXT.assistantIntro": {
    en: "Bring your own API key (Claude, OpenAI, DeepSeek, Gemini) to chat with an AI assistant inside the app.",
    he: "\u05D4\u05D6\u05DF \u05DE\u05E4\u05EA\u05D7 API \u05D0\u05D9\u05E9\u05D9 (Claude, OpenAI, DeepSeek, Gemini) \u05DB\u05D3\u05D9 \u05DC\u05E9\u05D5\u05D7\u05D7 \u05E2\u05DD \u05E2\u05D5\u05D6\u05E8 AI \u05D1\u05EA\u05D5\u05DA \u05D4\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4."
  },
  "AI_TEXT.providerLabel": {
    en: "AI Provider",
    he: "\u05E1\u05E4\u05E7 AI"
  },
  "AI_TEXT.keyLabel": {
    en: "API key",
    he: "\u05DE\u05E4\u05EA\u05D7 API"
  },
  "AI_TEXT.keyPlaceholder": {
    en: "Paste your API key",
    he: "\u05D4\u05D3\u05D1\u05E7 \u05DB\u05D0\u05DF \u05D0\u05EA \u05DE\u05E4\u05EA\u05D7 \u05D4-API \u05E9\u05DC\u05DA"
  },
  "AI_TEXT.keyStorageNotice": {
    en: "Stored only in this browser tab (cleared when you close it). Sent directly to the selected AI provider.",
    he: "\u05E0\u05E9\u05DE\u05E8 \u05E8\u05E7 \u05D1\u05D8\u05D0\u05D1 \u05D4\u05D3\u05E4\u05D3\u05E4\u05DF \u05D4\u05D6\u05D4 (\u05E0\u05DE\u05D7\u05E7 \u05D1\u05E1\u05D2\u05D9\u05E8\u05EA\u05D5). \u05E0\u05E9\u05DC\u05D7 \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05DC\u05E1\u05E4\u05E7 \u05D4-AI \u05D4\u05E0\u05D1\u05D7\u05E8."
  },
  "AI_TEXT.testConnection": {
    en: "Save & Test Connection",
    he: "\u05E9\u05DE\u05D5\u05E8 \u05D5\u05D1\u05D3\u05D5\u05E7 \u05D7\u05D9\u05D1\u05D5\u05E8"
  },
  "AI_TEXT.testing": {
    en: "Testing...",
    he: "\u05D1\u05D5\u05D3\u05E7..."
  },
  "AI_TEXT.connected": {
    en: "Connected",
    he: "\u05DE\u05D7\u05D5\u05D1\u05E8"
  },
  "AI_TEXT.connectionFailed": {
    en: "Connection failed",
    he: "\u05D4\u05D7\u05D9\u05D1\u05D5\u05E8 \u05E0\u05DB\u05E9\u05DC"
  },
  "AI_TEXT.removeKey": {
    en: "Remove key",
    he: "\u05D4\u05E1\u05E8 \u05DE\u05E4\u05EA\u05D7"
  },
  "AI_TEXT.modelLabel": {
    en: "Model",
    he: "\u05DE\u05D5\u05D3\u05DC"
  },
  "AI_TEXT.chatPlaceholder": {
    en: "Type a message...",
    he: "\u05D4\u05E7\u05DC\u05D3 \u05D4\u05D5\u05D3\u05E2\u05D4..."
  },
  "AI_TEXT.send": {
    en: "Send",
    he: "\u05E9\u05DC\u05D7"
  },
  "AI_TEXT.estimatedCost": {
    en: "Estimated cost",
    he: "\u05E2\u05DC\u05D5\u05EA \u05DE\u05E9\u05D5\u05E2\u05E8\u05EA"
  },
  "AI_TEXT.confirmSend": {
    en: "This will cost approximately {cost}. Send anyway?",
    he: "\u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05EA\u05E2\u05DC\u05D4 \u05DB-{cost}. \u05DC\u05E9\u05DC\u05D5\u05D7 \u05D1\u05DB\u05DC \u05D6\u05D0\u05EA?"
  },
  "AI_TEXT.sendingWarningThreshold": {
    en: "This message is large and may cost more than usual.",
    he: "\u05D4\u05D4\u05D5\u05D3\u05E2\u05D4 \u05D2\u05D3\u05D5\u05DC\u05D4 \u05D5\u05E2\u05E9\u05D5\u05D9\u05D4 \u05DC\u05E2\u05DC\u05D5\u05EA \u05D9\u05D5\u05EA\u05E8 \u05DE\u05D4\u05E8\u05D2\u05D9\u05DC."
  },
  "AI_TEXT.requestFailed": {
    en: "Request failed",
    he: "\u05D4\u05D1\u05E7\u05E9\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4"
  },
  "AI_TEXT.modeOmniRoute": {
    en: "OmniRoute (Docker)",
    he: "OmniRoute (Docker)"
  },
  "AI_TEXT.modeDirect": {
    en: "Direct API",
    he: "API \u05D9\u05E9\u05D9\u05E8"
  },
  "AI_TEXT.omniRouteKeyLabel": {
    en: "OmniRoute API key",
    he: "\u05DE\u05E4\u05EA\u05D7 API \u05E9\u05DC OmniRoute"
  },
  "AI_TEXT.omniRouteKeyPlaceholder": {
    en: "Paste your OmniRoute API key",
    he: "\u05D4\u05D3\u05D1\u05E7 \u05DB\u05D0\u05DF \u05D0\u05EA \u05DE\u05E4\u05EA\u05D7 \u05D4-OmniRoute \u05E9\u05DC\u05DA"
  },
  "AI_TEXT.omniRouteKeyStorageNotice": {
    en: "Stored only in this browser tab (cleared when you close it). Sent only to your local OmniRoute instance.",
    he: "\u05E0\u05E9\u05DE\u05E8 \u05E8\u05E7 \u05D1\u05D8\u05D0\u05D1 \u05D4\u05D3\u05E4\u05D3\u05E4\u05DF \u05D4\u05D6\u05D4 (\u05E0\u05DE\u05D7\u05E7 \u05D1\u05E1\u05D2\u05D9\u05E8\u05EA\u05D5). \u05E0\u05E9\u05DC\u05D7 \u05E8\u05E7 \u05DC\u05DE\u05D5\u05E4\u05E2 \u05D4-OmniRoute \u05D4\u05DE\u05E7\u05D5\u05DE\u05D9 \u05E9\u05DC\u05DA."
  },
  "AI_TEXT.omniRouteModelLabel": {
    en: "Model / routing strategy",
    he: "\u05DE\u05D5\u05D3\u05DC / \u05D0\u05E1\u05D8\u05E8\u05D8\u05D2\u05D9\u05D9\u05EA \u05E0\u05D9\u05EA\u05D5\u05D1"
  },
  "AI_TEXT.costVariesNotice": {
    en: "Cost varies by provider and is not estimated here.",
    he: "\u05D4\u05E2\u05DC\u05D5\u05EA \u05DE\u05E9\u05EA\u05E0\u05D4 \u05DC\u05E4\u05D9 \u05E1\u05E4\u05E7 \u05D5\u05D0\u05D9\u05E0\u05D4 \u05DE\u05D5\u05E2\u05E8\u05DB\u05EA \u05DB\u05D0\u05DF."
  },
  "AI_TEXT.clearChat": {
    en: "Clear chat",
    he: "\u05E0\u05E7\u05D4 \u05E9\u05D9\u05D7\u05D4"
  },
  "AI_TEXT.executingTool": {
    en: "Executing tool...",
    he: "\u05DE\u05D1\u05E6\u05E2 \u05E4\u05E2\u05D5\u05DC\u05D4..."
  },
  "AI_TEXT.toolSuccess": {
    en: "Done",
    he: "\u05D1\u05D5\u05E6\u05E2"
  },
  "AI_TEXT.toolDoneSchema": {
    en: "Checked the database: {n} tables",
    he: "\u05D1\u05D3\u05E7 \u05D0\u05EA \u05DE\u05E1\u05D3 \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD: {n} \u05D8\u05D1\u05DC\u05D0\u05D5\u05EA"
  },
  "AI_TEXT.toolDoneQuery": {
    en: "Looked up {table}: {n} rows found",
    he: "\u05D7\u05D9\u05E4\u05E9 \u05D1-{table}: \u05E0\u05DE\u05E6\u05D0\u05D5 {n} \u05E9\u05D5\u05E8\u05D5\u05EA"
  },
  "AI_TEXT.toolDoneQueryNone": {
    en: "Looked up {table}: nothing found",
    he: "\u05D7\u05D9\u05E4\u05E9 \u05D1-{table}: \u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0 \u05DB\u05DC\u05D5\u05DD"
  },
  "AI_TEXT.toolDoneTopics": {
    en: "Listed topics: {n} found",
    he: "\u05E8\u05E9\u05DD \u05E0\u05D5\u05E9\u05D0\u05D9\u05DD: \u05E0\u05DE\u05E6\u05D0\u05D5 {n}"
  },
  "AI_TEXT.toolOpConverted": {
    en: "blocks converted: {n}",
    he: "\u05D1\u05DC\u05D5\u05E7\u05D9\u05DD \u05E9\u05D4\u05D5\u05DE\u05E8\u05D5: {n}"
  },
  "AI_TEXT.toolOpTidied": {
    en: "tidied the layout",
    he: "\u05E1\u05D9\u05D3\u05E8 \u05D0\u05EA \u05D4\u05E4\u05E8\u05D9\u05E1\u05D4"
  },
  "AI_TEXT.toolOpAdded": {
    en: "blocks added: {n}",
    he: "\u05D1\u05DC\u05D5\u05E7\u05D9\u05DD \u05E9\u05E0\u05D5\u05E1\u05E4\u05D5: {n}"
  },
  "AI_TEXT.toolOpRemoved": {
    en: "blocks removed: {n}",
    he: "\u05D1\u05DC\u05D5\u05E7\u05D9\u05DD \u05E9\u05D4\u05D5\u05E1\u05E8\u05D5: {n}"
  },
  "AI_TEXT.toolOpChanged": {
    en: "blocks changed: {n}",
    he: "\u05D1\u05DC\u05D5\u05E7\u05D9\u05DD \u05E9\u05E9\u05D5\u05E0\u05D5: {n}"
  },
  "AI_TEXT.toolDoneEdit": {
    en: 'Edited "{scene}": {what}',
    he: '\u05E2\u05E8\u05DA \u05D0\u05EA "{scene}": {what}'
  },
  "AI_TEXT.toolDoneBuild": {
    en: 'Built canvas "{title}" ({n} blocks)',
    he: '\u05D1\u05E0\u05D4 \u05E7\u05E0\u05D1\u05E1 "{title}" ({n} \u05D1\u05DC\u05D5\u05E7\u05D9\u05DD)'
  },
  "AI_TEXT.toolDoneDiagram": {
    en: 'Added a {type} diagram to "{scene}"',
    he: '\u05D4\u05D5\u05E1\u05D9\u05E3 \u05D3\u05D9\u05D0\u05D2\u05E8\u05DE\u05EA {type} \u05DC-"{scene}"'
  },
  "AI_TEXT.toolActionCreated": {
    en: "created",
    he: "\u05E0\u05D5\u05E6\u05E8"
  },
  "AI_TEXT.toolActionUpdated": {
    en: "updated",
    he: "\u05E2\u05D5\u05D3\u05DB\u05DF"
  },
  "AI_TEXT.toolActionDeleted": {
    en: "deleted",
    he: "\u05E0\u05DE\u05D7\u05E7"
  },
  "AI_TEXT.toolActionMoved": {
    en: "moved",
    he: "\u05D4\u05D5\u05D6\u05D6"
  },
  "AI_TEXT.toolErrWrongName": {
    en: "wrong table or column name",
    he: "\u05E9\u05DD \u05D8\u05D1\u05DC\u05D4 \u05D0\u05D5 \u05E2\u05DE\u05D5\u05D3\u05D4 \u05E9\u05D2\u05D5\u05D9"
  },
  "AI_TEXT.toolErrNotFound": {
    en: "couldn't find the target",
    he: "\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0 \u05D4\u05D9\u05E2\u05D3"
  },
  "AI_TEXT.toolErrBadInput": {
    en: "the AI sent invalid input",
    he: "\u05D4-AI \u05E9\u05DC\u05D7 \u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF"
  },
  "AI_TEXT.toolErrConnection": {
    en: "connection problem",
    he: "\u05D1\u05E2\u05D9\u05D9\u05EA \u05D7\u05D9\u05D1\u05D5\u05E8"
  },
  "AI_TEXT.toolFailed": {
    en: "Action failed",
    he: "\u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4"
  },
  "AI_TEXT.toolReadSchema": {
    en: "Database schema",
    he: "\u05DE\u05D1\u05E0\u05D4 \u05DE\u05E1\u05D3 \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD"
  },
  "AI_TEXT.toolQueryData": {
    en: "Course data search",
    he: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05D1\u05E0\u05EA\u05D5\u05E0\u05D9 \u05D4\u05E7\u05D5\u05E8\u05E1"
  },
  "AI_TEXT.toolListTopics": {
    en: "Topic list",
    he: "\u05E8\u05E9\u05D9\u05DE\u05EA \u05E0\u05D5\u05E9\u05D0\u05D9\u05DD"
  },
  "AI_TEXT.toolListCourses": {
    en: "Course list",
    he: "\u05E8\u05E9\u05D9\u05DE\u05EA \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD"
  },
  "AI_TEXT.toolEditCanvas": {
    en: "Canvas edit",
    he: "\u05E2\u05E8\u05D9\u05DB\u05EA \u05E7\u05E0\u05D1\u05E1"
  },
  "AI_TEXT.toolBuildCanvas": {
    en: "New canvas",
    he: "\u05E7\u05E0\u05D1\u05E1 \u05D7\u05D3\u05E9"
  },
  "AI_TEXT.toolMakeDiagram": {
    en: "UML diagram",
    he: "\u05D3\u05D9\u05D0\u05D2\u05E8\u05DE\u05EA UML"
  },
  "AI_TEXT.toolEditCourse": {
    en: "Course update",
    he: "\u05E2\u05D3\u05DB\u05D5\u05DF \u05E7\u05D5\u05E8\u05E1"
  },
  "AI_TEXT.toolEditSection": {
    en: "Section update",
    he: "\u05E2\u05D3\u05DB\u05D5\u05DF \u05E4\u05E8\u05E7"
  },
  "AI_TEXT.toolEditTopic": {
    en: "Topic update",
    he: "\u05E2\u05D3\u05DB\u05D5\u05DF \u05E0\u05D5\u05E9\u05D0"
  },
  "AI_TEXT.toolPublishVisual": {
    en: "Step player lecture",
    he: "\u05D4\u05E8\u05E6\u05D0\u05EA \u05E0\u05D2\u05DF \u05E6\u05E2\u05D3\u05D9\u05DD"
  },
  "AI_TEXT.toolEditCode": {
    en: "Code edit",
    he: "\u05E2\u05E8\u05D9\u05DB\u05EA \u05E7\u05D5\u05D3"
  },
  "AI_TEXT.toolWriteLecture": {
    en: "Lecture write",
    he: "\u05DB\u05EA\u05D9\u05D1\u05EA \u05D4\u05E8\u05E6\u05D0\u05D4"
  },
  "AI_TEXT.toolUpdateCatalog": {
    en: "Catalog update",
    he: "\u05E2\u05D3\u05DB\u05D5\u05DF \u05E7\u05D8\u05DC\u05D5\u05D2"
  },
  "AI_TEXT.uploadFile": {
    en: "Attach file",
    he: "\u05E6\u05E8\u05E3 \u05E7\u05D5\u05D1\u05E5"
  },
  "AI_TEXT.contextActive": {
    en: "Active context",
    he: "\u05D4\u05E7\u05E9\u05E8 \u05E4\u05E2\u05D9\u05DC"
  },
  "AI_TEXT.stop": {
    en: "Stop",
    he: "\u05E2\u05E6\u05D5\u05E8"
  },
  "AI_TEXT.stopped": {
    en: "Stopped by user",
    he: "\u05D4\u05D5\u05E4\u05E1\u05E7 \u05E2\u05DC \u05D9\u05D3\u05D9 \u05D4\u05DE\u05E9\u05EA\u05DE\u05E9"
  },
  "AI_TEXT.interruptedByReload": {
    en: "Interrupted by reload.",
    he: "\u05D4\u05D5\u05E4\u05E1\u05E7 \u05D1\u05E8\u05E2\u05E0\u05D5\u05DF."
  },
  "AI_TEXT.emptyReplyAfterTools": {
    en: "\u26A0\uFE0F No change made. Try again, more specific.",
    he: "\u26A0\uFE0F \u05DC\u05D0 \u05D1\u05D5\u05E6\u05E2 \u05E9\u05D9\u05E0\u05D5\u05D9. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1, \u05D1\u05D9\u05EA\u05E8 \u05E4\u05D9\u05E8\u05D5\u05D8."
  },
  "AI_TEXT.quickFixPage": {
    en: "Fix this page",
    he: "\u05EA\u05E7\u05DF \u05D0\u05EA \u05D4\u05D3\u05E3"
  },
  "AI_TEXT.quickFixPagePrompt": {
    en: "Please review this page for mistakes (wrong content, broken blocks, bad translations) and fix them directly.",
    he: "\u05D1\u05D1\u05E7\u05E9\u05D4 \u05D1\u05D3\u05D5\u05E7 \u05D0\u05EA \u05D4\u05D3\u05E3 \u05D4\u05D6\u05D4 \u05DC\u05D8\u05E2\u05D5\u05D9\u05D5\u05EA (\u05EA\u05D5\u05DB\u05DF \u05E9\u05D2\u05D5\u05D9, \u05D1\u05DC\u05D5\u05E7\u05D9\u05DD \u05E9\u05D1\u05D5\u05E8\u05D9\u05DD, \u05EA\u05E8\u05D2\u05D5\u05DE\u05D9\u05DD \u05DC\u05D0 \u05D8\u05D5\u05D1\u05D9\u05DD) \u05D5\u05EA\u05E7\u05DF \u05D0\u05D5\u05EA\u05DF \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA."
  },
  "AI_TEXT.quickCreateCourse": {
    en: "Create course",
    he: "\u05E6\u05D5\u05E8 \u05E7\u05D5\u05E8\u05E1"
  },
  "AI_TEXT.quickCreateCoursePrompt": {
    en: "Create a new course about: ",
    he: "\u05E6\u05D5\u05E8 \u05E7\u05D5\u05E8\u05E1 \u05D7\u05D3\u05E9 \u05D1\u05E0\u05D5\u05E9\u05D0: "
  },
  "AI_TEXT.quickCreateTopic": {
    en: "Create topic",
    he: "\u05E6\u05D5\u05E8 \u05E0\u05D5\u05E9\u05D0"
  },
  "AI_TEXT.quickCreateTopicPrompt": {
    en: "Add a new topic to this course about: ",
    he: "\u05D4\u05D5\u05E1\u05E3 \u05E0\u05D5\u05E9\u05D0 \u05D7\u05D3\u05E9 \u05DC\u05E7\u05D5\u05E8\u05E1 \u05D4\u05D6\u05D4 \u05D1\u05E0\u05D5\u05E9\u05D0: "
  },
  "AI_TEXT.quickCreateCanvas": {
    en: "Create canvas",
    he: "\u05E6\u05D5\u05E8 \u05E7\u05E0\u05D1\u05E1"
  },
  "AI_TEXT.quickCreateCanvasPrompt": {
    en: "Create a canvas page for this topic about: ",
    he: "\u05E6\u05D5\u05E8 \u05D3\u05E3 \u05E7\u05E0\u05D1\u05E1 \u05DC\u05E0\u05D5\u05E9\u05D0 \u05D4\u05D6\u05D4 \u05D1\u05E0\u05D5\u05E9\u05D0: "
  },
  "AI_TEXT.askAi": {
    en: "Ask AI",
    he: "\u05E9\u05D0\u05DC AI"
  },
  "AI_TEXT.askAiCustom": {
    en: "Ask anything\u2026",
    he: "\u05E9\u05D0\u05DC \u05DE\u05E9\u05D4\u05D5\u2026"
  },
  "AI_TEXT.askAiCustomPrompt": {
    en: "My question about this:",
    he: "\u05D4\u05E9\u05D0\u05DC\u05D4 \u05E9\u05DC\u05D9 \u05E2\u05DC \u05D6\u05D4:"
  },
  "AI_TEXT.askAiTidy": {
    en: "Fix overlaps and empty space",
    he: "\u05EA\u05E7\u05DF \u05D7\u05E4\u05D9\u05E4\u05D5\u05EA \u05D5\u05E8\u05D5\u05D5\u05D7\u05D9\u05DD \u05E8\u05D9\u05E7\u05D9\u05DD"
  },
  "AI_TEXT.askAiTidyPrompt": {
    en: "Fix overlapping blocks and big empty gaps on this page. Use one apply_scene_ops call with a tidyLayout op for this page; do not change any content.",
    he: "\u05EA\u05E7\u05DF \u05D1\u05DC\u05D5\u05E7\u05D9\u05DD \u05D7\u05D5\u05E4\u05E4\u05D9\u05DD \u05D5\u05E8\u05D5\u05D5\u05D7\u05D9\u05DD \u05E8\u05D9\u05E7\u05D9\u05DD \u05D2\u05D3\u05D5\u05DC\u05D9\u05DD \u05D1\u05E2\u05DE\u05D5\u05D3 \u05D4\u05D6\u05D4. \u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05E7\u05E8\u05D9\u05D0\u05D4 \u05D0\u05D7\u05EA \u05DC-apply_scene_ops \u05E2\u05DD \u05E4\u05E2\u05D5\u05DC\u05EA tidyLayout \u05DC\u05E2\u05DE\u05D5\u05D3 \u05D4\u05D6\u05D4; \u05D0\u05DC \u05EA\u05E9\u05E0\u05D4 \u05EA\u05D5\u05DB\u05DF."
  },
  "AI_TEXT.askAiExplainPage": {
    en: "Explain this page",
    he: "\u05D4\u05E1\u05D1\u05E8 \u05D0\u05EA \u05D4\u05E2\u05DE\u05D5\u05D3"
  },
  "AI_TEXT.askAiExplainPagePrompt": {
    en: "Explain what is on this page in plain words. Do not change anything.",
    he: "\u05D4\u05E1\u05D1\u05E8 \u05D1\u05DE\u05D9\u05DC\u05D9\u05DD \u05E4\u05E9\u05D5\u05D8\u05D5\u05EA \u05DE\u05D4 \u05D9\u05E9 \u05D1\u05E2\u05DE\u05D5\u05D3 \u05D4\u05D6\u05D4. \u05D0\u05DC \u05EA\u05E9\u05E0\u05D4 \u05D3\u05D1\u05E8."
  },
  "AI_TEXT.askAiConvertTable": {
    en: "Convert to table",
    he: "\u05D4\u05DE\u05E8 \u05DC\u05D8\u05D1\u05DC\u05D4"
  },
  "AI_TEXT.askAiConvertTablePrompt": {
    en: "Convert this into a table. Edit the open scene directly (replaceBlock keeps its place).",
    he: "\u05D4\u05DE\u05E8 \u05D0\u05EA \u05D6\u05D4 \u05DC\u05D8\u05D1\u05DC\u05D4. \u05E2\u05E8\u05D5\u05DA \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05D0\u05EA \u05D4\u05E1\u05E6\u05E0\u05D4 \u05D4\u05E4\u05EA\u05D5\u05D7\u05D4 (replaceBlock \u05E9\u05D5\u05DE\u05E8 \u05E2\u05DC \u05D4\u05DE\u05D9\u05E7\u05D5\u05DD)."
  },
  "AI_TEXT.askAiConvertUml": {
    en: "Convert to UML diagram",
    he: "\u05D4\u05DE\u05E8 \u05DC\u05D3\u05D9\u05D0\u05D2\u05E8\u05DE\u05EA UML"
  },
  "AI_TEXT.askAiConvertUmlPrompt": {
    en: "Convert this into a UML diagram on the same page.",
    he: "\u05D4\u05DE\u05E8 \u05D0\u05EA \u05D6\u05D4 \u05DC\u05D3\u05D9\u05D0\u05D2\u05E8\u05DE\u05EA UML \u05D1\u05D0\u05D5\u05EA\u05D5 \u05E2\u05DE\u05D5\u05D3."
  },
  "AI_TEXT.askAiRewrite": {
    en: "Rewrite",
    he: "\u05E9\u05DB\u05EA\u05D1"
  },
  "AI_TEXT.askAiRewritePrompt": {
    en: "Rewrite this to be clearer and shorter. Keep its meaning.",
    he: "\u05E9\u05DB\u05EA\u05D1 \u05D0\u05EA \u05D6\u05D4 \u05DB\u05DA \u05E9\u05D9\u05D4\u05D9\u05D4 \u05D1\u05E8\u05D5\u05E8 \u05D5\u05E7\u05E6\u05E8 \u05D9\u05D5\u05EA\u05E8. \u05E9\u05DE\u05D5\u05E8 \u05E2\u05DC \u05D4\u05DE\u05E9\u05DE\u05E2\u05D5\u05EA."
  },
  "AI_TEXT.askAiExplain": {
    en: "Explain",
    he: "\u05D4\u05E1\u05D1\u05E8"
  },
  "AI_TEXT.askAiExplainPrompt": {
    en: "Explain this to me in plain words. Do not change anything.",
    he: "\u05D4\u05E1\u05D1\u05E8 \u05DC\u05D9 \u05D0\u05EA \u05D6\u05D4 \u05D1\u05DE\u05D9\u05DC\u05D9\u05DD \u05E4\u05E9\u05D5\u05D8\u05D5\u05EA. \u05D0\u05DC \u05EA\u05E9\u05E0\u05D4 \u05D3\u05D1\u05E8."
  },
  "AI_TEXT.quickExplain": {
    en: "What can you do?",
    he: "\u05DE\u05D4 \u05D0\u05EA\u05D4 \u05D9\u05DB\u05D5\u05DC \u05DC\u05E2\u05E9\u05D5\u05EA?"
  },
  "AI_TEXT.quickExplainPrompt": {
    en: "What can you do on this page? List your capabilities briefly.",
    he: "\u05DE\u05D4 \u05D0\u05EA\u05D4 \u05DE\u05E1\u05D5\u05D2\u05DC \u05DC\u05E2\u05E9\u05D5\u05EA \u05D1\u05D3\u05E3 \u05D4\u05D6\u05D4? \u05E4\u05E8\u05D8 \u05D1\u05E7\u05E6\u05E8\u05D4 \u05D0\u05EA \u05D4\u05D9\u05DB\u05D5\u05DC\u05D5\u05EA \u05E9\u05DC\u05DA."
  },
  "AI_TEXT.fileUnsupported": {
    en: "Only text files are supported for now (.md, .txt, .json). PDF support is coming soon.",
    he: "\u05DB\u05E8\u05D2\u05E2 \u05E0\u05EA\u05DE\u05DB\u05D9\u05DD \u05E8\u05E7 \u05E7\u05D1\u05E6\u05D9 \u05D8\u05E7\u05E1\u05D8 (md, txt, json). \u05EA\u05DE\u05D9\u05DB\u05D4 \u05D1-PDF \u05EA\u05D2\u05D9\u05E2 \u05D1\u05E7\u05E8\u05D5\u05D1."
  },
  "AI_TEXT.fileTooLarge": {
    en: "File is too large (max 200KB).",
    he: "\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D2\u05D3\u05D5\u05DC \u05DE\u05D3\u05D9 (\u05DE\u05E7\u05E1\u05D9\u05DE\u05D5\u05DD 200KB)."
  },
  "AI_TEXT.pdfConverting": {
    en: "Converting PDF...",
    he: "\u05DE\u05DE\u05D9\u05E8 PDF..."
  },
  "AI_TEXT.pdfConvertFailed": {
    en: "Could not read this PDF.",
    he: "\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05D4\u05D9\u05D4 \u05DC\u05E7\u05E8\u05D5\u05D0 \u05D0\u05EA \u05E7\u05D5\u05D1\u05E5 \u05D4-PDF \u05D4\u05D6\u05D4."
  },
  "AI_TEXT.toolArgsInvalidJson": {
    en: "The AI sent malformed data for this action",
    he: "\u05D4\u05D1\u05D9\u05E0\u05D4 \u05E9\u05DC\u05D7\u05D4 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05E4\u05D2\u05D5\u05DE\u05D9\u05DD \u05DC\u05E4\u05E2\u05D5\u05DC\u05D4 \u05D4\u05D6\u05D5"
  },
  "AI_TEXT.showSettings": {
    en: "Show Settings",
    he: "\u05D4\u05E6\u05D2 \u05D4\u05D2\u05D3\u05E8\u05D5\u05EA"
  },
  "AI_TEXT.hideSettings": {
    en: "Hide Settings",
    he: "\u05D4\u05E1\u05EA\u05E8 \u05D4\u05D2\u05D3\u05E8\u05D5\u05EA"
  },
  "AI_TEXT.enableSourceEditing": {
    en: "Enable source code editing (Docker verified)",
    he: "\u05D0\u05E4\u05E9\u05E8 \u05E2\u05E8\u05D9\u05DB\u05EA \u05E7\u05D5\u05D3 \u05DE\u05E7\u05D5\u05E8 (\u05DE\u05D0\u05D5\u05DE\u05EA Docker)"
  },
  "AI_TEXT.clear": {
    en: "Clear",
    he: "\u05E0\u05E7\u05D4"
  },
  "AI_TEXT.attachFile": {
    en: "Attach file",
    he: "\u05E6\u05E8\u05E3 \u05E7\u05D5\u05D1\u05E5"
  },
  "AI_TEXT.statusIdle": {
    en: "Idle",
    he: "\u05DE\u05D5\u05DB\u05DF"
  },
  "AI_TEXT.statusReading": {
    en: "Reading context\u2026",
    he: "\u05E7\u05D5\u05E8\u05D0 \u05D4\u05E7\u05E9\u05E8\u2026"
  },
  "AI_TEXT.statusSearching": {
    en: "Searching\u2026",
    he: "\u05DE\u05D7\u05E4\u05E9\u2026"
  },
  "AI_TEXT.statusGenerating": {
    en: "Generating\u2026",
    he: "\u05DE\u05D9\u05D9\u05E6\u05E8 \u05EA\u05E9\u05D5\u05D1\u05D4\u2026"
  },
  "AI_TEXT.statusExecuting": {
    en: "Running tool\u2026",
    he: "\u05DE\u05E8\u05D9\u05E5 \u05DB\u05DC\u05D9\u2026"
  },
  "AI_TEXT.statusConnecting": {
    en: "Connecting\u2026",
    he: "\u05DE\u05EA\u05D7\u05D1\u05E8\u2026"
  },
  "AI_TEXT.statusRetrying": {
    en: "Connection failed, retrying",
    he: "\u05D4\u05D7\u05D9\u05D1\u05D5\u05E8 \u05E0\u05DB\u05E9\u05DC, \u05DE\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1"
  },
  "AI_TEXT.changeModel": {
    en: "Change model",
    he: "\u05E9\u05E0\u05D4 \u05DE\u05D5\u05D3\u05DC"
  },
  "AI_TEXT.currentModel": {
    en: "Model",
    he: "\u05DE\u05D5\u05D3\u05DC"
  },
  "AI_TEXT.noApiKey": {
    en: "No API key \u2014 click Setting to configure",
    he: "\u05D0\u05D9\u05DF \u05DE\u05E4\u05EA\u05D7 API \u2014 \u05DC\u05D7\u05E5 \u05E2\u05DC \u05D4\u05D2\u05D3\u05E8\u05D5\u05EA \u05DC\u05E7\u05D1\u05D9\u05E2\u05EA \u05EA\u05E6\u05D5\u05E8\u05D4"
  },
  "AI_TEXT.needApiKeyFirst": {
    en: "Please connect an API key first",
    he: "\u05D9\u05E9 \u05DC\u05D7\u05D1\u05E8 \u05DE\u05E4\u05EA\u05D7 API \u05EA\u05D7\u05D9\u05DC\u05D4"
  },
  "AI_TEXT.actionCompleted": {
    en: "Done",
    he: "\u05D1\u05D5\u05E6\u05E2"
  },
  "AI_TEXT.errorTimeout": {
    en: "\u26A0\uFE0F AI timed out. Try again.",
    he: "\u26A0\uFE0F \u05D4-AI \u05DC\u05D0 \u05D4\u05D2\u05D9\u05D1 \u05D1\u05D6\u05DE\u05DF. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1."
  },
  "AI_TEXT.errorRateLimit": {
    en: "\u26A0\uFE0F Too many requests. Wait a moment.",
    he: "\u26A0\uFE0F \u05D9\u05D5\u05EA\u05E8 \u05DE\u05D3\u05D9 \u05D1\u05E7\u05E9\u05D5\u05EA. \u05D4\u05DE\u05EA\u05DF \u05E8\u05D2\u05E2."
  },
  "AI_TEXT.errorAuth": {
    en: "\u26A0\uFE0F API key rejected. Check Settings.",
    he: "\u26A0\uFE0F \u05DE\u05E4\u05EA\u05D7 \u05D4-API \u05E0\u05D3\u05D7\u05D4. \u05D1\u05D3\u05D5\u05E7 \u05D1\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA."
  },
  "AI_TEXT.errorBadRequest": {
    en: "\u26A0\uFE0F Invalid request. Rephrase and retry.",
    he: "\u26A0\uFE0F \u05D1\u05E7\u05E9\u05D4 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05E0\u05D4. \u05E0\u05E1\u05D7 \u05DE\u05D7\u05D3\u05E9."
  },
  "AI_TEXT.errorProvider": {
    en: "\u26A0\uFE0F AI provider error. Try again shortly.",
    he: "\u26A0\uFE0F \u05EA\u05E7\u05DC\u05D4 \u05D0\u05E6\u05DC \u05E1\u05E4\u05E7 \u05D4-AI. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1 \u05D1\u05E7\u05E8\u05D5\u05D1."
  },
  "AI_TEXT.errorNetwork": {
    en: "\u26A0\uFE0F Cannot reach the AI provider.",
    he: "\u26A0\uFE0F \u05D0\u05D9\u05DF \u05D7\u05D9\u05D1\u05D5\u05E8 \u05DC\u05E1\u05E4\u05E7 \u05D4-AI."
  },
  "AI_TEXT.errorAborted": {
    en: "\u26A0\uFE0F Request interrupted. Try again.",
    he: "\u26A0\uFE0F \u05D4\u05D1\u05E7\u05E9\u05D4 \u05D4\u05D5\u05E4\u05E1\u05E7\u05D4. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1."
  },
  "AI_TEXT.attachment_empty": {
    en: "File is empty",
    he: "\u05D4\u05E7\u05D5\u05D1\u05E5 \u05E8\u05D9\u05E7"
  },
  "AI_TEXT.attachment_too_large": {
    en: "File exceeds 5MB limit",
    he: "\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D7\u05D5\u05E8\u05D2 \u05DE\u05DE\u05D2\u05D1\u05DC\u05EA 5MB"
  },
  "AI_TEXT.attachment_archive_extension": {
    en: "Archive files (.zip, .rar, .7z, etc.) are blocked",
    he: "\u05E7\u05D1\u05E6\u05D9 \u05D0\u05E8\u05DB\u05D9\u05D5\u05DF (.zip, .rar, .7z \u05D5\u05DB\u05D5\u05F3) \u05D7\u05E1\u05D5\u05DE\u05D9\u05DD"
  },
  "AI_TEXT.attachment_archive_signature": {
    en: "Archive file signature detected (blocked)",
    he: "\u05D6\u05D5\u05D4\u05EA\u05D4 \u05D7\u05EA\u05D9\u05DE\u05EA \u05D0\u05E8\u05DB\u05D9\u05D5\u05DF (\u05D7\u05E1\u05D5\u05DD)"
  },
  "AI_TEXT.attachment_archive_mime": {
    en: "Archive MIME type detected (blocked)",
    he: "\u05E1\u05D5\u05D2 \u05E7\u05D5\u05D1\u05E5 \u05D0\u05E8\u05DB\u05D9\u05D5\u05DF (\u05D7\u05E1\u05D5\u05DD)"
  },
  "AI_TEXT.attachment_unsupported_extension": {
    en: "Unsupported file extension",
    he: "\u05E1\u05D9\u05D5\u05DE\u05EA \u05E7\u05D5\u05D1\u05E5 \u05DC\u05D0 \u05E0\u05EA\u05DE\u05DB\u05EA"
  },
  "AI_TEXT.attachment_pdf_signature": {
    en: "Invalid PDF signature",
    he: "\u05D7\u05EA\u05D9\u05DE\u05EA PDF \u05DC\u05D0 \u05EA\u05E7\u05D9\u05E0\u05D4"
  },
  "AI_TEXT.attachment_binary_content": {
    en: "Binary content detected (unsupported)",
    he: "\u05D6\u05D5\u05D4\u05D4 \u05EA\u05D5\u05DB\u05DF \u05D1\u05D9\u05E0\u05D0\u05E8\u05D9 (\u05DC\u05D0 \u05E0\u05EA\u05DE\u05DA)"
  },
  "AI_TEXT.attachment_too_many": {
    en: "Max 10 attachments allowed",
    he: "\u05E0\u05D9\u05EA\u05DF \u05DC\u05E6\u05E8\u05E3 \u05E2\u05D3 10 \u05E7\u05D1\u05E6\u05D9\u05DD"
  },
  "AI_TEXT.attachment_duplicate": {
    en: "Duplicate file already attached",
    he: "\u05E7\u05D5\u05D1\u05E5 \u05DB\u05E4\u05D5\u05DC \u05DB\u05D1\u05E8 \u05E6\u05D5\u05E8\u05E3"
  },
  "AI_TEXT.attachment_total_too_large": {
    en: "Total attachment size exceeds 20MB",
    he: "\u05D2\u05D5\u05D3\u05DC \u05D4\u05E7\u05D1\u05E6\u05D9\u05DD \u05D4\u05DB\u05D5\u05DC\u05DC \u05D7\u05D5\u05E8\u05D2 \u05DE-20MB"
  },
  "AI_TEXT.attachment_server_unavailable": {
    en: "Attachment validation server unavailable",
    he: "\u05E9\u05E8\u05EA \u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05E7\u05D1\u05E6\u05D9\u05DD \u05D0\u05D9\u05E0\u05D5 \u05D6\u05DE\u05D9\u05DF"
  },
  "AI_TEXT.copyCode": {
    en: "Copy",
    he: "\u05D4\u05E2\u05EA\u05E7"
  },
  "AI_TEXT.copied": {
    en: "Copied!",
    he: "\u05D4\u05D5\u05E2\u05EA\u05E7!"
  },
  "AI_TEXT.copyFailed": {
    en: "Failed to copy",
    he: "\u05D4\u05D4\u05E2\u05EA\u05E7\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4"
  },
  "AI_TEXT.scrollToBottom": {
    en: "Scroll to bottom",
    he: "\u05D2\u05DC\u05D5\u05DC \u05DC\u05EA\u05D7\u05EA\u05D9\u05EA"
  },
  "AI_TEXT.thinkingProcess": {
    en: "Thinking process",
    he: "\u05EA\u05D4\u05DC\u05D9\u05DA \u05D7\u05E9\u05D9\u05D1\u05D4"
  },
  "ALGORITHM_TEXT.bfs": {
    en: "Breadth-first search",
    he: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05DC\u05E8\u05D5\u05D7\u05D1"
  },
  "ALGORITHM_TEXT.dfs": {
    en: "Depth-first search",
    he: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05DC\u05E2\u05D5\u05DE\u05E7"
  },
  "ALGORITHM_TEXT.dijkstra": {
    en: "Dijkstra shortest paths",
    he: "\u05DE\u05E1\u05DC\u05D5\u05DC\u05D9\u05DD \u05E7\u05E6\u05E8\u05D9\u05DD (\u05D3\u05D9\u05D9\u05E7\u05E1\u05D8\u05E8\u05D4)"
  },
  "ALGORITHM_TEXT.prim": {
    en: "Prim spanning tree",
    he: "\u05E2\u05E5 \u05E4\u05D5\u05E8\u05E9 (\u05E4\u05E8\u05D9\u05DD)"
  },
  "ALGORITHM_TEXT.edmondsKarp": {
    en: "Max flow (Edmonds-Karp)",
    he: "\u05D6\u05E8\u05D9\u05DE\u05D4 \u05DE\u05E7\u05E1\u05D9\u05DE\u05DC\u05D9\u05EA (\u05D0\u05D3\u05DE\u05D5\u05E0\u05D3\u05E1-\u05E7\u05E8\u05E4)"
  },
  "ALGORITHM_TEXT.fordFulkerson": {
    en: "Max flow (Ford-Fulkerson)",
    he: "\u05D6\u05E8\u05D9\u05DE\u05D4 \u05DE\u05E7\u05E1\u05D9\u05DE\u05DC\u05D9\u05EA (\u05E4\u05D5\u05E8\u05D3-\u05E4\u05D5\u05DC\u05E7\u05E8\u05E1\u05D5\u05DF)"
  },
  "ALGORITHM_TEXT.automataRun": {
    en: "Run the word",
    he: "\u05D4\u05E8\u05E6\u05EA \u05D4\u05DE\u05D9\u05DC\u05D4"
  },
  "ALGORITHM_TEXT.networkSend": {
    en: "Send a packet (fewest hops)",
    he: "\u05E9\u05DC\u05D9\u05D7\u05EA \u05D7\u05D1\u05D9\u05DC\u05D4 (\u05DE\u05E2\u05D8 \u05E7\u05E4\u05D9\u05E6\u05D5\u05EA)"
  },
  "ALGORITHM_TEXT.networkSendCost": {
    en: "Send a packet (lowest cost)",
    he: "\u05E9\u05DC\u05D9\u05D7\u05EA \u05D7\u05D1\u05D9\u05DC\u05D4 (\u05E2\u05DC\u05D5\u05EA \u05E0\u05DE\u05D5\u05DB\u05D4)"
  },
  "ALGORITHM_TEXT.searchStart": {
    en: "Start at {vertex}",
    he: "\u05DE\u05EA\u05D7\u05D9\u05DC\u05D9\u05DD \u05D1-{vertex}"
  },
  "ALGORITHM_TEXT.searchVisit": {
    en: "Visit {vertex}",
    he: "\u05DE\u05D1\u05E7\u05E8\u05D9\u05DD \u05D1-{vertex}"
  },
  "ALGORITHM_TEXT.searchDiscover": {
    en: "Found {vertex}",
    he: "\u05DE\u05E6\u05D0\u05E0\u05D5 \u05D0\u05EA {vertex}"
  },
  "ALGORITHM_TEXT.searchDone": {
    en: "Done: {order}",
    he: "\u05E1\u05D9\u05D5\u05DD: {order}"
  },
  "ALGORITHM_TEXT.stripFifo": {
    en: "Queue",
    he: "\u05EA\u05D5\u05E8"
  },
  "ALGORITHM_TEXT.stripLifo": {
    en: "Stack",
    he: "\u05DE\u05D7\u05E1\u05E0\u05D9\u05EA"
  },
  "ALGORITHM_TEXT.stripPriority": {
    en: "Waiting",
    he: "\u05DE\u05DE\u05EA\u05D9\u05E0\u05D9\u05DD"
  },
  "ALGORITHM_TEXT.stripOrder": {
    en: "Order",
    he: "\u05E1\u05D3\u05E8"
  },
  "ALGORITHM_TEXT.distance": {
    en: "d = {value}",
    he: "d = {value}"
  },
  "ALGORITHM_TEXT.nameStrip": {
    en: "Algorithm strip",
    he: "\u05E4\u05E1 \u05D4\u05D0\u05DC\u05D2\u05D5\u05E8\u05D9\u05EA\u05DD"
  },
  "ALGORITHM_TEXT.nameDistance": {
    en: "Distance",
    he: "\u05DE\u05E8\u05D7\u05E7"
  },
  "ALGORITHM_TEXT.nameFlowLabel": {
    en: "Flow label",
    he: "\u05EA\u05D5\u05D5\u05D9\u05EA \u05D6\u05E8\u05D9\u05DE\u05D4"
  },
  "ALGORITHM_TEXT.inputWord": {
    en: "Input word",
    he: "\u05DE\u05D9\u05DC\u05EA \u05E7\u05DC\u05D8"
  },
  "ALGORITHM_TEXT.inputPrefix": {
    en: "Input: ",
    he: "\u05E7\u05DC\u05D8: "
  },
  "ALGORITHM_TEXT.recipeStart": {
    en: "Start at {vertex}",
    he: "\u05DE\u05EA\u05D7\u05D9\u05DC\u05D9\u05DD \u05D1-{vertex}"
  },
  "ALGORITHM_TEXT.recipeGo": {
    en: "Go to {vertex}",
    he: "\u05E2\u05D5\u05D1\u05E8\u05D9\u05DD \u05DC-{vertex}"
  },
  "ALGORITHM_TEXT.recipeShow": {
    en: "Show {vertex}",
    he: "\u05DE\u05E6\u05D9\u05D2\u05D9\u05DD \u05D0\u05EA {vertex}"
  },
  "ALGORITHM_TEXT.recipeMove": {
    en: "Move from {from} to {to}.",
    he: "\u05E2\u05D5\u05D1\u05E8\u05D9\u05DD \u05DE-{from} \u05DC-{to}."
  },
  "ALGORITHM_TEXT.tapeCellName": {
    en: "Cell",
    he: "\u05EA\u05D0"
  },
  "ALGORITHM_TEXT.tapeIndexName": {
    en: "Index",
    he: "\u05D0\u05D9\u05E0\u05D3\u05E7\u05E1"
  },
  "ALGORITHM_TEXT.tapeHeadName": {
    en: "Head",
    he: "\u05E8\u05D0\u05E9"
  },
  "ALGORITHM_TEXT.tapeHeadLabelName": {
    en: "Head label",
    he: "\u05EA\u05D5\u05D5\u05D9\u05EA \u05E8\u05D0\u05E9"
  },
  "ALGORITHM_TEXT.tapeStripName": {
    en: "Tape strip",
    he: "\u05E1\u05E8\u05D8"
  },
  "ALGORITHM_TEXT.tapeHeadText": {
    en: "head",
    he: "\u05E8\u05D0\u05E9"
  },
  "ALGORITHM_TEXT.tapeRead": {
    en: "Read {symbol}",
    he: "\u05E7\u05D5\u05E8\u05D0\u05D9\u05DD {symbol}"
  },
  "ALGORITHM_TEXT.tapeBlank": {
    en: "blank",
    he: "\u05E8\u05D9\u05E7"
  },
  "ALGORITHM_TEXT.tapeWhy": {
    en: "The head is on cell {number}.",
    he: "\u05D4\u05E8\u05D0\u05E9 \u05E0\u05DE\u05E6\u05D0 \u05D1\u05EA\u05D0 {number}."
  },
  "ALGORITHM_TEXT.flowStart": {
    en: "Flow from {source} to {sink}",
    he: "\u05D6\u05E8\u05D9\u05DE\u05D4 \u05DE-{source} \u05DC-{sink}"
  },
  "ALGORITHM_TEXT.flowAugment": {
    en: "Path {path}: push {pushed}",
    he: "\u05DE\u05E1\u05DC\u05D5\u05DC {path}: \u05D3\u05D5\u05D7\u05E4\u05D9\u05DD {pushed}"
  },
  "ALGORITHM_TEXT.flowDone": {
    en: "Maximum flow = {value}",
    he: "\u05D6\u05E8\u05D9\u05DE\u05D4 \u05DE\u05E7\u05E1\u05D9\u05DE\u05DC\u05D9\u05EA = {value}"
  },
  "ALGORITHM_TEXT.flowStrip": {
    en: "Flow",
    he: "\u05D6\u05E8\u05D9\u05DE\u05D4"
  },
  "ALGORITHM_TEXT.autoStart": {
    en: "Start at {states}",
    he: "\u05DE\u05EA\u05D7\u05D9\u05DC\u05D9\u05DD \u05D1-{states}"
  },
  "ALGORITHM_TEXT.autoRead": {
    en: "Read {symbol}",
    he: "\u05E7\u05D5\u05E8\u05D0\u05D9\u05DD {symbol}"
  },
  "ALGORITHM_TEXT.autoAccept": {
    en: "Accept",
    he: "\u05DE\u05E7\u05D1\u05DC"
  },
  "ALGORITHM_TEXT.autoReject": {
    en: "Reject",
    he: "\u05D3\u05D5\u05D7\u05D4"
  },
  "ALGORITHM_TEXT.autoStuck": {
    en: "Reject: no move on {symbol}",
    he: "\u05D3\u05D5\u05D7\u05D4: \u05D0\u05D9\u05DF \u05DE\u05E2\u05D1\u05E8 \u05E2\u05DC {symbol}"
  },
  "ALGORITHM_TEXT.autoWhyRead": {
    en: "{from} reads {symbol} and goes to {to}.",
    he: "{from} \u05E7\u05D5\u05E8\u05D0 {symbol} \u05D5\u05E2\u05D5\u05D1\u05E8 \u05DC-{to}."
  },
  "ALGORITHM_TEXT.autoWhyAccept": {
    en: "{states} accepts: {word} is accepted.",
    he: "{states} \u05DE\u05E7\u05D1\u05DC: \u05D4\u05DE\u05D9\u05DC\u05D4 {word} \u05D4\u05EA\u05E7\u05D1\u05DC\u05D4."
  },
  "ALGORITHM_TEXT.autoWhyReject": {
    en: "{states} does not accept: {word} is rejected.",
    he: "{states} \u05DC\u05D0 \u05DE\u05E7\u05D1\u05DC: \u05D4\u05DE\u05D9\u05DC\u05D4 {word} \u05E0\u05D3\u05D7\u05EA\u05D4."
  },
  "ALGORITHM_TEXT.autoWhyStuck": {
    en: "{states} has no transition on {symbol}.",
    he: "\u05DC-{states} \u05D0\u05D9\u05DF \u05DE\u05E2\u05D1\u05E8 \u05E2\u05DC {symbol}."
  },
  "ALGORITHM_TEXT.netStart": {
    en: "{device} sends a packet",
    he: "{device} \u05E9\u05D5\u05DC\u05D7 \u05D7\u05D1\u05D9\u05DC\u05D4"
  },
  "ALGORITHM_TEXT.netHop": {
    en: "Hop {number}: {to}",
    he: "\u05E7\u05E4\u05D9\u05E6\u05D4 {number}: {to}"
  },
  "ALGORITHM_TEXT.netDelivered": {
    en: "Delivered to {device}",
    he: "\u05E0\u05DE\u05E1\u05E8 \u05DC-{device}"
  },
  "ALGORITHM_TEXT.netUnreachable": {
    en: "No route from {device}",
    he: "\u05D0\u05D9\u05DF \u05DE\u05E1\u05DC\u05D5\u05DC \u05DE-{device}"
  },
  "ALGORITHM_TEXT.netExpired": {
    en: "Dropped at {device}: TTL ended",
    he: "\u05E0\u05E4\u05DC\u05D4 \u05D1-{device}: \u05D4-TTL \u05E0\u05D2\u05DE\u05E8"
  },
  "ALGORITHM_TEXT.netWhyStart": {
    en: "The packet starts with TTL {ttl}.",
    he: "\u05D4\u05D7\u05D1\u05D9\u05DC\u05D4 \u05D9\u05D5\u05E6\u05D0\u05EA \u05E2\u05DD TTL {ttl}."
  },
  "ALGORITHM_TEXT.netWhyHop": {
    en: "{from} forwards it to {to}; TTL left {ttlLeft}.",
    he: "{from} \u05DE\u05E2\u05D1\u05D9\u05E8 \u05DC-{to}; \u05E0\u05E9\u05D0\u05E8 TTL {ttlLeft}."
  },
  "ALGORITHM_TEXT.netWhyDelivered": {
    en: "It arrived after {hops} hops.",
    he: "\u05D4\u05D2\u05D9\u05E2\u05D4 \u05D0\u05D7\u05E8\u05D9 {hops} \u05E7\u05E4\u05D9\u05E6\u05D5\u05EA."
  },
  "ALGORITHM_TEXT.netWhyUnreachable": {
    en: "No cable path leads to the destination.",
    he: "\u05D0\u05D9\u05DF \u05E0\u05EA\u05D9\u05D1 \u05DB\u05D1\u05DC\u05D9\u05DD \u05DC\u05D9\u05E2\u05D3."
  },
  "ALGORITHM_TEXT.netWhyExpired": {
    en: "A router drops a packet whose TTL is zero.",
    he: "\u05E0\u05EA\u05D1 \u05DE\u05D5\u05E8\u05D9\u05D3 \u05D7\u05D1\u05D9\u05DC\u05D4 \u05E9\u05D4-TTL \u05E9\u05DC\u05D4 \u05D0\u05E4\u05E1."
  },
  "ALGORITHM_TEXT.pipeRun": {
    en: "Run a pipeline (tick by tick)",
    he: "\u05D4\u05E8\u05E6\u05EA \u05E6\u05D9\u05E0\u05D5\u05E8 (\u05DE\u05D7\u05D6\u05D5\u05E8 \u05D0\u05D7\u05E8 \u05DE\u05D7\u05D6\u05D5\u05E8)"
  },
  "ALGORITHM_TEXT.pipeTick": {
    en: "Tick {number}",
    he: "\u05DE\u05D7\u05D6\u05D5\u05E8 {number}"
  },
  "ALGORITHM_TEXT.pipeWhyTick": {
    en: "A stage passes items on when the next stage has room. Stalled: {stalled}.",
    he: "\u05E9\u05DC\u05D1 \u05DE\u05E2\u05D1\u05D9\u05E8 \u05E4\u05E8\u05D9\u05D8\u05D9\u05DD \u05D4\u05DC\u05D0\u05D4 \u05DB\u05E9\u05DC\u05E9\u05DC\u05D1 \u05D4\u05D1\u05D0 \u05D9\u05E9 \u05DE\u05E7\u05D5\u05DD. \u05E0\u05EA\u05E7\u05E2\u05D5: {stalled}."
  },
  "ALGORITHM_TEXT.pipeNone": {
    en: "none",
    he: "\u05D0\u05D9\u05DF"
  },
  "ALGORITHM_TEXT.pipeDone": {
    en: "Finished {done} of {tokens} items in {ticks} ticks",
    he: "\u05D4\u05E1\u05EA\u05D9\u05D9\u05DE\u05D5 {done} \u05DE\u05EA\u05D5\u05DA {tokens} \u05E4\u05E8\u05D9\u05D8\u05D9\u05DD \u05D1-{ticks} \u05DE\u05D7\u05D6\u05D5\u05E8\u05D9\u05DD"
  },
  "ALGORITHM_TEXT.pipeWhyBottleneck": {
    en: "Bottleneck: {stage}, the stage that stalled most often.",
    he: "\u05E6\u05D5\u05D5\u05D0\u05E8 \u05D1\u05E7\u05D1\u05D5\u05E7: {stage}, \u05D4\u05E9\u05DC\u05D1 \u05E9\u05E0\u05EA\u05E7\u05E2 \u05D4\u05DB\u05D9 \u05D4\u05E8\u05D1\u05D4 \u05E4\u05E2\u05DE\u05D9\u05DD."
  },
  "ALGORITHM_TEXT.pipeWhyClear": {
    en: "No stage stalled, so nothing waited.",
    he: "\u05D0\u05E3 \u05E9\u05DC\u05D1 \u05DC\u05D0 \u05E0\u05EA\u05E7\u05E2, \u05D5\u05DC\u05DB\u05DF \u05D0\u05E3 \u05E4\u05E8\u05D9\u05D8 \u05DC\u05D0 \u05D4\u05DE\u05EA\u05D9\u05DF."
  },
  "ALGORITHM_TEXT.memLeaks": {
    en: "Leak search",
    he: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05D3\u05DC\u05D9\u05E4\u05D5\u05EA"
  },
  "ALGORITHM_TEXT.memChase": {
    en: "Follow pointers",
    he: "\u05DE\u05E2\u05E7\u05D1 \u05D0\u05D7\u05E8\u05D9 \u05DE\u05E6\u05D1\u05D9\u05E2\u05D9\u05DD"
  },
  "ALGORITHM_TEXT.memRoot": {
    en: "Start from {cell}",
    he: "\u05DE\u05EA\u05D7\u05D9\u05DC\u05D9\u05DD \u05DE-{cell}"
  },
  "ALGORITHM_TEXT.memWhyRoot": {
    en: "Every variable on the stack is a root: the blocks its pointers reach are alive.",
    he: "\u05DB\u05DC \u05DE\u05E9\u05EA\u05E0\u05D4 \u05D1\u05DE\u05D7\u05E1\u05E0\u05D9\u05EA \u05D4\u05D5\u05D0 \u05E9\u05D5\u05E8\u05E9: \u05D1\u05DC\u05D5\u05E7\u05D9\u05DD \u05E9\u05D4\u05DE\u05E6\u05D1\u05D9\u05E2\u05D9\u05DD \u05E9\u05DC\u05D5 \u05DE\u05D2\u05D9\u05E2\u05D9\u05DD \u05D0\u05DC\u05D9\u05D4\u05DD \u05D4\u05DD \u05D7\u05D9\u05D9\u05DD."
  },
  "ALGORITHM_TEXT.memReach": {
    en: "{block} is reachable",
    he: "\u05D0\u05E4\u05E9\u05E8 \u05DC\u05D4\u05D2\u05D9\u05E2 \u05DC-{block}"
  },
  "ALGORITHM_TEXT.memWhyReach": {
    en: "Reached from {via}.",
    he: "\u05DE\u05D2\u05D9\u05E2\u05D9\u05DD \u05D0\u05DC\u05D9\u05D5 \u05DE-{via}."
  },
  "ALGORITHM_TEXT.memLeak": {
    en: "Leak: {block} is unreachable",
    he: "\u05D3\u05DC\u05D9\u05E4\u05D4: \u05D0\u05D9 \u05D0\u05E4\u05E9\u05E8 \u05DC\u05D4\u05D2\u05D9\u05E2 \u05DC-{block}"
  },
  "ALGORITHM_TEXT.memWhyLeak": {
    en: "No variable leads to it, so nothing can free it.",
    he: "\u05D0\u05E3 \u05DE\u05E9\u05EA\u05E0\u05D4 \u05DC\u05D0 \u05DE\u05D5\u05D1\u05D9\u05DC \u05D0\u05DC\u05D9\u05D5, \u05D5\u05DC\u05DB\u05DF \u05D0\u05D9 \u05D0\u05E4\u05E9\u05E8 \u05DC\u05E9\u05D7\u05E8\u05E8 \u05D0\u05D5\u05EA\u05D5."
  },
  "ALGORITHM_TEXT.memVerdict": {
    en: "Leaked: {leaks}",
    he: "\u05D3\u05DC\u05E4\u05D5: {leaks}"
  },
  "ALGORITHM_TEXT.memWhyVerdict": {
    en: "Reachable: {reachable}.",
    he: "\u05E0\u05D2\u05D9\u05E9\u05D9\u05DD: {reachable}."
  },
  "ALGORITHM_TEXT.memNone": {
    en: "none",
    he: "\u05D0\u05D9\u05DF"
  },
  "ALGORITHM_TEXT.memFollow": {
    en: "Step {number}: {from} points to {to}",
    he: "\u05E9\u05DC\u05D1 {number}: {from} \u05DE\u05E6\u05D1\u05D9\u05E2 \u05E2\u05DC {to}"
  },
  "ALGORITHM_TEXT.memWhyFollow": {
    en: "Follow the address stored in {from}.",
    he: "\u05E2\u05D5\u05E7\u05D1\u05D9\u05DD \u05D0\u05D7\u05E8\u05D9 \u05D4\u05DB\u05EA\u05D5\u05D1\u05EA \u05E9\u05E9\u05DE\u05D5\u05E8\u05D4 \u05D1-{from}."
  },
  "ALGORITHM_TEXT.memBlock": {
    en: "The chain ends at block {at}",
    he: "\u05D4\u05E9\u05E8\u05E9\u05E8\u05EA \u05E0\u05D2\u05DE\u05E8\u05EA \u05D1\u05D1\u05DC\u05D5\u05E7 {at}"
  },
  "ALGORITHM_TEXT.memWhyBlock": {
    en: "{at} points nowhere, so the value is the block.",
    he: "{at} \u05DC\u05D0 \u05DE\u05E6\u05D1\u05D9\u05E2 \u05DC\u05E9\u05D5\u05DD \u05DE\u05E7\u05D5\u05DD, \u05D5\u05D4\u05E2\u05E8\u05DA \u05D4\u05D5\u05D0 \u05D4\u05D1\u05DC\u05D5\u05E7."
  },
  "ALGORITHM_TEXT.memNull": {
    en: "The chain ends at null",
    he: "\u05D4\u05E9\u05E8\u05E9\u05E8\u05EA \u05E0\u05D2\u05DE\u05E8\u05EA \u05D1-null"
  },
  "ALGORITHM_TEXT.memWhyNull": {
    en: "{at} holds no address.",
    he: "\u05D1-{at} \u05D0\u05D9\u05DF \u05DB\u05EA\u05D5\u05D1\u05EA."
  },
  "ALGORITHM_TEXT.memCycle": {
    en: "The chain loops back to {at}",
    he: "\u05D4\u05E9\u05E8\u05E9\u05E8\u05EA \u05D7\u05D5\u05D6\u05E8\u05EA \u05D0\u05DC {at}"
  },
  "ALGORITHM_TEXT.memWhyCycle": {
    en: "Following the pointers returns to a node already visited.",
    he: "\u05D4\u05DE\u05E2\u05E7\u05D1 \u05D0\u05D7\u05E8\u05D9 \u05D4\u05DE\u05E6\u05D1\u05D9\u05E2\u05D9\u05DD \u05D7\u05D5\u05D6\u05E8 \u05DC\u05E6\u05D5\u05DE\u05EA \u05E9\u05DB\u05D1\u05E8 \u05D1\u05D9\u05E7\u05E8\u05E0\u05D5 \u05D1\u05D5."
  },
  "ALGORITHM_TEXT.memDangling": {
    en: "The pointer to {at} leads nowhere",
    he: "\u05D4\u05DE\u05E6\u05D1\u05D9\u05E2 \u05D0\u05DC {at} \u05DC\u05D0 \u05DE\u05D5\u05D1\u05D9\u05DC \u05DC\u05E9\u05D5\u05DD \u05DE\u05E7\u05D5\u05DD"
  },
  "ALGORITHM_TEXT.memWhyDangling": {
    en: "{at} is neither a variable nor a heap block.",
    he: "{at} \u05D0\u05D9\u05E0\u05D5 \u05DE\u05E9\u05EA\u05E0\u05D4 \u05D5\u05D0\u05D9\u05E0\u05D5 \u05D1\u05DC\u05D5\u05E7 \u05D1\u05E2\u05E8\u05D9\u05DE\u05D4."
  },
  "AUTHOR_TEXT.websiteAuthorLongPrefix": {
    en: "Website made by ",
    he: "\u05D4\u05D0\u05EA\u05E8 \u05E0\u05D1\u05E0\u05D4 \u05E2\u05DC \u05D9\u05D3\u05D9 "
  },
  "AUTHOR_TEXT.websiteAuthorLongSuffix": {
    en: ", check my website for my other projects",
    he: ", \u05D1\u05E7\u05E8 \u05D1\u05D0\u05EA\u05E8 \u05E9\u05DC\u05D9 \u05DC\u05DE\u05D9\u05D6\u05DE\u05D9\u05DD \u05E0\u05D5\u05E1\u05E4\u05D9\u05DD"
  },
  "AUTHOR_TEXT.websiteAuthorShortPrefix": {
    en: "By ",
    he: "\u05E2\u05DC \u05D9\u05D3\u05D9 "
  },
  "BUILDER_TEXT.hintSelect": {
    en: "Select: click to select, drag to move, double click to rename. Use the Arrow tool (L) to connect shapes.",
    he: "\u05D1\u05D7\u05D9\u05E8\u05D4: \u05DC\u05D7\u05D9\u05E6\u05D4 \u05DC\u05D1\u05D7\u05D9\u05E8\u05D4, \u05D2\u05E8\u05D9\u05E8\u05D4 \u05DC\u05D4\u05D6\u05D6\u05D4, \u05DC\u05D7\u05D9\u05E6\u05D4 \u05DB\u05E4\u05D5\u05DC\u05D4 \u05DC\u05E9\u05D9\u05E0\u05D5\u05D9 \u05E9\u05DD. \u05DB\u05DC\u05D9 \u05D4\u05D7\u05E5 (L) \u05DE\u05D7\u05D1\u05E8 \u05E6\u05D5\u05E8\u05D5\u05EA."
  },
  "BUILDER_TEXT.hintArrow": {
    en: "Arrow: drag from a shape or a \u25CF port onto another shape \xB7 Esc to cancel",
    he: "\u05D7\u05E5: \u05D2\u05E8\u05E8\u05D5 \u05DE\u05E6\u05D5\u05E8\u05D4 \u05D0\u05D5 \u05DE\u05E0\u05E7\u05D5\u05D3\u05EA \u25CF \u05D0\u05DC \u05E6\u05D5\u05E8\u05D4 \u05D0\u05D7\u05E8\u05EA \xB7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC"
  },
  "BUILDER_TEXT.hintFrom": {
    en: "From {name}: click the shape to connect to \xB7 Esc to cancel",
    he: "\u05DE-{name}: \u05DC\u05D7\u05E6\u05D5 \u05E2\u05DC \u05D4\u05E6\u05D5\u05E8\u05D4 \u05DC\u05D7\u05D9\u05D1\u05D5\u05E8 \xB7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC"
  },
  "BUILDER_TEXT.hintDrag": {
    en: "Release on a shape to connect, or on empty space to add a new one \xB7 Esc to cancel",
    he: "\u05E9\u05D7\u05E8\u05E8\u05D5 \u05E2\u05DC \u05E6\u05D5\u05E8\u05D4 \u05DC\u05D7\u05D9\u05D1\u05D5\u05E8, \u05D0\u05D5 \u05E2\u05DC \u05DE\u05E7\u05D5\u05DD \u05E8\u05D9\u05E7 \u05DC\u05D4\u05D5\u05E1\u05E4\u05EA \u05E6\u05D5\u05E8\u05D4 \u05D7\u05D3\u05E9\u05D4 \xB7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC"
  },
  "BUILDER_TEXT.hintQuickAdd": {
    en: "Choose a shape to add here and connect, or press Esc",
    he: "\u05D1\u05D7\u05E8\u05D5 \u05E6\u05D5\u05E8\u05D4 \u05DC\u05D4\u05D5\u05E1\u05E4\u05D4 \u05D5\u05D7\u05D9\u05D1\u05D5\u05E8 \u05DB\u05D0\u05DF, \u05D0\u05D5 \u05DC\u05D7\u05E6\u05D5 Esc"
  },
  "BUILDER_TEXT.hintWalkStart": {
    en: "Walk a path: click the shapes in order \xB7 Enter to finish \xB7 Esc to cancel",
    he: "\u05DE\u05E1\u05DC\u05D5\u05DC: \u05DC\u05D7\u05E6\u05D5 \u05E2\u05DC \u05D4\u05E6\u05D5\u05E8\u05D5\u05EA \u05DC\u05E4\u05D9 \u05D4\u05E1\u05D3\u05E8 \xB7 Enter \u05DC\u05E1\u05D9\u05D5\u05DD \xB7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC"
  },
  "BUILDER_TEXT.hintWalk": {
    en: "Walk: {path} \xB7 Enter to finish \xB7 Esc to cancel",
    he: "\u05DE\u05E1\u05DC\u05D5\u05DC: {path} \xB7 Enter \u05DC\u05E1\u05D9\u05D5\u05DD \xB7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC"
  },
  "BUILDER_TEXT.hintPickSpot": {
    en: "Click the canvas where the shape should go \xB7 Esc to cancel",
    he: "\u05DC\u05D7\u05E6\u05D5 \u05E2\u05DC \u05D4\u05E7\u05E0\u05D1\u05E1 \u05D1\u05DE\u05E7\u05D5\u05DD \u05E9\u05D1\u05D5 \u05D4\u05E6\u05D5\u05E8\u05D4 \u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05D9\u05D5\u05EA \xB7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC"
  },
  "BUILDER_TEXT.hintPickTarget": {
    en: "{effect}: click the {kinds} to animate \xB7 Esc to cancel",
    he: "{effect}: \u05DC\u05D7\u05E6\u05D5 \u05E2\u05DC \u05D4{kinds} \u05DC\u05D4\u05E0\u05E4\u05E9\u05D4 \xB7 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC"
  },
  "BUILDER_TEXT.noticePickShape": {
    en: "Pick a shape, not a link.",
    he: "\u05D1\u05D7\u05E8\u05D5 \u05E6\u05D5\u05E8\u05D4, \u05DC\u05D0 \u05E7\u05E9\u05E8."
  },
  "BUILDER_TEXT.noticeSecond": {
    en: "Pick a second shape, or press Esc to cancel.",
    he: "\u05D1\u05D7\u05E8\u05D5 \u05E6\u05D5\u05E8\u05D4 \u05E9\u05E0\u05D9\u05D9\u05D4, \u05D0\u05D5 \u05DC\u05D7\u05E6\u05D5 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC."
  },
  "BUILDER_TEXT.noticeFirst": {
    en: "Click the first shape, or press Esc to cancel.",
    he: "\u05DC\u05D7\u05E6\u05D5 \u05E2\u05DC \u05D4\u05E6\u05D5\u05E8\u05D4 \u05D4\u05E8\u05D0\u05E9\u05D5\u05E0\u05D4, \u05D0\u05D5 \u05DC\u05D7\u05E6\u05D5 Esc \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC."
  },
  "BUILDER_TEXT.noticeKinds": {
    en: "Pick {kinds} for this animation.",
    he: "\u05D1\u05D7\u05E8\u05D5 {kinds} \u05DC\u05D4\u05E0\u05E4\u05E9\u05D4 \u05D4\u05D6\u05D5."
  },
  "BUILDER_TEXT.layoutOutline": {
    en: '"{a}" sits on the outline of "{b}"',
    he: '"{a}" \u05D9\u05D5\u05E9\u05D1 \u05E2\u05DC \u05E7\u05D5 \u05D4\u05DE\u05EA\u05D0\u05E8 \u05E9\u05DC "{b}"'
  },
  "BUILDER_TEXT.layoutCrossed": {
    en: '"{a}" is crossed by the line "{b}"',
    he: '"{a}" \u05E0\u05D7\u05EA\u05DA \u05D1\u05D9\u05D3\u05D9 \u05D4\u05E7\u05D5 "{b}"'
  },
  "BUILDER_TEXT.layoutOverlap": {
    en: '"{a}" overlaps "{b}"',
    he: '"{a}" \u05D7\u05D5\u05E4\u05E3 \u05D0\u05EA "{b}"'
  },
  "BUILDER_TEXT.layoutOutside": {
    en: '"{a}" leaves the viewBox',
    he: '"{a}" \u05D9\u05D5\u05E6\u05D0 \u05DE\u05D2\u05D1\u05D5\u05DC\u05D5\u05EA \u05D4\u05D1\u05D3'
  },
  "BUILDER_TEXT.layoutPartlyOutside": {
    en: '"{a}" partly leaves the viewBox',
    he: '"{a}" \u05D9\u05D5\u05E6\u05D0 \u05D7\u05DC\u05E7\u05D9\u05EA \u05DE\u05D2\u05D1\u05D5\u05DC\u05D5\u05EA \u05D4\u05D1\u05D3'
  },
  "BUILDER_TEXT.layoutOrphan": {
    en: '"{a}" has a missing parent or link end',
    he: '"{a}" \u05D7\u05E1\u05E8 \u05D4\u05D5\u05E8\u05D4 \u05D0\u05D5 \u05E7\u05E6\u05D4 \u05E7\u05D9\u05E9\u05D5\u05E8'
  },
  "BUILDER_TEXT.cvBringInside": {
    en: "Bring inside",
    he: "\u05D4\u05D7\u05D6\u05E8\u05D4 \u05DC\u05EA\u05D5\u05DA \u05D4\u05D1\u05D3"
  },
  "BUILDER_TEXT.nameArrow": {
    en: "Arrow {from} to {to}",
    he: "\u05D7\u05E5 {from} \u05D0\u05DC {to}"
  },
  "BUILDER_TEXT.nameLabelled": {
    en: "{shape} \u201C{label}\u201D",
    he: "{shape} \u201C{label}\u201D"
  },
  "BUILDER_TEXT.nameIdentified": {
    en: "{shape} ({id})",
    he: "{shape} ({id})"
  },
  "BUILDER_TEXT.shapeCircle": {
    en: "Circle",
    he: "\u05E2\u05D9\u05D2\u05D5\u05DC"
  },
  "BUILDER_TEXT.shapeOval": {
    en: "Oval",
    he: "\u05D0\u05DC\u05D9\u05E4\u05E1\u05D4"
  },
  "BUILDER_TEXT.shapeBox": {
    en: "Box",
    he: "\u05EA\u05D9\u05D1\u05D4"
  },
  "BUILDER_TEXT.shapeRounded": {
    en: "Rounded box",
    he: "\u05EA\u05D9\u05D1\u05D4 \u05DE\u05E2\u05D5\u05D2\u05DC\u05EA"
  },
  "BUILDER_TEXT.shapeDiamond": {
    en: "Diamond",
    he: "\u05DE\u05E2\u05D5\u05D9\u05DF"
  },
  "BUILDER_TEXT.shapeTriangle": {
    en: "Triangle",
    he: "\u05DE\u05E9\u05D5\u05DC\u05E9"
  },
  "BUILDER_TEXT.shapeLine": {
    en: "Line",
    he: "\u05E7\u05D5"
  },
  "BUILDER_TEXT.shapeArrow": {
    en: "Arrow",
    he: "\u05D7\u05E5"
  },
  "BUILDER_TEXT.shapeText": {
    en: "Text",
    he: "\u05D8\u05E7\u05E1\u05D8"
  },
  "BUILDER_TEXT.shapeHeading": {
    en: "Heading",
    he: "\u05DB\u05D5\u05EA\u05E8\u05EA"
  },
  "BUILDER_TEXT.shapeCaption": {
    en: "Caption",
    he: "\u05DB\u05D9\u05EA\u05D5\u05D1"
  },
  "BUILDER_TEXT.shapeNote": {
    en: "Note",
    he: "\u05D4\u05E2\u05E8\u05D4"
  },
  "BUILDER_TEXT.shapeUnknown": {
    en: "Shape",
    he: "\u05E6\u05D5\u05E8\u05D4"
  },
  "BUILDER_TEXT.cvBuilderSettings": {
    en: "Builder settings",
    he: "\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA \u05D4\u05D1\u05D5\u05E0\u05D4"
  },
  "BUILDER_TEXT.cvHistory": {
    en: "History",
    he: "\u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D4"
  },
  "BUILDER_TEXT.cvAdd": {
    en: "Add",
    he: "\u05D4\u05D5\u05E1\u05E4\u05D4"
  },
  "BUILDER_TEXT.cvView": {
    en: "View",
    he: "\u05EA\u05E6\u05D5\u05D2\u05D4"
  },
  "BUILDER_TEXT.cvGridNone": {
    en: "No grid",
    he: "\u05DC\u05DC\u05D0 \u05E8\u05E9\u05EA"
  },
  "BUILDER_TEXT.cvGridLines": {
    en: "Grid lines",
    he: "\u05E7\u05D5\u05D5\u05D9 \u05E8\u05E9\u05EA"
  },
  "BUILDER_TEXT.cvGridDots": {
    en: "Dot grid",
    he: "\u05E8\u05E9\u05EA \u05E0\u05E7\u05D5\u05D3\u05D5\u05EA"
  },
  "BUILDER_TEXT.cvDocument": {
    en: "Document",
    he: "\u05DE\u05E1\u05DE\u05DA"
  },
  "BUILDER_TEXT.cvTool": {
    en: "Tool",
    he: "\u05DB\u05DC\u05D9"
  },
  "BUILDER_TEXT.cvLayout": {
    en: "Layout",
    he: "\u05E4\u05E8\u05D9\u05E1\u05D4"
  },
  "BUILDER_TEXT.cvUndo": {
    en: "Undo",
    he: "\u05D1\u05D9\u05D8\u05D5\u05DC"
  },
  "BUILDER_TEXT.cvRedo": {
    en: "Redo",
    he: "\u05D7\u05D6\u05E8\u05D4"
  },
  "BUILDER_TEXT.cvSelect": {
    en: "Select",
    he: "\u05D1\u05D7\u05D9\u05E8\u05D4"
  },
  "BUILDER_TEXT.cvArrow": {
    en: "Arrow",
    he: "\u05D7\u05E5"
  },
  "BUILDER_TEXT.cvAnimate": {
    en: "Animate",
    he: "\u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D4"
  },
  "BUILDER_TEXT.cvAnimateSelected": {
    en: "Animate the selected object (A)",
    he: "\u05D4\u05E4\u05E2\u05DC\u05EA \u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D4 \u05DC\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05D4\u05E0\u05D1\u05D7\u05E8 (A)"
  },
  "BUILDER_TEXT.cvSelectToAnimate": {
    en: "Select an object on the canvas first, then animate it",
    he: "\u05D1\u05D7\u05E8\u05D5 \u05E7\u05D5\u05D3\u05DD \u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05D1\u05E7\u05E0\u05D1\u05E1, \u05D5\u05D0\u05D6 \u05D4\u05E4\u05E2\u05D9\u05DC\u05D5 \u05E2\u05DC\u05D9\u05D5 \u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D4"
  },
  "BUILDER_TEXT.cvBuildLarge": {
    en: "Build large",
    he: "\u05D1\u05E0\u05D9\u05D9\u05D4 \u05DE\u05D5\u05D2\u05D3\u05DC\u05EA"
  },
  "BUILDER_TEXT.cvSplit": {
    en: "Split",
    he: "\u05E4\u05D9\u05E6\u05D5\u05DC"
  },
  "BUILDER_TEXT.cvPreviewLarge": {
    en: "Preview large",
    he: "\u05EA\u05E6\u05D5\u05D2\u05D4 \u05DE\u05E7\u05D3\u05D9\u05DE\u05D4 \u05DE\u05D5\u05D2\u05D3\u05DC\u05EA"
  },
  "BUILDER_TEXT.cvSnapToGrid": {
    en: "Snap to grid",
    he: "\u05D4\u05E6\u05DE\u05D3\u05D4 \u05DC\u05E8\u05E9\u05EA"
  },
  "BUILDER_TEXT.cvProject": {
    en: "Project",
    he: "\u05E4\u05E8\u05D5\u05D9\u05E7\u05D8"
  },
  "BUILDER_TEXT.cvSectionLocal": {
    en: "Local spec",
    he: "\u05DE\u05E4\u05E8\u05D8 \u05DE\u05E7\u05D5\u05DE\u05D9"
  },
  "BUILDER_TEXT.cvSectionPublish": {
    en: "Publish to course",
    he: "\u05E4\u05E8\u05E1\u05D5\u05DD \u05DC\u05E7\u05D5\u05E8\u05E1"
  },
  "BUILDER_TEXT.cvSectionTransfer": {
    en: "Import / export",
    he: "\u05D9\u05D9\u05D1\u05D5\u05D0 / \u05D9\u05D9\u05E6\u05D5\u05D0"
  },
  "BUILDER_TEXT.cvKeyboardShortcuts": {
    en: "Keyboard shortcuts",
    he: "\u05E7\u05D9\u05E6\u05D5\u05E8\u05D9 \u05DE\u05E7\u05DC\u05D3\u05EA"
  },
  "BUILDER_TEXT.cvAppearsAtStep": {
    en: "appears step {n}",
    he: "\u05DE\u05D5\u05E4\u05D9\u05E2 \u05D1\u05E9\u05DC\u05D1 {n}"
  },
  "BUILDER_TEXT.cvRemovedAtStep": {
    en: "removed at step {n}",
    he: "\u05E0\u05DE\u05D7\u05E7 \u05D1\u05E9\u05DC\u05D1 {n}"
  },
  "BUILDER_TEXT.cvCanvasLabel": {
    en: "Builder canvas",
    he: "\u05E7\u05E0\u05D1\u05E1 \u05D4\u05D1\u05D5\u05E0\u05D4"
  },
  "BUILDER_TEXT.cvZoomHint": {
    en: "Wheel zooms, middle button drags",
    he: "\u05D4\u05D2\u05DC\u05D2\u05DC \u05DE\u05D2\u05D3\u05D9\u05DC \u05D5\u05DE\u05E7\u05D8\u05D9\u05DF, \u05DC\u05D7\u05E6\u05DF \u05D4\u05D0\u05DE\u05E6\u05E2 \u05D2\u05D5\u05E8\u05E8"
  },
  "BUILDER_TEXT.cvZoomReadout": {
    en: "Zoom {percent}%",
    he: "\u05D6\u05D5\u05DD {percent}%"
  },
  "BUILDER_TEXT.cvOutsideStage": {
    en: "! outside the real stage",
    he: "! \u05DE\u05D7\u05D5\u05E5 \u05DC\u05D1\u05DE\u05D4 \u05D4\u05D0\u05DE\u05D9\u05EA\u05D9\u05EA"
  },
  "BUILDER_TEXT.cvLayoutNotes": {
    en: "Layout notes",
    he: "\u05D4\u05E2\u05E8\u05D5\u05EA \u05E2\u05DC \u05D4\u05E4\u05E8\u05D9\u05E1\u05D4"
  },
  "BUILDER_TEXT.cvCanvasActions": {
    en: "Canvas actions",
    he: "\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA \u05E2\u05DC \u05D4\u05E7\u05E0\u05D1\u05E1"
  },
  "BUILDER_TEXT.cvAddText": {
    en: "Add text",
    he: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05D8\u05E7\u05E1\u05D8"
  },
  "BUILDER_TEXT.cvAddCaption": {
    en: "Add caption",
    he: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05DB\u05D9\u05EA\u05D5\u05D1"
  },
  "BUILDER_TEXT.cvInsertObject": {
    en: "Insert object\u2026",
    he: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8\u2026"
  },
  "BUILDER_TEXT.cvRemoveLabel": {
    en: "Remove label",
    he: "\u05D4\u05E1\u05E8\u05EA \u05EA\u05D5\u05D5\u05D9\u05EA"
  },
  "BUILDER_TEXT.cvAddLabel": {
    en: "Add label",
    he: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05EA\u05D5\u05D5\u05D9\u05EA"
  },
  "BUILDER_TEXT.cvRename": {
    en: "Rename",
    he: "\u05E9\u05D9\u05E0\u05D5\u05D9 \u05E9\u05DD"
  },
  "BUILDER_TEXT.cvConnect": {
    en: "Connect",
    he: "\u05D7\u05D9\u05D1\u05D5\u05E8"
  },
  "BUILDER_TEXT.cvDuplicate": {
    en: "Duplicate",
    he: "\u05E9\u05DB\u05E4\u05D5\u05DC"
  },
  "BUILDER_TEXT.cvDelete": {
    en: "Delete",
    he: "\u05DE\u05D7\u05D9\u05E7\u05D4"
  },
  "BUILDER_TEXT.cvReverse": {
    en: "Reverse",
    he: "\u05D4\u05D9\u05E4\u05D5\u05DA \u05DB\u05D9\u05D5\u05D5\u05DF"
  },
  "BUILDER_TEXT.cvStraight": {
    en: "Straight",
    he: "\u05D9\u05E9\u05E8"
  },
  "BUILDER_TEXT.cvElbow": {
    en: "Elbow",
    he: "\u05D6\u05D5\u05D5\u05D9\u05EA\u05D9"
  },
  "BUILDER_TEXT.cvCurve": {
    en: "Curve",
    he: "\u05DE\u05E2\u05D5\u05E7\u05DC"
  },
  "BUILDER_TEXT.cvShapeTools": {
    en: "Shape tools",
    he: "\u05DB\u05DC\u05D9 \u05E6\u05D5\u05E8\u05D4"
  },
  "BUILDER_TEXT.cvArrowTools": {
    en: "Arrow tools",
    he: "\u05DB\u05DC\u05D9 \u05D7\u05E5"
  },
  "BUILDER_TEXT.cvRoute": {
    en: "Route",
    he: "\u05DE\u05E1\u05DC\u05D5\u05DC"
  },
  "BUILDER_TEXT.cvArrowHead": {
    en: "Arrow head",
    he: "\u05E8\u05D0\u05E9 \u05D7\u05E5"
  },
  "BUILDER_TEXT.cvArrowLabel": {
    en: "Arrow label",
    he: "\u05EA\u05D5\u05D5\u05D9\u05EA \u05D4\u05D7\u05E5"
  },
  "BUILDER_TEXT.cvLabelPlaceholder": {
    en: "label",
    he: "\u05EA\u05D5\u05D5\u05D9\u05EA"
  },
  "BUILDER_TEXT.cvColourName": {
    en: "Colour {name}",
    he: "\u05E6\u05D1\u05E2 {name}"
  },
  "BUILDER_TEXT.cvBlue": {
    en: "Blue",
    he: "\u05DB\u05D7\u05D5\u05DC"
  },
  "BUILDER_TEXT.cvPurple": {
    en: "Purple",
    he: "\u05E1\u05D2\u05D5\u05DC"
  },
  "BUILDER_TEXT.cvGreen": {
    en: "Green",
    he: "\u05D9\u05E8\u05D5\u05E7"
  },
  "BUILDER_TEXT.cvOrange": {
    en: "Orange",
    he: "\u05DB\u05EA\u05D5\u05DD"
  },
  "BUILDER_TEXT.cvPink": {
    en: "Pink",
    he: "\u05D5\u05E8\u05D5\u05D3"
  },
  "BUILDER_TEXT.cvAddAndConnect": {
    en: "Add a shape and connect",
    he: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E6\u05D5\u05E8\u05D4 \u05D5\u05D7\u05D9\u05D1\u05D5\u05E8"
  },
  "BUILDER_TEXT.cvAddShapeHere": {
    en: "Add a new shape here and connect",
    he: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E6\u05D5\u05E8\u05D4 \u05D7\u05D3\u05E9\u05D4 \u05DB\u05D0\u05DF \u05D5\u05D7\u05D9\u05D1\u05D5\u05E8"
  },
  "BUILDER_TEXT.cvCircle": {
    en: "Circle",
    he: "\u05E2\u05D9\u05D2\u05D5\u05DC"
  },
  "BUILDER_TEXT.cvBox": {
    en: "Box",
    he: "\u05EA\u05D9\u05D1\u05D4"
  },
  "BUILDER_TEXT.cvDiamond": {
    en: "Diamond",
    he: "\u05DE\u05E2\u05D5\u05D9\u05DF"
  },
  "BUILDER_TEXT.cvShapeText": {
    en: "Shape text",
    he: "\u05D8\u05E7\u05E1\u05D8 \u05D4\u05E6\u05D5\u05E8\u05D4"
  },
  "BUILDER_TEXT.cvLivePreview": {
    en: "Live preview",
    he: "\u05EA\u05E6\u05D5\u05D2\u05D4 \u05DE\u05E7\u05D3\u05D9\u05DE\u05D4 \u05D7\u05D9\u05D4"
  },
  "BUILDER_TEXT.cvPopOut": {
    en: "Pop out",
    he: "\u05E4\u05EA\u05D9\u05D7\u05D4 \u05D1\u05D7\u05DC\u05D5\u05DF \u05E0\u05E4\u05E8\u05D3"
  },
  "BUILDER_TEXT.cvShortcutSelectTool": {
    en: "Select tool",
    he: "\u05DB\u05DC\u05D9 \u05D4\u05D1\u05D7\u05D9\u05E8\u05D4"
  },
  "BUILDER_TEXT.cvShortcutArrowTool": {
    en: "Arrow tool",
    he: "\u05DB\u05DC\u05D9 \u05D4\u05D7\u05E5"
  },
  "BUILDER_TEXT.cvShortcutAddShapes": {
    en: "Add circle, box, diamond, text, heading, caption, note, custom",
    he: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E2\u05D9\u05D2\u05D5\u05DC, \u05EA\u05D9\u05D1\u05D4, \u05DE\u05E2\u05D5\u05D9\u05DF, \u05D8\u05E7\u05E1\u05D8, \u05DB\u05D5\u05EA\u05E8\u05EA, \u05DB\u05D9\u05EA\u05D5\u05D1, \u05D4\u05E2\u05E8\u05D4, \u05DE\u05D5\u05EA\u05D0\u05DD \u05D0\u05D9\u05E9\u05D9\u05EA"
  },
  "BUILDER_TEXT.cvShortcutAnimate": {
    en: "Add an animation",
    he: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D4"
  },
  "BUILDER_TEXT.cvShortcutNewStep": {
    en: "New step",
    he: "\u05E9\u05DC\u05D1 \u05D7\u05D3\u05E9"
  },
  "BUILDER_TEXT.cvShortcutPrevNext": {
    en: "Previous or next step",
    he: "\u05D4\u05E9\u05DC\u05D1 \u05D4\u05E7\u05D5\u05D3\u05DD \u05D0\u05D5 \u05D4\u05D1\u05D0"
  },
  "BUILDER_TEXT.cvShortcutPlayPause": {
    en: "Play or pause the preview",
    he: "\u05D4\u05E4\u05E2\u05DC\u05D4 \u05D0\u05D5 \u05D4\u05E9\u05D4\u05D9\u05D4 \u05E9\u05DC \u05D4\u05EA\u05E6\u05D5\u05D2\u05D4 \u05D4\u05DE\u05E7\u05D3\u05D9\u05DE\u05D4"
  },
  "BUILDER_TEXT.cvShortcutDelete": {
    en: "Delete selected",
    he: "\u05DE\u05D7\u05D9\u05E7\u05EA \u05D4\u05E0\u05D1\u05D7\u05E8"
  },
  "BUILDER_TEXT.cvShortcutEdit": {
    en: "Edit selected",
    he: "\u05E2\u05E8\u05D9\u05DB\u05EA \u05D4\u05E0\u05D1\u05D7\u05E8"
  },
  "BUILDER_TEXT.cvShortcutCancel": {
    en: "Cancel and go back to Select",
    he: "\u05D1\u05D9\u05D8\u05D5\u05DC \u05D5\u05D7\u05D6\u05E8\u05D4 \u05DC\u05DB\u05DC\u05D9 \u05D4\u05D1\u05D7\u05D9\u05E8\u05D4"
  },
  "BUILDER_TEXT.cvShortcutUndoRedo": {
    en: "Undo or redo",
    he: "\u05D1\u05D9\u05D8\u05D5\u05DC \u05D0\u05D5 \u05D7\u05D6\u05E8\u05D4"
  },
  "BUILDER_TEXT.cvShortcutDuplicate": {
    en: "Duplicate selected",
    he: "\u05E9\u05DB\u05E4\u05D5\u05DC \u05D4\u05E0\u05D1\u05D7\u05E8"
  },
  "BUILDER_TEXT.cvShortcutNudge": {
    en: "Nudge selected, Shift for 10",
    he: "\u05D4\u05D6\u05D6\u05EA \u05D4\u05E0\u05D1\u05D7\u05E8, Shift \u05DC\u05D4\u05D6\u05D6\u05D4 \u05E9\u05DC 10"
  },
  "BUILDER_TEXT.cvClose": {
    en: "Close",
    he: "\u05E1\u05D2\u05D9\u05E8\u05D4"
  },
  "BUILDER_TEXT.edEditShape": {
    en: "Edit shape",
    he: "\u05E2\u05E8\u05D9\u05DB\u05EA \u05E6\u05D5\u05E8\u05D4"
  },
  "BUILDER_TEXT.edName": {
    en: "Name",
    he: "\u05E9\u05DD"
  },
  "BUILDER_TEXT.edText": {
    en: "Text",
    he: "\u05D8\u05E7\u05E1\u05D8"
  },
  "BUILDER_TEXT.edColour": {
    en: "Colour",
    he: "\u05E6\u05D1\u05E2"
  },
  "BUILDER_TEXT.edWidth": {
    en: "Width",
    he: "\u05E8\u05D5\u05D7\u05D1"
  },
  "BUILDER_TEXT.edHeight": {
    en: "Height",
    he: "\u05D2\u05D5\u05D1\u05D4"
  },
  "BUILDER_TEXT.edDone": {
    en: "Done",
    he: "\u05E1\u05D9\u05D5\u05DD"
  },
  "BUILDER_TEXT.edFill": {
    en: "Fill",
    he: "\u05DE\u05D9\u05DC\u05D5\u05D9"
  },
  "BUILDER_TEXT.edFillStrength": {
    en: "Fill strength",
    he: "\u05E2\u05D5\u05E6\u05DE\u05EA \u05DE\u05D9\u05DC\u05D5\u05D9"
  },
  "BUILDER_TEXT.edOutline": {
    en: "Outline",
    he: "\u05E7\u05D5 \u05DE\u05EA\u05D0\u05E8"
  },
  "BUILDER_TEXT.edLineColor": {
    en: "Color",
    he: "\u05E6\u05D1\u05E2"
  },
  "BUILDER_TEXT.edThickness": {
    en: "Thickness",
    he: "\u05E2\u05D5\u05D1\u05D9"
  },
  "BUILDER_TEXT.edOutlineWidth": {
    en: "Outline width",
    he: "\u05E2\u05D5\u05D1\u05D9 \u05E7\u05D5 \u05DE\u05EA\u05D0\u05E8"
  },
  "BUILDER_TEXT.edLine": {
    en: "Line",
    he: "\u05E7\u05D5"
  },
  "BUILDER_TEXT.edOutlineStyle": {
    en: "Outline style",
    he: "\u05E1\u05D2\u05E0\u05D5\u05DF \u05E7\u05D5 \u05DE\u05EA\u05D0\u05E8"
  },
  "BUILDER_TEXT.edSolid": {
    en: "Solid",
    he: "\u05E8\u05E6\u05D9\u05E3"
  },
  "BUILDER_TEXT.edDashed": {
    en: "Dashed",
    he: "\u05DE\u05E7\u05D5\u05D5\u05E7\u05D5"
  },
  "BUILDER_TEXT.edDotted": {
    en: "Dotted",
    he: "\u05DE\u05E0\u05D5\u05E7\u05D3"
  },
  "BUILDER_TEXT.edAccent": {
    en: "Accent",
    he: "\u05D4\u05D3\u05D2\u05E9\u05D4"
  },
  "BUILDER_TEXT.edTextColor": {
    en: "Text color",
    he: "\u05E6\u05D1\u05E2 \u05D8\u05E7\u05E1\u05D8"
  },
  "BUILDER_TEXT.edTextSize": {
    en: "Text size",
    he: "\u05D2\u05D5\u05D3\u05DC \u05D8\u05E7\u05E1\u05D8"
  },
  "BUILDER_TEXT.edSmall": {
    en: "Small",
    he: "\u05E7\u05D8\u05DF"
  },
  "BUILDER_TEXT.edMedium": {
    en: "Medium",
    he: "\u05D1\u05D9\u05E0\u05D5\u05E0\u05D9"
  },
  "BUILDER_TEXT.edLarge": {
    en: "Large",
    he: "\u05D2\u05D3\u05D5\u05DC"
  },
  "BUILDER_TEXT.edHuge": {
    en: "Huge",
    he: "\u05E2\u05E0\u05E7"
  },
  "BUILDER_TEXT.edSize": {
    en: "Size",
    he: "\u05D2\u05D5\u05D3\u05DC"
  },
  "BUILDER_TEXT.edNone": {
    en: "none",
    he: "\u05DC\u05DC\u05D0"
  },
  "BUILDER_TEXT.edCustomColor": {
    en: "custom color",
    he: "\u05E6\u05D1\u05E2 \u05DE\u05D5\u05EA\u05D0\u05DD \u05D0\u05D9\u05E9\u05D9\u05EA"
  },
  "BUILDER_TEXT.edColourBlue": {
    en: "Blue",
    he: "\u05DB\u05D7\u05D5\u05DC"
  },
  "BUILDER_TEXT.edColourPurple": {
    en: "Purple",
    he: "\u05E1\u05D2\u05D5\u05DC"
  },
  "BUILDER_TEXT.edColourCyan": {
    en: "Cyan",
    he: "\u05D8\u05D5\u05E8\u05E7\u05D9\u05D6"
  },
  "BUILDER_TEXT.edColourGreen": {
    en: "Green",
    he: "\u05D9\u05E8\u05D5\u05E7"
  },
  "BUILDER_TEXT.edColourYellow": {
    en: "Yellow",
    he: "\u05E6\u05D4\u05D5\u05D1"
  },
  "BUILDER_TEXT.edColourOrange": {
    en: "Orange",
    he: "\u05DB\u05EA\u05D5\u05DD"
  },
  "BUILDER_TEXT.edColourPink": {
    en: "Pink",
    he: "\u05D5\u05E8\u05D5\u05D3"
  },
  "BUILDER_TEXT.edColourRed": {
    en: "Red",
    he: "\u05D0\u05D3\u05D5\u05DD"
  },
  "BUILDER_TEXT.edColourAmber": {
    en: "Amber",
    he: "\u05E2\u05E0\u05D1\u05E8"
  },
  "BUILDER_TEXT.edColourWhite": {
    en: "White",
    he: "\u05DC\u05D1\u05DF"
  },
  "BUILDER_TEXT.edChooseAnimation": {
    en: "Choose an animation",
    he: "\u05D1\u05D7\u05D9\u05E8\u05EA \u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D4"
  },
  "BUILDER_TEXT.edFor": {
    en: "for",
    he: "\u05E2\u05D1\u05D5\u05E8"
  },
  "BUILDER_TEXT.edOr": {
    en: "or",
    he: "\u05D0\u05D5"
  },
  "BUILDER_TEXT.edAnyObject": {
    en: "any object",
    he: "\u05DB\u05DC \u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8"
  },
  "BUILDER_TEXT.edKindShapes": {
    en: "shapes",
    he: "\u05E6\u05D5\u05E8\u05D5\u05EA"
  },
  "BUILDER_TEXT.edKindBoxes": {
    en: "boxes",
    he: "\u05EA\u05D9\u05D1\u05D5\u05EA"
  },
  "BUILDER_TEXT.edKindArrows": {
    en: "arrows",
    he: "\u05D7\u05E6\u05D9\u05DD"
  },
  "BUILDER_TEXT.edKindLines": {
    en: "lines",
    he: "\u05E7\u05D5\u05D5\u05D9\u05DD"
  },
  "BUILDER_TEXT.edKindText": {
    en: "text",
    he: "\u05D8\u05E7\u05E1\u05D8"
  },
  "BUILDER_TEXT.edEffectFill": {
    en: "Fill",
    he: "\u05DE\u05D9\u05DC\u05D5\u05D9"
  },
  "BUILDER_TEXT.edEffectFillDesc": {
    en: "The shape fills with colour.",
    he: "\u05D4\u05E6\u05D5\u05E8\u05D4 \u05DE\u05EA\u05DE\u05DC\u05D0\u05EA \u05D1\u05E6\u05D1\u05E2."
  },
  "BUILDER_TEXT.edEffectReveal": {
    en: "Reveal",
    he: "\u05D4\u05D5\u05E4\u05E2\u05D4"
  },
  "BUILDER_TEXT.edEffectRevealDesc": {
    en: "The shape fades in.",
    he: "\u05D4\u05E6\u05D5\u05E8\u05D4 \u05DE\u05D5\u05E4\u05D9\u05E2\u05D4 \u05D1\u05D4\u05D3\u05E8\u05D2\u05D4."
  },
  "BUILDER_TEXT.edEffectRemove": {
    en: "Remove",
    he: "\u05D4\u05E1\u05E8\u05D4"
  },
  "BUILDER_TEXT.edEffectRemoveDesc": {
    en: "The shape fades out and stays gone.",
    he: "\u05D4\u05E6\u05D5\u05E8\u05D4 \u05E0\u05E2\u05DC\u05DE\u05EA \u05D1\u05D4\u05D3\u05E8\u05D2\u05D4 \u05D5\u05E0\u05E9\u05D0\u05E8\u05EA \u05E0\u05E2\u05DC\u05DE\u05EA."
  },
  "BUILDER_TEXT.edEffectDraw": {
    en: "Draw in",
    he: "\u05E6\u05D9\u05D5\u05E8"
  },
  "BUILDER_TEXT.edEffectDrawDesc": {
    en: "The arrow draws from start to end.",
    he: "\u05D4\u05D7\u05E5 \u05DE\u05E6\u05D8\u05D9\u05D9\u05E8 \u05DE\u05D4\u05EA\u05D7\u05DC\u05D4 \u05D5\u05E2\u05D3 \u05E1\u05D5\u05E3."
  },
  "BUILDER_TEXT.edEffectTravel": {
    en: "Travel",
    he: "\u05DE\u05E1\u05E2"
  },
  "BUILDER_TEXT.edEffectTravelDesc": {
    en: "A token rides along the arrow.",
    he: "\u05D0\u05E1\u05D9\u05DE\u05D5\u05DF \u05E0\u05E2 \u05DC\u05D0\u05D5\u05E8\u05DA \u05D4\u05D7\u05E5."
  },
  "BUILDER_TEXT.edEffectFlow": {
    en: "Flow",
    he: "\u05D6\u05E8\u05D9\u05DE\u05D4"
  },
  "BUILDER_TEXT.edEffectFlowDesc": {
    en: "Dashes stream along the arrow.",
    he: "\u05E7\u05D5\u05D5\u05D9\u05DD \u05DE\u05E7\u05D5\u05D5\u05E7\u05D5\u05D5\u05D9\u05DD \u05D6\u05D5\u05E8\u05DE\u05D9\u05DD \u05DC\u05D0\u05D5\u05E8\u05DA \u05D4\u05D7\u05E5."
  },
  "BUILDER_TEXT.edEffectSpark": {
    en: "Zigzag",
    he: "\u05D6\u05D9\u05D2\u05D6\u05D2"
  },
  "BUILDER_TEXT.edEffectSparkDesc": {
    en: "A zigzag spark runs along the arrow.",
    he: "\u05E0\u05D9\u05E6\u05D5\u05E5 \u05D6\u05D9\u05D2\u05D6\u05D2 \u05E8\u05E5 \u05DC\u05D0\u05D5\u05E8\u05DA \u05D4\u05D7\u05E5."
  },
  "BUILDER_TEXT.edEffectFrame": {
    en: "Zigzag outline",
    he: "\u05E7\u05D5 \u05DE\u05EA\u05D0\u05E8 \u05D6\u05D9\u05D2\u05D6\u05D2"
  },
  "BUILDER_TEXT.edEffectFrameDesc": {
    en: "A marching dashed frame, like the swap marker.",
    he: "\u05DE\u05E1\u05D2\u05E8\u05EA \u05DE\u05E7\u05D5\u05D5\u05E7\u05D5\u05D5\u05EA \u05E0\u05E2\u05D4, \u05DB\u05DE\u05D5 \u05E1\u05DE\u05DF \u05D4\u05D4\u05D7\u05DC\u05E4\u05D4."
  },
  "BUILDER_TEXT.edEffectPulse": {
    en: "Pulse",
    he: "\u05E4\u05E2\u05D9\u05DE\u05D4"
  },
  "BUILDER_TEXT.edEffectPulseDesc": {
    en: "The shape swells and settles.",
    he: "\u05D4\u05E6\u05D5\u05E8\u05D4 \u05DE\u05EA\u05E0\u05E4\u05D7\u05EA \u05D5\u05DE\u05EA\u05D9\u05D9\u05E6\u05D1\u05EA."
  },
  "BUILDER_TEXT.edEffectGlow": {
    en: "Glow",
    he: "\u05D6\u05D5\u05D4\u05E8"
  },
  "BUILDER_TEXT.edEffectGlowDesc": {
    en: "Glows until the step ends or you calm it down.",
    he: "\u05D6\u05D5\u05D4\u05E8\u05EA \u05E2\u05D3 \u05E1\u05D5\u05E3 \u05D4\u05E9\u05DC\u05D1 \u05D0\u05D5 \u05E2\u05D3 \u05E9\u05EA\u05DB\u05D1\u05D5 \u05D0\u05D5\u05EA\u05D4."
  },
  "BUILDER_TEXT.edEffectSweep": {
    en: "Highlight sweep",
    he: "\u05E1\u05E8\u05D9\u05E7\u05EA \u05D4\u05D3\u05D2\u05E9\u05D4"
  },
  "BUILDER_TEXT.edEffectSweepDesc": {
    en: "A bar of light crosses the shape from left to right.",
    he: "\u05E4\u05E1 \u05D0\u05D5\u05E8 \u05D7\u05D5\u05E6\u05D4 \u05D0\u05EA \u05D4\u05E6\u05D5\u05E8\u05D4 \u05DE\u05E9\u05DE\u05D0\u05DC \u05DC\u05D9\u05DE\u05D9\u05DF."
  },
  "BUILDER_TEXT.edEffectCallout": {
    en: "Callout",
    he: "\u05D4\u05E2\u05E8\u05EA \u05D4\u05D3\u05D2\u05E9\u05D4"
  },
  "BUILDER_TEXT.edEffectCalloutDesc": {
    en: "A short note appears beside the shape for the step.",
    he: "\u05D4\u05E2\u05E8\u05D4 \u05E7\u05E6\u05E8\u05D4 \u05DE\u05D5\u05E4\u05D9\u05E2\u05D4 \u05DC\u05E6\u05D3 \u05D4\u05E6\u05D5\u05E8\u05D4 \u05DC\u05D0\u05D5\u05E8\u05DA \u05D4\u05E9\u05DC\u05D1."
  },
  "BUILDER_TEXT.edEffectFade": {
    en: "Fade",
    he: "\u05D3\u05D4\u05D9\u05D9\u05D4"
  },
  "BUILDER_TEXT.edEffectFadeDesc": {
    en: "The object dims to make the rest stand out.",
    he: "\u05D4\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05DE\u05EA\u05E2\u05DE\u05E2\u05DD \u05DB\u05D3\u05D9 \u05E9\u05D4\u05E9\u05D0\u05E8 \u05D9\u05D1\u05DC\u05D8\u05D5."
  },
  "BUILDER_TEXT.edEffectTint": {
    en: "Colour change",
    he: "\u05E9\u05D9\u05E0\u05D5\u05D9 \u05E6\u05D1\u05E2"
  },
  "BUILDER_TEXT.edEffectTintDesc": {
    en: "The object switches to another colour.",
    he: "\u05D4\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05E2\u05D5\u05D1\u05E8 \u05DC\u05E6\u05D1\u05E2 \u05D0\u05D7\u05E8."
  },
  "BUILDER_TEXT.edEffectOutline": {
    en: "Emphasise outline",
    he: "\u05D4\u05D3\u05D2\u05E9\u05EA \u05E7\u05D5 \u05DE\u05EA\u05D0\u05E8"
  },
  "BUILDER_TEXT.edEffectOutlineDesc": {
    en: "The outline thickens.",
    he: "\u05E7\u05D5 \u05D4\u05DE\u05EA\u05D0\u05E8 \u05DE\u05EA\u05E2\u05D1\u05D4."
  },
  "BUILDER_TEXT.edEffectSoften": {
    en: "Soft highlight",
    he: "\u05D4\u05D3\u05D2\u05E9\u05D4 \u05E8\u05DB\u05D4"
  },
  "BUILDER_TEXT.edEffectSoftenDesc": {
    en: "The fill brightens softly.",
    he: "\u05D4\u05DE\u05D9\u05DC\u05D5\u05D9 \u05DE\u05EA\u05D1\u05D4\u05E8 \u05D1\u05E2\u05D3\u05D9\u05E0\u05D5\u05EA."
  },
  "BUILDER_TEXT.edEffectMove": {
    en: "Move",
    he: "\u05D4\u05D6\u05D6\u05D4"
  },
  "BUILDER_TEXT.edEffectMoveDesc": {
    en: "The object slides to a new spot.",
    he: "\u05D4\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05DE\u05D7\u05DC\u05D9\u05E7 \u05DC\u05DE\u05D9\u05E7\u05D5\u05DD \u05D7\u05D3\u05E9."
  },
  "BUILDER_TEXT.edEffectGrow": {
    en: "Grow or shrink",
    he: "\u05D4\u05D2\u05D3\u05DC\u05D4 \u05D0\u05D5 \u05D4\u05E7\u05D8\u05E0\u05D4"
  },
  "BUILDER_TEXT.edEffectGrowDesc": {
    en: "The object grows to a larger size.",
    he: "\u05D4\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05D2\u05D3\u05DC \u05DC\u05D2\u05D5\u05D3\u05DC \u05D2\u05D3\u05D5\u05DC \u05D9\u05D5\u05EA\u05E8."
  },
  "BUILDER_TEXT.edEffectBounce": {
    en: "Bounce",
    he: "\u05E7\u05E4\u05D9\u05E6\u05D4"
  },
  "BUILDER_TEXT.edEffectBounceDesc": {
    en: "The object hops up and settles back.",
    he: "\u05D4\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8 \u05E7\u05D5\u05E4\u05E5 \u05DC\u05DE\u05E2\u05DC\u05D4 \u05D5\u05D7\u05D5\u05D6\u05E8 \u05DC\u05DE\u05E7\u05D5\u05DE\u05D5."
  },
  "BUTTONS_TEXT.launchModel": {
    en: "Launch Model",
    he: "\u05D4\u05E4\u05E2\u05DC \u05DE\u05D5\u05D3\u05DC"
  },
  "BUTTONS_TEXT.retryLoading": {
    en: "Retry Loading",
    he: "\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1"
  },
  "BUTTONS_TEXT.close": {
    en: "Close",
    he: "\u05E1\u05D2\u05D5\u05E8"
  },
  "BUTTONS_TEXT.sidebar": {
    en: "Sidebar",
    he: "\u05EA\u05E4\u05E8\u05D9\u05D8 \u05E6\u05D3"
  },
  "BUTTONS_TEXT.patchNotes": {
    en: "Patch Notes",
    he: "\u05E2\u05D3\u05DB\u05D5\u05E0\u05D9\u05DD"
  },
  "BUTTONS_TEXT.aiAssistant": {
    en: "AI Assistant",
    he: "\u05E2\u05D5\u05D6\u05E8 AI"
  },
  "COMMON_TEXT.save": {
    en: "Save",
    he: "\u05E9\u05DE\u05D5\u05E8"
  },
  "COMMON_TEXT.cancel": {
    en: "Cancel",
    he: "\u05D1\u05D9\u05D8\u05D5\u05DC"
  },
  "COMMON_TEXT.close": {
    en: "Close",
    he: "\u05E1\u05D2\u05D5\u05E8"
  },
  "COMMON_TEXT.apply": {
    en: "Apply",
    he: "\u05D4\u05D7\u05DC"
  },
  "COMMON_TEXT.delete": {
    en: "Delete",
    he: "\u05DE\u05D7\u05E7"
  },
  "COMMON_TEXT.edit": {
    en: "Edit",
    he: "\u05E2\u05E8\u05D5\u05DA"
  },
  "COMMON_TEXT.back": {
    en: "Back",
    he: "\u05D7\u05D6\u05D5\u05E8"
  },
  "COMMON_TEXT.next": {
    en: "Next",
    he: "\u05D4\u05D1\u05D0"
  },
  "COMMON_TEXT.confirm": {
    en: "Confirm",
    he: "\u05D0\u05D9\u05E9\u05D5\u05E8"
  },
  "COMMON_TEXT.loading": {
    en: "Loading...",
    he: "\u05D8\u05D5\u05E2\u05DF..."
  },
  "COMMON_TEXT.error": {
    en: "Error",
    he: "\u05E9\u05D2\u05D9\u05D0\u05D4"
  },
  "COMMON_TEXT.success": {
    en: "Success",
    he: "\u05D4\u05E6\u05DC\u05D7\u05D4"
  },
  "COMMON_TEXT.retry": {
    en: "Retry",
    he: "\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1"
  },
  "COMMON_TEXT.search": {
    en: "Search...",
    he: "\u05D7\u05D9\u05E4\u05D5\u05E9..."
  },
  "COMMON_TEXT.empty": {
    en: "(empty)",
    he: "(\u05E8\u05D9\u05E7)"
  },
  "COMMON_TEXT.networkError": {
    en: "Network Error loading content",
    he: "\u05E9\u05D2\u05D9\u05D0\u05EA \u05EA\u05E7\u05E9\u05D5\u05E8\u05EA \u05D1\u05D8\u05E2\u05D9\u05E0\u05EA \u05D4\u05EA\u05D5\u05DB\u05DF"
  },
  "COMMON_TEXT.tryAgain": {
    en: "Try Again",
    he: "\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1"
  },
  "COMMON_TEXT.backToHub": {
    en: "Back to Hub",
    he: "\u05D7\u05D6\u05E8\u05D4 \u05DC\u05D3\u05E3 \u05D4\u05D1\u05D9\u05EA"
  },
  "COMMON_TEXT.canvasRenderError": {
    en: "This canvas failed to render.",
    he: "\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D8\u05E2\u05D9\u05E0\u05EA \u05D4\u05E7\u05E0\u05D1\u05E1"
  },
  "HEADERS_TEXT.week1Header": {
    en: "Week 1: Computational Models",
    he: "\u05E9\u05D1\u05D5\u05E2 1: \u05DE\u05D5\u05D3\u05DC\u05D9\u05DD \u05D7\u05D9\u05E9\u05D5\u05D1\u05D9\u05D9\u05DD"
  },
  "HEADERS_TEXT.week2Header": {
    en: "Week 2: Turing Machines & Reductions",
    he: "\u05E9\u05D1\u05D5\u05E2 2: \u05DE\u05DB\u05D5\u05E0\u05D5\u05EA \u05D8\u05D5\u05E8\u05D9\u05E0\u05D2 \u05D5\u05E8\u05D3\u05D5\u05E7\u05E6\u05D9\u05D5\u05EA"
  },
  "HEADERS_TEXT.sidebarBrandTitle": {
    en: "Complexity Theory",
    he: "\u05EA\u05D5\u05E8\u05EA \u05D4\u05E1\u05D9\u05D1\u05D5\u05DB\u05D9\u05D5\u05EA"
  },
  "HEADERS_TEXT.mainHeaderHome": {
    en: "Complexity & Computability",
    he: "\u05E1\u05D9\u05D1\u05D5\u05DB\u05D9\u05D5\u05EA \u05D5\u05D7\u05D9\u05E9\u05D5\u05D1\u05D9\u05D5\u05EA"
  },
  "HEADERS_TEXT.mainHeaderDefault": {
    en: "Interactive Course Portal",
    he: "\u05E4\u05D5\u05E8\u05D8\u05DC \u05E7\u05D5\u05E8\u05E1 \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9"
  },
  "HOME_TEXT.title": {
    en: "Home Dashboard",
    he: "\u05D3\u05E3 \u05D4\u05D1\u05D9\u05EA"
  },
  "HOME_TEXT.welcomeTitle": {
    en: "Welcome to the Computability & Complexity Course Website",
    he: "\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC\u05D0\u05EA\u05E8 \u05D4\u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9 \u05E9\u05DC \u05E7\u05D5\u05E8\u05E1 \u05D7\u05D9\u05E9\u05D5\u05D1\u05D9\u05D5\u05EA \u05D5\u05E1\u05D9\u05D1\u05D5\u05DB\u05D9\u05D5\u05EA"
  },
  "HOME_TEXT.welcomeSubtitle": {
    en: "An interactive learning platform for step-by-step visualization of Turing machines, time and space hierarchy theorems, and polynomial time reductions.",
    he: "\u05E4\u05DC\u05D8\u05E4\u05D5\u05E8\u05DE\u05EA \u05DC\u05DE\u05D9\u05D3\u05D4 \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9\u05EA \u05DC\u05D4\u05DE\u05D7\u05E9\u05D4 \u05D5\u05D9\u05D6\u05D5\u05D0\u05DC\u05D9\u05EA \u05E9\u05DC \u05DE\u05DB\u05D5\u05E0\u05D5\u05EA \u05D8\u05D5\u05E8\u05D9\u05E0\u05D2, \u05DE\u05E9\u05E4\u05D8\u05D9 \u05D4\u05D9\u05E8\u05E8\u05DB\u05D9\u05D4, \u05D5\u05E8\u05D3\u05D5\u05E7\u05E6\u05D9\u05D5\u05EA \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05D0\u05DC\u05D9\u05D5\u05EA."
  },
  "HOME_TEXT.heroPlatformTag": {
    en: "Computability & Complexity Platform",
    he: "\u05E4\u05DC\u05D8\u05E4\u05D5\u05E8\u05DE\u05EA \u05D7\u05D9\u05E9\u05D5\u05D1\u05D9\u05D5\u05EA \u05D5\u05E1\u05D9\u05D1\u05D5\u05DB\u05D9\u05D5\u05EA"
  },
  "HOME_TEXT.week1Title": {
    en: "Week 1 Topics & Visual Models",
    he: "\u05E9\u05D1\u05D5\u05E2 1: \u05DE\u05D1\u05D5\u05D0 \u05D5\u05E0\u05D5\u05E9\u05D0\u05D9\u05DD \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9\u05D9\u05DD"
  },
  "HOME_TEXT.lectures": {
    en: "Lectures",
    he: "\u05D4\u05E8\u05E6\u05D0\u05D5\u05EA"
  },
  "HOME_TEXT.practice": {
    en: "Practice",
    he: "\u05EA\u05E8\u05D2\u05D5\u05DC\u05D9\u05DD"
  },
  "HUB_TEXT.topics": {
    en: "topics",
    he: "\u05E0\u05D5\u05E9\u05D0\u05D9\u05DD"
  },
  "HUB_TEXT.addTopic": {
    en: "Add topic",
    he: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E0\u05D5\u05E9\u05D0"
  },
  "HUB_TEXT.coursesTitle": {
    en: "Courses",
    he: "\u05E7\u05D5\u05E8\u05E1\u05D9\u05DD"
  },
  "HUB_TEXT.coursesIntro": {
    en: "Pick a course to start.",
    he: "\u05D1\u05D7\u05E8\u05D5 \u05E7\u05D5\u05E8\u05E1 \u05DB\u05D3\u05D9 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC."
  },
  "HUB_TEXT.platformTagline": {
    en: "Interactive Complexity Platform",
    he: "\u05E4\u05DC\u05D8\u05E4\u05D5\u05E8\u05DE\u05EA \u05D7\u05D9\u05E9\u05D5\u05D1\u05D9\u05D5\u05EA \u05D5\u05E1\u05D9\u05D1\u05D5\u05DB\u05D9\u05D5\u05EA"
  },
  "HUB_TEXT.hubTitle": {
    en: "Course Hub & Learning Modules",
    he: "\u05E4\u05D5\u05E8\u05D8\u05DC \u05D4\u05E7\u05D5\u05E8\u05E1\u05D9\u05DD \u05D5\u05D9\u05D7\u05D9\u05D3\u05D5\u05EA \u05D4\u05DC\u05D9\u05DE\u05D5\u05D3"
  },
  "HUB_TEXT.hubSubtitle": {
    en: "Select a course to explore interactive visualizations, lectures, and practice modules.",
    he: "\u05D1\u05D7\u05E8 \u05E7\u05D5\u05E8\u05E1 \u05DB\u05D3\u05D9 \u05DC\u05E6\u05E4\u05D5\u05EA \u05D1\u05D4\u05D3\u05DE\u05D9\u05D5\u05EA \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9\u05D5\u05EA, \u05D4\u05E8\u05E6\u05D0\u05D5\u05EA \u05D5\u05EA\u05E8\u05D2\u05D5\u05DC\u05D9\u05DD."
  },
  "HUB_TEXT.availableCourses": {
    en: "Available Courses",
    he: "\u05E7\u05D5\u05E8\u05E1\u05D9\u05DD \u05D6\u05DE\u05D9\u05E0\u05D9\u05DD"
  },
  "HUB_TEXT.exploreCourse": {
    en: "Explore Course",
    he: "\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DC\u05E7\u05D5\u05E8\u05E1"
  },
  "HUB_TEXT.weeksLabel": {
    en: "Weeks",
    he: "\u05E9\u05D1\u05D5\u05E2\u05D5\u05EA"
  },
  "HUB_TEXT.interactiveModules": {
    en: "Interactive Modules",
    he: "\u05D9\u05D7\u05D9\u05D3\u05D5\u05EA \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9\u05D5\u05EA"
  },
  "HUB_TEXT.coursesHub": {
    en: "Courses Hub",
    he: "\u05DE\u05E8\u05DB\u05D6 \u05D4\u05E7\u05D5\u05E8\u05E1\u05D9\u05DD"
  },
  "HUB_TEXT.allCourses": {
    en: "All Courses",
    he: "\u05DB\u05DC \u05D4\u05E7\u05D5\u05E8\u05E1\u05D9\u05DD"
  },
  "HUB_TEXT.fieldTitle": {
    en: "Title",
    he: "\u05DB\u05D5\u05EA\u05E8\u05EA"
  },
  "HUB_TEXT.fieldDescription": {
    en: "Description",
    he: "\u05EA\u05D9\u05D0\u05D5\u05E8"
  },
  "HUB_TEXT.titlePlaceholder": {
    en: "e.g. Data Structures",
    he: "\u05DC\u05D3\u05D5\u05D2\u05DE\u05D4: \u05DE\u05D1\u05E0\u05D9 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD"
  },
  "HUB_TEXT.descriptionPlaceholder": {
    en: "A short description",
    he: "\u05EA\u05D9\u05D0\u05D5\u05E8 \u05E7\u05E6\u05E8"
  },
  "HUB_TEXT.apply": {
    en: "Apply",
    he: "\u05D4\u05D7\u05DC"
  },
  "HUB_TEXT.saving": {
    en: "Saving\u2026",
    he: "\u05E9\u05D5\u05DE\u05E8\u2026"
  },
  "HUB_TEXT.cancel": {
    en: "Cancel",
    he: "\u05D1\u05D9\u05D8\u05D5\u05DC"
  },
  "HUB_TEXT.close": {
    en: "Close",
    he: "\u05E1\u05D2\u05D9\u05E8\u05D4"
  },
  "HUB_TEXT.editCourse": {
    en: "Edit course",
    he: "\u05E2\u05E8\u05D9\u05DB\u05EA \u05E7\u05D5\u05E8\u05E1"
  },
  "HUB_TEXT.editSection": {
    en: "Edit section",
    he: "\u05E2\u05E8\u05D9\u05DB\u05EA \u05E4\u05E8\u05E7"
  },
  "HUB_TEXT.editTopic": {
    en: "Edit topic",
    he: "\u05E2\u05E8\u05D9\u05DB\u05EA \u05E0\u05D5\u05E9\u05D0"
  },
  "HUB_TEXT.courseIdLabel": {
    en: "Course ID",
    he: "\u05DE\u05D6\u05D4\u05D4 \u05E7\u05D5\u05E8\u05E1"
  },
  "HUB_TEXT.sectionIdLabel": {
    en: "Section ID",
    he: "\u05DE\u05D6\u05D4\u05D4 \u05E4\u05E8\u05E7"
  },
  "HUB_TEXT.topicIdLabel": {
    en: "Topic ID",
    he: "\u05DE\u05D6\u05D4\u05D4 \u05E0\u05D5\u05E9\u05D0"
  },
  "HUB_TEXT.idDerivedNote": {
    en: "derived automatically, can't be changed later.",
    he: "\u05E0\u05D5\u05E6\u05E8 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05D5\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05E9\u05D9\u05E0\u05D5\u05D9 \u05D0\u05D7\u05E8 \u05DB\u05DA."
  },
  "HUB_TEXT.idWaitingForTitle": {
    en: "(type a title above)",
    he: "(\u05D4\u05E7\u05DC\u05D9\u05D3\u05D5 \u05DB\u05D5\u05EA\u05E8\u05EA \u05DC\u05DE\u05E2\u05DC\u05D4)"
  },
  "HUB_TEXT.idCannotDerive": {
    en: "Couldn't derive an ID from the title. Use some English letters or digits in the title.",
    he: "\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D9\u05E6\u05D5\u05E8 \u05DE\u05D6\u05D4\u05D4 \u05DE\u05D4\u05DB\u05D5\u05EA\u05E8\u05EA. \u05D4\u05D5\u05E1\u05D9\u05E4\u05D5 \u05D0\u05D5\u05EA\u05D9\u05D5\u05EA \u05D1\u05D0\u05E0\u05D2\u05DC\u05D9\u05EA \u05D0\u05D5 \u05E1\u05E4\u05E8\u05D5\u05EA \u05DC\u05DB\u05D5\u05EA\u05E8\u05EA."
  },
  "HUB_TEXT.idInvalid": {
    en: 'The ID "{id}" is invalid. Use lowercase letters, numbers, hyphens and underscores, starting with a letter or number.',
    he: '\u05D4\u05DE\u05D6\u05D4\u05D4 "{id}" \u05D0\u05D9\u05E0\u05D5 \u05EA\u05E7\u05D9\u05DF. \u05D4\u05E9\u05EA\u05DE\u05E9\u05D5 \u05D1\u05D0\u05D5\u05EA\u05D9\u05D5\u05EA \u05E7\u05D8\u05E0\u05D5\u05EA \u05D1\u05D0\u05E0\u05D2\u05DC\u05D9\u05EA, \u05E1\u05E4\u05E8\u05D5\u05EA, \u05DE\u05E7\u05E4\u05D9\u05DD \u05D5\u05E7\u05D5\u05D5\u05D9\u05DD \u05EA\u05D7\u05EA\u05D5\u05E0\u05D9\u05DD, \u05D5\u05D4\u05EA\u05D7\u05D9\u05DC\u05D5 \u05D1\u05D0\u05D5\u05EA \u05D0\u05D5 \u05D1\u05E1\u05E4\u05E8\u05D4.'
  },
  "HUB_TEXT.exportCourse": {
    en: "Export course as ZIP",
    he: "\u05D9\u05D9\u05E6\u05D5\u05D0 \u05D4\u05E7\u05D5\u05E8\u05E1 \u05DB\u05E7\u05D5\u05D1\u05E5 ZIP"
  },
  "HUB_TEXT.importCourseFromZip": {
    en: "Import course from ZIP",
    he: "\u05D9\u05D9\u05D1\u05D5\u05D0 \u05E7\u05D5\u05E8\u05E1 \u05DE\u05E7\u05D5\u05D1\u05E5 ZIP"
  },
  "HUB_TEXT.deleteCourse": {
    en: "Delete course",
    he: "\u05DE\u05D7\u05D9\u05E7\u05EA \u05D4\u05E7\u05D5\u05E8\u05E1"
  },
  "HUB_TEXT.deleteSection": {
    en: "Delete section",
    he: "\u05DE\u05D7\u05D9\u05E7\u05EA \u05D4\u05E4\u05E8\u05E7"
  },
  "HUB_TEXT.deleteTopic": {
    en: "Delete topic",
    he: "\u05DE\u05D7\u05D9\u05E7\u05EA \u05D4\u05E0\u05D5\u05E9\u05D0"
  },
  "HUB_TEXT.exportPdfCourse": {
    en: "Export course as PDF",
    he: "\u05D9\u05D9\u05E6\u05D5\u05D0 \u05D4\u05E7\u05D5\u05E8\u05E1 \u05DC-PDF"
  },
  "HUB_TEXT.openStepMaker": {
    en: "Step maker",
    he: "\u05D9\u05D5\u05E6\u05E8 \u05E6\u05E2\u05D3\u05D9\u05DD"
  },
  "HUB_TEXT.exportPdfWeek": {
    en: "Export section as PDF",
    he: "\u05D9\u05D9\u05E6\u05D5\u05D0 \u05D4\u05E4\u05E8\u05E7 \u05DC-PDF"
  },
  "HUB_TEXT.exportPdfSectionLabel": {
    en: "Section",
    he: "\u05E4\u05E8\u05E7"
  },
  "HUB_TEXT.exportingPdf": {
    en: "Preparing PDF\u2026 {done}/{total}",
    he: "\u05DE\u05DB\u05D9\u05DF PDF\u2026 {done}/{total}"
  },
  "HUB_TEXT.exportPdfEmpty": {
    en: "No canvas topics to export.",
    he: "\u05D0\u05D9\u05DF \u05E0\u05D5\u05E9\u05D0\u05D9 \u05E7\u05E0\u05D1\u05E1 \u05DC\u05D9\u05D9\u05E6\u05D5\u05D0."
  },
  "HUB_TEXT.exportPdfFailed": {
    en: "Could not load: {names}",
    he: "\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D8\u05E2\u05D5\u05DF: {names}"
  },
  "HUB_TEXT.confirmDelete": {
    en: "Confirm?",
    he: "\u05DC\u05D0\u05E9\u05E8?"
  },
  "HUB_TEXT.addCourse": {
    en: "Add course",
    he: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E7\u05D5\u05E8\u05E1"
  },
  "HUB_TEXT.addSection": {
    en: "Add section",
    he: "\u05D4\u05D5\u05E1\u05E4\u05EA \u05E4\u05E8\u05E7"
  },
  "HUB_TEXT.edit": {
    en: "Edit",
    he: "\u05E2\u05E8\u05D9\u05DB\u05D4"
  },
  "HUB_TEXT.doneEditing": {
    en: "Done editing",
    he: "\u05E1\u05D9\u05D5\u05DD \u05E2\u05E8\u05D9\u05DB\u05D4"
  },
  "HUB_TEXT.noTopicsYet": {
    en: "No topics yet. Turn on editing to add one.",
    he: "\u05E2\u05D3\u05D9\u05D9\u05DF \u05D0\u05D9\u05DF \u05E0\u05D5\u05E9\u05D0\u05D9\u05DD. \u05D4\u05E4\u05E2\u05D9\u05DC\u05D5 \u05E2\u05E8\u05D9\u05DB\u05D4 \u05DB\u05D3\u05D9 \u05DC\u05D4\u05D5\u05E1\u05D9\u05E3."
  },
  "HUB_TEXT.deleteAnyway": {
    en: "Delete anyway",
    he: "\u05DC\u05DE\u05D7\u05D5\u05E7 \u05D1\u05DB\u05DC \u05D6\u05D0\u05EA"
  },
  "HUB_TEXT.sectionHasTopics": {
    en: 'Section "{name}" still has topics. Delete it and all its topics anyway?',
    he: '\u05DC\u05E4\u05E8\u05E7 "{name}" \u05E2\u05D3\u05D9\u05D9\u05DF \u05D9\u05E9 \u05E0\u05D5\u05E9\u05D0\u05D9\u05DD. \u05DC\u05DE\u05D7\u05D5\u05E7 \u05D0\u05D5\u05EA\u05D5 \u05D5\u05D0\u05EA \u05DB\u05DC \u05D4\u05E0\u05D5\u05E9\u05D0\u05D9\u05DD \u05E9\u05DC\u05D5?'
  },
  "HUB_TEXT.importCourseTitle": {
    en: "Import course",
    he: "\u05D9\u05D9\u05D1\u05D5\u05D0 \u05E7\u05D5\u05E8\u05E1"
  },
  "HUB_TEXT.importCourseHint": {
    en: "Upload a course ZIP exported from this app.",
    he: "\u05D4\u05E2\u05DC\u05D5 \u05E7\u05D5\u05D1\u05E5 ZIP \u05E9\u05DC \u05E7\u05D5\u05E8\u05E1 \u05E9\u05D9\u05D5\u05E6\u05D0 \u05DE\u05D4\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4 \u05D4\u05D6\u05D5."
  },
  "HUB_TEXT.importing": {
    en: "Importing\u2026",
    he: "\u05DE\u05D9\u05D9\u05D1\u05D0\u2026"
  },
  "HUB_TEXT.importAction": {
    en: "Import",
    he: "\u05D9\u05D9\u05D1\u05D5\u05D0"
  },
  "HUB_TEXT.importFailed": {
    en: "Import failed",
    he: "\u05D4\u05D9\u05D9\u05D1\u05D5\u05D0 \u05E0\u05DB\u05E9\u05DC"
  },
  "HUB_TEXT.topicKindCanvas": {
    en: "Canvas",
    he: "\u05E7\u05E0\u05D1\u05E1"
  },
  "HUB_TEXT.topicKindFile": {
    en: "Document",
    he: "\u05DE\u05E1\u05DE\u05DA"
  },
  "HUB_TEXT.topicTypeFileHint": {
    en: "Upload a PDF, Word, PowerPoint, Excel or CSV file",
    he: "\u05D4\u05E2\u05DC\u05D0\u05EA \u05DE\u05E1\u05DE\u05DA \u05D4\u05E8\u05E6\u05D0\u05D4 \u05DC\u05E9\u05D9\u05E2\u05D5\u05E8"
  },
  "HUB_TEXT.fileTopicEmpty": {
    en: "This document topic has no file yet.",
    he: "\u05DC\u05E0\u05D5\u05E9\u05D0 \u05D4\u05DE\u05E1\u05DE\u05DA \u05D4\u05D6\u05D4 \u05E2\u05D3\u05D9\u05D9\u05DF \u05D0\u05D9\u05DF \u05E7\u05D5\u05D1\u05E5."
  },
  "HUB_TEXT.attachmentTypeRefused": {
    en: "This file type is not supported",
    he: "\u05E1\u05D5\u05D2 \u05D4\u05E7\u05D5\u05D1\u05E5 \u05D0\u05D9\u05E0\u05D5 \u05E0\u05EA\u05DE\u05DA"
  },
  "HUB_TEXT.attachFileChoose": {
    en: "Choose a file",
    he: "\u05D1\u05D7\u05D9\u05E8\u05EA \u05E7\u05D5\u05D1\u05E5"
  },
  "HUB_TEXT.attachFileChange": {
    en: "Change file",
    he: "\u05D4\u05D7\u05DC\u05E4\u05EA \u05E7\u05D5\u05D1\u05E5"
  },
  "HUB_TEXT.topicKindPlayer": {
    en: "Step player",
    he: "\u05E0\u05D2\u05DF \u05E9\u05DC\u05D1\u05D9\u05DD"
  },
  "HUB_TEXT.funnyTopicName1": {
    en: "I was too lazy to name my topic",
    he: "\u05D4\u05D9\u05D9\u05EA\u05D9 \u05E2\u05E6\u05DC\u05DF \u05DE\u05D3\u05D9 \u05DC\u05EA\u05EA \u05E9\u05DD \u05DC\u05E0\u05D5\u05E9\u05D0 \u05E9\u05DC\u05D9"
  },
  "HUB_TEXT.funnyTopicName2": {
    en: "Untitled, but make it fancy",
    he: "\u05DC\u05DC\u05D0 \u05DB\u05D5\u05EA\u05E8\u05EA, \u05D0\u05D1\u05DC \u05D1\u05E1\u05D8\u05D9\u05D9\u05DC"
  },
  "HUB_TEXT.funnyTopicName3": {
    en: "The topic formerly known as nameless",
    he: "\u05D4\u05E0\u05D5\u05E9\u05D0 \u05E9\u05E4\u05E2\u05DD \u05D4\u05D9\u05D4 \u05D1\u05DC\u05D9 \u05E9\u05DD"
  },
  "HUB_TEXT.funnyTopicName4": {
    en: "Final final v2 (really)",
    he: "\u05E1\u05D5\u05E4\u05D9 \u05E1\u05D5\u05E4\u05D9 v2 (\u05D1\u05D0\u05DE\u05EA)"
  },
  "HUB_TEXT.funnyTopicName5": {
    en: "Name TBD, vibes confirmed",
    he: "\u05D4\u05E9\u05DD \u05D9\u05D9\u05E7\u05D1\u05E2, \u05D4\u05D0\u05D5\u05D5\u05D9\u05E8\u05D4 \u05D0\u05D5\u05E9\u05E8\u05D4"
  },
  "HUB_TEXT.funnyTopicName6": {
    en: "Somebody please name me",
    he: "\u05DE\u05D9\u05E9\u05D4\u05D5 \u05D1\u05D1\u05E7\u05E9\u05D4 \u05D9\u05D9\u05EA\u05DF \u05DC\u05D9 \u05E9\u05DD"
  },
  "HUB_TEXT.funnyTopicName7": {
    en: "Nameless topic, big energy",
    he: "\u05E0\u05D5\u05E9\u05D0 \u05D1\u05DC\u05D9 \u05E9\u05DD, \u05D0\u05E0\u05E8\u05D2\u05D9\u05D4 \u05D2\u05D3\u05D5\u05DC\u05D4"
  },
  "HUB_TEXT.funnyTopicName8": {
    en: "I typed nothing and it still worked",
    he: "\u05DC\u05D0 \u05D4\u05E7\u05DC\u05D3\u05EA\u05D9 \u05DB\u05DC\u05D5\u05DD \u05D5\u05D6\u05D4 \u05E2\u05D3\u05D9\u05D9\u05DF \u05E2\u05D1\u05D3"
  },
  "HUB_TEXT.attachmentsLabel": {
    en: "Lecture documents",
    he: "\u05DE\u05E1\u05DE\u05DB\u05D9 \u05D4\u05E8\u05E6\u05D0\u05D4"
  },
  "HUB_TEXT.attachmentsEmpty": {
    en: "No documents yet. Attach PDF, Word or PowerPoint files.",
    he: "\u05D0\u05D9\u05DF \u05DE\u05E1\u05DE\u05DB\u05D9\u05DD \u05E2\u05D3\u05D9\u05D9\u05DF. \u05E6\u05E8\u05E4\u05D5 \u05E7\u05D1\u05E6\u05D9 PDF, Word \u05D0\u05D5 PowerPoint."
  },
  "HUB_TEXT.attachmentAdd": {
    en: "Attach file",
    he: "\u05E6\u05D9\u05E8\u05D5\u05E3 \u05E7\u05D5\u05D1\u05E5"
  },
  "HUB_TEXT.attachmentRemove": {
    en: "Remove",
    he: "\u05D4\u05E1\u05E8\u05D4"
  },
  "HUB_TEXT.topicTypeLabel": {
    en: "Topic type",
    he: "\u05E1\u05D5\u05D2 \u05E0\u05D5\u05E9\u05D0"
  },
  "HUB_TEXT.topicTypeCanvasHint": {
    en: "Freeform diagrams, tables and formulas",
    he: "\u05D3\u05D9\u05D0\u05D2\u05E8\u05DE\u05D5\u05EA \u05D7\u05D5\u05E4\u05E9\u05D9\u05D5\u05EA, \u05D8\u05D1\u05DC\u05D0\u05D5\u05EA \u05D5\u05E0\u05D5\u05E1\u05D7\u05D0\u05D5\u05EA"
  },
  "HUB_TEXT.topicTypePlayerHint": {
    en: "Interactive step-by-step animation",
    he: "\u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D4 \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9\u05EA \u05E9\u05DC\u05D1 \u05D0\u05D7\u05E8 \u05E9\u05DC\u05D1"
  },
  "HUB_TEXT.importArchiveTitle": {
    en: "Import archive",
    he: "\u05D9\u05D9\u05D1\u05D5\u05D0 \u05D0\u05E8\u05DB\u05D9\u05D5\u05DF"
  },
  "HUB_TEXT.importArchiveChoose": {
    en: "Choose ZIP file",
    he: "\u05D1\u05D7\u05D9\u05E8\u05EA \u05E7\u05D5\u05D1\u05E5 ZIP"
  },
  "HUB_TEXT.importKindCourse": {
    en: "Single Course",
    he: "\u05E7\u05D5\u05E8\u05E1 \u05D1\u05D5\u05D3\u05D3"
  },
  "HUB_TEXT.importKindCourses": {
    en: "Course Bundle",
    he: "\u05D7\u05D1\u05D9\u05DC\u05EA \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD"
  },
  "HUB_TEXT.importKindBackup": {
    en: "Full Backup",
    he: "\u05D2\u05D9\u05D1\u05D5\u05D9 \u05DE\u05DC\u05D0"
  },
  "HUB_TEXT.importConflictLabel": {
    en: "Conflict resolution",
    he: "\u05E4\u05EA\u05E8\u05D5\u05DF \u05D4\u05EA\u05E0\u05D2\u05E9\u05D5\u05D9\u05D5\u05EA"
  },
  "HUB_TEXT.importPolicySkip": {
    en: "Skip existing",
    he: "\u05D3\u05DC\u05D2 \u05E2\u05DC \u05E7\u05D9\u05D9\u05DD"
  },
  "HUB_TEXT.importPolicyReplace": {
    en: "Replace existing",
    he: "\u05D4\u05D7\u05DC\u05E3 \u05E7\u05D9\u05D9\u05DD"
  },
  "HUB_TEXT.importPolicyDuplicate": {
    en: "Import as copy (new ID)",
    he: "\u05D9\u05D9\u05D1\u05D0 \u05DB\u05E2\u05D5\u05EA\u05E7 (\u05DE\u05D6\u05D4\u05D4 \u05D7\u05D3\u05E9)"
  },
  "HUB_TEXT.importConfirm": {
    en: "Import now",
    he: "\u05D9\u05D9\u05D1\u05D5\u05D0 \u05E2\u05DB\u05E9\u05D9\u05D5"
  },
  "HUB_TEXT.importPartialNone": {
    en: "No courses imported",
    he: "\u05DC\u05D0 \u05D9\u05D5\u05D1\u05D0\u05D5 \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD"
  },
  "HUB_TEXT.importErrorUnsupportedVersion": {
    en: "Archive format is newer than supported; please update the app",
    he: "\u05D2\u05E8\u05E1\u05EA \u05E4\u05D5\u05E8\u05DE\u05D8 \u05D4\u05D0\u05E8\u05DB\u05D9\u05D5\u05DF \u05D7\u05D3\u05E9\u05D4 \u05DE\u05D4\u05E0\u05EA\u05DE\u05DB\u05EA; \u05D0\u05E0\u05D0 \u05E2\u05D3\u05DB\u05E0\u05D5 \u05D0\u05EA \u05D4\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4"
  },
  "HUB_TEXT.importErrorCorrupt": {
    en: "File is not a valid zip archive or is corrupted",
    he: "\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D0\u05D9\u05E0\u05D5 \u05D0\u05E8\u05DB\u05D9\u05D5\u05DF ZIP \u05EA\u05E7\u05D9\u05DF \u05D0\u05D5 \u05E4\u05D2\u05D5\u05DD"
  },
  "HUB_TEXT.importErrorUnsafe": {
    en: "Archive contains unsafe file paths",
    he: "\u05D4\u05D0\u05E8\u05DB\u05D9\u05D5\u05DF \u05DE\u05DB\u05D9\u05DC \u05E0\u05EA\u05D9\u05D1\u05D9\u05DD \u05DC\u05D0 \u05D1\u05D8\u05D5\u05D7\u05D9\u05DD"
  },
  "HUB_TEXT.importErrorTooLarge": {
    en: "Archive size exceeds upload limits",
    he: "\u05D2\u05D5\u05D3\u05DC \u05D4\u05D0\u05E8\u05DB\u05D9\u05D5\u05DF \u05D7\u05D5\u05E8\u05D2 \u05DE\u05D4\u05DE\u05D2\u05D1\u05DC\u05D4"
  },
  "MCP_TEXT.tabMcp": {
    en: "StudyTs-MCP",
    he: "StudyTs-MCP"
  },
  "MCP_TEXT.tabAiProvider": {
    en: "AI Provider",
    he: "\u05E1\u05E4\u05E7 AI"
  },
  "MCP_TEXT.mcpTitle": {
    en: "StudyTs-MCP Daemon",
    he: "\u05D3\u05DE\u05D5\u05DF StudyTs-MCP"
  },
  "MCP_TEXT.mcpSubtitle": {
    en: "Unified local daemon connecting tools, database, and notebooks directly to the AI assistant.",
    he: "\u05D3\u05DE\u05D5\u05DF \u05DE\u05E7\u05D5\u05DE\u05D9 \u05DE\u05D0\u05D5\u05D7\u05D3 \u05D4\u05DE\u05D7\u05D1\u05E8 \u05DB\u05DC\u05D9\u05DD, \u05DE\u05E1\u05D3 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D5\u05DE\u05D7\u05D1\u05E8\u05D5\u05EA \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05DC\u05E2\u05D5\u05D6\u05E8 \u05D4-AI."
  },
  "MCP_TEXT.addServer": {
    en: "Add MCP Server",
    he: "\u05D4\u05D5\u05E1\u05E3 \u05E9\u05E8\u05EA MCP"
  },
  "MCP_TEXT.serverName": {
    en: "Server Name",
    he: "\u05E9\u05DD \u05D4\u05E9\u05E8\u05EA"
  },
  "MCP_TEXT.command": {
    en: "Command",
    he: "\u05E4\u05E7\u05D5\u05D3\u05D4"
  },
  "MCP_TEXT.args": {
    en: "Arguments (space separated)",
    he: "\u05D0\u05E8\u05D2\u05D5\u05DE\u05E0\u05D8\u05D9\u05DD (\u05DE\u05D5\u05E4\u05E8\u05D3\u05D9\u05DD \u05D1\u05E8\u05D5\u05D5\u05D7)"
  },
  "MCP_TEXT.autoStart": {
    en: "Auto-start with backend",
    he: "\u05D4\u05E4\u05E2\u05DC \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05E2\u05DD \u05D4\u05E9\u05E8\u05EA"
  },
  "MCP_TEXT.statusConnected": {
    en: "Connected",
    he: "\u05DE\u05D7\u05D5\u05D1\u05E8"
  },
  "MCP_TEXT.statusConnecting": {
    en: "Connecting...",
    he: "\u05DE\u05EA\u05D7\u05D1\u05E8..."
  },
  "MCP_TEXT.statusStopped": {
    en: "Stopped",
    he: "\u05DE\u05D5\u05E4\u05E1\u05E7"
  },
  "MCP_TEXT.statusError": {
    en: "Error",
    he: "\u05E9\u05D2\u05D9\u05D0\u05D4"
  },
  "MCP_TEXT.start": {
    en: "Start",
    he: "\u05D4\u05E4\u05E2\u05DC"
  },
  "MCP_TEXT.stop": {
    en: "Stop",
    he: "\u05E2\u05E6\u05D5\u05E8"
  },
  "MCP_TEXT.ping": {
    en: "Ping",
    he: "\u05D1\u05D3\u05D9\u05E7\u05EA \u05E7\u05E9\u05E8"
  },
  "MCP_TEXT.delete": {
    en: "Delete",
    he: "\u05DE\u05D7\u05E7"
  },
  "MCP_TEXT.toolsCount": {
    en: "{count} tools available",
    he: "{count} \u05DB\u05DC\u05D9\u05DD \u05D6\u05DE\u05D9\u05E0\u05D9\u05DD"
  },
  "MCP_TEXT.noServers": {
    en: "StudyTs-MCP is not running.",
    he: "StudyTs-MCP \u05D0\u05D9\u05E0\u05D5 \u05E4\u05D5\u05E2\u05DC \u05DB\u05E2\u05EA."
  },
  "MCP_TEXT.tutorialBtn": {
    en: "How StudyTs-MCP Works",
    he: "\u05D0\u05D9\u05DA StudyTs-MCP \u05E4\u05D5\u05E2\u05DC"
  },
  "MCP_TEXT.tutorialTitle": {
    en: "StudyTs-MCP Architecture & Guide",
    he: "\u05D0\u05E8\u05DB\u05D9\u05D8\u05E7\u05D8\u05D5\u05E8\u05D4 \u05D5\u05DE\u05D3\u05E8\u05D9\u05DA StudyTs-MCP"
  },
  "MCP_TEXT.step1Title": {
    en: "1. What is StudyTs-MCP?",
    he: "1. \u05DE\u05D4 \u05D6\u05D4 StudyTs-MCP?"
  },
  "MCP_TEXT.step1Desc": {
    en: "StudyTs-MCP is a unified local daemon running on your machine over stdio JSON-RPC. It connects the AI assistant directly to your local database, notebooks, and course content without cloud lock-in.",
    he: "StudyTs-MCP \u05D4\u05D5\u05D0 \u05D3\u05DE\u05D5\u05DF \u05DE\u05E7\u05D5\u05DE\u05D9 \u05DE\u05D0\u05D5\u05D7\u05D3 \u05D4\u05E4\u05D5\u05E2\u05DC \u05D1\u05DE\u05D7\u05E9\u05D1\u05DA \u05DE\u05E2\u05DC stdio JSON-RPC. \u05D4\u05D5\u05D0 \u05DE\u05D7\u05D1\u05E8 \u05D0\u05EA \u05E2\u05D5\u05D6\u05E8 \u05D4-AI \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05DC\u05DE\u05E1\u05D3 \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD, \u05DC\u05DE\u05D7\u05D1\u05E8\u05D5\u05EA \u05D5\u05DC\u05EA\u05D5\u05DB\u05DF \u05D4\u05E7\u05D5\u05E8\u05E1\u05D9\u05DD \u05DC\u05DC\u05D0 \u05EA\u05DC\u05D5\u05EA \u05D1\u05E2\u05E0\u05DF."
  },
  "MCP_TEXT.step2Title": {
    en: "2. Unified Domains & Capabilities",
    he: "2. \u05EA\u05D7\u05D5\u05DE\u05D9 \u05D0\u05D7\u05E8\u05D9\u05D5\u05EA \u05D5\u05D9\u05DB\u05D5\u05DC\u05D5\u05EA"
  },
  "MCP_TEXT.step2Desc": {
    en: "StudyTs-MCP groups all 12 tools into 3 distinct domains: Research & Notebooks, SQLite Course Database, and Course Authoring.",
    he: "StudyTs-MCP \u05DE\u05D0\u05D2\u05D3 \u05D0\u05EA \u05DB\u05DC 12 \u05D4\u05DB\u05DC\u05D9\u05DD \u05EA\u05D7\u05EA 3 \u05EA\u05D7\u05D5\u05DE\u05D9\u05DD: \u05DE\u05D7\u05E7\u05E8 \u05D5\u05DE\u05D7\u05D1\u05E8\u05D5\u05EA, \u05DE\u05E1\u05D3 \u05E0\u05EA\u05D5\u05E0\u05D9 \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD \u05D1-SQLite, \u05D5\u05D9\u05E6\u05D9\u05E8\u05EA \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD."
  },
  "MCP_TEXT.step3Title": {
    en: "3. Live Daemon Test",
    he: "3. \u05D1\u05D3\u05D9\u05E7\u05EA \u05D3\u05DE\u05D5\u05DF \u05D7\u05D9\u05D4"
  },
  "MCP_TEXT.step3Desc": {
    en: "Run an instant, side-effect-free test query against the running StudyTs-MCP daemon.",
    he: "\u05D4\u05E8\u05E5 \u05E9\u05D0\u05D9\u05DC\u05EA\u05EA \u05D1\u05D3\u05D9\u05E7\u05D4 \u05DE\u05D9\u05D9\u05D3\u05D9\u05EA \u05D5\u05E0\u05E7\u05D9\u05D9\u05D4 \u05DE\u05EA\u05D5\u05E4\u05E2\u05D5\u05EA \u05DC\u05D5\u05D5\u05D0\u05D9 \u05DE\u05D5\u05DC \u05D3\u05DE\u05D5\u05DF StudyTs-MCP \u05D4\u05E4\u05E2\u05D9\u05DC."
  },
  "MCP_TEXT.testSnippetPlaceholder": {
    en: "Enter query or leave blank to test...",
    he: "\u05D4\u05D6\u05DF \u05E9\u05D0\u05D9\u05DC\u05EA\u05D4 \u05D0\u05D5 \u05D4\u05E9\u05D0\u05E8 \u05E8\u05D9\u05E7 \u05DC\u05D1\u05D3\u05D9\u05E7\u05D4..."
  },
  "MCP_TEXT.testSendBtn": {
    en: "Run Daemon Test",
    he: "\u05D4\u05E8\u05E5 \u05D1\u05D3\u05D9\u05E7\u05EA \u05D3\u05DE\u05D5\u05DF"
  },
  "MCP_TEXT.sending": {
    en: "Sending...",
    he: "\u05E9\u05D5\u05DC\u05D7..."
  },
  "MCP_TEXT.testSuccess": {
    en: "StudyTs-MCP daemon responded successfully!",
    he: "\u05D3\u05DE\u05D5\u05DF StudyTs-MCP \u05D4\u05D2\u05D9\u05D1 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4!"
  },
  "MCP_TEXT.testFailed": {
    en: "Test failed:",
    he: "\u05D4\u05D1\u05D3\u05D9\u05E7\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4:"
  },
  "MCP_TEXT.close": {
    en: "Close",
    he: "\u05E1\u05D2\u05D5\u05E8"
  },
  "MCP_TEXT.nextStep": {
    en: "Next",
    he: "\u05D4\u05D1\u05D0"
  },
  "MCP_TEXT.prevStep": {
    en: "Back",
    he: "\u05D7\u05D6\u05D5\u05E8"
  },
  "MCP_TEXT.saveServer": {
    en: "Save Server",
    he: "\u05E9\u05DE\u05D5\u05E8 \u05E9\u05E8\u05EA"
  },
  "MCP_TEXT.cancel": {
    en: "Cancel",
    he: "\u05D1\u05D9\u05D8\u05D5\u05DC"
  },
  "MCP_TEXT.activeTools": {
    en: "Active Tools",
    he: "\u05DB\u05DC\u05D9\u05DD \u05E4\u05E2\u05D9\u05DC\u05D9\u05DD"
  },
  "MCP_TEXT.domainNotebooks": {
    en: "Research & Notebooks",
    he: "\u05DE\u05D7\u05E7\u05E8 \u05D5\u05DE\u05D7\u05D1\u05E8\u05D5\u05EA"
  },
  "MCP_TEXT.domainDatabase": {
    en: "Course Database",
    he: "\u05DE\u05E1\u05D3 \u05E0\u05EA\u05D5\u05E0\u05D9 \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD"
  },
  "MCP_TEXT.domainAuthoring": {
    en: "Course Authoring",
    he: "\u05D9\u05E6\u05D9\u05E8\u05EA \u05D5\u05E2\u05E8\u05D9\u05DB\u05EA \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD"
  },
  "MCP_TEXT.howItWorksTitle": {
    en: "How StudyTs-MCP Works",
    he: "\u05D0\u05D9\u05DA StudyTs-MCP \u05E4\u05D5\u05E2\u05DC"
  },
  "MCP_TEXT.howItWorksSubtitle": {
    en: "Local-first, model-agnostic MCP integration pipeline",
    he: "\u05E6\u05D9\u05E0\u05D5\u05E8 \u05D0\u05D9\u05E0\u05D8\u05D2\u05E8\u05E6\u05D9\u05D4 MCP \u05DE\u05E7\u05D5\u05DE\u05D9 \u05D5\u05D1\u05DC\u05EA\u05D9-\u05EA\u05DC\u05D5\u05D9 \u05D1\u05DE\u05D5\u05D3\u05DC"
  },
  "MCP_TEXT.architectureClient": {
    en: "AI Chat Assistant",
    he: "\u05E2\u05D5\u05D6\u05E8 \u05E9\u05D9\u05D7\u05EA AI"
  },
  "MCP_TEXT.architectureClientDesc": {
    en: "Web UI invokes tools during study & course authoring",
    he: "\u05DE\u05DE\u05E9\u05E7 \u05D4\u05DE\u05E9\u05EA\u05DE\u05E9 \u05DE\u05E4\u05E2\u05D9\u05DC \u05DB\u05DC\u05D9\u05DD \u05D1\u05D6\u05DE\u05DF \u05DC\u05D9\u05DE\u05D5\u05D3 \u05D5\u05E2\u05E8\u05D9\u05DB\u05EA \u05E7\u05D5\u05E8\u05E1\u05D9\u05DD"
  },
  "MCP_TEXT.architectureGateway": {
    en: "Express API Gateway",
    he: "\u05E9\u05E2\u05E8 \u05D4-API \u05E9\u05DC Express"
  },
  "MCP_TEXT.architectureGatewayDesc": {
    en: "Routes /api/mcp calls over stdio JSON-RPC",
    he: "\u05DE\u05E0\u05EA\u05D1 \u05E7\u05E8\u05D9\u05D0\u05D5\u05EA \u05D1\u05E0\u05EA\u05D9\u05D1 /api/mcp \u05DE\u05E2\u05DC stdio \u05D1-JSON-RPC"
  },
  "MCP_TEXT.architectureDaemon": {
    en: "StudyTs-MCP Daemon",
    he: "\u05D3\u05DE\u05D5\u05DF StudyTs-MCP"
  },
  "MCP_TEXT.architectureDaemonDesc": {
    en: "Single background process managing 12 domain tools",
    he: "\u05EA\u05D4\u05DC\u05D9\u05DA \u05E8\u05E7\u05E2 \u05D9\u05D7\u05D9\u05D3 \u05D4\u05DE\u05E0\u05D4\u05DC 12 \u05DB\u05DC\u05D9 \u05EA\u05D7\u05D5\u05DD \u05DE\u05E7\u05D5\u05DE\u05D9\u05D9\u05DD"
  },
  "MCP_TEXT.architectureStorage": {
    en: "Local Database & Files",
    he: "\u05DE\u05E1\u05D3 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D5\u05E7\u05D1\u05E6\u05D9\u05DD \u05DE\u05E7\u05D5\u05DE\u05D9\u05D9\u05DD"
  },
  "MCP_TEXT.architectureStorageDesc": {
    en: "Read-only SQLite and atomic data/ file operations",
    he: "\u05E9\u05D0\u05D9\u05DC\u05EA\u05D5\u05EA SQLite \u05DC\u05E7\u05E8\u05D9\u05D0\u05D4 \u05D1\u05DC\u05D1\u05D3 \u05D5\u05E9\u05DE\u05D9\u05E8\u05EA \u05E7\u05D1\u05E6\u05D9\u05DD \u05D0\u05D8\u05D5\u05DE\u05D9\u05EA \u05D1-data/"
  },
  "PATCH_NOTES_TEXT.patchNotesTitle": {
    en: "Platform Updates & Patch Notes",
    he: "\u05E2\u05D3\u05DB\u05D5\u05E0\u05D9 \u05DE\u05E2\u05E8\u05DB\u05EA \u05D5\u05D9\u05D5\u05DE\u05DF \u05D2\u05E8\u05E1\u05D0\u05D5\u05EA"
  },
  "PATCH_NOTES_TEXT.patchNotesVersion": {
    en: "Version 2.4.0",
    he: "\u05D2\u05E8\u05E1\u05D4 2.4.0"
  },
  "PATCH_NOTES_TEXT.patchNotesDesc": {
    en: "Interactive Canvas improvements, Nocturne theme integration, and Docker verification engine.",
    he: "\u05E9\u05D9\u05E4\u05D5\u05E8\u05D9 \u05E7\u05E0\u05D1\u05E1 \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9, \u05E2\u05D9\u05E6\u05D5\u05D1 Nocturne \u05D5\u05DE\u05E0\u05D5\u05E2 \u05D0\u05D9\u05DE\u05D5\u05EA Docker."
  },
  "PLAYER_TEXT.activeStep": {
    en: "Active Step",
    he: "\u05E9\u05DC\u05D1 \u05E0\u05D5\u05DB\u05D7\u05D9"
  },
  "PLAYER_TEXT.stepPlayer": {
    en: "Step Player",
    he: "\u05E0\u05D2\u05DF \u05E9\u05DC\u05D1\u05D9\u05DD"
  },
  "PLAYER_TEXT.whatChanged": {
    en: "What changed",
    he: "\u05DE\u05D4 \u05D4\u05E9\u05EA\u05E0\u05D4"
  },
  "PLAYER_TEXT.why": {
    en: "Why",
    he: "\u05DE\u05D3\u05D5\u05E2"
  },
  "PLAYER_TEXT.speedLabel": {
    en: "Speed",
    he: "\u05DE\u05D4\u05D9\u05E8\u05D5\u05EA"
  },
  "PLAYER_TEXT.fullscreen": {
    en: "Fullscreen",
    he: "\u05DE\u05E1\u05DA \u05DE\u05DC\u05D0"
  },
  "PLAYER_TEXT.exitFullscreen": {
    en: "Exit Fullscreen",
    he: "\u05D9\u05E6\u05D9\u05D0\u05D4 \u05DE\u05DE\u05E1\u05DA \u05DE\u05DC\u05D0"
  },
  "PLAYER_TEXT.failedToLoad": {
    en: "Failed to load visual model",
    he: "\u05D8\u05E2\u05D9\u05E0\u05EA \u05D4\u05DE\u05D5\u05D3\u05DC \u05D4\u05D7\u05D6\u05D5\u05EA\u05D9 \u05E0\u05DB\u05E9\u05DC\u05D4"
  },
  "PLAYER_TEXT.reset": {
    en: "Reset",
    he: "\u05D0\u05D9\u05E4\u05D5\u05E1"
  },
  "PLAYER_TEXT.previous": {
    en: "Previous",
    he: "\u05D4\u05E7\u05D5\u05D3\u05DD"
  },
  "PLAYER_TEXT.next": {
    en: "Next",
    he: "\u05D4\u05D1\u05D0"
  },
  "PLAYER_TEXT.play": {
    en: "Play",
    he: "\u05E0\u05D9\u05D2\u05D5\u05DF"
  },
  "PLAYER_TEXT.pause": {
    en: "Pause",
    he: "\u05D4\u05E9\u05D4\u05D9\u05D4"
  },
  "PLAYER_TEXT.scrubber": {
    en: "Preview scrubber",
    he: "\u05DE\u05D7\u05D5\u05D5\u05DF \u05D4\u05EA\u05E6\u05D5\u05D2\u05D4 \u05D4\u05DE\u05E7\u05D3\u05D9\u05DE\u05D4"
  },
  "PLAYER_TEXT.part": {
    en: "Part",
    he: "\u05E7\u05D8\u05E2"
  },
  "PLAYER_TEXT.partTitle": {
    en: "Play only a part of this step",
    he: "\u05E0\u05D2\u05E0\u05D5 \u05E8\u05E7 \u05E7\u05D8\u05E2 \u05DE\u05D4\u05E9\u05DC\u05D1 \u05D4\u05D6\u05D4"
  },
  "PLAYER_TEXT.loop": {
    en: "Loop",
    he: "\u05D7\u05D6\u05E8\u05D4"
  },
  "PLAYER_TEXT.loopTitle": {
    en: "Repeat the part",
    he: "\u05D7\u05D6\u05E8\u05D4 \u05E2\u05DC \u05D4\u05E7\u05D8\u05E2"
  },
  "PLAYER_TEXT.milliseconds": {
    en: "{value} ms",
    he: "{value} \u05DE\u05F4\u05E9"
  },
  "PLAYER_TEXT.seconds": {
    en: "{value}s",
    he: "{value} \u05E9\u05E0\u05F3"
  },
  "SETTINGS_TEXT.settingsTitle": {
    en: "Settings",
    he: "\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA"
  },
  "SETTINGS_TEXT.tabAppearance": {
    en: "Appearance & Theme",
    he: "\u05E2\u05D9\u05E6\u05D5\u05D1 \u05D5\u05E2\u05E8\u05DB\u05EA \u05E0\u05D5\u05E9\u05D0"
  },
  "SETTINGS_TEXT.tabAi": {
    en: "AI Assistant",
    he: "\u05E2\u05D5\u05D6\u05E8 AI"
  },
  "SETTINGS_TEXT.tabMcp": {
    en: "MCP Integrations",
    he: "\u05D7\u05D9\u05D1\u05D5\u05E8\u05D9 MCP"
  },
  "SETTINGS_TEXT.tabStorage": {
    en: "Storage & Data",
    he: "\u05D0\u05D7\u05E1\u05D5\u05DF \u05D5\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD"
  },
  "SETTINGS_TEXT.tabLogs": {
    en: "Logs & Diagnostics",
    he: "\u05D9\u05D5\u05DE\u05E0\u05D9 \u05DE\u05E2\u05E8\u05DB\u05EA \u05D5\u05D3\u05D9\u05D0\u05D2\u05E0\u05D5\u05E1\u05D8\u05D9\u05E7\u05D4"
  },
  "SETTINGS_TEXT.popoutLogs": {
    en: "Pop out to window",
    he: "\u05E4\u05EA\u05D7 \u05D1\u05D7\u05DC\u05D5\u05DF \u05E0\u05E4\u05E8\u05D3"
  },
  "SETTINGS_TEXT.dockLogs": {
    en: "Dock to settings",
    he: "\u05D4\u05D7\u05D6\u05E8 \u05DC\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA"
  },
  "SETTINGS_TEXT.refreshLogs": {
    en: "Refresh",
    he: "\u05E8\u05E2\u05E0\u05DF"
  },
  "SETTINGS_TEXT.autoRefreshLogs": {
    en: "Auto refresh",
    he: "\u05E8\u05E2\u05E0\u05D5\u05DF \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9"
  },
  "SETTINGS_TEXT.autoScrollLogs": {
    en: "Auto-scroll",
    he: "\u05D2\u05DC\u05D9\u05DC\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA"
  },
  "SETTINGS_TEXT.scrollToBottom": {
    en: "Scroll to bottom",
    he: "\u05D2\u05DC\u05D5\u05DC \u05DC\u05EA\u05D7\u05EA\u05D9\u05EA"
  },
  "SETTINGS_TEXT.copyLogs": {
    en: "Copy",
    he: "\u05D4\u05E2\u05EA\u05E7"
  },
  "SETTINGS_TEXT.copiedLogs": {
    en: "Copied!",
    he: "\u05D4\u05D5\u05E2\u05EA\u05E7!"
  },
  "SETTINGS_TEXT.runLogsTab": {
    en: "Current Run",
    he: "\u05E8\u05D9\u05E6\u05D4 \u05E0\u05D5\u05DB\u05D7\u05D9\u05EA"
  },
  "SETTINGS_TEXT.runtimeErrorsTab": {
    en: "Runtime Errors",
    he: "\u05E9\u05D2\u05D9\u05D0\u05D5\u05EA \u05D6\u05DE\u05DF \u05E8\u05D9\u05E6\u05D4"
  },
  "SETTINGS_TEXT.allRunsTab": {
    en: "All Runs",
    he: "\u05DB\u05DC \u05D4\u05E8\u05D9\u05E6\u05D5\u05EA"
  },
  "SETTINGS_TEXT.searchLogs": {
    en: "Search logs...",
    he: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05D1\u05D9\u05D5\u05DE\u05E0\u05D9\u05DD..."
  },
  "SETTINGS_TEXT.noLogs": {
    en: "No logs recorded yet.",
    he: "\u05D0\u05D9\u05DF \u05D9\u05D5\u05DE\u05E0\u05D9\u05DD \u05E2\u05D3\u05D9\u05D9\u05DF."
  },
  "SETTINGS_TEXT.accentColor": {
    en: "Accent Color",
    he: "\u05E6\u05D1\u05E2 \u05D4\u05D3\u05D2\u05E9\u05D4"
  },
  "SETTINGS_TEXT.themeMode": {
    en: "Light / Dark Mode",
    he: "\u05DE\u05E6\u05D1 \u05D1\u05D4\u05D9\u05E8 / \u05DB\u05D4\u05D4"
  },
  "SETTINGS_TEXT.themeModeLight": {
    en: "Light",
    he: "\u05D1\u05D4\u05D9\u05E8"
  },
  "SETTINGS_TEXT.themeModeDark": {
    en: "Dark",
    he: "\u05DB\u05D4\u05D4"
  },
  "SETTINGS_TEXT.language": {
    en: "Language",
    he: "\u05E9\u05E4\u05D4"
  },
  "SETTINGS_TEXT.selectLanguage": {
    en: "Select Language",
    he: "\u05D1\u05D7\u05E8 \u05E9\u05E4\u05D4"
  },
  "SETTINGS_TEXT.hebrew": {
    en: "Hebrew",
    he: "\u05E2\u05D1\u05E8\u05D9\u05EA"
  },
  "SETTINGS_TEXT.english": {
    en: "English",
    he: "\u05D0\u05E0\u05D2\u05DC\u05D9\u05EA"
  },
  "SETTINGS_TEXT.clearAutoSaves": {
    en: "Clear Canvas Auto-Saves",
    he: "\u05E0\u05E7\u05D4 \u05E9\u05DE\u05D9\u05E8\u05D5\u05EA \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05D5\u05EA \u05E9\u05DC \u05E7\u05E0\u05D1\u05E1"
  },
  "SETTINGS_TEXT.clearChatHistory": {
    en: "Clear AI Conversation History",
    he: "\u05E0\u05E7\u05D4 \u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D9\u05EA \u05E9\u05D9\u05D7\u05D5\u05EA AI"
  },
  "SETTINGS_TEXT.resetAll": {
    en: "Reset All Local Settings",
    he: "\u05D0\u05E4\u05E1 \u05D0\u05EA \u05DB\u05DC \u05D4\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA \u05D4\u05DE\u05E7\u05D5\u05DE\u05D9\u05D5\u05EA"
  },
  "SETTINGS_TEXT.clearedSuccess": {
    en: "Cleared successfully",
    he: "\u05E0\u05D5\u05E7\u05D4 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4"
  },
  "SETTINGS_TEXT.close": {
    en: "Close",
    he: "\u05E1\u05D2\u05D5\u05E8"
  },
  "STATUS_TEXT.accept": {
    en: "Accept",
    he: "\u05E7\u05D1\u05DC\u05D4"
  },
  "STATUS_TEXT.reject": {
    en: "Reject",
    he: "\u05D3\u05D7\u05D9\u05D9\u05D4"
  },
  "STATUS_TEXT.looping": {
    en: "Looping",
    he: "\u05DC\u05D5\u05DC\u05D0\u05D4 \u05D0\u05D9\u05E0\u05E1\u05D5\u05E4\u05D9\u05EA"
  },
  "STATUS_TEXT.currentState": {
    en: "Current State",
    he: "\u05DE\u05E6\u05D1 \u05E0\u05D5\u05DB\u05D7\u05D9"
  },
  "STATUS_TEXT.stepCount": {
    en: "Step Count",
    he: "\u05DE\u05D5\u05E0\u05D4 \u05E6\u05E2\u05D3\u05D9\u05DD"
  },
  "STATUS_TEXT.headPointer": {
    en: "Head Pointer",
    he: "\u05DE\u05D9\u05E7\u05D5\u05DD \u05E8\u05D0\u05E9"
  },
  "STATUS_TEXT.inputInstance": {
    en: "Input Instance",
    he: "\u05DE\u05D5\u05E4\u05E2 \u05E7\u05DC\u05D8"
  },
  "STATUS_TEXT.polyReduction": {
    en: "Polynomial Reduction",
    he: "\u05E8\u05D3\u05D5\u05E7\u05E6\u05D9\u05D4 \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05EA"
  },
  "STATUS_TEXT.targetDecider": {
    en: "Target Decider",
    he: "\u05DE\u05DB\u05E8\u05D9\u05E2 \u05D9\u05E2\u05D3"
  },
  "TOPICS_TEXT.recallPTitle": {
    en: "Class P Review",
    he: "\u05D7\u05D6\u05E8\u05D4 \u05E2\u05DC \u05D4\u05DE\u05D7\u05DC\u05E7\u05D4 P"
  },
  "TOPICS_TEXT.recallPDesc": {
    en: "Deterministic polynomial time decision problems and complexity characteristics.",
    he: "\u05D1\u05E2\u05D9\u05D5\u05EA \u05D4\u05DB\u05E8\u05E2\u05D4 \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05D0\u05DC\u05D9\u05D5\u05EA \u05D3\u05D8\u05E8\u05DE\u05D9\u05E0\u05D9\u05E1\u05D8\u05D9\u05D5\u05EA \u05D5\u05DE\u05D0\u05E4\u05D9\u05D9\u05E0\u05D9 \u05E1\u05D9\u05D1\u05D5\u05DB\u05D9\u05D5\u05EA."
  },
  "TOPICS_TEXT.timeHierarchyTitle": {
    en: "Time Hierarchy Theorem",
    he: "\u05DE\u05E9\u05E4\u05D8 \u05D4\u05D9\u05E8\u05E8\u05DB\u05D9\u05D9\u05EA \u05D4\u05D6\u05DE\u05DF"
  },
  "TOPICS_TEXT.timeHierarchyDesc": {
    en: "Deterministic time separation and simulation diagonalization visual proof.",
    he: "\u05D4\u05D5\u05DB\u05D7\u05D4 \u05D7\u05D6\u05D5\u05EA\u05D9\u05EA \u05DC\u05D4\u05E4\u05E8\u05D3\u05D4 \u05D1\u05D9\u05DF \u05DE\u05D7\u05DC\u05E7\u05D5\u05EA \u05D6\u05DE\u05DF \u05D5\u05D3\u05D9\u05D0\u05D2\u05D5\u05E0\u05DC\u05D9\u05D6\u05E6\u05D9\u05D4."
  },
  "TOPICS_TEXT.reductionPipelineTitle": {
    en: "Reduction Pipeline",
    he: "\u05E6\u05D9\u05E0\u05D5\u05E8 \u05E8\u05D3\u05D5\u05E7\u05E6\u05D9\u05D4"
  },
  "TOPICS_TEXT.reductionPipelineDesc": {
    en: "Step-by-step polynomial reduction mapping between computational problems.",
    he: "\u05DE\u05D9\u05E4\u05D5\u05D9 \u05E6\u05E2\u05D3-\u05D0\u05D7\u05E8-\u05E6\u05E2\u05D3 \u05E9\u05DC \u05E8\u05D3\u05D5\u05E7\u05E6\u05D9\u05D4 \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05EA \u05D1\u05D9\u05DF \u05D1\u05E2\u05D9\u05D5\u05EA \u05D7\u05D9\u05E9\u05D5\u05D1\u05D9\u05D5\u05EA."
  },
  "TOPICS_TEXT.gadgetGraphTitle": {
    en: "Gadget Graph Construction",
    he: "\u05D1\u05E0\u05D9\u05D9\u05EA \u05D2\u05E8\u05E3 \u05D2\u05D0\u05D3\u05D2\u05F3\u05D8\u05D9\u05DD"
  },
  "TOPICS_TEXT.gadgetGraphDesc": {
    en: "Visual clause-to-subgraph gadget transformations and verification.",
    he: "\u05D8\u05E8\u05E0\u05E1\u05E4\u05D5\u05E8\u05DE\u05E6\u05D9\u05D5\u05EA \u05D7\u05D6\u05D5\u05EA\u05D9\u05D5\u05EA \u05DE\u05E4\u05E1\u05D5\u05E7\u05D9\u05D5\u05EA \u05DC\u05EA\u05EA\u05D9-\u05D2\u05E8\u05E4\u05D9\u05DD \u05D5\u05D0\u05D9\u05DE\u05D5\u05EA."
  },
  "TOPICS_TEXT.dfsColoringTitle": {
    en: "DFS Graph Coloring",
    he: "\u05E6\u05D1\u05D9\u05E2\u05EA \u05D2\u05E8\u05E3 \u05D1-DFS"
  },
  "TOPICS_TEXT.dfsColoringDesc": {
    en: "Interactive 3-Colorability search and vertex constraint validation.",
    he: "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9 \u05DC\u05E6\u05D1\u05D9\u05E2\u05D4 \u05D1-3 \u05E6\u05D1\u05E2\u05D9\u05DD \u05D5\u05D1\u05D3\u05D9\u05E7\u05EA \u05D0\u05D9\u05DC\u05D5\u05E6\u05D9 \u05E6\u05DE\u05EA\u05D9\u05DD."
  },
  "CANVAS_TEXT.headerHidden": {
    en: "Header Hidden",
    he: "\u05DB\u05D5\u05EA\u05E8\u05EA \u05DE\u05D5\u05E1\u05EA\u05E8\u05EA"
  },
  "CANVAS_TEXT.headerVisible": {
    en: "Header Visible",
    he: "\u05DB\u05D5\u05EA\u05E8\u05EA \u05DE\u05D5\u05E6\u05D2\u05EA"
  },
  "CANVAS_TEXT.cardTitle": {
    en: "Card Title",
    he: "\u05DB\u05D5\u05EA\u05E8\u05EA \u05DB\u05E8\u05D8\u05D9\u05E1"
  },
  "CANVAS_TEXT.direction": {
    en: "Direction",
    he: "\u05DB\u05D9\u05D5\u05D5\u05DF"
  },
  "CANVAS_TEXT.untitledBlock": {
    en: "Untitled block...",
    he: "\u05D1\u05DC\u05D5\u05E7 \u05DC\u05DC\u05D0 \u05E9\u05DD..."
  },
  "CANVAS_TEXT.editBlock": {
    en: "Edit {kind} block",
    he: "\u05E2\u05E8\u05D5\u05DA \u05D1\u05DC\u05D5\u05E7 {kind}"
  },
  "CANVAS_TEXT.addBlock": {
    en: "Add Block",
    he: "\u05D4\u05D5\u05E1\u05E3 \u05D1\u05DC\u05D5\u05E7"
  },
  "CANVAS_TEXT.duplicate": {
    en: "Duplicate",
    he: "\u05E9\u05DB\u05E4\u05DC"
  },
  "CANVAS_TEXT.movePageTo": {
    en: "Move to page",
    he: "\u05D4\u05E2\u05D1\u05E8 \u05DC\u05E2\u05DE\u05D5\u05D3"
  },
  "CANVAS_TEXT.movePageLabel": {
    en: "Page {n}",
    he: "\u05E2\u05DE\u05D5\u05D3 {n}"
  },
  "CANVAS_TEXT.moveToNewPage": {
    en: "Move to new page",
    he: "\u05D4\u05E2\u05D1\u05E8 \u05DC\u05E2\u05DE\u05D5\u05D3 \u05D7\u05D3\u05E9"
  },
  "CANVAS_TEXT.delete": {
    en: "Delete",
    he: "\u05DE\u05D7\u05E7"
  },
  "CANVAS_TEXT.lock": {
    en: "Lock",
    he: "\u05E0\u05E2\u05DC"
  },
  "CANVAS_TEXT.unlock": {
    en: "Unlock",
    he: "\u05D1\u05D8\u05DC \u05E0\u05E2\u05D9\u05DC\u05D4"
  },
  "CANVAS_TEXT.fitToContent": {
    en: "Fit to Content",
    he: "\u05D4\u05EA\u05D0\u05DD \u05DC\u05EA\u05D5\u05DB\u05DF"
  },
  "CANVAS_TEXT.autoHeight": {
    en: "Auto Height",
    he: "\u05D2\u05D5\u05D1\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9"
  },
  "CANVAS_TEXT.zoomIn": {
    en: "Zoom In",
    he: "\u05D4\u05D2\u05D3\u05DC"
  },
  "CANVAS_TEXT.zoomOut": {
    en: "Zoom Out",
    he: "\u05D4\u05E7\u05D8\u05DF"
  },
  "CANVAS_TEXT.resetZoom": {
    en: "Reset Zoom",
    he: "\u05D0\u05E4\u05E1 \u05EA\u05E6\u05D5\u05D2\u05D4"
  },
  "CANVAS_TEXT.stylePreset": {
    en: "Style Preset",
    he: "\u05E2\u05E8\u05DB\u05EA \u05E1\u05D2\u05E0\u05D5\u05DF"
  },
  "CANVAS_TEXT.custom": {
    en: "Custom",
    he: "\u05DE\u05D5\u05EA\u05D0\u05DD \u05D0\u05D9\u05E9\u05D9\u05EA"
  },
  "CANVAS_TEXT.newStylePlaceholder": {
    en: "New style name\u2026",
    he: "\u05E9\u05DD \u05E1\u05D2\u05E0\u05D5\u05DF \u05D7\u05D3\u05E9\u2026"
  },
  "CANVAS_TEXT.add": {
    en: "Add",
    he: "\u05D4\u05D5\u05E1\u05E3"
  },
  "CANVAS_PATTERNS_TEXT.blank": {
    en: "Clean Blank",
    he: "\u05E0\u05E7\u05D9 \u05DC\u05DC\u05D0 \u05E8\u05E9\u05EA"
  },
  "CANVAS_PATTERNS_TEXT.dots": {
    en: "Subtle Dots",
    he: "\u05E0\u05E7\u05D5\u05D3\u05D5\u05EA \u05E2\u05D3\u05D9\u05E0\u05D5\u05EA"
  },
  "CANVAS_PATTERNS_TEXT.grid": {
    en: "Square Grid",
    he: "\u05E8\u05E9\u05EA \u05DE\u05E9\u05D1\u05E6\u05D5\u05EA"
  },
  "CANVAS_PATTERNS_TEXT.isometric": {
    en: "Isometric",
    he: "\u05D0\u05D9\u05D6\u05D5\u05DE\u05D8\u05E8\u05D9"
  },
  "CANVAS_PATTERNS_TEXT.blueprint": {
    en: "Blueprint",
    he: "\u05E9\u05E8\u05D8\u05D5\u05D8 \u05D4\u05E0\u05D3\u05E1\u05D9"
  },
  "CANVAS_PATTERNS_TEXT.mesh": {
    en: "Gradient Mesh",
    he: "\u05E8\u05E9\u05EA \u05D2\u05E8\u05D3\u05D9\u05D0\u05E0\u05D8"
  },
  "CANVAS_PRESETS_TEXT.plain": {
    en: "Plain",
    he: "\u05E8\u05D2\u05D9\u05DC"
  },
  "CANVAS_PRESETS_TEXT.card": {
    en: "Card",
    he: "\u05DB\u05E8\u05D8\u05D9\u05E1"
  },
  "CANVAS_PRESETS_TEXT.proof": {
    en: "Formal Proof",
    he: "\u05D4\u05D5\u05DB\u05D7\u05D4 \u05E4\u05D5\u05E8\u05DE\u05DC\u05D9\u05EA"
  },
  "CANVAS_PRESETS_TEXT.callout": {
    en: "Callout",
    he: "\u05D4\u05E2\u05E8\u05EA \u05D4\u05D3\u05D2\u05E9\u05D4"
  },
  "CANVAS_PRESETS_TEXT.code": {
    en: "Code Block",
    he: "\u05D1\u05DC\u05D5\u05E7 \u05E7\u05D5\u05D3"
  },
  "CANVAS_HEADER_TEXT.editModeEnter": {
    en: "Edit Mode",
    he: "\u05DE\u05E6\u05D1 \u05E2\u05E8\u05D9\u05DB\u05D4"
  },
  "CANVAS_HEADER_TEXT.editModeExit": {
    en: "Exit Edit Mode",
    he: "\u05D9\u05E6\u05D9\u05D0\u05D4 \u05DE\u05E2\u05E8\u05D9\u05DB\u05D4"
  },
  "CANVAS_HEADER_TEXT.restoreSave": {
    en: "Restore last save",
    he: "\u05E9\u05D7\u05D6\u05E8 \u05E9\u05DE\u05D9\u05E8\u05D4 \u05D0\u05D7\u05E8\u05D5\u05E0\u05D4"
  },
  "CANVAS_HEADER_TEXT.restoring": {
    en: "Restoring...",
    he: "\u05DE\u05E9\u05D7\u05D6\u05E8..."
  },
  "CANVAS_HEADER_TEXT.noPreviousSave": {
    en: "No previous save to restore",
    he: "\u05D0\u05D9\u05DF \u05D2\u05E8\u05E1\u05D0\u05D5\u05EA \u05E7\u05D5\u05D3\u05DE\u05D5\u05EA \u05DC\u05E9\u05D7\u05D6\u05D5\u05E8"
  },
  "CANVAS_HEADER_TEXT.undo": {
    en: "Undo",
    he: "\u05D1\u05D8\u05DC"
  },
  "CANVAS_HEADER_TEXT.undoTooltip": {
    en: "Undo (Ctrl+Z)",
    he: "\u05D1\u05D8\u05DC (Ctrl+Z)"
  },
  "CANVAS_HEADER_TEXT.redo": {
    en: "Redo",
    he: "\u05D1\u05E6\u05E2 \u05E9\u05D5\u05D1"
  },
  "CANVAS_HEADER_TEXT.redoTooltip": {
    en: "Redo (Ctrl+Shift+Z)",
    he: "\u05D1\u05E6\u05E2 \u05E9\u05D5\u05D1 (Ctrl+Shift+Z)"
  },
  "CANVAS_HEADER_TEXT.layers": {
    en: "Layers",
    he: "\u05E9\u05DB\u05D1\u05D5\u05EA"
  },
  "CANVAS_HEADER_TEXT.layersTooltip": {
    en: "Layers panel",
    he: "\u05DC\u05D5\u05D7 \u05E9\u05DB\u05D1\u05D5\u05EA"
  },
  "CANVAS_HEADER_TEXT.properties": {
    en: "Properties",
    he: "\u05DE\u05D0\u05E4\u05D9\u05D9\u05E0\u05D9\u05DD"
  },
  "CANVAS_HEADER_TEXT.propertiesTooltip": {
    en: "Properties & Settings panel",
    he: "\u05DC\u05D5\u05D7 \u05DE\u05D0\u05E4\u05D9\u05D9\u05E0\u05D9\u05DD \u05D5\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA"
  },
  "CANVAS_HEADER_TEXT.splitView": {
    en: "Split",
    he: "\u05DE\u05E4\u05D5\u05E6\u05DC"
  },
  "CANVAS_HEADER_TEXT.splitViewTooltip": {
    en: "Dual Pane: Live Editor & Presentation",
    he: "\u05EA\u05E6\u05D5\u05D2\u05D4 \u05DE\u05E4\u05D5\u05E6\u05DC\u05EA: \u05E2\u05D5\u05E8\u05DA \u05D5\u05EA\u05E6\u05D5\u05D2\u05D4 \u05D7\u05D9\u05D4"
  },
  "CANVAS_HEADER_TEXT.editorOnly": {
    en: "Editor",
    he: "\u05E2\u05D5\u05E8\u05DA"
  },
  "CANVAS_HEADER_TEXT.editorOnlyTooltip": {
    en: "Editor only",
    he: "\u05DE\u05E6\u05D1 \u05E2\u05D5\u05E8\u05DA \u05D1\u05DC\u05D1\u05D3"
  },
  "CANVAS_HEADER_TEXT.previewOnly": {
    en: "Preview",
    he: "\u05EA\u05E6\u05D5\u05D2\u05D4 \u05D7\u05D9\u05D4"
  },
  "CANVAS_HEADER_TEXT.previewOnlyTooltip": {
    en: "Live presentation preview only",
    he: "\u05DE\u05E6\u05D1 \u05EA\u05E6\u05D5\u05D2\u05D4 \u05D7\u05D9\u05D4 \u05D5\u05E4\u05E8\u05D6\u05E0\u05D8\u05E6\u05D9\u05D4"
  },
  "CANVAS_HEADER_TEXT.syncViewport": {
    en: "Synchronize scroll & zoom between editor and preview",
    he: "\u05E1\u05E0\u05DB\u05E8\u05DF \u05D2\u05DC\u05D9\u05DC\u05D4 \u05D5\u05D6\u05D5\u05DD \u05D1\u05D9\u05DF \u05E9\u05E0\u05D9 \u05D4\u05D7\u05DC\u05D5\u05E0\u05D5\u05EA"
  },
  "CANVAS_HEADER_TEXT.print": {
    en: "Print",
    he: "\u05D4\u05D3\u05E4\u05E1\u05D4"
  },
  "CANVAS_HEADER_TEXT.printTooltip": {
    en: "Print / Export to PDF",
    he: "\u05D4\u05D3\u05E4\u05E1 / \u05D9\u05D9\u05E6\u05D0 \u05DB-PDF"
  },
  "CANVAS_HEADER_TEXT.restore": {
    en: "Restore",
    he: "\u05E9\u05D7\u05D6\u05D5\u05E8"
  },
  "DUALITY_TEXT.certificate": {
    en: "Strong Duality Certificate",
    he: "\u05EA\u05E2\u05D5\u05D3\u05EA \u05D3\u05D5\u05D0\u05DC\u05D9\u05D5\u05EA (Strong Duality)"
  },
  "DUALITY_TEXT.primalOptimal": {
    en: "Primal Optimal Value",
    he: "\u05E2\u05E8\u05DA \u05D0\u05D5\u05E4\u05D8\u05D9\u05DE\u05DC\u05D9 \u05E8\u05D0\u05E9\u05D9 (Primal)"
  },
  "DUALITY_TEXT.dualOptimal": {
    en: "Dual Optimal Value",
    he: "\u05E2\u05E8\u05DA \u05D0\u05D5\u05E4\u05D8\u05D9\u05DE\u05DC\u05D9 \u05D3\u05D5\u05D0\u05DC\u05D9 (Dual)"
  },
  "DUALITY_TEXT.dualityGap": {
    en: "Duality Gap",
    he: "\u05E4\u05E2\u05E8 \u05D3\u05D5\u05D0\u05DC\u05D9\u05D5\u05EA (Duality Gap)"
  },
  "PIPELINE_TEXT.addStage": {
    en: "Add Stage",
    he: "\u05D4\u05D5\u05E1\u05E3 \u05E9\u05DC\u05D1"
  },
  "PIPELINE_TEXT.removeStage": {
    en: "Remove Stage",
    he: "\u05D4\u05E1\u05E8 \u05E9\u05DC\u05D1"
  },
  "MEDIA_TEXT.image": {
    en: "Image",
    he: "\u05EA\u05DE\u05D5\u05E0\u05D4"
  },
  "MEDIA_TEXT.pdf": {
    en: "PDF",
    he: "PDF"
  },
  "MEDIA_TEXT.video": {
    en: "Video",
    he: "\u05D5\u05D9\u05D3\u05D0\u05D5"
  },
  "MEDIA_TEXT.expandPreview": {
    en: "Expand preview",
    he: "\u05D4\u05D2\u05D3\u05DC \u05EA\u05DE\u05D5\u05E0\u05D4"
  },
  "MEDIA_TEXT.downloadImage": {
    en: "Download image",
    he: "\u05D4\u05D5\u05E8\u05D3 \u05EA\u05DE\u05D5\u05E0\u05D4"
  },
  "MEDIA_TEXT.download": {
    en: "Download",
    he: "\u05D4\u05D5\u05E8\u05D3"
  },
  "MEDIA_TEXT.close": {
    en: "Close",
    he: "\u05E1\u05D2\u05D5\u05E8"
  },
  "MEDIA_TEXT.expandVideo": {
    en: "Expand video",
    he: "\u05D4\u05D2\u05D3\u05DC \u05D5\u05D9\u05D3\u05D0\u05D5"
  },
  "MEDIA_TEXT.expandYouTube": {
    en: "Expand YouTube video",
    he: "\u05D4\u05D2\u05D3\u05DC \u05E1\u05E8\u05D8\u05D5\u05DF YouTube"
  },
  "MEDIA_TEXT.openPdf": {
    en: "Open PDF",
    he: "\u05E4\u05EA\u05D7 PDF"
  },
  "MEDIA_TEXT.openNewTab": {
    en: "Open in new tab",
    he: "\u05E4\u05EA\u05D7 \u05D1\u05DC\u05E9\u05D5\u05E0\u05D9\u05EA \u05D7\u05D3\u05E9\u05D4"
  },
  "MEDIA_TEXT.openInYouTube": {
    en: "Open in YouTube",
    he: "\u05E4\u05EA\u05D7 \u05D1-YouTube"
  },
  "MEDIA_TEXT.loadingPreview": {
    en: "Loading preview\u2026",
    he: "\u05D8\u05D5\u05E2\u05DF \u05EA\u05E6\u05D5\u05D2\u05D4 \u05DE\u05E7\u05D3\u05D9\u05DE\u05D4\u2026"
  },
  "MEDIA_TEXT.clickToExpandPdf": {
    en: "Click to expand PDF",
    he: "\u05DC\u05D7\u05E5 \u05DC\u05D4\u05E8\u05D7\u05D1\u05EA \u05D4\u05DE\u05E1\u05DE\u05DA"
  },
  "MEDIA_TEXT.pdfEmptyTitle": {
    en: "No PDF URL provided",
    he: "\u05DC\u05D0 \u05E0\u05D1\u05D7\u05E8 \u05E7\u05D5\u05D1\u05E5 PDF"
  },
  "MEDIA_TEXT.pdfEmptyDesc": {
    en: "Select this block in Edit Mode and use the Content Editor to paste a PDF URL.",
    he: "\u05D1\u05D7\u05E8 \u05D1\u05DC\u05D5\u05E7 \u05D6\u05D4 \u05D1\u05DE\u05E6\u05D1 \u05E2\u05E8\u05D9\u05DB\u05D4 \u05D5\u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05E2\u05D5\u05E8\u05DA \u05D4\u05EA\u05D5\u05DB\u05DF \u05DB\u05D3\u05D9 \u05DC\u05D4\u05D3\u05D1\u05D9\u05E7 \u05DB\u05EA\u05D5\u05D1\u05EA PDF."
  },
  "MEDIA_TEXT.uploadPdf": {
    en: "Upload PDF",
    he: "\u05D4\u05E2\u05DC\u05D0\u05EA PDF"
  },
  "MEDIA_TEXT.url": {
    en: "URL",
    he: "\u05DB\u05EA\u05D5\u05D1\u05EA URL"
  },
  "MEDIA_TEXT.set": {
    en: "Set",
    he: "\u05D4\u05D2\u05D3\u05E8"
  },
  "COMPLEXITY_CLASSES.P.name": {
    en: "Class P",
    he: "\u05DE\u05D7\u05DC\u05E7\u05EA P"
  },
  "COMPLEXITY_CLASSES.P.description": {
    en: "Problems decidable in polynomial time on a deterministic Turing machine.",
    he: "\u05D1\u05E2\u05D9\u05D5\u05EA \u05D4\u05E0\u05D9\u05EA\u05E0\u05D5\u05EA \u05DC\u05D4\u05DB\u05E8\u05E2\u05D4 \u05D1\u05D6\u05DE\u05DF \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05D0\u05DC\u05D9 \u05D1\u05DE\u05DB\u05D5\u05E0\u05EA \u05D8\u05D5\u05E8\u05D9\u05E0\u05D2 \u05D3\u05D8\u05E8\u05DE\u05D9\u05E0\u05D9\u05E1\u05D8\u05D9\u05EA."
  },
  "COMPLEXITY_CLASSES.NP.name": {
    en: "Class NP",
    he: "\u05DE\u05D7\u05DC\u05E7\u05EA NP"
  },
  "COMPLEXITY_CLASSES.NP.description": {
    en: "Problems verifiable in polynomial time or decidable on a non-deterministic Turing machine.",
    he: "\u05D1\u05E2\u05D9\u05D5\u05EA \u05D4\u05E0\u05D9\u05EA\u05E0\u05D5\u05EA \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA \u05D1\u05D6\u05DE\u05DF \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05D0\u05DC\u05D9 \u05D0\u05D5 \u05DC\u05D4\u05DB\u05E8\u05E2\u05D4 \u05D1\u05DE\u05DB\u05D5\u05E0\u05EA \u05D8\u05D5\u05E8\u05D9\u05E0\u05D2 \u05D0\u05D9-\u05D3\u05D8\u05E8\u05DE\u05D9\u05E0\u05D9\u05E1\u05D8\u05D9\u05EA."
  },
  "COMPLEXITY_CLASSES.NPC.name": {
    en: "Class NP-Complete",
    he: "\u05DE\u05D7\u05DC\u05E7\u05EA NP-Complete"
  },
  "COMPLEXITY_CLASSES.NPC.description": {
    en: "The hardest problems in NP, to which every problem in NP polynomial-time reduces.",
    he: "\u05D4\u05D1\u05E2\u05D9\u05D5\u05EA \u05D4\u05E7\u05E9\u05D5\u05EA \u05D1\u05D9\u05D5\u05EA\u05E8 \u05D1-NP, \u05D0\u05DC\u05D9\u05D4\u05DF \u05DB\u05DC \u05D1\u05E2\u05D9\u05D4 \u05D1-NP \u05E0\u05D9\u05EA\u05E0\u05EA \u05DC\u05E8\u05D3\u05D5\u05E7\u05E6\u05D9\u05D4 \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05EA."
  },
  "COMPLEXITY_CLASSES.PSPACE.name": {
    en: "Class PSPACE",
    he: "\u05DE\u05D7\u05DC\u05E7\u05EA PSPACE"
  },
  "COMPLEXITY_CLASSES.PSPACE.description": {
    en: "Problems decidable using a polynomial amount of memory space.",
    he: "\u05D1\u05E2\u05D9\u05D5\u05EA \u05D4\u05E0\u05D9\u05EA\u05E0\u05D5\u05EA \u05DC\u05D4\u05DB\u05E8\u05E2\u05D4 \u05D1\u05D6\u05D9\u05DB\u05E8\u05D5\u05DF (\u05DE\u05E7\u05D5\u05DD) \u05E4\u05D5\u05DC\u05D9\u05E0\u05D5\u05DE\u05D9\u05D0\u05DC\u05D9."
  },
  "COMPLEXITY_CLASSES.EXPTIME.name": {
    en: "Class EXPTIME",
    he: "\u05DE\u05D7\u05DC\u05E7\u05EA EXPTIME"
  },
  "COMPLEXITY_CLASSES.EXPTIME.description": {
    en: "Problems decidable in exponential time $O(2^{p(n)})$.",
    he: "\u05D1\u05E2\u05D9\u05D5\u05EA \u05D4\u05E0\u05D9\u05EA\u05E0\u05D5\u05EA \u05DC\u05D4\u05DB\u05E8\u05E2\u05D4 \u05D1\u05D6\u05DE\u05DF \u05D0\u05E7\u05E1\u05E4\u05D5\u05E0\u05E0\u05E6\u05D9\u05D0\u05DC\u05D9 $O(2^{p(n)})$."
  }
};

// src/core/shared/translationLeaves.ts
function leavesFromSnapshot(snapshot) {
  return new Map(Object.entries(snapshot));
}

// server/routes/localeRoutes.ts
var leaves = leavesFromSnapshot(translationLeafSnapshot_default);
var localeRouter = Router18();
localeRouter.get("/", async (_req, res) => {
  const dir = resolveLocalesDir();
  const knownKeys = new Set(leaves.keys());
  const { packs } = await readLocalePacks(dir, knownKeys, leaves);
  const summaries = packs.map(({ pack }) => {
    const total = leaves.size;
    const translated = Object.keys(pack.strings).length;
    return {
      code: pack.meta.code,
      nativeName: pack.meta.nativeName,
      englishName: pack.meta.englishName,
      dir: pack.meta.dir,
      flag: pack.meta.flag,
      translated,
      total
    };
  });
  res.json(summaries);
});
localeRouter.get("/:code", async (req, res) => {
  const code = req.params.code;
  if (!LOCALE_CODE_PATTERN.test(code)) {
    res.status(400).json({ error: `Invalid locale code parameter: "${code}"` });
    return;
  }
  const dir = resolveLocalesDir();
  const knownKeys = new Set(leaves.keys());
  const { packs } = await readLocalePacks(dir, knownKeys, leaves);
  const found = packs.find((p) => p.pack.meta.code.toLowerCase() === code.toLowerCase());
  if (!found) {
    res.status(404).json({ error: `Locale "${code}" not found` });
    return;
  }
  res.json(found.pack);
});

// server/routes/transferRoutes.ts
import { Router as Router19 } from "express";
import express2 from "express";
import path16 from "path";

// server/transfer/archiveReader.ts
import { unzipSync, strFromU8 } from "fflate";

// server/transfer/transferLimits.ts
var CURRENT_FORMAT_VERSION = 1;
var ARCHIVE_KINDS = ["course", "courses", "backup"];
var MB = 1024 * 1024;
var TRANSFER_LIMITS = {
  maxCompressedBytes: 50 * MB,
  maxTotalBytes: 200 * MB,
  maxEntryBytes: 25 * MB,
  maxEntries: 5e3,
  maxCourses: 100,
  transactionMs: 6e4
};
var COURSE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

// server/transfer/archiveManifest.ts
var ArchiveError = class extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "ArchiveError";
  }
  code;
  status;
};
function buildManifest(ids, kind, appVersion, now = /* @__PURE__ */ new Date()) {
  return {
    formatVersion: CURRENT_FORMAT_VERSION,
    kind,
    createdAt: now.toISOString(),
    appVersion,
    courses: ids.map((id) => ({ id }))
  };
}
function detectKind(ids, isFullBackup) {
  if (isFullBackup) return "backup";
  return ids.length === 1 ? "course" : "courses";
}
var bad = (message) => {
  throw new ArchiveError("invalid_manifest", message);
};
function parseManifest(raw) {
  if (!raw || typeof raw !== "object") return bad("manifest.json must be an object");
  const m = raw;
  if (typeof m.formatVersion !== "number") return bad("manifest.formatVersion must be a number");
  if (m.formatVersion > CURRENT_FORMAT_VERSION) {
    throw new ArchiveError(
      "unsupported_version",
      `Archive format ${m.formatVersion} is newer than supported ${CURRENT_FORMAT_VERSION}; update the app`
    );
  }
  if (!ARCHIVE_KINDS.includes(m.kind)) return bad("manifest.kind is not recognised");
  if (!Array.isArray(m.courses)) return bad("manifest.courses must be an array");
  const ids = m.courses.map((c) => c?.id);
  if (!ids.every((id) => typeof id === "string" && COURSE_ID_PATTERN.test(id))) {
    return bad("manifest contains an invalid course id");
  }
  return {
    formatVersion: m.formatVersion,
    kind: m.kind,
    createdAt: String(m.createdAt ?? ""),
    appVersion: String(m.appVersion ?? ""),
    courses: ids.map((id) => ({ id }))
  };
}

// server/transfer/courseMetaValidation.ts
function isUserText(value) {
  if (typeof value === "string") return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).some((text) => typeof text === "string");
}
function collectCourseMetaProblems(candidate) {
  const problems = [];
  if (!candidate || typeof candidate !== "object") {
    return ["course.json must contain a JSON object"];
  }
  const c = candidate;
  if (typeof c.id !== "string") problems.push("course.json missing string field 'id'");
  if (typeof c.code !== "string") problems.push("course.json missing string field 'code'");
  if (typeof c.icon !== "string") problems.push("course.json missing string field 'icon'");
  if (typeof c.color !== "string") problems.push("course.json missing string field 'color'");
  if (typeof c.accent !== "string") problems.push("course.json missing string field 'accent'");
  for (const key of ["title", "subtitle", "description", "badge"]) {
    if (!isUserText(c[key])) problems.push(`course.json missing text or localized field '${key}'`);
  }
  return problems;
}

// server/transfer/archiveReader.ts
var SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
var TOPIC_FILE_FLAT_RE = /^([^/]+)\/([^/]+)\/(topic|scene|model|content)\.json$/;
var TOPIC_FILE_SECTION_RE = /^([^/]+)\/([^/]+)\/([^/]+)\/(topic|scene|model|content)\.json$/;
var COURSE_PREFIX = "courses/";
var ASSETS_SUBDIR = "assets/";
var PACKS_SUBDIR = "packs/";
function assertSafeEntryPath(path19) {
  const bad2 = path19.includes("\\") || path19.startsWith("/") || path19.includes("\0") || /^[A-Za-z]:/.test(path19);
  const segments = path19.split("/").filter((s, i, all) => !(s === "" && i === all.length - 1));
  const traversal = segments.some(
    (s) => s === ".." || s === "." || s === "" || s.includes(":")
  );
  if (bad2 || traversal) {
    throw new ArchiveError("unsafe_path", `Unsafe path in archive: ${path19}`);
  }
}
function inflateEntries(bytes) {
  if (bytes.byteLength > TRANSFER_LIMITS.maxCompressedBytes) {
    throw new ArchiveError("too_large", "Archive file is too large", 413);
  }
  let count = 0;
  let total = 0;
  try {
    return unzipSync(bytes, {
      filter: (file) => {
        assertSafeEntryPath(file.name);
        if (++count > TRANSFER_LIMITS.maxEntries) {
          throw new ArchiveError("too_many_entries", "Archive has too many entries");
        }
        total += file.originalSize;
        if (file.originalSize > TRANSFER_LIMITS.maxEntryBytes || total > TRANSFER_LIMITS.maxTotalBytes) {
          throw new ArchiveError("too_large", "Archive decompressed size exceeds the limit", 413);
        }
        return true;
      }
    });
  } catch (error) {
    if (error instanceof ArchiveError) throw error;
    throw new ArchiveError("corrupt", "File is not a valid zip archive");
  }
}
function parseJsonEntry(bytes, path19) {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    throw new ArchiveError("corrupt", `'${path19}' is not valid JSON`);
  }
}
function isSafeCoord(s) {
  return SEGMENT_RE.test(s) && !s.includes("..");
}
function parsePathCoords(path19, courseId) {
  const flatMatch = TOPIC_FILE_FLAT_RE.exec(path19);
  const sectionMatch = TOPIC_FILE_SECTION_RE.exec(path19);
  if (!flatMatch && !sectionMatch) return null;
  const coords = flatMatch ? { weekKey: flatMatch[1], section: "topics", topicId: flatMatch[2], fileType: flatMatch[3] } : { weekKey: sectionMatch[1], section: sectionMatch[2], topicId: sectionMatch[3], fileType: sectionMatch[4] };
  if (!isSafeCoord(coords.weekKey) || !isSafeCoord(coords.topicId) || !isSafeCoord(coords.section)) {
    throw new ArchiveError("unsafe_path", `Unsafe topic path in course '${courseId}': ${path19}`);
  }
  return coords;
}
function applyTopicMeta(topic, parsed) {
  const tObj = parsed;
  topic.title = typeof tObj.title === "string" ? tObj.title : tObj.title;
  topic.description = typeof tObj.description === "string" ? tObj.description : tObj.description;
  if (typeof tObj.position === "number") topic.position = tObj.position;
}
function applySceneData(topic, parsed, courseId, path19) {
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.blocks)) {
    const p = parsed;
    const err = validateBlocks(p.blocks, p.nodes);
    if (err) {
      throw new ArchiveError("invalid_course", `Course '${courseId}' scene '${path19}' invalid: ${err}`);
    }
  }
  topic.scene = parsed;
}
function applyTopicPayload(topic, fileType, parsed, courseId, path19) {
  if (fileType === "topic") applyTopicMeta(topic, parsed);
  else if (fileType === "scene") applySceneData(topic, parsed, courseId, path19);
  else if (fileType === "model") topic.model = parsed;
  else if (fileType === "content") topic.content = parsed;
}
function parseTopicsAndAssets(scoped, courseId) {
  const topicMap = /* @__PURE__ */ new Map();
  const assets = [];
  const packs = [];
  for (const [path19, bytes] of Object.entries(scoped)) {
    if (path19 === "course.json" || path19 === "weeks.json" || path19 === "catalog.json") continue;
    if (path19.startsWith(ASSETS_SUBDIR)) {
      assets.push({ path: path19.slice(ASSETS_SUBDIR.length), content: bytes });
      continue;
    }
    if (path19.startsWith(PACKS_SUBDIR)) {
      packs.push({ path: path19.slice(PACKS_SUBDIR.length), content: strFromU8(bytes) });
      continue;
    }
    const coords = parsePathCoords(path19, courseId);
    if (!coords) continue;
    const key = `${coords.weekKey}/${coords.topicId}`;
    let topic = topicMap.get(key);
    if (!topic) {
      topic = { weekKey: coords.weekKey, topicId: coords.topicId, section: coords.section };
      topicMap.set(key, topic);
    }
    const parsed = parseJsonEntry(bytes, path19);
    applyTopicPayload(topic, coords.fileType, parsed, courseId, path19);
  }
  return { topics: Array.from(topicMap.values()), assets, packs };
}
function parseWeeks(scoped, topics) {
  if (scoped["weeks.json"]) {
    const raw = parseJsonEntry(scoped["weeks.json"], "weeks.json");
    if (Array.isArray(raw)) {
      return raw.map((w, idx) => ({
        weekKey: String(w.weekKey ?? `week-${idx + 1}`),
        title: typeof w.title === "string" ? w.title : String(w.title ?? w.weekKey),
        position: typeof w.position === "number" ? w.position : idx
      }));
    }
  }
  const weekKeys = Array.from(new Set(topics.map((t) => t.weekKey))).sort();
  return weekKeys.map((weekKey, idx) => ({
    weekKey,
    title: weekKey,
    position: idx
  }));
}
function readCourse(id, scoped) {
  const courseBytes = scoped["course.json"];
  if (!courseBytes) {
    throw new ArchiveError("invalid_course", `Missing 'course.json' for course '${id}'`);
  }
  const candidate = parseJsonEntry(courseBytes, `courses/${id}/course.json`);
  const problems = collectCourseMetaProblems(candidate);
  if (problems.length > 0) {
    throw new ArchiveError("invalid_course", `Invalid course.json in course '${id}':
${problems.join("\n")}`);
  }
  const meta = candidate;
  if (meta.id !== id) {
    throw new ArchiveError(
      "invalid_course",
      `Course ID '${meta.id}' does not match directory name '${id}'`
    );
  }
  if (!COURSE_ID_PATTERN.test(meta.id)) {
    throw new ArchiveError("invalid_course", `Course ID '${meta.id}' is invalid`);
  }
  const { topics, assets, packs } = parseTopicsAndAssets(scoped, id);
  const weeks = parseWeeks(scoped, topics);
  return { meta, weeks, topics, assets, packs };
}
function readModernCourses(entries, manifest) {
  if (manifest.courses.length === 0) {
    throw new ArchiveError("invalid_manifest", "Archive manifest lists no courses");
  }
  if (manifest.courses.length > TRANSFER_LIMITS.maxCourses) {
    throw new ArchiveError("too_many_entries", `Archive exceeds max courses limit of ${TRANSFER_LIMITS.maxCourses}`);
  }
  return manifest.courses.map((courseRef) => {
    const prefix = `${COURSE_PREFIX}${courseRef.id}/`;
    const scoped = {};
    for (const [k, v] of Object.entries(entries)) {
      if (k.startsWith(prefix)) scoped[k.slice(prefix.length)] = v;
    }
    if (Object.keys(scoped).length === 0) {
      throw new ArchiveError("invalid_course", `Course folder missing for listed course '${courseRef.id}'`);
    }
    return readCourse(courseRef.id, scoped);
  });
}
function readArchive(bytes) {
  const entries = inflateEntries(bytes);
  const keys = Object.keys(entries);
  if (keys.length === 0) throw new ArchiveError("corrupt", "Archive is empty");
  if (entries["manifest.json"]) {
    const manifestRaw = parseJsonEntry(entries["manifest.json"], "manifest.json");
    const manifest2 = parseManifest(manifestRaw);
    const courses = readModernCourses(entries, manifest2);
    return { manifest: manifest2, courses };
  }
  if (!entries["course.json"]) {
    throw new ArchiveError("corrupt", "Archive missing 'manifest.json' or root 'course.json'");
  }
  const candidate = parseJsonEntry(entries["course.json"], "course.json");
  const problems = collectCourseMetaProblems(candidate);
  if (problems.length > 0) {
    throw new ArchiveError("invalid_course", `Legacy course.json is invalid:
${problems.join("\n")}`);
  }
  const meta = candidate;
  if (!COURSE_ID_PATTERN.test(meta.id)) {
    throw new ArchiveError("invalid_course", `Legacy course id '${meta.id}' is invalid`);
  }
  const manifest = buildManifest([meta.id], "course", "legacy");
  const course = readCourse(meta.id, entries);
  return { manifest, courses: [course] };
}

// server/transfer/buildCourseZip.ts
import { zipSync, strToU8 } from "fflate";
function buildCourseZip(files) {
  const entries = {};
  for (const file of files) {
    entries[file.path] = typeof file.content === "string" ? strToU8(file.content) : file.content;
  }
  return zipSync(entries);
}

// server/transfer/archiveWriter.ts
function stringify(value) {
  return JSON.stringify(value, null, 2);
}
function buildTopicFiles(weekKey, topic) {
  const files = [];
  const basePath = `${weekKey}/${topic.topicId}`;
  const topicMeta = {
    title: topic.title,
    description: topic.description,
    position: topic.position
  };
  files.push({ path: `${basePath}/topic.json`, content: stringify(topicMeta) });
  if (topic.scene !== null && topic.scene !== void 0) {
    files.push({ path: `${basePath}/scene.json`, content: stringify(topic.scene) });
  }
  if (topic.model !== null && topic.model !== void 0) {
    files.push({ path: `${basePath}/model.json`, content: stringify(topic.model) });
  }
  if (topic.content !== null && topic.content !== void 0) {
    files.push({ path: `${basePath}/content.json`, content: stringify(topic.content) });
  }
  return files;
}
function archiveFilesForCourse(course, options) {
  const courseMeta = {
    id: course.id,
    code: course.code,
    icon: course.icon,
    color: course.color,
    accent: course.accent,
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    badge: course.badge
  };
  const files = [
    { path: "course.json", content: stringify(courseMeta) }
  ];
  const sortedWeeks = [...course.weeks || []].sort((a, b) => a.id - b.id);
  const weeksData = sortedWeeks.map((w, idx) => ({
    weekKey: w.weekKey,
    title: w.title,
    position: idx
  }));
  files.push({ path: "weeks.json", content: stringify(weeksData) });
  for (const week of sortedWeeks) {
    const sortedTopics = [...week.topics || []].sort((a, b) => a.position - b.position);
    for (const topic of sortedTopics) {
      files.push(...buildTopicFiles(week.weekKey, topic));
    }
  }
  if (options?.packs) {
    for (const pack of options.packs) {
      files.push({ path: `packs/${pack.lang}.json`, content: pack.content });
    }
  }
  return files;
}
function buildArchive(courses, kind, appVersion, coursePacks) {
  const ids = courses.map((c) => c.id);
  const manifest = buildManifest(ids, kind, appVersion);
  const allFiles = [
    { path: "manifest.json", content: stringify(manifest) }
  ];
  for (const course of courses) {
    const packs = coursePacks?.[course.id];
    const courseFiles = archiveFilesForCourse(course, { packs });
    for (const file of courseFiles) {
      allFiles.push({
        path: `courses/${course.id}/${file.path}`,
        content: file.content
      });
    }
  }
  return buildCourseZip(allFiles);
}

// server/transfer/importPlanner.ts
function nextFreeId(base, taken) {
  let counter = 2;
  while (counter < 1e3) {
    const suffix = `-${counter}`;
    const maxBaseLen = 64 - suffix.length;
    const truncatedBase = base.slice(0, maxBaseLen);
    const candidate = `${truncatedBase}${suffix}`;
    if (!taken.has(candidate) && COURSE_ID_PATTERN.test(candidate)) {
      return candidate;
    }
    counter++;
  }
  throw new ArchiveError("invalid_course", `Unable to find free ID for duplicate of '${base}'`);
}
function resolveCoursePolicy(sourceId, policy) {
  if (typeof policy === "string") return policy;
  return policy[sourceId] ?? "skip";
}
function planImport(archive, existingIds, policy) {
  const taken = new Set(existingIds);
  const plannedCourses = [];
  const seenSourceIds = /* @__PURE__ */ new Set();
  for (const course of archive.courses) {
    const sourceId = course.meta.id;
    if (seenSourceIds.has(sourceId)) {
      throw new ArchiveError("invalid_manifest", `Duplicate course id '${sourceId}' in archive`);
    }
    seenSourceIds.add(sourceId);
    const conflict = existingIds.has(sourceId);
    let action;
    let targetId;
    let preparedCourse = course;
    if (!conflict) {
      action = "create";
      targetId = sourceId;
      taken.add(targetId);
    } else {
      const chosenPolicy = resolveCoursePolicy(sourceId, policy);
      if (chosenPolicy === "skip") {
        action = "skip";
        targetId = sourceId;
      } else if (chosenPolicy === "replace") {
        action = "replace";
        targetId = sourceId;
      } else {
        action = "duplicate";
        targetId = nextFreeId(sourceId, taken);
        taken.add(targetId);
        preparedCourse = {
          ...course,
          meta: {
            ...course.meta,
            id: targetId
          }
        };
      }
    }
    plannedCourses.push({
      sourceId,
      targetId,
      action,
      conflict,
      course: preparedCourse,
      topicCount: course.topics.length
    });
  }
  return {
    kind: archive.manifest.kind,
    courses: plannedCourses
  };
}

// server/transfer/importApplier.ts
import { Prisma as Prisma3 } from "@prisma/client";
import fs11 from "fs";
import path15 from "path";
import crypto6 from "crypto";
function stringify2(obj) {
  return JSON.stringify(obj, null, 2);
}
function buildCatalogData(weeks, topics) {
  const catalogObj = {};
  for (const week of weeks) {
    const weekTopics = topics.filter((t) => t.weekKey === week.weekKey);
    catalogObj[week.weekKey] = {
      title: week.title,
      lectures: weekTopics.filter((t) => !t.section || t.section === "lectures" || t.section === "topics").map((t) => ({
        id: t.topicId,
        title: t.title ?? t.topicId,
        description: t.description
      })),
      practice: weekTopics.filter((t) => t.section === "practice").map((t) => ({
        id: t.topicId,
        title: t.title ?? t.topicId,
        description: t.description
      }))
    };
  }
  return catalogObj;
}
function stageSingleTopic(courseDir, topic) {
  const topicDir = path15.join(courseDir, topic.weekKey, topic.topicId);
  fs11.mkdirSync(topicDir, { recursive: true });
  const topicMeta = {
    title: topic.title ?? topic.topicId,
    description: topic.description ?? "",
    position: topic.position ?? 0
  };
  fs11.writeFileSync(path15.join(topicDir, "topic.json"), stringify2(topicMeta), "utf8");
  if (topic.scene !== null && topic.scene !== void 0) {
    fs11.writeFileSync(path15.join(topicDir, "scene.json"), stringify2(topic.scene), "utf8");
  }
  if (topic.model !== null && topic.model !== void 0) {
    fs11.writeFileSync(path15.join(topicDir, "model.json"), stringify2(topic.model), "utf8");
  }
  if (topic.content !== null && topic.content !== void 0) {
    fs11.writeFileSync(path15.join(topicDir, "content.json"), stringify2(topic.content), "utf8");
  }
}
function stageTopicFiles(courseDir, topics) {
  for (const topic of topics) {
    stageSingleTopic(courseDir, topic);
  }
}
function stageAssets(courseDir, assets) {
  if (!assets || assets.length === 0) return;
  const assetsDir = path15.join(courseDir, "assets");
  fs11.mkdirSync(assetsDir, { recursive: true });
  for (const asset of assets) {
    const assetPath = path15.join(assetsDir, asset.path);
    fs11.mkdirSync(path15.dirname(assetPath), { recursive: true });
    fs11.writeFileSync(assetPath, Buffer.from(asset.content));
  }
}
function stageCourseFiles(stagingDir, course, targetId) {
  const courseDir = path15.join(stagingDir, targetId);
  fs11.mkdirSync(courseDir, { recursive: true });
  const courseMeta = { ...course.meta, id: targetId };
  fs11.writeFileSync(path15.join(courseDir, "course.json"), stringify2(courseMeta), "utf8");
  const catalogObj = buildCatalogData(course.weeks, course.topics);
  fs11.writeFileSync(path15.join(courseDir, "catalog.json"), stringify2(catalogObj), "utf8");
  fs11.writeFileSync(path15.join(courseDir, "weeks.json"), stringify2(course.weeks), "utf8");
  stageTopicFiles(courseDir, course.topics);
  stageAssets(courseDir, course.assets);
}
async function cleanOldTopicDocs(tx, targetId) {
  const oldCourse = await tx.course.findUnique({
    where: { id: targetId },
    include: { weeks: { include: { topics: true } } }
  });
  const oldTopicIds = oldCourse?.weeks.flatMap((w) => w.topics.map((t) => t.topicId)) || [];
  await tx.course.delete({ where: { id: targetId } });
  if (oldTopicIds.length > 0 && "canvasStoreDoc" in tx) {
    const docTx = tx;
    await docTx.canvasStoreDoc.deleteMany({
      where: { key: { in: oldTopicIds } }
    });
  }
}
function mapWeeksData(course) {
  return course.weeks.map((week) => {
    const weekTopics = course.topics.filter((t) => t.weekKey === week.weekKey);
    return {
      weekKey: week.weekKey,
      title: week.title,
      topics: {
        create: weekTopics.map((topic, idx) => ({
          section: topic.section || "topics",
          topicId: topic.topicId,
          position: typeof topic.position === "number" ? topic.position : idx,
          title: topic.title ?? topic.topicId,
          description: topic.description ?? "",
          scene: topic.scene ? topic.scene : Prisma3.JsonNull,
          model: topic.model ? topic.model : Prisma3.JsonNull,
          content: topic.content ? topic.content : Prisma3.JsonNull
        }))
      }
    };
  });
}
async function writeCourseToDatabase(tx, course, targetId, action) {
  if (action === "replace") {
    await cleanOldTopicDocs(tx, targetId);
  }
  await tx.course.create({
    data: {
      id: targetId,
      code: String(course.meta.code ?? ""),
      title: String(course.meta.title ?? targetId),
      subtitle: String(course.meta.subtitle ?? ""),
      description: String(course.meta.description ?? ""),
      icon: String(course.meta.icon ?? "BookOpen"),
      color: String(course.meta.color ?? "var(--surface-1)"),
      accent: String(course.meta.accent ?? "var(--text-1)"),
      badge: String(course.meta.badge ?? ""),
      weeks: {
        create: mapWeeksData(course)
      }
    }
  });
}
async function applyImportPlan(prisma3, plan, dataDir) {
  const stagingId = `.import-${crypto6.randomUUID()}`;
  const stagingDir = path15.join(dataDir, stagingId);
  fs11.mkdirSync(stagingDir, { recursive: true });
  const activeCourses = plan.courses.filter((c) => c.action !== "skip");
  const skipped = plan.courses.filter((c) => c.action === "skip").map((c) => c.targetId);
  const imported = [];
  try {
    for (const planned of activeCourses) {
      stageCourseFiles(stagingDir, planned.course, planned.targetId);
    }
    await prisma3.$transaction(
      async (tx) => {
        for (const planned of activeCourses) {
          await writeCourseToDatabase(tx, planned.course, planned.targetId, planned.action);
        }
      },
      { timeout: TRANSFER_LIMITS.transactionMs }
    );
    const oldBackupDir = path15.join(stagingDir, ".old");
    fs11.mkdirSync(oldBackupDir, { recursive: true });
    for (const planned of activeCourses) {
      const liveDir = path15.join(dataDir, planned.targetId);
      const stagedCourseDir = path15.join(stagingDir, planned.targetId);
      if (fs11.existsSync(liveDir)) {
        const oldDir = path15.join(oldBackupDir, planned.targetId);
        fs11.renameSync(liveDir, oldDir);
      }
      fs11.renameSync(stagedCourseDir, liveDir);
      imported.push(planned.targetId);
    }
    await invalidateRegistryCache();
    return { imported, skipped };
  } catch (error) {
    if (error instanceof ArchiveError) throw error;
    throw error;
  } finally {
    if (fs11.existsSync(stagingDir)) {
      fs11.rmSync(stagingDir, { recursive: true, force: true });
    }
  }
}

// server/routes/transferRoutes.ts
function extractZipUint8Array(rawBody) {
  if (rawBody instanceof Uint8Array) return rawBody;
  if (Buffer.isBuffer(rawBody)) {
    return new Uint8Array(rawBody.buffer, rawBody.byteOffset, rawBody.byteLength);
  }
  return new Uint8Array(rawBody);
}
function parseHeaderPolicy(headerValue) {
  if (typeof headerValue !== "string") return null;
  if (headerValue === "skip" || headerValue === "replace" || headerValue === "duplicate") {
    return headerValue;
  }
  try {
    const parsed = JSON.parse(headerValue);
    if (parsed && typeof parsed === "object") return parsed;
  } catch (err) {
    return null;
  }
  return null;
}
function parsePolicyInput(req) {
  const queryPolicy = req.query.policy;
  if (queryPolicy === "skip" || queryPolicy === "replace" || queryPolicy === "duplicate") {
    return queryPolicy;
  }
  const fromHeader = parseHeaderPolicy(req.headers["x-conflict-policy"]);
  if (fromHeader) return fromHeader;
  return "skip";
}
function createTransferRouter(dataDir) {
  const router = Router19();
  const targetDataDir = dataDir ?? path16.join(DATA_ROOT, "data");
  const rawParser = express2.raw({
    type: [
      "application/zip",
      "application/x-zip-compressed",
      "multipart/x-zip",
      "application/octet-stream"
    ],
    limit: TRANSFER_LIMITS.maxCompressedBytes
  });
  router.post("/preview", rawParser, async (req, res, next) => {
    try {
      const prisma3 = req.prisma;
      const bytes = extractZipUint8Array(req.body);
      const archive = readArchive(bytes);
      const existing = await prisma3.course.findMany({ select: { id: true } });
      const existingIds = new Set(existing.map((c) => c.id));
      const plan = planImport(archive, existingIds, "skip");
      res.json({
        kind: plan.kind,
        formatVersion: archive.manifest.formatVersion,
        courses: plan.courses.map((c) => ({
          sourceId: c.sourceId,
          title: c.course.meta.title ?? c.sourceId,
          topicCount: c.topicCount,
          conflict: c.conflict
        }))
      });
    } catch (err) {
      next(err);
    }
  });
  router.post("/import", rawParser, async (req, res, next) => {
    try {
      const prisma3 = req.prisma;
      const bytes = extractZipUint8Array(req.body);
      const archive = readArchive(bytes);
      const policy = parsePolicyInput(req);
      const existing = await prisma3.course.findMany({ select: { id: true } });
      const existingIds = new Set(existing.map((c) => c.id));
      const plan = planImport(archive, existingIds, policy);
      const result = await applyImportPlan(prisma3, plan, targetDataDir);
      res.json({
        success: true,
        imported: result.imported,
        skipped: result.skipped
      });
    } catch (err) {
      next(err);
    }
  });
  router.get("/export", async (req, res, next) => {
    try {
      const prisma3 = req.prisma;
      const isAll = req.query.all === "1" || req.query.all === "true";
      const courseQuery = typeof req.query.courses === "string" ? req.query.courses.split(",") : [];
      let courses;
      if (isAll) {
        courses = await prisma3.course.findMany({
          include: { weeks: { include: { topics: true } } }
        });
      } else if (courseQuery.length > 0) {
        courses = await prisma3.course.findMany({
          where: { id: { in: courseQuery } },
          include: { weeks: { include: { topics: true } } }
        });
      } else {
        res.status(400).json({ error: "Missing required query '?all=1' or '?courses=id1,id2'" });
        return;
      }
      if (courses.length === 0) {
        res.status(404).json({ error: "No matching courses found to export" });
        return;
      }
      const kind = detectKind(courses.map((c) => c.id), isAll);
      const zipBytes = buildArchive(courses, kind, "1.0.0");
      const filename = courses.length === 1 ? `${courses[0].id}.zip` : isAll ? "studyts-backup.zip" : "courses-bundle.zip";
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(Buffer.from(zipBytes));
    } catch (err) {
      next(err);
    }
  });
  router.use((err, _req, res, next) => {
    if (err instanceof ArchiveError) {
      res.status(err.status).json({ code: err.code, error: err.message });
      return;
    }
    next(err);
  });
  return router;
}

// server/utils/contentChangeStream.ts
var clients = /* @__PURE__ */ new Set();
function announceContentChange() {
  for (const res of clients) res.write("data: changed\n\n");
}
function contentChangeStreamHandler(req, res) {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  res.write(": connected\n\n");
  clients.add(res);
  req.on("close", () => clients.delete(res));
}

// server/routes/index.ts
var apiRouter = Router20();
apiRouter.get("/content-changes", contentChangeStreamHandler);
apiRouter.use("/locales", localeRouter);
apiRouter.use("/transfer", createTransferRouter());
apiRouter.use(clientErrorsRouter);
apiRouter.use(logsRouter);
apiRouter.use(registryRouter);
apiRouter.use(contentRouter);
apiRouter.use(coursesRouter);
apiRouter.use(scenesRouter);
apiRouter.use(canvasStoreRouter);
apiRouter.use(visualSpecsRouter);
apiRouter.use(chatRouter);
apiRouter.use(aiChatProxyRouter);
apiRouter.use(aiModelsRouter);
apiRouter.use(aiKeysRouter);
apiRouter.use(updateStatusRouter);
apiRouter.use(pdfIngestionRouter);
apiRouter.use(aiAttachmentsRouter);
apiRouter.use(mcpRouter);

// server/utils/shutdown.ts
async function gracefulShutdown(server2, prisma3, timeoutMs = 5e3) {
  log.info("Initiating graceful shutdown");
  try {
    abortAllInFlight();
    mcpLinker.shutdownAll();
  } catch (err) {
    log.error("Error aborting in-flight AI requests or MCP processes", { error: err instanceof Error ? err.message : String(err) });
  }
  const shutdownHttp = new Promise((resolve3) => {
    if (!server2) return resolve3();
    server2.close((err) => {
      if (err) log.error("Error closing HTTP server", { error: err.message });
      resolve3();
    });
  });
  const timer = new Promise((resolve3) => setTimeout(resolve3, timeoutMs));
  await Promise.race([shutdownHttp, timer]);
  if (prisma3) {
    try {
      await prisma3.$disconnect();
    } catch (err) {
      log.error("Error disconnecting Prisma", {
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  log.info("Graceful shutdown completed");
}

// server/utils/mapPrismaError.ts
function mapPrismaError(err) {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = err.code;
    if (code === "P2025") {
      return { status: 404, message: "Resource not found" };
    }
    if (code === "P2002") {
      return { status: 409, message: "Unique constraint violation" };
    }
    if (code === "P2003") {
      return { status: 409, message: "Foreign key constraint violation" };
    }
  }
  return null;
}

// server/runtime/runtimePorts.ts
import { readFileSync as readFileSync3 } from "node:fs";
import path17 from "node:path";
var PORT_KEYS = ["frontendPort", "apiPort"];
function parseRuntimePorts(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`config/runtimePorts.json is not valid JSON: ${err.message}`);
  }
  for (const key of PORT_KEYS) {
    const value = parsed[key];
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      throw new Error(`runtimePorts.${key} must be an integer between 1 and 65535`);
    }
  }
  const ports = PORT_KEYS.map((k) => parsed[k]);
  if (new Set(ports).size !== ports.length) {
    throw new Error("runtimePorts has duplicate ports");
  }
  if (typeof parsed.loopbackHost !== "string" || parsed.loopbackHost === "") {
    throw new Error("runtimePorts.loopbackHost must be a non-empty string");
  }
  return parsed;
}
function readRuntimePorts() {
  return parseRuntimePorts(readFileSync3(path17.resolve(PACKAGE_ROOT, "config", "runtimePorts.json"), "utf8"));
}

// server/middleware/serverOrigins.ts
var DEV_CLIENT_PORT = 7300;
var LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
function getDefaultOrigins() {
  try {
    const { frontendPort, loopbackHost } = readRuntimePorts();
    return `http://localhost:${frontendPort},http://${loopbackHost}:${frontendPort}`;
  } catch {
    return `http://localhost:${DEV_CLIENT_PORT},http://127.0.0.1:${DEV_CLIENT_PORT}`;
  }
}
function isSameOrigin(origin, host) {
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// server/middleware/httpMiddleware.ts
function allowedOrigins(env = process.env.ALLOWED_ORIGINS) {
  return (env ?? getDefaultOrigins()).split(",").map((s) => s.trim()).filter(Boolean);
}
function localOnly(req, res, next) {
  const host = req.headers.host;
  const origin = req.headers.origin;
  const hostOk = LOOPBACK_HOST.test(host ?? "");
  const originOk = origin === void 0 || isSameOrigin(origin, host) || allowedOrigins().includes(origin);
  if (!hostOk || !originOk) {
    log.warn("Forbidden origin rejected", { id: req?.id, host, origin });
    res.status(403).json({ error: "Forbidden origin" });
    return;
  }
  next();
}
function statusOf(err) {
  if (typeof err !== "object" || err === null) return 500;
  const carried = err;
  return Number(carried.status || carried.statusCode) || 500;
}
function problemsOf(err) {
  return err && typeof err === "object" && "problems" in err ? { problems: err.problems } : {};
}
function errorHandler(err, req, res, _next) {
  const reqId = req?.id;
  const prismaMapped = mapPrismaError(err);
  if (prismaMapped) {
    log.warn("Prisma error handled", { id: reqId, status: prismaMapped.status, msg: prismaMapped.message });
    res.status(prismaMapped.status).json({ error: prismaMapped.message });
    return;
  }
  const status = statusOf(err);
  const errorMessage = err instanceof Error ? err.message : "Internal server error";
  log.error("Unhandled route error", { id: reqId, status, error: errorMessage });
  if (!res.headersSent) {
    res.status(status).json({ error: status >= 500 ? "Internal server error" : errorMessage, ...problemsOf(err) });
  }
}

// prisma/seed.ts
import { PrismaClient as PrismaClient4 } from "@prisma/client";
import { join as join5 } from "path";
import { pathToFileURL } from "url";

// prisma/catalogScanner.ts
import { readdirSync as readdirSync2, existsSync as existsSync3, readFileSync as readFileSync4 } from "fs";
import { join as join3 } from "path";
function scanCourses(baseDataDir) {
  if (!existsSync3(baseDataDir)) return [];
  const entries = readdirSync2(baseDataDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."));
  const courses = [];
  for (const entry of entries) {
    const coursePath = join3(baseDataDir, entry.name, "course.json");
    if (!existsSync3(coursePath)) continue;
    try {
      const raw = readFileSync4(coursePath, "utf8");
      const parsed = JSON.parse(raw);
      courses.push(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  WARN: Could not parse course.json for ${entry.name}: ${message}`);
    }
  }
  return courses;
}
function readWeekTitle(courseId, weekKey, baseDataDir) {
  const catalogPath = join3(baseDataDir, courseId, "catalog.json");
  if (!existsSync3(catalogPath)) return null;
  try {
    const catalog = JSON.parse(readFileSync4(catalogPath, "utf8"));
    return catalog[weekKey]?.title ?? null;
  } catch {
    return null;
  }
}
var SCANNER_CONSTANTS = {
  WEEK_PREFIX: "week",
  SECTIONS: ["lectures", "practice"]
};
function getSubdirectories(directoryPath) {
  if (!existsSync3(directoryPath)) return [];
  return readdirSync2(directoryPath, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}
function scanSectionTopics(weekDir, weekKey, section) {
  const sectionDir = join3(weekDir, section);
  const topicFolderNames = getSubdirectories(sectionDir).filter(
    (name) => !name.startsWith("_") && !name.startsWith(".")
  );
  return topicFolderNames.map((topicId) => ({
    weekKey,
    section,
    topicId
  }));
}
function scanWeekTopics(courseDir, weekKey) {
  const weekDir = join3(courseDir, weekKey);
  const detectedSubdirs = getSubdirectories(weekDir);
  const validSections = detectedSubdirs.filter(
    (name) => SCANNER_CONSTANTS.SECTIONS.includes(name)
  );
  return validSections.flatMap(
    (section) => scanSectionTopics(weekDir, weekKey, section)
  );
}
function scanCourseTopics(courseId, baseDataDir) {
  const courseDir = join3(baseDataDir, courseId);
  const detectedSubdirs = getSubdirectories(courseDir);
  const weekFolderNames = detectedSubdirs.filter((name) => {
    if (name.startsWith("_") || name.startsWith(".")) return false;
    const sub = getSubdirectories(join3(courseDir, name));
    return sub.some((s) => SCANNER_CONSTANTS.SECTIONS.includes(s));
  });
  return weekFolderNames.flatMap(
    (weekKey) => scanWeekTopics(courseDir, weekKey)
  );
}

// prisma/topicLoader.ts
import { existsSync as existsSync4, readFileSync as readFileSync5 } from "fs";
import { join as join4, resolve as resolve2 } from "path";
var TOPIC_FILE_NAMES = {
  SCENE_JSON: "scene.json",
  MODEL_JSON: "model.json",
  CONTENT_JSON: "content.json",
  CATALOG_JSON: "catalog.json"
};
function formatTopicTitle(topicId) {
  const formatted = topicId.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  return { en: formatted };
}
function formatTopicDescription(topicId) {
  const title = formatTopicTitle(topicId);
  return { en: `Interactive visualization module for ${title.en}` };
}
function safeReadJson(filePath, label, allowedBaseDir) {
  try {
    const resolvedPath = resolve2(filePath);
    if (allowedBaseDir && !resolvedPath.startsWith(resolve2(allowedBaseDir))) {
      console.warn(`  WARN: Path traversal attempt rejected for ${label}: ${filePath}`);
      return null;
    }
    if (!existsSync4(resolvedPath)) return null;
    const raw = readFileSync5(resolvedPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  WARN: Could not parse JSON for ${label}: ${message}`);
    return null;
  }
}
async function loadScene(topicDir, courseId, topicId, baseDataDir) {
  return safeReadJson(join4(topicDir, TOPIC_FILE_NAMES.SCENE_JSON), `scene for ${courseId}/${topicId}`, baseDataDir);
}
async function loadModel(topicDir, courseId, topicId, baseDataDir) {
  return safeReadJson(join4(topicDir, TOPIC_FILE_NAMES.MODEL_JSON), `model for ${courseId}/${topicId}`, baseDataDir);
}
async function loadContent(topicDir, courseId, topicId, baseDataDir) {
  return safeReadJson(join4(topicDir, TOPIC_FILE_NAMES.CONTENT_JSON), `content for ${courseId}/${topicId}`, baseDataDir);
}
function loadCatalogTopicMetadata(courseId, weekKey, section, topicId, baseDataDir) {
  const catalogPath = join4(baseDataDir, courseId, TOPIC_FILE_NAMES.CATALOG_JSON);
  const catalog = safeReadJson(catalogPath, `catalog for ${courseId}`, baseDataDir);
  if (!catalog || typeof catalog !== "object") return null;
  const week = catalog[weekKey];
  if (!week || typeof week !== "object") return null;
  const items = week[section];
  if (!Array.isArray(items)) return null;
  const found = items.find((item) => item && item.id === topicId);
  if (!found) return null;
  return {
    title: found.title,
    description: found.description
  };
}
async function loadTopicData(courseId, weekKey, section, topicId, baseDataDir) {
  const topicDir = join4(baseDataDir, courseId, weekKey, section, topicId);
  const [scene, model, content] = await Promise.all([
    loadScene(topicDir, courseId, topicId, baseDataDir),
    loadModel(topicDir, courseId, topicId, baseDataDir),
    loadContent(topicDir, courseId, topicId, baseDataDir)
  ]);
  return {
    scene: scene ?? void 0,
    model: model ?? void 0,
    content: content ?? void 0
  };
}

// prisma/seed.ts
var prisma = new PrismaClient4();
var DEFAULT_DATA_DIR = join5(import.meta.dirname, "..", "data");
var isVerbose = process.env.VERBOSE === "true" || process.argv.includes("--verbose");
function verboseLog(msg) {
  if (isVerbose) console.log(msg);
}
function shouldDropEditorDoc(existingScene, newScene) {
  if (!newScene) return false;
  return JSON.stringify(existingScene ?? null) !== JSON.stringify(newScene);
}
async function seedCourse(db, course) {
  await db.course.upsert({ where: { id: course.id }, create: course, update: course });
  verboseLog(`  Course: ${course.id}`);
}
async function seedTopic(db, weekId, courseId, topic, dataDir) {
  const data = await loadTopicData(courseId, topic.weekKey, topic.section, topic.topicId, dataDir);
  const catalogMeta = loadCatalogTopicMetadata(courseId, topic.weekKey, topic.section, topic.topicId, dataDir);
  const payload = {
    title: catalogMeta?.title ?? formatTopicTitle(topic.topicId),
    description: catalogMeta?.description ?? formatTopicDescription(topic.topicId),
    scene: data.scene,
    model: data.model,
    content: data.content
  };
  const where = { weekId_section_topicId: { weekId, section: topic.section, topicId: topic.topicId } };
  const existing = await db.topic.findUnique({ where });
  if (shouldDropEditorDoc(existing?.scene, data.scene)) {
    await dropEditorDoc(db, topic.topicId);
  }
  await db.topic.upsert({
    where,
    create: { weekId, section: topic.section, topicId: topic.topicId, position: await db.topic.count({ where: { weekId, section: topic.section } }), ...payload },
    update: payload
  });
  verboseLog(`    Topic: ${topic.topicId}`);
}
async function seedCourseWeeksAndTopics(db, courseId, dataDir) {
  const topics = scanCourseTopics(courseId, dataDir);
  const weekKeys = [...new Set(topics.map((t) => t.weekKey))];
  for (const weekKey of weekKeys) {
    const title = readWeekTitle(courseId, weekKey, dataDir) ?? { en: weekKey };
    const week = await db.week.upsert({
      where: { courseId_weekKey: { courseId, weekKey } },
      create: { courseId, weekKey, title },
      update: { title }
    });
    verboseLog(`  Week: ${courseId}/${weekKey}`);
    for (const topic of topics.filter((t) => t.weekKey === weekKey)) {
      await seedTopic(db, week.id, courseId, topic, dataDir);
    }
  }
}
async function pruneStaleTopics(db, courseId, week, liveTopics) {
  const liveTopicKeys = new Set(
    liveTopics.filter((t) => t.weekKey === week.weekKey).map((t) => `${t.section}/${t.topicId}`)
  );
  for (const topic of week.topics) {
    if (liveTopicKeys.has(`${topic.section}/${topic.topicId}`)) continue;
    await db.topic.delete({ where: { id: topic.id } });
    verboseLog(`  Removed topic: ${courseId}/${week.weekKey}/${topic.section}/${topic.topicId}`);
  }
}
async function pruneStale(db, courses, dataDir) {
  const liveCourseIds = new Set(courses.map((c) => c.id));
  const dbCourses = await db.course.findMany({ include: { weeks: { include: { topics: true } } } });
  for (const course of dbCourses) {
    if (!liveCourseIds.has(course.id)) {
      await db.course.delete({ where: { id: course.id } });
      verboseLog(`  Removed course: ${course.id}`);
      continue;
    }
    const liveTopics = scanCourseTopics(course.id, dataDir);
    const liveWeekKeys = new Set(liveTopics.map((t) => t.weekKey));
    for (const week of course.weeks) {
      if (!liveWeekKeys.has(week.weekKey)) {
        await db.week.delete({ where: { id: week.id } });
        verboseLog(`  Removed week: ${course.id}/${week.weekKey}`);
        continue;
      }
      await pruneStaleTopics(db, course.id, week, liveTopics);
    }
  }
}
async function runSeed(db, dataDir = DEFAULT_DATA_DIR) {
  const courses = scanCourses(dataDir);
  for (const course of courses) {
    await seedCourse(db, course);
    await seedCourseWeeksAndTopics(db, course.id, dataDir);
  }
  await pruneStale(db, courses, dataDir);
}
async function seedAtomically(client = prisma) {
  await client.$transaction((tx) => runSeed(tx), { timeout: 3e4 });
}
async function main() {
  await seedAtomically();
}
var isMainModule = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  }).finally(() => prisma.$disconnect());
}

// server/index.ts
log.initCrashHandlers();
vaultService.initialize();
var prisma2 = new PrismaClient5({
  log: [
    { emit: "event", level: "query" },
    { emit: "event", level: "error" },
    { emit: "event", level: "warn" }
  ]
});
prisma2.$on("query", (e) => {
  if (e.duration > 50) {
    log.warn(`[Slow Query] ${e.query} (${e.duration}ms)`, {
      durationMs: e.duration,
      query: e.query
    });
  }
});
prisma2.$on("error", (e) => {
  log.error("[Prisma]", { message: e.message, target: e.target });
});
prisma2.$on("warn", (e) => {
  log.warn("[Prisma]", { message: e.message, target: e.target });
});
var DATA_DIR2 = path18.resolve(DATA_ROOT, "data");
if (fs12.existsSync(DATA_DIR2)) {
  let debounceTimer = null;
  try {
    fs12.watch(DATA_DIR2, { recursive: true }, (_event, filename) => {
      if (!filename || filename.endsWith(".tmp") || filename.includes("node_modules")) return;
      if (isOwnWrite(path18.join(DATA_DIR2, filename))) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        log.info(`[HotSync] Data change detected in ${filename}, reseeding database`);
        seedAtomically(prisma2).then(() => invalidateRegistryCache()).then(() => announceContentChange()).catch((err) => log.error("[HotSync] Reseed failed, database left unchanged", { error: err instanceof Error ? err.message : String(err) }));
      }, 300);
    });
  } catch (watchErr) {
    log.warn("Could not attach recursive watcher to data directory", { error: String(watchErr) });
  }
}
prisma2.$queryRawUnsafe(`
  PRAGMA journal_mode=WAL;
  PRAGMA busy_timeout=5000;
  PRAGMA cache_size=-64000;
  PRAGMA wal_autocheckpoint=1000;
`).catch((err) => {
  log.warn("Could not set SQLite performance PRAGMAs", { error: err instanceof Error ? err.message : String(err) });
});
var app = express3();
var PORT = process.env.BACKEND_PORT || 7301;
app.use(cors({ origin: allowedOrigins() }));
app.use("/api", localOnly);
app.use(express3.json({ limit: "10mb" }));
app.use((req, res, next) => {
  const reqId = crypto7.randomUUID();
  req.id = reqId;
  req.prisma = prisma2;
  res.setHeader("X-Request-Id", reqId);
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log.info("HTTP request", {
      id: reqId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration
    }, { fileOnly: true });
  });
  next();
});
app.use("/assets", express3.static(path18.resolve(DATA_ROOT, "data", "assets")));
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use("/api", apiRouter);
app.use("/__canvas-editor", (req, res, next) => {
  req.url = `/canvas-editor${req.url}`;
  apiRouter(req, res, next);
});
app.use("/__content-editor", (req, res, next) => {
  req.url = `/content-editor${req.url}`;
  apiRouter(req, res, next);
});
app.get("/api/health", async (_req, res) => {
  try {
    await prisma2.$queryRaw`SELECT 1`;
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const mcpServers = mcpLinker.getServers();
    res.json({
      status: "ok",
      db: "connected",
      uptimeSeconds: Math.round(process.uptime()),
      cpu: {
        userMicroseconds: cpu.user,
        systemMicroseconds: cpu.system
      },
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024)
      },
      mcp: {
        activeProcesses: mcpServers.filter((s) => s.status === "connected").length,
        totalConfigured: mcpServers.length
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    log.error("Health check failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});
var DIST_DIR = path18.resolve(PACKAGE_ROOT, "dist");
var serveBuild = !process.argv.includes("--dev");
if (serveBuild) app.use(express3.static(DIST_DIR));
app.get("*", (req, res, next) => {
  if (!serveBuild || req.path.startsWith("/api") || req.path.startsWith("/assets") || req.path.startsWith("/__")) return next();
  res.sendFile(path18.join(DIST_DIR, "index.html"), (err) => {
    if (err) next(err);
  });
});
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/__")) {
    return void res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  }
  next();
});
app.use(errorHandler);
function listenWithRetry(startPort) {
  return new Promise((resolve3) => {
    const port = Number(startPort);
    const srv = app.listen(port, "127.0.0.1", () => {
      log.info(`StudyTS backend running on http://localhost:${port}`, { port });
      resolve3(srv);
    });
    srv.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        log.error(`Port ${port} already in use \u2014 another StudyTS backend is likely already running. Run "npm stop" (or "npm run stop:dev") first.`);
        process.exit(1);
      } else {
        log.error("Failed to bind backend port", { error: err.message });
        process.exit(1);
      }
    });
  });
}
var server = await listenWithRetry(Number(PORT));
log.setShutdownHook(() => gracefulShutdown(server, prisma2));
await mcpLinker.init().catch((err) => log.warn("Failed to initialize MCP linker", err));
var handleExitSignal = async (signal) => {
  log.info(`Received ${signal}, shutting down...`);
  await gracefulShutdown(server, prisma2);
  process.exit(0);
};
process.on("SIGTERM", () => handleExitSignal("SIGTERM"));
process.on("SIGINT", () => handleExitSignal("SIGINT"));
