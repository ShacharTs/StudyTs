import { useCanvasStore, pageSizeMm, PX_PER_MM, type Page } from '@canvasStore';

export function clampPageIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

export const WORLD_PAD_MM = 24;
export const WORLD_GAP_MM = 12;

let viewportEl: HTMLElement | null = null;

export function registerViewportEl(el: HTMLElement | null): void {
  viewportEl = el;
}

export function pageTopMm(pages: Page[], index: number): number {
  let topMm = WORLD_PAD_MM;
  for (let i = 0; i < index; i++) {
    topMm += pageSizeMm(pages[i].orientation, pages[i].paperSize).h + WORLD_GAP_MM;
  }
  return topMm;
}

export function centerPage(pages: Page[], index: number): void {
  if (!viewportEl) return;
  const page = pages[index];
  if (!page) return;
  const topMm = pageTopMm(pages, index);
  const size = pageSizeMm(page.orientation, page.paperSize);
  const cw = viewportEl.clientWidth;
  const half = (WORLD_PAD_MM + size.w / 2) * PX_PER_MM;
  useCanvasStore.getState().setViewport({
    zoom: 1,
    panX: cw / 2 - half,
    panY: 24 - topMm * PX_PER_MM,
  });
}

export function screenToPageMm(
  pageId: string,
  pages: Page[],
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  if (!viewportEl) return null;
  const index = pages.findIndex((p) => p.id === pageId);
  if (index === -1) return null;
  const rect = viewportEl.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const { zoom, panX, panY } = useCanvasStore.getState().viewport;
  const worldPx = { x: (localX - panX) / zoom, y: (localY - panY) / zoom };
  const topMm = pageTopMm(pages, index);
  return {
    x: worldPx.x / PX_PER_MM - WORLD_PAD_MM,
    y: worldPx.y / PX_PER_MM - topMm,
  };
}

export function getViewportCenterMm(
  pageId: string,
  pages: Page[]
): { x: number; y: number } | null {
  if (!viewportEl) return null;
  const rect = viewportEl.getBoundingClientRect();
  const cx = rect.left + viewportEl.clientWidth / 2;
  const cy = rect.top + (viewportEl.clientHeight ?? 0) / 2;
  return screenToPageMm(pageId, pages, cx, cy);
}

/** The page containing a point given in world millimetres (pages are stacked, left-aligned at WORLD_PAD_MM). */
export function pageIdAtWorldMm(pages: Page[], xMm: number, yMm: number): string | null {
  let top = WORLD_PAD_MM;
  for (const page of pages) {
    const size = pageSizeMm(page.orientation, page.paperSize);
    const inX = xMm >= WORLD_PAD_MM && xMm <= WORLD_PAD_MM + size.w;
    if (inX && yMm >= top && yMm <= top + size.h) return page.id;
    top += size.h + WORLD_GAP_MM;
  }
  return null;
}

/** The page under a screen point, or null over the gaps between pages and outside the viewport. */
export function pageIdAtClientPoint(pages: Page[], clientX: number, clientY: number): string | null {
  if (!viewportEl) return null;
  const rect = viewportEl.getBoundingClientRect();
  const { zoom, panX, panY } = useCanvasStore.getState().viewport;
  const xMm = (clientX - rect.left - panX) / zoom / PX_PER_MM;
  const yMm = (clientY - rect.top - panY) / zoom / PX_PER_MM;
  return pageIdAtWorldMm(pages, xMm, yMm);
}
