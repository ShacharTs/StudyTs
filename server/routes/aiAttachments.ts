// server/routes/aiAttachments.ts
import { Router, type Request, type Response } from 'express';
import {
  ATTACHMENT_POLICY,
  validateAttachmentBatch,
  type AttachmentCandidate,
  type AttachmentVerdict,
} from '../../src/core/shared/attachmentPolicy.js';

export const aiAttachmentsRouter = Router();

interface IncomingFile {
  name: string;
  mime: string;
  base64: string;
}

interface ValidationResultSuccess {
  name: string;
  ok: true;
  text: string | null;
}

interface ValidationResultFailure {
  name: string;
  ok: false;
  reason: string;
}

type FileValidationResult = ValidationResultSuccess | ValidationResultFailure;

const decodeText = (bytes: Uint8Array): { ok: true; text: string } | { ok: false } => {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { ok: true, text };
  } catch {
    return { ok: false };
  }
};

const processFile = (
  file: IncomingFile,
  acceptedList: { name: string; size: number }[]
): FileValidationResult => {
  const bytes = new Uint8Array(Buffer.from(file.base64, 'base64'));
  const candidate: AttachmentCandidate = {
    name: file.name,
    mime: file.mime || '',
    bytes,
  };

  const verdict: AttachmentVerdict = validateAttachmentBatch(acceptedList, candidate);
  if (!verdict.ok) {
    return { name: file.name, ok: false, reason: verdict.reason };
  }

  acceptedList.push({ name: file.name, size: bytes.length });
  if (file.name.toLowerCase().endsWith('.pdf')) {
    return { name: file.name, ok: true, text: null };
  }

  const decoded = decodeText(bytes);
  if (!decoded.ok) {
    return { name: file.name, ok: false, reason: 'binary-content' };
  }

  return { name: file.name, ok: true, text: decoded.text };
};

aiAttachmentsRouter.post('/ai/attachments/validate', (req: Request, res: Response) => {
  const { files } = req.body as { files?: unknown };

  if (!Array.isArray(files)) {
    return res.status(400).json({ error: 'files array is required' });
  }

  if (files.length > ATTACHMENT_POLICY.maxCount) {
    return res.status(400).json({ error: `Exceeded maximum attachment count (${ATTACHMENT_POLICY.maxCount})` });
  }

  const validStructure = files.every(
    (f) => f && typeof f === 'object' && typeof f.name === 'string' && typeof f.base64 === 'string'
  );

  if (!validStructure) {
    return res.status(400).json({ error: 'Invalid file payload structure' });
  }

  const acceptedList: { name: string; size: number }[] = [];
  const results: FileValidationResult[] = (files as IncomingFile[]).map((file) =>
    processFile(file, acceptedList)
  );

  return res.json({ results });
});
