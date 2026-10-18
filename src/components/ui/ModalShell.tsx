import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './ModalShell.module.css';

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  labelledBy?: string;
  ariaLabel?: string;
  dir?: 'ltr' | 'rtl';
  maxWidth?: number;
  animated?: boolean;
  children: React.ReactNode;
}

export function ModalShell({ isOpen, onClose, labelledBy, ariaLabel, dir, maxWidth = 480, animated, children }: ModalShellProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [isOpen, onClose]);

  const card = (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : ariaLabel}
      dir={dir}
      tabIndex={-1}
      className={styles.card}
      style={{ ['--modal-max-width' as string]: `${maxWidth}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );

  if (animated) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            data-testid="modal-scrim"
            className={styles.scrim}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          >
            {card}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
  if (!isOpen) return null;
  return (
    <div data-testid="modal-scrim" className={styles.scrim} onClick={onClose}>
      {card}
    </div>
  );
}
