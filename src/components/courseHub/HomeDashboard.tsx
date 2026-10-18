// HomeDashboard component: course syllabus overview, week/topic preview cards,
// and edit mode for managing weeks and topics.

import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import type { TopicCatalogEntry, WeekCatalogAPI } from '../../core/courseDataLoader';
import { useTranslation, HUB_TEXT } from '../../i18n';
import { useCourseRegistry } from '../../core/courseRegistry/CourseRegistryContext';
import { WeekSection } from './WeekSection';
import { EntityEditor } from './EntityEditor';
import { useWeekTopicActions, EditingTopic } from './useWeekTopicActions';
import { useCoursePdfExport } from './useCoursePdfExport';
import { CourseHeaderActions } from './CourseHeaderActions';
import { CourseHub } from './CourseHub';
import styles from './HomeDashboard.module.css';
import buttons from './courseHubButtons.module.css';
import courseHeroBannerStyles from './CourseHeroBanner.module.css';

interface CourseHeroBannerProps {
  title: string;
  subtitle: string;
}

const CourseHeroBanner: React.FC<CourseHeroBannerProps> = ({ title, subtitle }) => (
  <div className={courseHeroBannerStyles.root}>
    <h1 dir="auto" className={courseHeroBannerStyles.title}>
      {title}
    </h1>
    <p dir="auto" className={courseHeroBannerStyles.subtitle}>
      {subtitle}
    </p>
  </div>
);

interface CascadeWarningProps {
  weekKey: string;
  label: string;
  deleteLabel: string;
  cancelLabel: string;
  onConfirm: (weekKey: string) => void;
  onCancel: () => void;
}

const CascadeWarning: React.FC<CascadeWarningProps> = ({
  weekKey,
  label,
  deleteLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) => (
  <div className={styles.cascade}>
    <span>{label.replace('{name}', weekKey)}</span>
    <button type="button" onClick={() => onConfirm(weekKey)} className={buttons.secondary}>
      {deleteLabel}
    </button>
    <button type="button" onClick={onCancel} className={buttons.secondary}>
      {cancelLabel}
    </button>
  </div>
);

interface HomeDashboardModalsProps {
  courseCatalog: Record<string, WeekCatalogAPI>;
  courseId: string;
  editingWeekKey: string | null;
  creatingWeek: boolean;
  editingTopic: EditingTopic | null;
  onSaveWeek: (weekKey: string | null, fields: Record<string, unknown>) => Promise<void>;
  onSaveTopic: (
    weekKey: string,
    section: 'lectures' | 'practice',
    topic: TopicCatalogEntry | null,
    fields: Record<string, unknown>
  ) => Promise<void>;
  onCloseWeekEdit: () => void;
  onCloseWeekCreate: () => void;
  onCloseTopicEdit: () => void;
}

const HomeDashboardModals: React.FC<HomeDashboardModalsProps> = ({
  courseCatalog,
  courseId,
  editingWeekKey,
  creatingWeek,
  editingTopic,
  onSaveWeek,
  onSaveTopic,
  onCloseWeekEdit,
  onCloseWeekCreate,
  onCloseTopicEdit,
}) => {
  const activeWeek = editingWeekKey ? courseCatalog[editingWeekKey] : undefined;

  return (
    <>
      <AnimatePresence>
        {activeWeek && (
          <EntityEditor
            key="entity-editor-week-edit"
            kind="week"
            initial={{ weekKey: editingWeekKey, title: activeWeek.title }}
            onSave={(fields) => onSaveWeek(editingWeekKey, fields)}
            onClose={onCloseWeekEdit}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {creatingWeek && (
          <EntityEditor
            key="entity-editor-week-create"
            kind="week"
            initial={{}}
            onSave={(fields) => onSaveWeek(null, fields)}
            onClose={onCloseWeekCreate}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editingTopic && (
          <EntityEditor
            key="entity-editor-topic-edit"
            kind="topic"
            initial={editingTopic.topic ? (editingTopic.topic as unknown as Record<string, unknown>) : {}}
            courseId={courseId}
            onSave={(fields) => onSaveTopic(editingTopic.weekKey, editingTopic.section, editingTopic.topic, fields)}
            onClose={onCloseTopicEdit}
          />
        )}
      </AnimatePresence>
    </>
  );
};

interface HomeDashboardProps {
  onSelectTopic: (topicId: string) => void;
  courseId?: string;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onSelectTopic, courseId = '' }) => {
  const { val, resolveLocalized } = useTranslation();
  const { registry, refreshRegistry } = useCourseRegistry();
  const currentCourse = courseId ? registry[courseId] : undefined;

  const [editMode, setEditMode] = useState(false);
  const [editingWeekKey, setEditingWeekKey] = useState<string | null>(null);
  const [creatingWeek, setCreatingWeek] = useState(false);
  const [editingTopic, setEditingTopic] = useState<EditingTopic | null>(null);

  const {
    actionError,
    confirmingDeleteWeek,
    pendingCascadeWeek,
    setPendingCascadeWeek,
    confirmingDeleteTopicId,
    handleSaveWeek,
    handleDeleteWeekClick,
    handleCascadeConfirm,
    handleSaveTopic,
    handleDeleteTopicClick,
    handleMoveTopic,
  } = useWeekTopicActions(courseId, refreshRegistry, onSelectTopic);

  const pdfExport = useCoursePdfExport(currentCourse ?? { title: '', catalog: {} });
  const shownError = actionError ?? pdfExport.error;

  if (!currentCourse) {
    return <CourseHub onSelectCourse={() => onSelectTopic('course-home')} />;
  }

  const courseCatalog: Record<string, WeekCatalogAPI> = currentCourse.catalog ?? {};

  const handleEditTopicClick = (weekKey: string, weekData: WeekCatalogAPI, topic: unknown) => {
    const isLecture = weekData.lectures.some((t) => t.id === (topic as TopicCatalogEntry).id);
    setEditingTopic({
      weekKey,
      section: isLecture ? 'lectures' : 'practice',
      topic: topic as TopicCatalogEntry,
    });
  };

  const handleDeleteTopic = (e: React.MouseEvent, weekKey: string, weekData: WeekCatalogAPI, topicId: string) => {
    const section = weekData.lectures.some((l) => l.id === topicId) ? 'lectures' : 'practice';
    handleDeleteTopicClick(e, weekKey, section, topicId);
  };

  return (
    <div className={styles.root}>
      <header className={styles.pageHeader}>
        <CourseHeroBanner
          title={resolveLocalized(currentCourse.title)}
          subtitle={resolveLocalized(currentCourse.subtitle)}
        />
        <CourseHeaderActions
          editMode={editMode}
          onToggleEdit={() => setEditMode((prev) => !prev)}
          exportProgress={pdfExport.progress}
          onExportPdf={() => void pdfExport.exportPdf()}
        />
      </header>

      {shownError && <div className={styles.actionError}>{shownError}</div>}

      {pendingCascadeWeek && (
        <CascadeWarning
          weekKey={pendingCascadeWeek}
          label={val(HUB_TEXT.sectionHasTopics)}
          deleteLabel={val(HUB_TEXT.deleteAnyway)}
          cancelLabel={val(HUB_TEXT.cancel)}
          onConfirm={handleCascadeConfirm}
          onCancel={() => setPendingCascadeWeek(null)}
        />
      )}

      <div className={styles.weeks}>
        {Object.entries(courseCatalog).map(([weekKey, weekData]) => (
          <WeekSection
            key={weekKey}
            weekKey={weekKey}
            weekData={weekData}
            editMode={editMode}
            confirmingDeleteWeek={confirmingDeleteWeek === weekKey}
            confirmingDeleteTopicId={confirmingDeleteTopicId}
            addTopicLabel={val(HUB_TEXT.addTopic)}
            onSelectTopic={onSelectTopic}
            onEditWeek={() => setEditingWeekKey(weekKey)}
            onDeleteWeekClick={(e) => handleDeleteWeekClick(e, weekKey)}
            onAddTopic={(section) => setEditingTopic({ weekKey, section, topic: null })}
            onEditTopic={(topic) => handleEditTopicClick(weekKey, weekData, topic)}
            onDeleteTopicClick={(e, topicId) => handleDeleteTopic(e, weekKey, weekData, topicId)}
            onMoveTopic={(topicId, section, toIndex) => handleMoveTopic(weekKey, section, topicId, toIndex)}
            onExportWeek={editMode ? undefined : () => void pdfExport.exportPdf(weekKey)}
            exportBusy={Boolean(pdfExport.progress)}
            resolveLocalized={resolveLocalized}
          />
        ))}

        {editMode && (
          <button type="button" onClick={() => setCreatingWeek(true)} className={styles.addWeek}>
            <Plus size={18} />
            <span>{val(HUB_TEXT.addSection)}</span>
          </button>
        )}
      </div>

      <HomeDashboardModals
        courseCatalog={courseCatalog}
        courseId={courseId}
        editingWeekKey={editingWeekKey}
        creatingWeek={creatingWeek}
        editingTopic={editingTopic}
        onSaveWeek={handleSaveWeek}
        onSaveTopic={handleSaveTopic}
        onCloseWeekEdit={() => setEditingWeekKey(null)}
        onCloseWeekCreate={() => setCreatingWeek(false)}
        onCloseTopicEdit={() => setEditingTopic(null)}
      />
    </div>
  );
};
