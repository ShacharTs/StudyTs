import React, { useEffect } from 'react';
import { ModalShell } from '../ui/ModalShell';
import { useTranslation, HUB_TEXT } from '../../i18n';
import { useArchiveImport, ArchiveImportConflictPolicy } from './useArchiveImport';
import styles from './ImportArchiveDialog.module.css';
import buttons from './courseHubButtons.module.css';

interface ImportArchiveDialogProps {
  file: File;
  onClose: () => void;
  onImported: () => void;
}

export const ImportArchiveDialog: React.FC<ImportArchiveDialogProps> = ({
  file,
  onClose,
  onImported,
}) => {
  const { val } = useTranslation();
  const { state, choose, setPolicy, confirm } = useArchiveImport(onImported);

  useEffect(() => {
    if (file) {
      choose(file);
    }
  }, [file, choose]);

  const getKindLabel = (kind: string) => {
    if (kind === 'backup') return val(HUB_TEXT.importKindBackup);
    if (kind === 'courses') return val(HUB_TEXT.importKindCourses);
    return val(HUB_TEXT.importKindCourse);
  };

  const getErrorMessage = (code: string, message: string) => {
    if (code === 'unsupported_version') return val(HUB_TEXT.importErrorUnsupportedVersion);
    if (code === 'corrupt') return val(HUB_TEXT.importErrorCorrupt);
    if (code === 'unsafe_path') return val(HUB_TEXT.importErrorUnsafe);
    if (code === 'too_large') return val(HUB_TEXT.importErrorTooLarge);
    return message;
  };

  return (
    <ModalShell isOpen onClose={onClose} labelledBy="import-archive-title" maxWidth={460}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h3 id="import-archive-title" className={styles.title}>
            {val(HUB_TEXT.importArchiveTitle)}
          </h3>
          {state.status === 'ready' && (
            <span className={styles.badge}>{getKindLabel(state.preview.kind)}</span>
          )}
        </div>

        {state.status === 'previewing' && (
          <div className={styles.spinner}>{val(HUB_TEXT.saving)}</div>
        )}

        {state.status === 'importing' && (
          <div className={styles.spinner}>{val(HUB_TEXT.importing)}</div>
        )}

        {state.status === 'error' && (
          <div className={styles.errorBox}>
            {getErrorMessage(state.code, state.message)}
          </div>
        )}

        {state.status === 'ready' && (
          <>
            <p className={styles.desc}>
              {val(HUB_TEXT.importCourseHint)} ({state.preview.courses.length} courses)
            </p>

            <div className={styles.courseList}>
              {state.preview.courses.map((course) => (
                <div key={course.sourceId} className={styles.courseRow}>
                  <div className={styles.courseInfo}>
                    <span className={styles.courseTitle}>{course.title}</span>
                    <span className={styles.courseMeta}>
                      ID: {course.sourceId} • {course.topicCount} {val(HUB_TEXT.topics)}
                    </span>
                  </div>

                  {course.conflict ? (
                    <select
                      className={styles.conflictSelect}
                      value={state.policies[course.sourceId] || 'replace'}
                      onChange={(e) =>
                        setPolicy(course.sourceId, e.target.value as ArchiveImportConflictPolicy)
                      }
                      aria-label={`${val(HUB_TEXT.importConflictLabel)} - ${course.title}`}
                    >
                      <option value="replace">{val(HUB_TEXT.importPolicyReplace)}</option>
                      <option value="duplicate">{val(HUB_TEXT.importPolicyDuplicate)}</option>
                      <option value="skip">{val(HUB_TEXT.importPolicySkip)}</option>
                    </select>
                  ) : (
                    <span className={styles.badge}>{val(HUB_TEXT.apply)}</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {state.status === 'done' && (
          <p className={styles.desc}>
            {val(HUB_TEXT.importAction)}: {state.result.imported.length} imported,{' '}
            {state.result.skipped.length} skipped.
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" onClick={onClose} className={buttons.secondary}>
            {state.status === 'done' ? val(HUB_TEXT.close) : val(HUB_TEXT.cancel)}
          </button>
          {state.status === 'ready' && (
            <button
              type="button"
              onClick={confirm}
              className={buttons.primary}
              autoFocus
            >
              {val(HUB_TEXT.importConfirm)}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
};
