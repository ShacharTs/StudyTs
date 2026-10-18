/**
 * Patch Notes Modal component.
 * Displays version release highlights and platform updates.
 */

import React from 'react';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { BUTTONS_TEXT, PATCH_NOTES_TEXT } from '../../i18n/dictionary';
import { ModalShell } from '../ui/ModalShell';
import styles from './PatchNotesModal.module.css';

interface PatchNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PatchNotesModal: React.FC<PatchNotesModalProps> = ({ isOpen, onClose }) => {
  const { val } = useTranslation();

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} animated maxWidth={560} ariaLabel={val(PATCH_NOTES_TEXT.patchNotesTitle)}>
      <button type="button" aria-label={val(BUTTONS_TEXT.close)} onClick={onClose} className={styles.close}>
        <X size={20} />
      </button>

        <div className={styles.titleRow}>
          <Sparkles size={24} />
          <h2 dir="auto" className={styles.title}>
            {val(PATCH_NOTES_TEXT.patchNotesTitle)}
          </h2>
        </div>

        <div className={styles.body}>
          <p dir="auto" className={styles.para}>
            <strong>{val(PATCH_NOTES_TEXT.patchNotesVersion)}</strong>
          </p>

          <p dir="auto" className={styles.para}>
            {val(PATCH_NOTES_TEXT.patchNotesDesc)}
          </p>

          <div className={styles.list}>
            <div className={styles.item}>
              <CheckCircle2 size={18} color="var(--accent-cyan)" className={styles.icon} />
              <div dir="auto" className={styles.itemText}>
                <strong className={styles.itemStrong}>Pure TypeScript Code-as-Data</strong>: Zero JSON files; all topics compiled dynamically.
              </div>
            </div>

            <div className={styles.item}>
              <CheckCircle2 size={18} color="var(--accent-purple)" className={styles.icon} />
              <div dir="auto" className={styles.itemText}>
                <strong className={styles.itemStrong}>Visual Engine Suite</strong>: High-resolution SVG Graph Canvas, Turing Machine Tape Engine, Venn Class Diagrams, and Reduction Pipelines.
              </div>
            </div>

            <div className={styles.item}>
              <CheckCircle2 size={18} color="var(--accent-green)" className={styles.icon} />
              <div dir="auto" className={styles.itemText}>
                <strong className={styles.itemStrong}>Bundled KaTeX Engine</strong>: Crisp mathematical typesetting for complexity classes and reduction formulas.
              </div>
            </div>
          </div>
        </div>

        <button type="button" onClick={onClose} className={styles.cta}>
          {val(BUTTONS_TEXT.close)}
        </button>
    </ModalShell>
  );
};
