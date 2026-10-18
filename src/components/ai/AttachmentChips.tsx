// src/components/ai/AttachmentChips.tsx
import { FileText, FileCode, Paperclip, AlertCircle } from 'lucide-react';
import type { AiAttachment, AttachmentRejectionItem } from './useAiAttachments';
import { getRejectionMessage } from './attachmentRejectionText';
import styles from './AttachmentChips.module.css';

interface AttachmentChipsProps {
  val: (input?: unknown) => string;
  attachments: AiAttachment[];
  rejections: AttachmentRejectionItem[];
  onRemove: (id: string) => void;
  onDismissRejection: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.js') || lower.endsWith('.json')) {
    return <FileCode size={13} className={styles.icon} />;
  }
  if (lower.endsWith('.pdf')) {
    return <Paperclip size={13} className={styles.icon} />;
  }
  return <FileText size={13} className={styles.icon} />;
}

export function AttachmentChips({
  val,
  attachments,
  rejections,
  onRemove,
  onDismissRejection,
}: AttachmentChipsProps) {
  if (attachments.length === 0 && rejections.length === 0) return null;

  return (
    <div className={styles.chipsContainer}>
      {attachments.map((att) => (
        <div key={att.id} className={styles.chip} title={att.name}>
          {fileIcon(att.name)}
          <span className={styles.name}>{att.name}</span>
          <span className={styles.size}>{formatBytes(att.size)}</span>
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => onRemove(att.id)}
            aria-label={`Remove ${att.name}`}
          >
            ×
          </button>
        </div>
      ))}

      {rejections.map((rej) => {
        const errorMsg = getRejectionMessage(val, rej.reason);
        return (
          <div key={rej.id} className={styles.chipError} title={`${rej.name}: ${errorMsg}`}>
            <AlertCircle size={13} className={styles.errorIcon} />
            <span className={styles.name}>{rej.name}</span>
            <span className={styles.errorReason}>({errorMsg})</span>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => onDismissRejection(rej.id)}
              aria-label={`Dismiss error for ${rej.name}`}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
