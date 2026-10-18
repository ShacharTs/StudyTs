/**
 * A step-player topic on its own course page: the player by default, and Edit turns the editor on in place,
 * so the timeline stays under the stage the same way it does for a canvas topic.
 */
import { lazy, Suspense, useContext, useRef, useState } from 'react';
import { VisualStepPlayer, type VisualSpec } from '@engine/visualStepPlayer';
import { CourseRegistryContext } from '../../core/courseRegistry/CourseRegistryContext';
import { findTopicLocation } from '../../core/courseDataLoader';
import { useTranslation, HUB_TEXT } from '@i18n';
import { ErrorBoundary } from './ErrorBoundary';
import styles from './AppMainContent.module.css';
import buttons from '../courseHub/courseHubButtons.module.css';
import editorStyles from './VisualTopicBody.module.css';

const VisualAuthoringPageLazy = lazy(() =>
  import('../visualAuthoring/VisualAuthoringPage').then((module) => ({ default: module.VisualAuthoringPage })),
);

interface VisualTopicBodyProps {
  courseId: string;
  topicId: string;
  spec: VisualSpec;
  /** Reloads the topic after editing so the player shows the saved spec. */
  onSaved: () => void;
}

export function VisualTopicBody({ courseId, topicId, spec, onSaved }: VisualTopicBodyProps) {
  const registry = useContext(CourseRegistryContext)?.registry ?? {};
  const location = findTopicLocation(registry, courseId, topicId);
  const { val } = useTranslation();
  const [editing, setEditing] = useState(false);
  // The editor registers its save here, so Done editing saves before it leaves edit mode.
  const saveRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));

  const toggleEditing = async () => {
    if (editing) {
      const saved = await saveRef.current();
      if (!saved) return;
      onSaved();
    }
    setEditing((on) => !on);
  };

  const editButton = location ? (
    <button type="button" className={buttons.secondary} onClick={toggleEditing}>
      {val(HUB_TEXT.edit)}
    </button>
  ) : undefined;

  return (
    <div className={styles.steps}>
      <div className={styles.stepsBody}>
        <ErrorBoundary fallbackTitle="Visual step player crashed — try reloading this scene" retryLabel="Try Again">
          {editing && location ? (
            <div className={editorStyles.editor}>
              <Suspense fallback={null}>
                <VisualAuthoringPageLazy
                  embedded
                  lecture={{ courseId, ...location, topicId }}
                  onNavigate={() => {}}
                  onLectureSaveReady={(save) => { saveRef.current = save; }}
                  headerAction={<button type="button" className={buttons.secondary} onClick={toggleEditing}>{val(HUB_TEXT.doneEditing)}</button>}
                />
              </Suspense>
            </div>
          ) : (
            <VisualStepPlayer spec={spec} controlsLeading={editButton} />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
