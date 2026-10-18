/**
 * Links a step-player lecture to its builder: "Edit step player" on a finished one, "Create the step player" while the
 * topic is still empty. The week and section are looked up in the registry, so nothing is hardcoded.
 */
import { useContext } from 'react';
import { CourseRegistryContext } from '../../core/courseRegistry/CourseRegistryContext';
import { findTopicLocation } from '../../core/courseDataLoader';
import { buildVisualAuthoringUrl } from '../visualAuthoring/visualAuthoringRoute';
import styles from './AppMainContent.module.css';

interface VisualLectureActionsProps {
  courseId: string;
  topicId: string;
  /** `empty` shows the call-to-action for a topic without a step player yet. */
  variant: 'edit' | 'empty';
}

export function VisualLectureActions({ courseId, topicId, variant }: VisualLectureActionsProps) {
  const registry = useContext(CourseRegistryContext)?.registry ?? {};
  const location = findTopicLocation(registry, courseId, topicId);
  if (!location) return null;
  const href = buildVisualAuthoringUrl({ courseId, ...location, topicId });

  if (variant === 'empty') {
    return (
      <div className={styles.emptyPlayer}>
        <p>This step player is still empty.</p>
        <a className={styles.authoringButton} href={href}>
          Create the step player
        </a>
      </div>
    );
  }
  return (
    <a className={styles.authoringButton} href={href}>
      Edit step player
    </a>
  );
}
