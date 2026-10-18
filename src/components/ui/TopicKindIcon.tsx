// src/components/ui/TopicKindIcon.tsx
/**
 * The icon that says what a topic opens: a play triangle for the Step player, a page for the Canvas.
 * Its colour follows the accent chosen in Settings (see --kind-player / --kind-canvas) and it carries the
 * kind's name as its accessible label, so the meaning never depends on colour alone.
 */

import { File, FileText, Play } from 'lucide-react';
import { useTopicKindLabel, type TopicKind } from './topicKinds';
import styles from './TopicKindIcon.module.css';

const ICONS = {
  canvas: { Icon: File, className: styles.canvas },
  stepPlayer: { Icon: Play, className: styles.player },
  file: { Icon: FileText, className: styles.canvas },
} as const;

interface TopicKindIconProps {
  kind: TopicKind;
  size?: number;
  /** Hides the icon from screen readers when its name is already written next to it. */
  decorative?: boolean;
}

export function TopicKindIcon({ kind, size = 16, decorative = false }: TopicKindIconProps) {
  const label = useTopicKindLabel(kind);
  const { Icon, className } = ICONS[kind];
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label, title: label };
  return (
    <span className={`${styles.icon} ${className}`} {...a11y}>
      <Icon size={size} aria-hidden="true" />
    </span>
  );
}
