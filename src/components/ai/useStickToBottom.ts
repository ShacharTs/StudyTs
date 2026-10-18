// src/components/ai/useStickToBottom.ts
import { useState, useEffect, useCallback, type RefObject } from 'react';
import { NEAR_BOTTOM_PX } from './chatLayoutConstants';

function scrollElementToBottom(el: HTMLElement) {
  if (typeof el.scrollTo === 'function') {
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  } else {
    el.scrollTop = el.scrollHeight;
  }
}

export function useStickToBottom(
  containerRef: RefObject<HTMLElement | null>,
  changeKey: unknown,
  enabled: boolean = true
) {
  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceToBottom <= NEAR_BOTTOM_PX);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [containerRef, handleScroll]);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    scrollElementToBottom(el);
    setIsAtBottom(true);
  }, [containerRef]);

  useEffect(() => {
    if (!enabled || !isAtBottom) return;
    const hasActiveSelection = typeof window !== 'undefined' && Boolean(window.getSelection()?.toString());
    if (hasActiveSelection) return;
    const el = containerRef.current;
    if (!el) return;
    scrollElementToBottom(el);
  }, [changeKey, enabled, isAtBottom, containerRef]);

  return { isAtBottom, scrollToBottom };
}
