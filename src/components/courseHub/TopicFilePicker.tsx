// src/components/courseHub/TopicFilePicker.tsx
/** Picks the document for a new file topic. Nothing is uploaded until the topic is saved. */
import React, { useState } from 'react';
import { useTranslation, HUB_TEXT } from '@i18n';
import { attachmentTypeOf } from '@core/shared/topicAttachment';
import { FileDropzone } from './FileDropzone';
import styles from './TopicFilePicker.module.css';
import { extensionOf } from './topicFileUpload';

const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md';

interface TopicFilePickerProps {
  file: File | null;
  onPick: (file: File | null) => void;
}

export const TopicFilePicker: React.FC<TopicFilePickerProps> = ({ file, onPick }) => {
  const { val } = useTranslation();
  const [refused, setRefused] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    event.target.value = '';
    const accepted = picked !== null && attachmentTypeOf(extensionOf(picked.name)) !== null;
    setRefused(picked !== null && !accepted);
    onPick(accepted ? picked : null);
  };

  return (
    <div className={styles.field}>
      <FileDropzone label={file ? val(HUB_TEXT.attachFileChange) : val(HUB_TEXT.attachFileChoose)} accept={ACCEPT} onPick={handleChange} />
      {file && <span className={styles.name}>{file.name}</span>}
      {refused && <p role="alert" className={styles.error}>{val(HUB_TEXT.attachmentTypeRefused)}</p>}
    </div>
  );
};
