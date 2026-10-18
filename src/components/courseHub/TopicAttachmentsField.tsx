// src/components/courseHub/TopicAttachmentsField.tsx
/** Lecture documents on an existing topic: attach a file, review the list, download any of them. */
import React, { useState } from 'react';
import { useTranslation, HUB_TEXT } from '@i18n';
import { attachmentTypeOf, type TopicAttachment } from '@core/shared/topicAttachment';
import { extensionOf, uploadTopicFile } from './topicFileUpload';
import buttons from './courseHubButtons.module.css';
import { FileDropzone } from './FileDropzone';
import styles from './TopicAttachmentsField.module.css';

const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md';

interface TopicAttachmentsFieldProps {
  courseId: string;
  topicId: string;
  attachments: TopicAttachment[];
  onChange: (next: TopicAttachment[]) => void;
}

export const TopicAttachmentsField: React.FC<TopicAttachmentsFieldProps> = ({ courseId, topicId, attachments, onChange }) => {
  const { val } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!attachmentTypeOf(extensionOf(file.name))) {
      setError(val(HUB_TEXT.attachmentTypeRefused));
      return;
    }
    setBusy(true);
    setError(null);
    uploadTopicFile(file, courseId, topicId)
      .then((record) => onChange([...attachments, record]))
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  const handleRemove = (id: string) => onChange(attachments.filter((item) => item.id !== id));

  return (
    <div className={styles.field}>
      <span className={buttons.label}>{val(HUB_TEXT.attachmentsLabel)}</span>
      {attachments.length === 0 && <p className={styles.empty}>{val(HUB_TEXT.attachmentsEmpty)}</p>}
      <ul className={styles.list}>
        {attachments.map((item) => (
          <li key={item.id} className={styles.item}>
            <a href={item.filePath} download={item.name} className={styles.link}>{item.name}</a>
            <span className={styles.meta}>{item.type.toUpperCase()}</span>
            <button type="button" className={buttons.secondary} onClick={() => handleRemove(item.id)}>{val(HUB_TEXT.attachmentRemove)}</button>
          </li>
        ))}
      </ul>
      <FileDropzone label={busy ? val(HUB_TEXT.saving) : val(HUB_TEXT.attachmentAdd)} accept={ACCEPT} disabled={busy} onPick={handlePick} />
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
  );
};
