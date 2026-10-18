import { useState, useEffect, useCallback } from 'react';
import { getStoredItem, setStoredItem } from '../../ai/userConfigStorage';
import { STORAGE_KEYS } from '@core/shared/storageKeys';

export const DEFAULT_AI_PANEL_WIDTH = 340;
export const MIN_AI_PANEL_WIDTH = 340;
const STORAGE_KEY = STORAGE_KEYS.aiPanelWidth;

function getInitialWidth(): number {
  const stored = getStoredItem(STORAGE_KEY);
  if (stored) {
    const parsed = Number.parseInt(stored, 10);
    if (!Number.isNaN(parsed) && parsed >= MIN_AI_PANEL_WIDTH) {
      return parsed;
    }
  }
  return DEFAULT_AI_PANEL_WIDTH;
}

export function useAiPanelResize(direction: 'ltr' | 'rtl') {
  const [width, setWidth] = useState<number>(getInitialWidth);

  useEffect(() => {
    setStoredItem(STORAGE_KEY, String(width));
  }, [width]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth = width;
      const dragFactor = direction === 'rtl' ? 1 : -1;

      const onPointerMove = (ev: PointerEvent) => {
        const deltaX = ev.clientX - startX;
        const maxWidth =
          typeof window !== 'undefined'
            ? Math.max(MIN_AI_PANEL_WIDTH, window.innerWidth - 200)
            : 1200;
        const nextWidth = Math.min(
          Math.max(startWidth + dragFactor * deltaX, MIN_AI_PANEL_WIDTH),
          maxWidth
        );
        setWidth(nextWidth);
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [width, direction]
  );

  const resetWidth = useCallback(() => {
    setWidth(DEFAULT_AI_PANEL_WIDTH);
  }, []);

  return {
    width,
    handlePointerDown,
    resetWidth,
  };
}
