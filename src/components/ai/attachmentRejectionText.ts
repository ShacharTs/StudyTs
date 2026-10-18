// src/components/ai/attachmentRejectionText.ts
import { AI_TEXT } from '../../i18n/dictionary';
import type { AttachmentRejection } from '../../core/shared/attachmentPolicy';
import type { LocalizedText } from '../../i18n/localizedValue';

export type ExtendedRejectionReason = AttachmentRejection | 'server-unavailable';

export const REJECTION_TEXT_KEYS: Record<ExtendedRejectionReason, LocalizedText> = {
  empty: AI_TEXT.attachment_empty,
  'too-large': AI_TEXT.attachment_too_large,
  'archive-extension': AI_TEXT.attachment_archive_extension,
  'archive-signature': AI_TEXT.attachment_archive_signature,
  'archive-mime': AI_TEXT.attachment_archive_mime,
  'unsupported-extension': AI_TEXT.attachment_unsupported_extension,
  'pdf-signature': AI_TEXT.attachment_pdf_signature,
  'binary-content': AI_TEXT.attachment_binary_content,
  'too-many': AI_TEXT.attachment_too_many,
  duplicate: AI_TEXT.attachment_duplicate,
  'total-too-large': AI_TEXT.attachment_total_too_large,
  'server-unavailable': AI_TEXT.attachment_server_unavailable,
};

export function getRejectionMessage(
  val: (t?: unknown) => string,
  reason: ExtendedRejectionReason
): string {
  const key = REJECTION_TEXT_KEYS[reason];
  return key ? val(key) : reason;
}
