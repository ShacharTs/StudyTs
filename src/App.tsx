/**
 * Main application shell layout.
 * Fully responsive layout:
 * - empty path ('/') -> HomeDashboardLazy (default launch page: Selected Course Syllabus & Weekly Topics)
 * - 'home' (/lobby) -> CourseHubLazy (Select CS Course: Complexity, Algorithms, Automata)
 * - 'course-home' (/:courseId) -> HomeDashboardLazy (Selected Course Syllabus & Weekly Topics)
 * - topicId (/:courseId/:topicId) -> StepPlayer + VisualizationRenderer (Interactive Visualization)
 */

import { lazy, Suspense, useCallback, useEffect } from 'react';
import { useServerContentChanges } from './hooks/useServerContentChanges';
import styles from './App.module.css';
import { TopBarHeader } from './components/shell/TopBarHeader';
import { SidebarNav } from './components/sidebar/SidebarNav';
import { AppMainContent } from './components/shell/AppMainContent';
import { DebugOverlay } from './components/shell/DebugOverlay';
import { useAppRouter } from './hooks/useAppRouter';
import { useAppShellState } from './hooks/useAppShellState';
import { useDocumentTitle } from './hooks/useDocumentTitle';
import { pruneOldAutoSaves } from './hooks/useCanvasLocalBackup';
import { useTranslation, COMMON_TEXT } from './i18n';
import { onAiPromptRequest } from './ai/chat/aiPromptEvent';
import { useCourseRegistry } from './core/courseRegistry/CourseRegistryContext';

const PatchNotesModalLazy = lazy(() => import('./components/shell/PatchNotesModal').then((m) => ({ default: m.PatchNotesModal })));
const AiSettingsModalLazy = lazy(() => import('./components/ai/AiSettingsModal').then((m) => ({ default: m.AiSettingsModal })));
const AppSettingsModalLazy = lazy(() => import('./components/settings/AppSettingsModal').then((m) => ({ default: m.AppSettingsModal })));

export function App() {
  const { val, resolveLocalized, direction } = useTranslation();
  const { registry, refreshRegistry } = useCourseRegistry();
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    expandedWeeks,
    setExpandedWeeks,
    isPatchNotesOpen,
    setIsPatchNotesOpen,
    isAiSettingsOpen,
    setIsAiSettingsOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTab,
    setSettingsTab,
    sourceEditingEnabled,
    setSourceEditingEnabled,
  } = useAppShellState();

  const {
    activeCourseId,
    setActiveCourseId,
    activeTopicId,
    setActiveTopicId,
    topicContent,
    isLoading,
    hasError,
    retryLoad,
  } = useAppRouter();

  const reloadAfterExternalChange = useCallback(() => {
    void refreshRegistry();
    retryLoad();
  }, [refreshRegistry, retryLoad]);
  useServerContentChanges(reloadAfterExternalChange);

  useDocumentTitle({ activeCourseId, activeTopicId, topicContent, registry, resolveLocalized });

  useEffect(() => {
    pruneOldAutoSaves();
  }, []);

  // An "Ask AI" shortcut anywhere in the app opens the panel; the panel itself picks up the prompt.
  useEffect(() => onAiPromptRequest(() => setIsAiSettingsOpen(true)), [setIsAiSettingsOpen]);

  const networkErrText = val(COMMON_TEXT.networkError);
  const tryAgainText = val(COMMON_TEXT.tryAgain);
  const backToHubText = val(COMMON_TEXT.backToHub);
  const canvasErrText = val(COMMON_TEXT.canvasRenderError);

  const isDashboardPage = activeTopicId === 'home' || activeTopicId === 'course-home' || (!topicContent && !isLoading);
  const isCanvasPage = topicContent?.type === 'canvas';

  const page = isDashboardPage ? 'dashboard' : isCanvasPage ? 'canvas' : 'content';

  return (
    <div
      className={`app-container ${styles.root}`}
      dir={direction}
    >
      <TopBarHeader
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onToggleAiSettings={() => setIsAiSettingsOpen((prev) => !prev)}
        onOpenSettings={() => {
          setSettingsTab('appearance');
          setIsSettingsOpen(true);
        }}
        isAiOpen={isAiSettingsOpen}
        activeCourseId={activeCourseId}
        activeTopicId={activeTopicId}
        courseCode={registry[activeCourseId]?.code}
        topicTitle={topicContent ? resolveLocalized(topicContent.title) : undefined}
        onNavigateHome={() => setActiveTopicId('home')}
        onNavigateCourse={() => setActiveTopicId('course-home')}
      />

      <div className={styles.body}>
        <SidebarNav
          isSidebarOpen={isSidebarOpen}
          activeCourseId={activeCourseId}
          activeTopicId={activeTopicId}
          expandedWeeks={expandedWeeks}
          onToggleWeek={(weekKey) => setExpandedWeeks((prev) => ({ ...prev, [weekKey]: !(prev[weekKey] ?? true) }))}
          onSelectCourse={(courseId) => {
            setActiveCourseId(courseId);
            setActiveTopicId('course-home');
          }}
          onSelectTopic={(topicId) => setActiveTopicId(topicId)}
          onOpenVisualSteps={() => window.location.assign('/step-player')}
        />

        <main className={`${styles.main} ${styles[page]}`}>
          <AppMainContent
            isLoading={isLoading}
            hasError={hasError}
            activeTopicId={activeTopicId}
            activeCourseId={activeCourseId}
            topicContent={topicContent}
            resolvedTopicTitle={topicContent ? resolveLocalized(topicContent.title) : ''}
            networkErrText={networkErrText}
            tryAgainText={tryAgainText}
            backToHubText={backToHubText}
            canvasErrText={canvasErrText}
            retryLoad={retryLoad}
            setActiveCourseId={setActiveCourseId}
            setActiveTopicId={setActiveTopicId}
          />
        </main>

        <Suspense fallback={null}>
          <AiSettingsModalLazy
            isOpen={isAiSettingsOpen}
            onClose={() => setIsAiSettingsOpen(false)}
            activeCourseId={activeCourseId}
            activeTopicId={activeTopicId}
            topicContent={topicContent}
            isLoading={isLoading}
            onContentChanged={retryLoad}
            sourceEditingEnabled={sourceEditingEnabled}
          />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <PatchNotesModalLazy isOpen={isPatchNotesOpen} onClose={() => setIsPatchNotesOpen(false)} />
      </Suspense>

      <Suspense fallback={null}>
        <AppSettingsModalLazy
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          initialTab={settingsTab}
          sourceEditingEnabled={sourceEditingEnabled}
          setSourceEditingEnabled={setSourceEditingEnabled}
        />
      </Suspense>

      <DebugOverlay />
    </div>
  );
}

export default App;
