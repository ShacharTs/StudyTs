import type React from 'react';

export function nextPanelWidth(startWidth: number, deltaX: number, direction: 1 | -1, min: number, max: number): number {
  return Math.min(Math.max(startWidth + direction * deltaX, min), max);
}

interface WidthDragOptions {
  width: number;
  setWidth: (w: number) => void;
  direction: 1 | -1;
  min: number;
  max: number;
}

/** Returns a pointer-down handler that resizes a docked panel by dragging its divider. */
export function useWidthDrag({ width, setWidth, direction, min, max }: WidthDragOptions) {
  return (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const onMove = (ev: PointerEvent) => setWidth(nextPanelWidth(startWidth, ev.clientX - startX, direction, min, max));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
}
