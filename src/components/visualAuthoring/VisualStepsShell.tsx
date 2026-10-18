import type { ReactNode } from 'react';
import { useAppShellState } from '../../hooks/useAppShellState';
import { TopBarHeader } from '../shell/TopBarHeader';
import { SidebarNav } from '../sidebar/SidebarNav';
import { AppSettingsModal } from '../settings/AppSettingsModal';
import { AiSettingsModal } from '../ai/AiSettingsModal';
import styles from './VisualStepsShell.module.css';

const VISUAL_STEPS_PATH = '/step-player';
const NO_TOPIC = 'step-player';

// The entry glows only for a brand-new page from that button, not while editing an existing lecture or saved spec.
const isNewVisualSteps = (): boolean => window.location.pathname === VISUAL_STEPS_PATH && window.location.search === '';

// Same chrome as the app shell (top bar, sidebar, settings and AI modals), so the visual steps page is not a separate app.
export function VisualStepsShell({ children }: { children: ReactNode }) {
  const shell = useAppShellState();

  return (
    <div className={styles.root}>
      <TopBarHeader
        onToggleSidebar={() => shell.setIsSidebarOpen((open) => !open)}
        onToggleAiSettings={() => shell.setIsAiSettingsOpen((open) => !open)}
        onOpenSettings={() => {
          shell.setSettingsTab('appearance');
          shell.setIsSettingsOpen(true);
        }}
        isAiOpen={shell.isAiSettingsOpen}
        onNavigateHome={() => window.location.assign('/lobby')}
      />

      <div className={styles.body}>
        <SidebarNav
          isSidebarOpen={shell.isSidebarOpen}
          activeCourseId=""
          activeTopicId={NO_TOPIC}
          expandedWeeks={shell.expandedWeeks}
          onToggleWeek={(weekKey) => shell.setExpandedWeeks((prev) => ({ ...prev, [weekKey]: !(prev[weekKey] ?? true) }))}
          onSelectCourse={(courseId) => window.location.assign(`/${courseId}`)}
          onSelectTopic={(topicId) => window.location.assign(topicId === 'home' ? '/lobby' : `/${topicId}`)}
          visualStepsActive={isNewVisualSteps()}
          onOpenVisualSteps={() => window.location.assign(VISUAL_STEPS_PATH)}
        />

        <main className={styles.main}>{children}</main>
      </div>

      <AiSettingsModal
        isOpen={shell.isAiSettingsOpen}
        onClose={() => shell.setIsAiSettingsOpen(false)}
        sourceEditingEnabled={shell.sourceEditingEnabled}
      />
      <AppSettingsModal
        isOpen={shell.isSettingsOpen}
        onClose={() => shell.setIsSettingsOpen(false)}
        initialTab={shell.settingsTab}
        sourceEditingEnabled={shell.sourceEditingEnabled}
        setSourceEditingEnabled={shell.setSourceEditingEnabled}
      />
    </div>
  );
}
