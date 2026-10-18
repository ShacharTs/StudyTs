// src/components/ai/useAutosizeTextarea.ts
import { useEffect, type RefObject } from 'react';
import { COMPOSER_MAX_ROWS } from './chatLayoutConstants';

const ROW_HEIGHT_PX = 24;
const MIN_HEIGHT_PX = 38;

export function useAutosizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxRows: number = COMPOSER_MAX_ROWS
) {
  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = maxRows * ROW_HEIGHT_PX;

    if (scrollHeight <= MIN_HEIGHT_PX) {
      textarea.style.height = `${MIN_HEIGHT_PX}px`;
      textarea.style.overflowY = 'hidden';
    } else if (scrollHeight > maxHeight) {
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.height = `${scrollHeight}px`;
      textarea.style.overflowY = 'hidden';
    }
  }, [ref, value, maxRows]);
}
