import { useEffect } from 'react';
import { useTranslation } from '@i18n';
import styles from './TimelinePanel.module.css';

interface TimelineClipMenuProps {
  x: number;
  y: number;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

// Closes on any press outside the menu or on Escape; the clip keeps its selection.
export function TimelineClipMenu({ x, y, onDuplicate, onDelete, onClose }: TimelineClipMenuProps) {
  const { val } = useTranslation();
  useEffect(() => {
    const onPress = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-clip-menu]')) onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onPress);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPress);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div className={styles.clipMenu} data-clip-menu role="menu" style={{ left: x, top: y }}>
      <button type="button" role="menuitem" onClick={() => { onDuplicate(); onClose(); }}>
        {val({ key: 'visualAuthoring.timeline.duplicateClip' })} <kbd>D</kbd>
      </button>
      <button type="button" role="menuitem" onClick={() => { onDelete(); onClose(); }}>
        {val({ key: 'visualAuthoring.timeline.deleteClip' })} <kbd>Del</kbd>
      </button>
    </div>
  );
}
