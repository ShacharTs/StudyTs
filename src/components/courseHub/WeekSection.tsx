// src/components/courseHub/WeekSection.tsx
/**
 * One week's lectures/practice grid for HomeDashboard. Owns only display +
 * hover controls; all POSTing and editor-panel state live in HomeDashboard.tsx
 * (same split as CourseHub.tsx / CourseCard.tsx).
 */

import React from 'react';
import { FileDown, Pencil, Trash2, Plus } from 'lucide-react';
import { useTranslation, HUB_TEXT } from '@i18n';
import type { WeekSectionViewModel, TopicCardViewModel } from './topicCardViewModels';
import type { WeekCatalogAPI, TopicCatalogEntry } from '../../core/courseDataLoader';
import buttons from './courseHubButtons.module.css';
import styles from './WeekSection.module.css';
import { TopicCard } from './TopicCard';

/** One labelled grid of topic cards (a week's lectures, or its practice) with its edit-mode add button. */

type Topic = TopicCatalogEntry | TopicCardViewModel;

interface TopicGroupProps {
  topics: Topic[];
  addLabel: string;
  editMode: boolean;
  confirmingDeleteTopicId: string | null;
  onSelectTopic: (topicId: string) => void;
  onAddTopic: (section: 'lectures' | 'practice') => void;
  onEditTopic: (topic: Topic) => void;
  onDeleteTopicClick: (e: React.MouseEvent, topicId: string) => void;
  /** Topic order is per section, so a topic only moves among the ids of its own section. */
  sectionIds: string[][];
  onMoveTopic?: (topicId: string, section: Section, toIndex: number) => void;
  resolveLocalized: (value?: unknown) => string;
}

type Section = 'lectures' | 'practice';

function TopicGroup(props: TopicGroupProps) {
  const { topics, addLabel, editMode, onAddTopic, sectionIds, onMoveTopic } = props;
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  if (topics.length === 0 && !editMode) return null;

  const sectionOf = (topicId: string) => sectionIds.findIndex((ids) => ids.includes(topicId));
  const moveTo = (topicId: string, toId: string) => {
    const sectionIndex = sectionOf(topicId);
    if (sectionIndex < 0 || sectionIndex !== sectionOf(toId) || topicId === toId) return;
    onMoveTopic?.(topicId, sectionIndex === 0 ? 'lectures' : 'practice', sectionIds[sectionIndex].indexOf(toId));
  };
  const dragProps = (topicId: string): React.HTMLAttributes<HTMLDivElement> =>
    editMode
      ? {
          draggable: true,
          onDragStart: () => setDraggingId(topicId),
          onDragEnd: () => setDraggingId(null),
          onDragOver: (e) => e.preventDefault(),
          onDrop: () => draggingId && moveTo(draggingId, topicId),
        }
      : {};

  return (
    <div>
      {editMode && (
        <div className={styles.groupHeader}>
          <button type="button" onClick={() => onAddTopic('lectures')} className={buttons.secondary}>
            <Plus size={14} /> {addLabel}
          </button>
        </div>
      )}
      <div className={styles.grid}>
        {topics.map((topic) => (
          <TopicCard
            key={topic.id}
            topic={topic}
            editMode={editMode}
            confirmingDelete={props.confirmingDeleteTopicId === topic.id}
            onSelect={() => props.onSelectTopic(topic.id)}
            onEditClick={() => props.onEditTopic(topic)}
            onDeleteClick={(e) => props.onDeleteTopicClick(e, topic.id)}
            dragProps={dragProps(topic.id)}
            resolveLocalized={props.resolveLocalized}
          />
        ))}
      </div>
    </div>
  );
}

interface WeekSectionProps {
  weekKey: string;
  weekData: WeekSectionViewModel | WeekCatalogAPI;
  editMode: boolean;
  confirmingDeleteWeek: boolean;
  confirmingDeleteTopicId: string | null;
  addTopicLabel: string;
  onSelectTopic: (topicId: string) => void;
  onEditWeek: () => void;
  onDeleteWeekClick: (e: React.MouseEvent) => void;
  onAddTopic: (section: 'lectures' | 'practice') => void;
  onEditTopic: (topic: TopicCatalogEntry | TopicCardViewModel) => void;
  onDeleteTopicClick: (e: React.MouseEvent, topicId: string) => void;
  onMoveTopic?: (topicId: string, section: 'lectures' | 'practice', toIndex: number) => void;
  /** Shows a PDF export button on the week header (also outside Edit Mode). */
  onExportWeek?: () => void;
  exportBusy?: boolean;
  resolveLocalized: (value?: unknown) => string;
}

export const WeekSection: React.FC<WeekSectionProps> = ({
  weekKey,
  weekData,
  editMode,
  confirmingDeleteWeek,
  confirmingDeleteTopicId,
  addTopicLabel,
  onSelectTopic,
  onEditWeek,
  onDeleteWeekClick,
  onAddTopic,
  onEditTopic,
  onDeleteTopicClick,
  onMoveTopic,
  onExportWeek,
  exportBusy,
  resolveLocalized,
}) => {
  const { val } = useTranslation();
  const isEmpty = weekData.lectures.length === 0 && weekData.practice.length === 0;
  const topics = [...weekData.lectures, ...weekData.practice];
  const sectionIds = [weekData.lectures.map((t) => t.id), weekData.practice.map((t) => t.id)];
  const groupProps = { editMode, confirmingDeleteTopicId, onSelectTopic, onAddTopic, onEditTopic, onDeleteTopicClick, onMoveTopic, sectionIds, resolveLocalized };

  return (
    <div key={weekKey} className={styles.week}>
      <div className={styles.weekHeader}>
        <h3 className={styles.weekTitle}>
          <span dir="auto" className={styles.isolate}>{resolveLocalized(weekData.title)}</span>
        </h3>
        {(editMode || onExportWeek) && (
          <div className={styles.actions}>
            {onExportWeek && (
              <button type="button" onClick={onExportWeek} disabled={exportBusy} className={buttons.icon} title={val(HUB_TEXT.exportPdfWeek)}>
                <FileDown size={13} />
              </button>
            )}
            {editMode && (
              <>
                <button type="button" onClick={onEditWeek} className={buttons.icon} title={val(HUB_TEXT.editSection)}>
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={onDeleteWeekClick}
                  className={confirmingDeleteWeek ? buttons.danger : buttons.icon}
                  title={val(HUB_TEXT.deleteSection)}
                >
                  {confirmingDeleteWeek ? <span className={styles.confirmText}>{val(HUB_TEXT.confirmDelete)}</span> : <Trash2 size={13} />}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {isEmpty && !editMode && (
        <p className={styles.emptyHint}>
          {val(HUB_TEXT.noTopicsYet)}
        </p>
      )}

      <TopicGroup topics={topics} addLabel={addTopicLabel} {...groupProps} />
    </div>
  );
};
