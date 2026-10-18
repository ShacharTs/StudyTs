// src/core/shared/attachmentPolicy.ts
/** The one place that decides which files the AI chat accepts; client uses it for UX, the server re-runs it as the authority. */
export const ATTACHMENT_POLICY = {
  maxCount: 10,
  maxFileBytes: 5 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  allowedExtensions: ['.pdf', '.txt', '.md', '.ts', '.tsx', '.js', '.json'],
  blockedExtensions: ['.zip', '.rar', '.7z', '.gz', '.tgz', '.tar', '.bz2', '.xz'],
  blockedMimes: [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/vnd.rar',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-gzip',
    'application/x-tar',
    'application/x-bzip2',
    'application/x-xz',
  ],
  // Signatures checked at offset 0 unless an offset is given. PK covers zip, empty zip, spanned zip and all zip containers (docx, jar, apk).
  archiveSignatures: [
    { name: 'zip', offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
    { name: 'zip-empty', offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06] },
    { name: 'zip-spanned', offset: 0, bytes: [0x50, 0x4b, 0x07, 0x08] },
    { name: 'rar', offset: 0, bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] },
    { name: '7z', offset: 0, bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
    { name: 'gzip', offset: 0, bytes: [0x1f, 0x8b] },
    // ponytail: bzip2 starts with BZh; rare collision with plain English word list accepted
    { name: 'bzip2', offset: 0, bytes: [0x42, 0x5a, 0x68] },
    { name: 'xz', offset: 0, bytes: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00] },
    { name: 'tar', offset: 257, bytes: [0x75, 0x73, 0x74, 0x61, 0x72] },
  ],
  pdfSignature: [0x25, 0x50, 0x44, 0x46, 0x2d],
  textSniffBytes: 8192,
} as const;

export type AttachmentRejection =
  | 'empty'
  | 'too-large'
  | 'archive-extension'
  | 'archive-signature'
  | 'archive-mime'
  | 'unsupported-extension'
  | 'pdf-signature'
  | 'binary-content'
  | 'too-many'
  | 'duplicate'
  | 'total-too-large';

export interface AttachmentCandidate {
  name: string;
  mime: string;
  bytes: Uint8Array;
  size?: number;
}

export type AttachmentVerdict = { ok: true } | { ok: false; reason: AttachmentRejection };

const reject = (reason: AttachmentRejection): AttachmentVerdict => ({ ok: false, reason });
const OK: AttachmentVerdict = { ok: true };

const lowerName = (name: string) => name.toLowerCase();
const hasExtension = (name: string, list: readonly string[]) => list.some((ext) => lowerName(name).endsWith(ext));
const startsWith = (bytes: Uint8Array, sig: readonly number[], offset = 0) =>
  bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);

function checkSize(size: number): AttachmentVerdict | null {
  if (size === 0) return reject('empty');
  if (size > ATTACHMENT_POLICY.maxFileBytes) return reject('too-large');
  return null;
}

function checkDisguisedArchives(name: string, mime: string, bytes: Uint8Array): AttachmentVerdict | null {
  if (hasExtension(name, ATTACHMENT_POLICY.blockedExtensions)) return reject('archive-extension');
  if ((ATTACHMENT_POLICY.blockedMimes as readonly string[]).includes(mime.toLowerCase())) return reject('archive-mime');
  if (ATTACHMENT_POLICY.archiveSignatures.some((s) => startsWith(bytes, s.bytes, s.offset))) return reject('archive-signature');
  return null;
}

function checkContentSignature(name: string, bytes: Uint8Array): AttachmentVerdict {
  if (!hasExtension(name, ATTACHMENT_POLICY.allowedExtensions)) return reject('unsupported-extension');
  if (lowerName(name).endsWith('.pdf')) return startsWith(bytes, ATTACHMENT_POLICY.pdfSignature) ? OK : reject('pdf-signature');
  return bytes.subarray(0, ATTACHMENT_POLICY.textSniffBytes).includes(0) ? reject('binary-content') : OK;
}

/** Validates single attachment candidate against policy rules. */
export function validateAttachment({ name, mime, bytes, size }: AttachmentCandidate): AttachmentVerdict {
  const sizeVerdict = checkSize(size ?? bytes.length);
  if (sizeVerdict) return sizeVerdict;

  const archiveVerdict = checkDisguisedArchives(name, mime, bytes);
  if (archiveVerdict) return archiveVerdict;

  return checkContentSignature(name, bytes);
}

/** Validates candidate attachment against existing batch state and limits. */
export function validateAttachmentBatch(
  existing: { name: string; size: number }[],
  incoming: AttachmentCandidate
): AttachmentVerdict {
  if (existing.length >= ATTACHMENT_POLICY.maxCount) return reject('too-many');
  if (existing.some((f) => f.name === incoming.name)) return reject('duplicate');
  const incomingSize = incoming.size ?? incoming.bytes.length;
  const total = existing.reduce((sum, f) => sum + f.size, 0) + incomingSize;
  return total > ATTACHMENT_POLICY.maxTotalBytes ? reject('total-too-large') : validateAttachment(incoming);
}
