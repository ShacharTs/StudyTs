// src/components/courseHub/TopicTypePicker.tsx
/** Segmented choice between a canvas topic and a step-player topic, shown while a topic is created. */
import React from 'react';
import { useTranslation, HUB_TEXT } from '@i18n';
import buttons from './courseHubButtons.module.css';
import styles from './TopicTypePicker.module.css';

export type TopicContentType = 'canvas' | 'stepPlayer' | 'file';

const TYPE_LABEL: Record<string, typeof HUB_TEXT.topicKindCanvas> = {
  canvas: HUB_TEXT.topicKindCanvas,
  stepPlayer: HUB_TEXT.topicKindPlayer,
  file: HUB_TEXT.topicKindFile,
};

const TYPE_OPTIONS = [
  { value: 'canvas', label: HUB_TEXT.topicKindCanvas, hint: HUB_TEXT.topicTypeCanvasHint },
  { value: 'stepPlayer', label: HUB_TEXT.topicKindPlayer, hint: HUB_TEXT.topicTypePlayerHint },
  { value: 'file', label: HUB_TEXT.topicKindFile, hint: HUB_TEXT.topicTypeFileHint },
] as const;

interface TopicTypePickerProps {
  value: TopicContentType;
  onChange: (value: TopicContentType) => void;
}

/** An existing topic's type is derived from its content, so editing shows it rather than offering a switch. */
export const TopicTypeNote: React.FC<{ kind: string | undefined }> = ({ kind }) => {
  const { val } = useTranslation();
  const label = TYPE_LABEL[kind ?? 'canvas'] ?? HUB_TEXT.topicKindCanvas;
  return <p className={styles.note}>{val(HUB_TEXT.topicTypeLabel)}: {val(label)}</p>;
};

export const TopicTypePicker: React.FC<TopicTypePickerProps> = ({ value, onChange }) => {
  const { val } = useTranslation();
  return (
    <>
      <span className={buttons.label}>{val(HUB_TEXT.topicTypeLabel)}</span>
      <div role="radiogroup" aria-label={val(HUB_TEXT.topicTypeLabel)} className={styles.group}>
        {TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={`${styles.option} ${value === option.value ? styles.selected : ''}`}
            onClick={() => onChange(option.value)}
          >
            <span className={styles.name}>{val(option.label)}</span>
            <span className={styles.hint}>{val(option.hint)}</span>
          </button>
        ))}
      </div>
    </>
  );
};
