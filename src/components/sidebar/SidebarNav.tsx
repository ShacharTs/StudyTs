/**
 * SidebarNav component.
 * Collapsible sidebar drawer rendering course tree navigation and active topic selection.
 * Implements Nocturne design system with full theme support.
 * Per-week rendering lives in SidebarWeekSection.tsx; per-topic rows in SidebarNavItem.tsx.
 */

import React from 'react';
import { useCourseRegistry } from '../../core/courseRegistry/CourseRegistryContext';
import { useLanguage } from '../../i18n/languageContext';
import { isRtl as checkIsRtl } from '../../i18n/localizedValue';
import { HUB_TEXT } from '../../i18n/dictionary';
import { SidebarWeekSection } from './SidebarWeekSection';
import { onActivateKey } from '../ui/keyboardActivation';
import styles from './Sidebar.module.css';
import type { CourseDefinitionAPI } from '../../core/courseDataLoader';
import { Film, Home, type LucideIcon } from 'lucide-react';
import { translateAppShell } from '../../i18n/appShell/translateAppShell';

function HubLink({ active, isRtl, label, onSelect, icon: Icon = Home }: { active: boolean; isRtl: boolean; label: string; onSelect: () => void; icon?: LucideIcon }) {
  return (
  <div
    className={`nvi ${styles.row} ${styles.hub} ${active ? `${styles.active} active-nav` : ''} ${active && isRtl ? styles.rtl : ''}`}
    onClick={onSelect}
  >
    <Icon size={15} color={active ? 'var(--ac)' : 'var(--text-4, #5c5c64)'} />
    <span>{label}</span>
  </div>
  );
}

function CourseRow({ course: c, isActive, isRtl, title, onSelect }: { course: CourseDefinitionAPI; isActive: boolean; isRtl: boolean; title: string; onSelect: (courseId: string) => void }) {
  return (
    <div
      key={c.id}
      className={`nvi ${styles.row} ${styles.course} ${isActive ? `${styles.active} active-nav` : ''} ${isActive && isRtl ? styles.rtl : ''}`}
      onClick={() => onSelect(c.id)}
      role="button"
      tabIndex={0}
      onKeyDown={onActivateKey(() => onSelect(c.id))}
    >
      <span className={styles.dot} style={{ background: c.color || 'var(--ac)' }} />
      <span className={styles.code}>{c.code}</span>
      <span className={styles.ellipsis}>{title}</span>
    </div>
  );
}

interface SidebarNavProps {
  isSidebarOpen: boolean;
  expandedWeeks: Record<string, boolean>;
  activeTopicId: string;
  activeCourseId: string;
  onToggleWeek: (weekKey: string) => void;
  onSelectTopic: (topicId: string) => void;
  onSelectCourse: (courseId: string) => void;
  // The visual steps page is a separate route; this entry sits under Courses Hub and highlights while open.
  visualStepsActive?: boolean;
  onOpenVisualSteps?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  isSidebarOpen,
  expandedWeeks,
  activeTopicId,
  activeCourseId,
  onToggleWeek,
  onSelectTopic,
  onSelectCourse,
  visualStepsActive = false,
  onOpenVisualSteps,
}) => {
  const { val, resolveLocalized, lang } = useLanguage();
  const isRtl = checkIsRtl(lang);
  const { registry } = useCourseRegistry();
  const currentCourse = registry[activeCourseId];
  const courseCatalog = currentCourse?.catalog ?? {};

  return (
    <aside
      className={`sidebar ${styles.aside} ${isSidebarOpen ? styles.open : ''} ${!isSidebarOpen ? 'collapsed' : ''}`}
      id="sidebar-nav"
    >
      <div className={styles.inner}>
        <HubLink active={activeTopicId === 'home'} isRtl={isRtl} label={val(HUB_TEXT.coursesHub)} onSelect={() => onSelectTopic('home')} />
        {onOpenVisualSteps && (
          <HubLink active={visualStepsActive} isRtl={isRtl} label={translateAppShell('visualSteps', lang)} onSelect={onOpenVisualSteps} icon={Film} />
        )}

        <div className={styles.sectionLabel}>
          Courses
        </div>

        {/* Course List */}
        <div className={styles.courseList}>
          {Object.values(registry).map((c) => {
            const isActive = activeTopicId !== 'home' && activeCourseId === c.id;
            return <CourseRow key={c.id} course={c} isActive={isActive} isRtl={isRtl} title={resolveLocalized(c.title)} onSelect={onSelectCourse} />;
          })}
        </div>

        {activeTopicId !== 'home' && (
          <>
            {/* Fading Divider */}
            <div className={styles.divider} />

            {/* Week Sections */}
            <div className={styles.weeks}>
              {Object.entries(courseCatalog).map(([weekKey, weekData]) => {
                const isExpanded = expandedWeeks[weekKey] ?? true;
                const onToggle = () => {
                  // Navigate to first topic when clicking week header
                  if (!isExpanded && weekData.lectures.length > 0) {
                    onSelectTopic(weekData.lectures[0].id);
                  }
                  onToggleWeek(weekKey);
                };

                return (
                  <SidebarWeekSection
                    key={weekKey}
                    weekTitle={resolveLocalized(weekData.title)}
                    lectures={weekData.lectures}
                    practice={weekData.practice}
                    isExpanded={isExpanded}
                    isRtl={isRtl}
                    activeTopicId={activeTopicId}
                    onToggle={onToggle}
                    onSelectTopic={onSelectTopic}
                    resolveLocalized={resolveLocalized}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
