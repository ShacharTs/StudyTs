/**
 * CourseHub component.
 * Central platform landing hub displaying all available CS courses, course details, progress tags, and launch triggers.
 */

import React, { useState, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, Upload } from 'lucide-react';
import { useTranslation, HUB_TEXT } from '../../i18n';
import { useCourseRegistry } from '../../core/courseRegistry/CourseRegistryContext';
import { CourseCard } from './CourseCard';
import { EntityEditor } from './EntityEditor';
import { postCourseAction } from './postCourseAction';
import buttons from './courseHubButtons.module.css';
import styles from './CourseHub.module.css';
import { UpdatePrompt } from '../shell/UpdatePrompt';
import { ImportArchiveDialog } from './ImportArchiveDialog';

interface CourseHubProps {
  onSelectCourse: (courseId: string) => void;
}

export const CourseHub: React.FC<CourseHubProps> = ({ onSelectCourse }) => {
  const { val, resolveLocalized } = useTranslation();
  const { registry, refreshRegistry } = useCourseRegistry();
  const [editMode, setEditMode] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedArchiveFile, setSelectedArchiveFile] = useState<File | null>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);

  const handleSaveCourse = (courseId: string | null, fields: Record<string, unknown>): Promise<void> => {
    const body = courseId
      ? { action: 'update', id: courseId, course: fields }
      : { action: 'create', id: fields.id, course: { color: '#0ea5e9', accent: '#06b6d4', icon: 'Layers', ...fields } };
    return postCourseAction(body).then(() => refreshRegistry());
  };

  const handleExportClick = (courseId: string) => {
    window.location.href = `/api/transfer/export?courses=${courseId}`;
  };

  const handleDeleteClick = (e: React.MouseEvent, courseId: string) => {
    e.stopPropagation();
    if (confirmingDeleteId !== courseId) {
      setConfirmingDeleteId(courseId);
      window.setTimeout(() => setConfirmingDeleteId((prev) => (prev === courseId ? null : prev)), 3000);
      return;
    }
    setConfirmingDeleteId(null);
    postCourseAction({ action: 'delete', id: courseId })
      .then(() => refreshRegistry())
      .catch((err: Error) => setActionError(err.message));
  };

  return (
    <div className={styles.hub}>
      {/* CS Courses Grid */}
      <div className={styles.section}>
        <header className={styles.headerRow}>
          <div>
            <h1 dir="auto" className={styles.title}>{val(HUB_TEXT.coursesTitle)}</h1>
            <p dir="auto" className={styles.intro}>{val(HUB_TEXT.coursesIntro)}</p>
          </div>
          <UpdatePrompt />
          <div className={styles.actions}>
            {editMode && (
              <>
                <input
                  type="file"
                  ref={archiveInputRef}
                  accept=".zip,application/zip"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedArchiveFile(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => archiveInputRef.current?.click()}
                  className={buttons.secondary}
                  aria-label={val(HUB_TEXT.importArchiveTitle)}
                >
                  <Upload size={14} /> {val(HUB_TEXT.importArchiveTitle)}
                </button>
              </>
            )}
            <button type="button" onClick={() => setEditMode((prev) => !prev)} className={buttons.secondary}>
              {editMode ? val(HUB_TEXT.doneEditing) : val(HUB_TEXT.edit)}
            </button>
          </div>
        </header>

        {actionError && <div className={styles.error}>{actionError}</div>}

        <div className={styles.list}>
          {Object.values(registry).map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              editMode={editMode}
              confirmingDelete={confirmingDeleteId === course.id}
              onSelect={() => onSelectCourse(course.id)}
              onEditClick={() => setEditingCourseId(course.id)}
              onDeleteClick={(e) => handleDeleteClick(e, course.id)}
              onExportClick={() => handleExportClick(course.id)}
              onImportClick={() => archiveInputRef.current?.click()}
              labels={{ topics: val(HUB_TEXT.topics) }}
              resolveLocalized={resolveLocalized}
            />
          ))}
          {editMode && (
            <button type="button" onClick={() => setCreatingCourse(true)} className={styles.addCard} aria-label={val(HUB_TEXT.addCourse)}>
              <Plus size={16} /> {val(HUB_TEXT.addCourse)}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editingCourseId && (
          <EntityEditor
            key="entity-editor-course-edit"
            kind="course"
            initial={registry[editingCourseId] as unknown as Record<string, unknown>}
            onSave={(fields) => handleSaveCourse(editingCourseId, fields)}
            onClose={() => setEditingCourseId(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {creatingCourse && (
          <EntityEditor
            key="entity-editor-course-create"
            kind="course"
            initial={{}}
            onSave={(fields) => handleSaveCourse(null, fields)}
            onClose={() => setCreatingCourse(false)}
          />
        )}
      </AnimatePresence>
      {selectedArchiveFile && (
        <ImportArchiveDialog
          file={selectedArchiveFile}
          onClose={() => setSelectedArchiveFile(null)}
          onImported={() => {
            setSelectedArchiveFile(null);
            refreshRegistry();
          }}
        />
      )}
    </div>
  );
};
