/**
 * The main-panel content switch: loading/error states, hub/dashboard lazy
 * routes, and the topic content view (canvas, visual step player, or the empty create-a-visual screen).
 */
import { lazy, Suspense, useMemo } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Latex } from '@engine/latex';
import { PageLoading } from '@engine/ui';
import { ErrorBoundary } from './ErrorBoundary';
import { VisualLectureActions } from './VisualLectureActions';
import { VisualTopicBody } from './VisualTopicBody';
import { FileTopicView } from './FileTopicView';
import { TopicContent } from '../../core/courseDataLoader';
import { CanvasApp } from '../../canvasEditor/CanvasApp';
import { usePublishAppViewContext } from '../../ai/context/usePublishAppViewContext';
import styles from './AppMainContent.module.css';

const CourseHubLazy = lazy(() => import('../courseHub/CourseHub').then((m) => ({ default: m.CourseHub })));
const HomeDashboardLazy = lazy(() => import('../courseHub/HomeDashboard').then((m) => ({ default: m.HomeDashboard })));

interface AppMainContentProps {
  isLoading: boolean;
  hasError: boolean;
  activeTopicId: string;
  activeCourseId: string;
  topicContent: TopicContent | null;
  resolvedTopicTitle: string;
  networkErrText: string;
  tryAgainText: string;
  backToHubText: string;
  canvasErrText: string;
  retryLoad: () => void;
  setActiveCourseId: (courseId: string) => void;
  setActiveTopicId: (topicId: string) => void;
}

export function AppMainContent({
  isLoading,
  hasError,
  activeTopicId,
  activeCourseId,
  topicContent,
  resolvedTopicTitle,
  networkErrText,
  tryAgainText,
  backToHubText,
  canvasErrText,
  retryLoad,
  setActiveCourseId,
  setActiveTopicId,
}: AppMainContentProps) {
  const onSelectCourse = (cId: string) => {
    setActiveCourseId(cId);
    setActiveTopicId('course-home');
  };

  const fallbackContext = useMemo(() => {
    if (!activeCourseId) return { kind: 'hub' as const };
    if (activeTopicId === 'course-home' || !activeTopicId) {
      return { kind: 'courseHome' as const, courseId: activeCourseId };
    }
    return { kind: 'courseViewer' as const, courseId: activeCourseId, topicId: activeTopicId };
  }, [activeCourseId, activeTopicId]);

  usePublishAppViewContext(fallbackContext);

  if (isLoading) return <PageLoading />;

  if (hasError) {
    return (
      <div className={styles.error}>
        <AlertTriangle size={32} className={styles.errorIcon} />
        <div>{networkErrText}</div>
        <div className={styles.errorActions}>
          <button
            onClick={retryLoad}
            className={styles.errorBtn}
          >
            <RefreshCw size={14} className={styles.btnIcon} /> {tryAgainText}
          </button>
          <button
            onClick={() => setActiveTopicId('course-home')}
            className={styles.errorBtn}
          >
            Course Syllabus
          </button>
          <button
            onClick={() => setActiveTopicId('home')}
            className={`${styles.errorBtn} ${styles.ghost}`}
          >
            {backToHubText}
          </button>
        </div>
      </div>
    );
  }

  if (activeTopicId === 'home') {
    return (
      <Suspense fallback={<PageLoading />}>
        <CourseHubLazy onSelectCourse={onSelectCourse} />
      </Suspense>
    );
  }

  if (activeTopicId === 'course-home') {
    return (
      <Suspense fallback={<PageLoading />}>
        <HomeDashboardLazy onSelectTopic={(topId) => setActiveTopicId(topId)} courseId={activeCourseId} />
      </Suspense>
    );
  }

  if (!topicContent) {
    return (
      <Suspense fallback={<PageLoading />}>
        <CourseHubLazy onSelectCourse={onSelectCourse} />
      </Suspense>
    );
  }

  if (topicContent.type === 'canvas') {
    return (
      <div className={styles.canvasHost}>
        <ErrorBoundary fallbackTitle={canvasErrText} retryLabel={tryAgainText}>
          <CanvasApp sceneId={topicContent.id} />
        </ErrorBoundary>
      </div>
    );
  }

  if (topicContent.type === 'file') {
    return <FileTopicView title={resolvedTopicTitle} attachments={topicContent.attachments} />;
  }

  if (topicContent.type === 'visual') {
    return (
      <VisualTopicBody courseId={activeCourseId} topicId={activeTopicId} spec={topicContent.spec} onSaved={retryLoad} />
    );
  }

  return (
    <div className={styles.steps}>
      <div className={styles.stepsHeader}>
        <h1 className={styles.stepsTitle}>
          <Latex text={resolvedTopicTitle} />
        </h1>
      </div>
      <div className={styles.stepsBody}>
        <VisualLectureActions courseId={activeCourseId} topicId={activeTopicId} variant="empty" />
      </div>
    </div>
  );
}
