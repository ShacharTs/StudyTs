import type { LucideIcon } from 'lucide-react';
import {
  Circle,
  CircleDot,
  Image,
  Minus,
  Rows3,
  Shapes,
  Sigma,
  Spline,
  Table,
  Type,
} from 'lucide-react';
import type { ObjectType } from '@canvasStore';
import { useTranslation } from '@i18n';
import styles from './PropertiesPanel.module.css';

const TYPE_ICONS: Record<ObjectType, LucideIcon> = {
  shape: Shapes,
  node: CircleDot,
  edge: Spline,
  line: Minus,
  formula: Sigma,
  image: Image,
  text: Type,
  'uml-class': Rows3,
  table: Table,
};

interface PropertiesHeaderProps {
  type: ObjectType;
  onClose: () => void;
}

/** Object icon, kind and close control. Falls back to a plain circle for an unknown kind. */
export function PropertiesHeader({ type, onClose }: PropertiesHeaderProps) {
  const { val } = useTranslation();
  const Icon = TYPE_ICONS[type] ?? Circle;
  return (
    <div className={styles.header}>
      <Icon size={14} className={styles.objectIcon} aria-hidden="true" />
      <span className={styles.title}>{type}</span>
      <button className={styles.closeBtn} onClick={onClose} title={val({ key: 'canvasBlocks.properties.close' })}>
        ✕
      </button>
    </div>
  );
}
