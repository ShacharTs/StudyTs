// src/components/ai/useAiAttachments.ts
import { useState, useCallback, useRef } from 'react';
import {
  validateAttachmentBatch,
  type AttachmentRejection,
  type AttachmentCandidate,
} from '../../core/shared/attachmentPolicy';
import { extractPdfMarkdown } from '../../ai/context/extractPdfMarkdown';

export interface AiAttachment {
  id: string;
  name: string;
  size: number;
  content: string;
}

export interface AttachmentRejectionItem {
  id: string;
  name: string;
  reason: AttachmentRejection | 'server-unavailable';
}

type IngestResult =
  | { ok: true; attachment: AiAttachment }
  | { ok: false; reason: AttachmentRejection | 'server-unavailable' };

function bufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function requestServerValidation(
  name: string,
  mime: string,
  bytes: Uint8Array
): Promise<{ ok: true; text?: string | null } | { ok: false; reason: AttachmentRejection | 'server-unavailable' }> {
  try {
    const base64 = bufferToBase64(bytes);
    const response = await fetch('/api/ai/attachments/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [{ name, mime, base64 }],
      }),
    });

    if (!response.ok) return { ok: false, reason: 'server-unavailable' };
    const data = (await response.json()) as {
      results: Array<{ name: string; ok: boolean; text?: string | null; reason?: AttachmentRejection }>;
    };
    const result = data.results?.[0];
    if (!result || !result.ok) return { ok: false, reason: result?.reason || 'server-unavailable' };
    return { ok: true, text: result.text };
  } catch {
    return { ok: false, reason: 'server-unavailable' };
  }
}

async function processSingleFile(
  file: File,
  existingList: { name: string; size: number }[]
): Promise<IngestResult> {
  const headerSlice = file.slice(0, 8192);
  const headerBuffer = await headerSlice.arrayBuffer();
  const headerBytes = new Uint8Array(headerBuffer);
  const candidate: AttachmentCandidate = {
    name: file.name,
    mime: file.type || '',
    bytes: headerBytes,
    size: file.size,
  };

  const clientVerdict = validateAttachmentBatch(existingList, candidate);
  if (!clientVerdict.ok) {
    return { ok: false, reason: clientVerdict.reason };
  }

  const fullBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(fullBuffer);

  const serverResult = await requestServerValidation(file.name, file.type || '', bytes);
  if (!serverResult.ok) {
    return { ok: false, reason: serverResult.reason };
  }

  let contentText = serverResult.text || '';
  if (file.name.toLowerCase().endsWith('.pdf')) {
    const pdfMd = await extractPdfMarkdown(file);
    if (!pdfMd) return { ok: false, reason: 'pdf-signature' };
    contentText = pdfMd;
  }

  return {
    ok: true,
    attachment: {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      content: contentText,
    },
  };
}

export function useAiAttachments() {
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [rejections, setRejections] = useState<AttachmentRejectionItem[]>([]);
  const [pending, setPending] = useState(0);
  const attachmentsRef = useRef<AiAttachment[]>([]);
  attachmentsRef.current = attachments;

  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setPending((p) => p + 1);

    const working = [...attachmentsRef.current];

    for (const file of files) {
      try {
        const result = await processSingleFile(file, working);
        if (!result.ok) {
          setRejections((rej) => [
            ...rej,
            { id: crypto.randomUUID(), name: file.name, reason: result.reason },
          ]);
        } else {
          working.push(result.attachment);
          setAttachments([...working]);
        }
      } catch {
        setRejections((rej) => [
          ...rej,
          { id: crypto.randomUUID(), name: file.name, reason: 'server-unavailable' },
        ]);
      }
    }

    setPending((p) => Math.max(0, p - 1));
  }, []);

  const remove = useCallback((id: string) => {
    setAttachments((current) => {
      const updated = current.filter((att) => att.id !== id);
      attachmentsRef.current = updated;
      return updated;
    });
  }, []);

  const clear = useCallback(() => {
    attachmentsRef.current = [];
    setAttachments([]);
    setRejections([]);
  }, []);

  const dismissRejection = useCallback((id: string) => {
    setRejections((current) => current.filter((rej) => rej.id !== id));
  }, []);

  return {
    attachments,
    pending,
    rejections,
    addFiles,
    remove,
    clear,
    dismissRejection,
  };
}
