import { useCallback, useEffect, useRef, useState } from 'react';

const LEAVE_DELAY_MS = 150;

/** Hover state that survives short gaps (e.g. moving from a shape onto a port that sits just outside its contour). */
export function useHoverIntent() {
  const [hovered, setHovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const onPointerEnter = useCallback(() => {
    clear();
    setHovered(true);
  }, []);
  const onPointerLeave = useCallback(() => {
    clear();
    timer.current = setTimeout(() => setHovered(false), LEAVE_DELAY_MS);
  }, []);

  return { hovered, handlers: { onPointerEnter, onPointerLeave } };
}
