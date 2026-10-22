// src/components/ai/ScrollToBottomButton.tsx
import { ArrowDown } from 'lucide-react';
import { AI_TEXT } from '../../i18n/dictionary';
import styles from './ScrollToBottomButton.module.css';

interface ScrollToBottomButtonProps {
  val: (input?: unknown) => string;
  onClick: () => void;
}

export function ScrollToBottomButton({ val, onClick }: ScrollToBottomButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.button}
      aria-label={val(AI_TEXT.scrollToBottom)}
    >
      <ArrowDown size={12} color="var(--ac)" />
      <span>{val(AI_TEXT.scrollToBottom)}</span>
    </button>
  );
}
