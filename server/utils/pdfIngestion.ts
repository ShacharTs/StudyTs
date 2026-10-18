import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { log } from './log.js';
import { DATA_ROOT } from '../runtime/appPaths.js';

const PDF_MAGIC_BYTES = Buffer.from('%PDF-');
const DEFAULT_TEMP_DIR = path.resolve(DATA_ROOT, 'temp', 'pdf_ingest');
const MAX_ORPHAN_AGE_MS = 60 * 60 * 1000;

interface ExtractedTable {
  id: string;
  section: string;
  headers: string[];
  rows: string[][];
  rawMarkdown: string;
}

interface ExtractedFormula {
  id: string;
  type: 'inline' | 'block';
  content: string;
  section: string;
}

interface SemanticSection {
  id: string;
  level: number;
  title: string;
  content: string;
  characterCount: number;
  tables: ExtractedTable[];
  formulas: ExtractedFormula[];
}

interface IngestionResult {
  filename: string;
  fileSizeBytes: number;
  rawMarkdown: string;
  characterCount: number;
  sections: SemanticSection[];
  coverageIndex: {
    totalSections: number;
    totalTables: number;
    totalFormulas: number;
    isExhaustive: boolean;
    sectionIds: string[];
  };
}

export function validatePdfBuffer(buffer: Buffer): boolean {
  return !!buffer && buffer.length >= 5 && buffer.subarray(0, 5).equals(PDF_MAGIC_BYTES);
}

export function sanitizeFilename(filename: string): string {
  if (!filename) return 'document.pdf';
  const clean = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  return clean.endsWith('.pdf') ? clean : `${clean}.pdf`;
}

export async function createSecureTempPdf(
  buffer: Buffer,
  originalName: string = 'upload.pdf',
  customTempDir: string = DEFAULT_TEMP_DIR
): Promise<{ tempPath: string; cleanup: () => Promise<void> }> {
  if (!validatePdfBuffer(buffer)) throw new Error('Invalid PDF: file header does not match %PDF- signature');
  await fs.mkdir(customTempDir, { recursive: true, mode: 0o700 });
  const tempPath = path.join(customTempDir, `${crypto.randomUUID()}_${sanitizeFilename(originalName)}`);
  await fs.writeFile(tempPath, buffer, { mode: 0o600 });
  return {
    tempPath,
    cleanup: async () => {
      try { await fs.unlink(tempPath); } catch (err) { log.warn('Failed temp PDF cleanup', { tempPath, err }); }
    },
  };
}

/** Deletes `fullPath` if it is a file older than `maxAgeMs`; true when deleted, false on skip or any fs error. */
async function purgeIfStale(fullPath: string, now: number, maxAgeMs: number): Promise<boolean> {
  try {
    const stats = await fs.stat(fullPath);
    if (!stats.isFile() || now - stats.mtimeMs <= maxAgeMs) return false;
    await fs.unlink(fullPath);
    return true;
  } catch {
    return false;
  }
}

export async function sweepOrphanedTempPdfs(
  dir: string = DEFAULT_TEMP_DIR,
  maxAgeMs: number = MAX_ORPHAN_AGE_MS
): Promise<number> {
  if (!fsSync.existsSync(dir)) return 0;
  let purgedCount = 0;
  try {
    const entries = await fs.readdir(dir);
    const now = Date.now();
    for (const entry of entries) {
      if (await purgeIfStale(path.join(dir, entry), now, maxAgeMs)) purgedCount++;
    }
  } catch (err) {
    log.error('Error sweeping temporary PDF directory', { dir, err });
  }
  return purgedCount;
}

export function extractMarkdownTables(text: string, sectionTitle: string = 'General'): ExtractedTable[] {
  const tables: ExtractedTable[] = [];
  const lines = text.split('\n');
  let curLines: string[] = [];

  const flush = () => {
    if (curLines.length >= 2) {
      const parsed = curLines.map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
      const data = parsed.filter((r) => !r.every((c) => /^:?-+:?$/.test(c)));
      if (data.length > 0) {
        tables.push({
          id: `tbl-${crypto.randomUUID().slice(0, 8)}`,
          section: sectionTitle,
          headers: data[0],
          rows: data.slice(1),
          rawMarkdown: curLines.join('\n'),
        });
      }
    }
    curLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) curLines.push(trimmed);
    else if (curLines.length) flush();
  }
  if (curLines.length) flush();
  return tables;
}

export function extractFormulas(text: string, sectionTitle: string = 'General'): ExtractedFormula[] {
  const formulas: ExtractedFormula[] = [];
  const blockRegex = /\$\$([\s\S]*?)\$\$/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(text)) !== null) {
    if (match[1]?.trim()) {
      formulas.push({ id: `form-blk-${crypto.randomUUID().slice(0, 8)}`, type: 'block', content: match[1].trim(), section: sectionTitle });
    }
  }
  const inlineRegex = /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g;
  while ((match = inlineRegex.exec(text)) !== null) {
    if (match[1]?.trim()) {
      formulas.push({ id: `form-inl-${crypto.randomUUID().slice(0, 8)}`, type: 'inline', content: match[1].trim(), section: sectionTitle });
    }
  }
  return formulas;
}

function partitionMarkdownAst(markdown: string): SemanticSection[] {
  const sections: SemanticSection[] = [];
  let currentTitle = 'Introduction';
  let currentLevel = 1;
  let currentContentLines: string[] = [];

  const flush = () => {
    const content = currentContentLines.join('\n').trim();
    if (content.length > 0 || currentTitle !== 'Introduction') {
      sections.push({
        id: `sec-${sections.length + 1}-${currentTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        level: currentLevel,
        title: currentTitle,
        content,
        characterCount: content.length,
        tables: extractMarkdownTables(content, currentTitle),
        formulas: extractFormulas(content, currentTitle),
      });
    }
    currentContentLines = [];
  };

  for (const line of markdown.split('\n')) {
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

export function processZeroLossIngestion(filename: string, fileSizeBytes: number, markdownText: string): IngestionResult {
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
      sectionIds: sections.map((s) => s.id),
    },
  };
}
