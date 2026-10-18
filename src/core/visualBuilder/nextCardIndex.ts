const HORIZONTAL: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
const VERTICAL: Record<string, number> = { ArrowUp: -1, ArrowDown: 1 };

export const NAVIGATION_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'] as const;

// Visual left is the previous card in left-to-right text and the next one in right-to-left.
export function nextCardIndex(current: number, key: string, columns: number, rtl: boolean, count: number): number {
  const last = count - 1;
  if (last < 0) return 0;
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  const step = (HORIZONTAL[key] ?? 0) * (rtl ? -1 : 1) + (VERTICAL[key] ?? 0) * Math.max(1, columns);
  return Math.min(last, Math.max(0, current + step));
}
