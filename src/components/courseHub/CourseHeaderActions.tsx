import React from 'react';
import { FileDown } from 'lucide-react';
import { useTranslation, HUB_TEXT } from '@i18n';
import buttons from './courseHubButtons.module.css';
import styles from './HomeDashboard.module.css';

interface CourseHeaderActionsProps {
  editMode: boolean;
  onToggleEdit: () => void;
  /** Progress text while a PDF export runs, null when idle. */
  exportProgress: string | null;
  onExportPdf: () => void;
}

/** The course page's header buttons: export the whole course as PDF, and turn Edit Mode on or off. */
export const CourseHeaderActions: React.FC<CourseHeaderActionsProps> = ({ editMode, onToggleEdit, exportProgress, onExportPdf }) => {
  const { val } = useTranslation();
  return (
    <div className={styles.headerActions}>
      {!editMode && (
        <button type="button" onClick={onExportPdf} disabled={Boolean(exportProgress)} className={buttons.secondary}>
          <FileDown size={14} /> {exportProgress ?? val(HUB_TEXT.exportPdfCourse)}
        </button>
      )}
      <button type="button" onClick={onToggleEdit} className={buttons.secondary}>
        {editMode ? val(HUB_TEXT.doneEditing) : val(HUB_TEXT.edit)}
      </button>
    </div>
  );
};
