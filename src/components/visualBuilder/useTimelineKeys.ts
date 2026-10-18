import { useEffect, useRef } from 'react';
import { isTyping } from './useBuilderKeys';

export interface TimelineKeyActions {
  duplicate: () => void;
  remove: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

type ClipAction = 'duplicate' | 'remove';

const CLIP_ACTIONS: Record<string, ClipAction> = { d: 'duplicate', delete: 'remove', backspace: 'remove' };
const VIEW_ACTIONS: Record<string, 'zoomIn' | 'zoomOut' | 'fit'> = { '+': 'zoomIn', '=': 'zoomIn', '-': 'zoomOut', _: 'zoomOut', '0': 'fit' };

// Capture phase: with a clip selected, Delete must remove the clip before the builder's shape delete sees the key.
export function useTimelineKeys(actions: TimelineKeyActions, hasClip: boolean): void {
  const latest = useRef({ actions, hasClip });
  latest.current = { actions, hasClip };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      const { actions: current, hasClip: clipSelected } = latest.current;
      const clipAction = CLIP_ACTIONS[key];
      const name = clipAction && clipSelected ? clipAction : VIEW_ACTIONS[event.key];
      if (!name) return;
      event.preventDefault();
      event.stopPropagation();
      current[name]();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
