// src/canvasEditor/page/pagePreviewContext.ts
/** Tells a page whether it is drawn as a small preview (thumbnail) instead of the editable page. */
import { createContext, useContext } from 'react';

export const PagePreviewContext = createContext(false);

export const PagePreviewProvider = PagePreviewContext.Provider;

export function useIsPagePreview(): boolean {
  return useContext(PagePreviewContext);
}
