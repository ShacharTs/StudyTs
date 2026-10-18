// src/components/sidebar/SidebarWeekSection.tsx
import { ChevronDown } from 'lucide-react';
import styles from './Sidebar.module.css';
import { Latex } from '@engine/latex';
import { HOME_TEXT } from '../../i18n/dictionary';
import { useLanguage } from '../../i18n/languageContext';
import { TopicKindIcon } from '../ui/TopicKindIcon';
import { onActivateKey } from '../ui/keyboardActivation';
import type { TopicKind } from '../ui/topicKinds';

interface SidebarNavItemProps {
  id: string;
  isActive: boolean;
  isRtl: boolean;
  numLabel: string;
  title: string;
  kind?: TopicKind;
  onSelect: () => void;
}

/** Shared row renderer for lecture/practice topic entries in SidebarNav. */
export function SidebarNavItem({ id, isActive, isRtl, numLabel, title, kind, onSelect }: SidebarNavItemProps) {
  return (
    <div
      id={`nav-${id}`}
      className={`nvi ${styles.row} ${styles.topic} ${isActive ? `${styles.active} active-nav` : ''} ${isActive && isRtl ? styles.rtl : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={onActivateKey(onSelect)}
    >
      <span className={styles.num}>
        {numLabel}
      </span>
      <span dir="auto" className={`${styles.ellipsis} ${styles.isolate}`}>
        <Latex text={title} />
      </span>
      {kind && <TopicKindIcon kind={kind} size={14} />}
    </div>
  );
}

interface TopicLike {
  id: string;
  title?: unknown;
  kind?: 'canvas' | 'stepPlayer' | 'file';
}

interface SidebarWeekSectionProps {
  weekTitle: string;
  lectures: TopicLike[];
  practice: TopicLike[];
  isExpanded: boolean;
  isRtl: boolean;
  activeTopicId: string;
  onToggle: () => void;
  onSelectTopic: (topicId: string) => void;
  resolveLocalized: (v?: unknown) => string;
}

export function SidebarWeekSection({
  weekTitle,
  lectures,
  practice,
  isExpanded,
  isRtl,
  activeTopicId,
  onToggle,
  onSelectTopic,
  resolveLocalized,
}: SidebarWeekSectionProps) {
  const { val } = useLanguage();
  return (
    <div className={styles.week}>
      <div
        onClick={onToggle}
        className={`${styles.weekHeader} ${isExpanded ? styles.expanded : ''}`}
      >
        <span dir="auto" className={styles.isolate}>{weekTitle}</span>
        <ChevronDown size={13} className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : isRtl ? styles.chevronRtl : ''}`} />
      </div>

      {isExpanded && (
        <div className={styles.weekItems}>
          {lectures.map((lec, idx) => {
            const numStr = idx < 9 ? `0${idx + 1}` : `${idx + 1}`;
            return (
              <SidebarNavItem
                key={lec.id}
                id={lec.id}
                isActive={activeTopicId === lec.id}
                isRtl={isRtl}
                numLabel={numStr}
                title={resolveLocalized(lec.title)}
                kind={lec.kind}
                onSelect={() => onSelectTopic(lec.id)}
              />
            );
          })}

          {practice.length > 0 && (
            <>
              <div className={`${styles.sectionLabel} ${styles.practiceLabel}`}>
                {val(HOME_TEXT.practice)}
              </div>
              {practice.map((prac, pIdx) => (
                <SidebarNavItem
                  key={prac.id}
                  id={prac.id}
                  isActive={activeTopicId === prac.id}
                  isRtl={isRtl}
                  numLabel={`P${pIdx + 1}`}
                  title={resolveLocalized(prac.title)}
                  kind={prac.kind}
                  onSelect={() => onSelectTopic(prac.id)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
