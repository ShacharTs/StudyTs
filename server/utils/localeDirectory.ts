// Reads, validates, caches, and writes runtime locale packs in the locales/ directory.

import fs from 'node:fs';
import path from 'node:path';
import {
  LOCALE_CODE_PATTERN,
  LOCALE_PACK_LIMITS,
  RESERVED_LOCALE_CODES,
} from '../../src/core/shared/localePackLimits.js';
import {
  LocalePack,
  PackIssue,
  placeholdersOf,
  validateLocalePack,
} from '../../src/core/shared/localePack.js';
import { TranslationLeaf } from '../../src/core/shared/translationLeaves.js';
import { PACKAGE_ROOT } from '../runtime/appPaths.js';

export interface LoadedLocale {
  pack: LocalePack;
  issues: PackIssue[];
  file: string;
}

export class LocaleExistsError extends Error {
  constructor(code: string) {
    super(`Locale file for code "${code}" already exists`);
    this.name = 'LocaleExistsError';
  }
}

export function resolveLocalesDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.STUDYTS_LOCALES_DIR
    ? path.resolve(env.STUDYTS_LOCALES_DIR)
    : path.resolve(PACKAGE_ROOT, 'locales');
}

export function findPlaceholderMismatches(
  pack: LocalePack,
  leaves: Map<string, TranslationLeaf>
): PackIssue[] {
  const issues: PackIssue[] = [];

  for (const [key, translatedText] of Object.entries(pack.strings)) {
    const leaf = leaves.get(key);
    if (!leaf) continue;
    const expected = placeholdersOf(leaf.en);
    const actual = placeholdersOf(translatedText);

    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      issues.push({
        level: 'warning',
        key,
        message: `Placeholder mismatch for "${key}": expected [${expected.join(', ')}], got [${actual.join(', ')}]`,
      });
    }
  }

  return issues;
}

interface CacheEntry {
  mtime: number;
  packs: LoadedLocale[];
  rejected: { file: string; issues: PackIssue[] }[];
}

const dirCache = new Map<string, CacheEntry>();

function getDirMaxMtime(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  const stat = fs.statSync(dir);
  let maxMtime = stat.mtimeMs;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      const fileStat = fs.statSync(path.join(dir, entry.name));
      if (fileStat.mtimeMs > maxMtime) maxMtime = fileStat.mtimeMs;
    }
  }
  return maxMtime;
}

function parseJsonFile(filePath: string): { parsed?: unknown; parseError?: string } {
  const stat = fs.statSync(filePath);
  if (stat.size > LOCALE_PACK_LIMITS.maxBytes) {
    return { parseError: `File size exceeds limit of ${LOCALE_PACK_LIMITS.maxBytes} bytes` };
  }

  let rawText = fs.readFileSync(filePath, 'utf8');
  if (rawText.charCodeAt(0) === 0xfeff) rawText = rawText.slice(1);

  try {
    return { parsed: JSON.parse(rawText) };
  } catch (err) {
    return { parseError: `Invalid JSON syntax: ${(err as Error).message}` };
  }
}

function loadPackFile(
  dir: string,
  file: string,
  knownKeys: ReadonlySet<string>,
  seenCodes: Set<string>,
  leaves?: Map<string, TranslationLeaf>
): { pack?: LoadedLocale; rejection?: { file: string; issues: PackIssue[] } } {
  const filePath = path.join(dir, file);
  const { parsed, parseError } = parseJsonFile(filePath);
  if (parseError) {
    return { rejection: { file, issues: [{ level: 'error', message: parseError }] } };
  }

  const { pack, issues } = validateLocalePack(parsed, knownKeys);
  if (!pack) {
    return { rejection: { file, issues } };
  }

  const fileStem = path.basename(file, '.json').toLowerCase();
  if (fileStem !== pack.meta.code.toLowerCase()) {
    return {
      rejection: {
        file,
        issues: [{ level: 'error', message: `File name "${file}" does not match locale code "${pack.meta.code}"` }],
      },
    };
  }

  if (seenCodes.has(fileStem)) {
    return {
      rejection: {
        file,
        issues: [{ level: 'error', message: `Duplicate locale code "${pack.meta.code}" already loaded` }],
      },
    };
  }

  seenCodes.add(fileStem);

  if (leaves) {
    const placeholderIssues = findPlaceholderMismatches(pack, leaves);
    issues.push(...placeholderIssues);
    for (const issue of placeholderIssues) {
      if (issue.key) delete pack.strings[issue.key];
    }
  }

  return { pack: { pack, issues, file } };
}

export async function readLocalePacks(
  dir: string,
  knownKeys: ReadonlySet<string>,
  leaves?: Map<string, TranslationLeaf>
): Promise<{ packs: LoadedLocale[]; rejected: { file: string; issues: PackIssue[] }[] }> {
  if (!fs.existsSync(dir)) return { packs: [], rejected: [] };

  const currentMtime = getDirMaxMtime(dir);
  const cached = dirCache.get(dir);
  if (cached && cached.mtime === currentMtime) {
    return { packs: cached.packs, rejected: cached.rejected };
  }

  const rawFiles = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.json') && !e.name.startsWith('_') && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();

  const packs: LoadedLocale[] = [];
  const rejected: { file: string; issues: PackIssue[] }[] = [];
  const seenCodes = new Set<string>();

  for (const file of rawFiles) {
    const res = loadPackFile(dir, file, knownKeys, seenCodes, leaves);
    if (res.rejection) rejected.push(res.rejection);
    else if (res.pack) packs.push(res.pack);
  }

  const result = { packs, rejected };
  dirCache.set(dir, { mtime: currentMtime, ...result });
  return result;
}

export async function writeTemplate(
  dir: string,
  code: string,
  englishLeaves: Map<string, TranslationLeaf>,
  nativeName = code,
  englishName = code
): Promise<string> {
  const codeLower = code.trim().toLowerCase();
  if (!LOCALE_CODE_PATTERN.test(codeLower) || RESERVED_LOCALE_CODES.includes(codeLower)) {
    throw new Error(`Invalid or reserved locale code: "${code}"`);
  }

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const targetPath = path.join(dir, `${codeLower}.json`);
  if (fs.existsSync(targetPath)) {
    throw new LocaleExistsError(codeLower);
  }

  const isDefaultRtl = ['ar', 'fa', 'ur', 'yi', 'ps', 'dv'].includes(codeLower.split('-')[0]);
  const strings: Record<string, string> = {};
  for (const [key, leaf] of englishLeaves.entries()) {
    strings[key] = leaf.en;
  }

  const pack: LocalePack = {
    meta: {
      code: codeLower,
      nativeName,
      englishName,
      dir: isDefaultRtl ? 'rtl' : 'ltr',
      flag: codeLower.toUpperCase(),
    },
    strings,
  };

  const tempPath = path.join(dir, `.${codeLower}.json.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`);
  try {
    fs.writeFileSync(tempPath, JSON.stringify(pack, null, 2) + '\n', 'utf8');
    fs.renameSync(tempPath, targetPath);
    return targetPath;
  } catch (err) {
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
    throw err;
  }
}
