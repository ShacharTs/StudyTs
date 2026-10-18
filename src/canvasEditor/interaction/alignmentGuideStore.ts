import { create } from 'zustand';
import type { AlignmentGuide } from './alignmentGuides';

interface AlignmentGuideState {
  /** The page being dragged on; guides are drawn only on that page. */
  pageId: string | null;
  guides: AlignmentGuide[];
  show(pageId: string, guides: AlignmentGuide[]): void;
  clear(): void;
}

export const useAlignmentGuides = create<AlignmentGuideState>((set) => ({
  pageId: null,
  guides: [],
  show: (pageId, guides) => set({ pageId, guides }),
  clear: () => set({ pageId: null, guides: [] }),
}));
