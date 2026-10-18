// src/components/courseHub/TopicCard.tsx
/**
 * One topic of a section: its number, a coloured icon saying whether it opens the Canvas or the Step player,
 * the title and a short description. The whole tile is a link; in Edit Mode it shows the edit/delete toolbar instead.
 */

import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { TopicKindIcon } from '../ui/TopicKindIcon';
import { useTopicKindLabel, type TopicKind } from '../ui/topicKinds';
import type { TopicCardViewModel } from './topicCardViewModels';
import type { TopicCatalogEntry } from '../../core/courseDataLoader';
import { Latex } from '@engine/latex';
import { useTranslation, HUB_TEXT } from '@i18n';
import { linkTileProps } from '../ui/keyboardActivation';
import buttons from './courseHubButtons.module.css';
import styles from './TopicCard.module.css';

interface TopicCardProps {
  topic: TopicCardViewModel | TopicCatalogEntry;
  editMode: boolean;
  confirmingDelete: boolean;
  onSelect: () => void;
  onEditClick: () => void;
  onDeleteClick: (e: React.MouseEvent) => void;
  dragProps?: React.HTMLAttributes<HTMLDivElement>;
  resolveLocalized: (value?: unknown) => string;
}

/** A plain string as-is, else its localized text. */
function textOf(value: unknown, resolveLocalized: (value?: unknown) => string): string {
  return typeof value === 'string' ? value : resolveLocalized(value);
}

function EditToolbar({ confirmingDelete, onEditClick, onDeleteClick }: Pick<TopicCardProps, 'confirmingDelete' | 'onEditClick' | 'onDeleteClick'>) {
  const { val } = useTranslation();
  return (
    <div className={styles.toolbar}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEditClick();
        }}
        className={buttons.icon}
        title={val(HUB_TEXT.editTopic)}
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        onClick={onDeleteClick}
        className={confirmingDelete ? buttons.danger : buttons.icon}
        title={val(HUB_TEXT.deleteTopic)}
      >
        {confirmingDelete ? <span className={styles.confirmText}>{val(HUB_TEXT.confirmDelete)}</span> : <Trash2 size={13} />}
      </button>
    </div>
  );
}

/** The pill that names a topic's kind next to its icon. */
const KIND_CLASS: Record<string, string> = { canvas: styles.canvas, stepPlayer: styles.player, file: styles.canvas };

function KindBadge({ kind }: { kind: TopicKind }) {
  const label = useTopicKindLabel(kind);
  return (
    <span className={styles.kind}>
      <TopicKindIcon kind={kind} size={18} decorative />
      {label}
    </span>
  );
}

export const TopicCard: React.FC<TopicCardProps> = ({
  topic,
  editMode,
  confirmingDelete,
  onSelect,
  onEditClick,
  onDeleteClick,
  dragProps,
  resolveLocalized,
}) => {
  return (
    <div onClick={() => !editMode && onSelect()} {...linkTileProps(editMode, onSelect)} {...dragProps} className={`${styles.tile} ${KIND_CLASS[topic.kind ?? ''] ?? ''} ${editMode ? styles.tileStatic : styles.tileLink}`}>
      <div className={styles.meta}>
        <span className={styles.index} aria-hidden="true" />
        {topic.kind && !editMode && <KindBadge kind={topic.kind} />}
        {editMode && <EditToolbar confirmingDelete={confirmingDelete} onEditClick={onEditClick} onDeleteClick={onDeleteClick} />}
      </div>
      <h4 dir="auto" className={styles.title}>
        <Latex text={textOf(topic.title, resolveLocalized)} />
      </h4>
      <p dir="auto" className={styles.description}>
        {textOf(topic.description, resolveLocalized)}
      </p>
    </div>
  );
};
