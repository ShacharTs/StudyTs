// src/components/shell/TopBarHeader.tsx
import React from 'react';
import { PanelLeft, Sparkles, Settings } from 'lucide-react';
import { useLanguage } from '../../i18n/languageContext';
import { BUTTONS_TEXT, SETTINGS_TEXT } from '../../i18n/dictionary';
import { useAiTaskStatus } from '@ai/useAiTaskStatus';
import { LanguageSwitcher } from './LanguageSwitcher';
import '../../styles/topbar.css';
import styles from './TopBarHeader.module.css';

interface TopBarHeaderProps {
  onToggleSidebar?: () => void;
  onOpenAiSettings?: () => void;
  onToggleAiSettings?: () => void;
  onOpenSettings?: () => void;
  isAiOpen?: boolean;
  activeCourseId?: string;
  activeTopicId?: string;
  courseCode?: string;
  topicTitle?: string;
  onNavigateHome?: () => void;
  onNavigateCourse?: () => void;
}

type BreadcrumbsProps = Pick<TopBarHeaderProps, 'activeCourseId' | 'activeTopicId' | 'courseCode' | 'topicTitle' | 'onNavigateHome' | 'onNavigateCourse'>;

function Breadcrumbs({ activeCourseId, activeTopicId, courseCode, topicTitle, onNavigateHome, onNavigateCourse }: BreadcrumbsProps) {
  return (
  <div className="topbar-breadcrumbs">
    <button
      type="button"
      onClick={onNavigateHome}
      className={`topbar-breadcrumb-btn ${activeTopicId === 'home' ? 'active' : ''}`}
    >
      Lobby
    </button>
    {activeCourseId && activeTopicId !== 'home' && (
      <>
        <span className="topbar-breadcrumb-slash">/</span>
        <button
          type="button"
          onClick={onNavigateCourse}
          className={`topbar-breadcrumb-btn ${activeTopicId === 'course-home' ? 'active' : ''}`}
        >
          {courseCode || activeCourseId}
        </button>
      </>
    )}
    {topicTitle && activeTopicId !== 'home' && activeTopicId !== 'course-home' && (
      <>
        <span className="topbar-breadcrumb-slash">/</span>
        <span className="topbar-breadcrumb-title">{topicTitle}</span>
      </>
    )}
  </div>
  );
}

export const TopBarHeader: React.FC<TopBarHeaderProps> = ({
  onToggleSidebar,
  onOpenAiSettings,
  onToggleAiSettings,
  onOpenSettings,
  isAiOpen = false,
  activeCourseId,
  activeTopicId,
  courseCode,
  topicTitle,
  onNavigateHome,
  onNavigateCourse,
}) => {
  const { val } = useLanguage();
  const [aiStatus] = useAiTaskStatus();

  const handleAiClick = () => {
    if (onToggleAiSettings) {
      onToggleAiSettings();
    } else if (onOpenAiSettings) {
      onOpenAiSettings();
    }
  };

  const sidebarLabel = val(BUTTONS_TEXT.sidebar);
  const aiAssistantLabel = val(BUTTONS_TEXT.aiAssistant);
  const settingsLabel = val(SETTINGS_TEXT.settingsTitle);

  return (
    <header className="sticky-top-bar" id="sticky-header">
      <div className="topbar-left-cluster">
        {onToggleSidebar && (
          <button
            type="button"
            className="topbar-sidebar-btn"
            onClick={onToggleSidebar}
            title={sidebarLabel}
          >
            <PanelLeft size={14} strokeWidth={1.8} />
            <span dir="auto" className={styles.isolate}>{sidebarLabel}</span>
          </button>
        )}

        <LanguageSwitcher />

        <div className="topbar-divider" />

        <Breadcrumbs {...{ activeCourseId, activeTopicId, courseCode, topicTitle, onNavigateHome, onNavigateCourse }} />
      </div>

      <div className="topbar-right-cluster">
        {onOpenSettings && (
          <button
            type="button"
            className="topbar-settings-btn"
            onClick={onOpenSettings}
            title={settingsLabel}
          >
            <Settings size={13} />
            <span dir="auto" className={styles.isolate}>{settingsLabel}</span>
          </button>
        )}

        <div className="topbar-profile-container">
          <img
            src="https://github.com/ShacharTs.png"
            alt="Shachar Tsrafati"
            className="topbar-profile-avatar"
          />
          <a
            href="https://www.shachartsrafati.me"
            target="_blank"
            rel="noopener noreferrer"
            className="topbar-profile-link"
          >
            Shachar Tsrafati
          </a>
        </div>

        {(onToggleAiSettings || onOpenAiSettings) && (
          <button
            type="button"
            className={`topbar-ai-btn ${isAiOpen ? 'active' : ''}`}
            onClick={handleAiClick}
          >
            <Sparkles size={13} fill="currentColor" />
            <span dir="auto" className={styles.isolate}>{aiAssistantLabel}</span>
            {aiStatus === 'working' && <span className="ai-status-pulse-dot" />}
          </button>
        )}
      </div>
    </header>
  );
};
