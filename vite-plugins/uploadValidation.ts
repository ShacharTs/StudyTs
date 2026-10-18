/**
 * Upload hardening for the /__canvas-editor/upload endpoint. Extension
 * whitelist alone doesn't validate actual file content (a .png-named file
 * could be arbitrary bytes), so every accepted extension also gets a
 * magic-byte signature check. SVG is rejected outright rather than
 * accepted-and-stripped, since reliably stripping <script>/event-handler
 * content from arbitrary SVG is its own attack surface. The filename
 * written to disk is always derived fresh — never any part of the
 * client-supplied name — and course/topic path segments go through the
 * same validateSlug the catalog patcher uses, with a final containment
 * check that the resolved path is still under the real assets root.
 */

import path from 'path';
import { randomBytes } from 'crypto';

export class InvalidUploadError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = 'InvalidUploadError';
  }
}

export class InvalidSlugError extends Error {
  constructor(public slug: string, public reason: string) {
    super(`Invalid slug '${slug}': ${reason}`);
    this.name = 'InvalidSlugError';
  }
}

const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;
const RESERVED_WINDOWS_NAMES = new Set([
  'con', 'nul', 'aux', 'prn',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
]);
const PURELY_NUMERIC_RE = /^[0-9]+$/;
const MAX_SLUG_LENGTH = 64;

/**
 * Ids become filesystem path segments here (see resolveUploadPath below).
 * This is the path-traversal defense: blocks separators/dot-segments via
 * SLUG_RE, Windows-reserved device names, trailing dot/space, and
 * purely-numeric ids (which reorder as integer-like keys elsewhere).
 */
export function validateSlug(slug: string): void {
  if (slug.length === 0) {
    throw new InvalidSlugError(slug, 'must not be empty');
  }
  if (slug.length > MAX_SLUG_LENGTH) {
    throw new InvalidSlugError(slug, `must be at most ${MAX_SLUG_LENGTH} characters`);
  }
  if (!SLUG_RE.test(slug)) {
    throw new InvalidSlugError(slug, 'must match /^[a-z0-9][a-z0-9_-]*$/');
  }
  if (RESERVED_WINDOWS_NAMES.has(slug.toLowerCase())) {
    throw new InvalidSlugError(slug, 'is a reserved Windows device name');
  }
  if (/[. ]$/.test(slug)) {
    throw new InvalidSlugError(slug, 'must not end with a dot or space');
  }
  if (PURELY_NUMERIC_RE.test(slug)) {
    throw new InvalidSlugError(slug, 'must not be purely numeric');
  }
}

const VALID_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'mp4', 'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt', 'md']);

export function assertValidExtension(filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase();
  if (!ext || !VALID_EXTENSIONS.has(ext)) {
    throw new InvalidUploadError(
      `Extension '${ext || '(none)'}' is not allowed. Allowed: ${[...VALID_EXTENSIONS].join(', ')}`
    );
  }
  return ext;
}

type MagicByteCheck = (buf: Buffer) => boolean;

function isOleCompound(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
}

function isPlainText(buf: Buffer): boolean {
  return !buf.subarray(0, 4096).includes(0);
}

function isZipContainer(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

const MAGIC_BYTES: Record<string, MagicByteCheck> = {
  png: (buf) => buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
  jpg: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  jpeg: (buf) => MAGIC_BYTES.jpg(buf),
  webp: (buf) =>
    buf.length >= 12 &&
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP',
  mp4: (buf) => buf.length >= 8 && buf.slice(4, 8).toString('ascii') === 'ftyp',
  pdf: (buf) => buf.length >= 5 && buf.slice(0, 5).toString('ascii') === '%PDF-',
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
  md: isPlainText,
};

export function assertValidMagicBytes(buffer: Buffer, extension: string): void {
  const check = MAGIC_BYTES[extension];
  if (!check || !check(buffer)) {
    throw new InvalidUploadError(`File content does not match the expected signature for '.${extension}'`);
  }
}

// Documents keep the name the teacher uploaded, so the copy in data/ reads like the original.
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt', 'md']);

export function isDocumentExtension(extension: string): boolean {
  return DOCUMENT_EXTENSIONS.has(extension);
}

export function safeDocumentName(originalFilename: string): string {
  const unsafe = '<>:|?*"/' + String.fromCharCode(92);
  const base = Array.from(path.basename(originalFilename))
    .map((c) => (unsafe.includes(c) || c.charCodeAt(0) < 32 ? '_' : c))
    .join('')
    .trim();
  if (base.length === 0 || base === '.' || base === '..') {
    throw new InvalidUploadError('Filename is empty after removing unsafe characters');
  }
  return base;
}

export function sanitizeUploadFilename(originalFilename: string): string {
  const ext = assertValidExtension(originalFilename);
  const randomSlug = randomBytes(8).toString('hex');
  return `${randomSlug}.${ext}`;
}

export function resolveUploadPath(
  publicAssetsRoot: string,
  courseId: string,
  topicId: string,
  filename: string
): string {
  validateSlug(courseId);
  validateSlug(topicId);

  const joined = path.join(publicAssetsRoot, courseId, topicId, filename);
  const resolvedRoot = path.resolve(publicAssetsRoot);
  const resolvedPath = path.resolve(joined);

  // Check that the resolved path doesn't escape the root
  if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
    throw new InvalidUploadError('Resolved upload path escapes the assets root');
  }

  return joined;
}
