import { useCanvasStore } from './useCanvasStore';
import { createPage, type Orientation, type PagePatch, type PaperSize } from '../model/sceneModel';
import {
  addPageCommand,
  removePageCommand,
  movePageCommand,
  patchPageCommand,
} from '../commands/canvasCommands';

export function addPage(afterIndex?: number): ReturnType<typeof createPage> {
  const state = useCanvasStore.getState();
  const index = afterIndex !== undefined ? afterIndex + 1 : state.doc.pages.length;
  const page = createPage();
  state.execute(addPageCommand(page, index, []));
  return page;
}

export function removePage(id: string): void {
  const state = useCanvasStore.getState();
  if (state.doc.pages.length <= 1) return;
  const index = state.doc.pages.findIndex((p) => p.id === id);
  if (index === -1) return;
  const page = state.doc.pages[index];
  const objects = page.objects
    .map((oid) => state.doc.objects[oid])
    .filter(Boolean) as (typeof state.doc.objects)[string][];
  state.execute(removePageCommand(page, index, objects));
}

export function movePage(id: string, toIndex: number): void {
  const state = useCanvasStore.getState();
  const fromIndex = state.doc.pages.findIndex((p) => p.id === id);
  if (fromIndex === -1) return;
  state.execute(movePageCommand(id, fromIndex, toIndex));
}

export function patchPage(id: string, patch: PagePatch, label = 'Edit page'): void {
  const state = useCanvasStore.getState();
  const page = state.doc.pages.find((p) => p.id === id);
  if (!page) return;
  const before: PagePatch = {};
  for (const key of Object.keys(patch) as (keyof PagePatch)[]) {
    (before as Record<string, unknown>)[key] = page[key];
  }
  state.execute(patchPageCommand(id, before, patch, label));
}

export function toggleOrientation(id: string): void {
  const state = useCanvasStore.getState();
  const page = state.doc.pages.find((p) => p.id === id);
  if (!page) return;
  const next: Orientation = page.orientation === 'portrait' ? 'landscape' : 'portrait';
  patchPage(id, { orientation: next }, 'Toggle orientation');
}

export function setPageMargin(id: string, mm: number): void {
  patchPage(id, { margin: mm }, 'Set margin');
}

export function setPagePaperSize(id: string, size: PaperSize): void {
  patchPage(id, { paperSize: size }, 'Set paper size');
}
