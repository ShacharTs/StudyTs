import { useLayoutEffect, useRef } from 'react';
import styles from './PropertiesPanel.module.css';

interface AutoGrowTextareaProps {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

/** Height follows the content so a long LaTeX or UML body never scrolls inside a fixed box. */
export function AutoGrowTextarea({ id, value, placeholder, onChange }: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={styles.textArea}
    />
  );
}
