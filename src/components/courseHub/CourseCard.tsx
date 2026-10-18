// src/components/courseHub/CourseCard.tsx
/**
 * Single course card for CourseHub's grid. Renders the card markup plus,
 * in Edit Mode, a hover toolbar (pencil/trash) matching
 * EditableBlockFrame.tsx's two-click-confirm delete idiom.
 */

import React from 'react';
import { Pencil, Trash2, Download, Upload } from 'lucide-react';
import type { CourseDefinitionAPI } from '../../core/courseDataLoader';
import { useTranslation, HUB_TEXT } from '@i18n';
import { linkTileProps } from '../ui/keyboardActivation';
import buttons from './courseHubButtons.module.css';
import styles from './CourseCard.module.css';

interface CourseCardProps {
  course: CourseDefinitionAPI;
  editMode: boolean;
  confirmingDelete: boolean;
  onSelect: () => void;
  onEditClick: () => void;
  onDeleteClick: (e: React.MouseEvent) => void;
  onExportClick: (e: React.MouseEvent) => void;
  onImportClick: (e: React.MouseEvent) => void;
  labels: { topics: string };
  resolveLocalized: (value?: unknown) => string;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  editMode,
  confirmingDelete,
  onSelect,
  onEditClick,
  onDeleteClick,
  onExportClick,
  onImportClick,
  labels,
  resolveLocalized,
}) => {
  const { val } = useTranslation();
  const topicCount = Object.values(course.catalog).reduce((count, week) => count + week.lectures.length + week.practice.length, 0);
  return (
    <div
      onClick={() => !editMode && onSelect()}
      {...linkTileProps(editMode, onSelect)}
      className={`${styles.card} ${editMode ? styles.cardEditing : ''}`}
    >
      {editMode && (
        <div className={styles.actions}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExportClick(e);
            }}
            className={buttons.icon}
            title={val(HUB_TEXT.exportCourse)}
          >
            <Download size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onImportClick(e);
            }}
            className={buttons.icon}
            title={val(HUB_TEXT.importCourseFromZip)}
          >
            <Upload size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditClick();
            }}
            className={buttons.icon}
            title={val(HUB_TEXT.editCourse)}
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={onDeleteClick}
            className={confirmingDelete ? buttons.danger : buttons.icon}
            title={val(HUB_TEXT.deleteCourse)}
          >
            {confirmingDelete ? <span className={styles.confirmText}>{val(HUB_TEXT.confirmDelete)}</span> : <Trash2 size={13} />}
          </button>
        </div>
      )}
      <h4 dir="auto" className={styles.name}>
        {typeof course.title === 'string' ? course.title : resolveLocalized(course.title)}
      </h4>
      <p dir="auto" className={styles.description}>
        {typeof course.description === 'string' ? course.description : resolveLocalized(course.description)}
      </p>
      <div className={styles.count}>
        {topicCount} {labels.topics}
      </div>
    </div>
  );
};
