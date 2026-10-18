import { useState, type RefObject } from 'react';
import { setProp } from '@canvasStore';

const MIN_COLUMN_FRACTION = 0.05;

/** True when the table keeps its own column widths (a column border was dragged, or the author set them). */
export function hasStoredColumnWidths(raw: unknown, cols: number): boolean {
  return Array.isArray(raw) && raw.length === cols && raw.every((n) => typeof n === 'number' && n > 0);
}

/** Stored widths are fractions of the table width; anything stale or malformed falls back to `fallback` (equal columns by default). */
export function readColumnWidths(raw: unknown, cols: number, fallback?: number[]): number[] {
  if (!hasStoredColumnWidths(raw, cols)) return fallback ?? Array<number>(cols).fill(1 / cols);
  const total = (raw as number[]).reduce((a, b) => a + b, 0);
  return (raw as number[]).map((n) => n / total);
}

/** Word-style: dragging the border between column i and i+1 trades width between those two only. */
export function moveBorder(widths: number[], i: number, delta: number): number[] {
  const pair = widths[i] + widths[i + 1];
  const left = Math.min(pair - MIN_COLUMN_FRACTION, Math.max(MIN_COLUMN_FRACTION, widths[i] + delta));
  const next = [...widths];
  next[i] = left;
  next[i + 1] = pair - left;
  return next;
}

export function useColumnResize(objId: string, stored: number[], tableRef: RefObject<HTMLElement | null>) {
  const [live, setLive] = useState<number[] | null>(null);

  const startDrag = (i: number) => (e: React.PointerEvent) => {
    // The frame starts an object drag on pointerdown; a border drag must not move the table.
    e.stopPropagation();
    e.preventDefault();
    const tableW = tableRef.current?.getBoundingClientRect().width;
    if (!tableW) return;
    const startX = e.clientX;
    let latest = stored;

    const onMove = (ev: PointerEvent) => {
      latest = moveBorder(stored, i, (ev.clientX - startX) / tableW);
      setLive(latest);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setProp(objId, 'colWidths', latest, 'Resize table column');
      setLive(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return { widths: live ?? stored, startDrag };
}
