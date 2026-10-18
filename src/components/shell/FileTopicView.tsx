// src/components/shell/FileTopicView.tsx
/** A file topic: its document is the lesson. PDFs are shown in the page; Word, PowerPoint and Excel files are downloaded. */
import React from 'react';
import { Download } from 'lucide-react';
import { useTranslation, HUB_TEXT } from '@i18n';
import { Latex } from '@engine/latex';
import type { TopicAttachment } from '@core/shared/topicAttachment';
import styles from './FileTopicView.module.css';

interface FileTopicViewProps {
  title: string;
  attachments: TopicAttachment[];
}

export const FileTopicView: React.FC<FileTopicViewProps> = ({ title, attachments }) => {
  const { val } = useTranslation();
  if (attachments.length === 0) {
    return <p className={styles.empty}>{val(HUB_TEXT.fileTopicEmpty)}</p>;
  }
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        <Latex text={title} />
      </h1>
      {attachments.map((item) =>
        item.type === 'pdf' ? (
          <iframe key={item.id} src={item.filePath} title={item.name} className={styles.viewer} />
        ) : (
          <a key={item.id} href={item.filePath} download={item.name} className={styles.download}>
            <Download size={16} /> {item.name}
          </a>
        ),
      )}
    </div>
  );
};
