import { create } from 'zustand';

/** One dragged object's outline in screen pixels, for the preview that follows the pointer between pages. */
export interface DragGhost {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PageDropState {
  /** The page the pointer is over while dragging objects off their own page; null for an ordinary in-page drag. */
  targetPageId: string | null;
  ghosts: DragGhost[];
  set: (targetPageId: string, ghosts: DragGhost[]) => void;
  clear: () => void;
}

export const usePageDrop = create<PageDropState>((set) => ({
  targetPageId: null,
  ghosts: [],
  set: (targetPageId, ghosts) => set({ targetPageId, ghosts }),
  clear: () => set({ targetPageId: null, ghosts: [] }),
}));
