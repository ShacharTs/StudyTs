import type { ObjectPatch, SceneObject, Page, PagePatch } from '../model/sceneModel';

export function addPageCommand(page: Page, index: number, objects: SceneObject[] = []): Command {
  return {
    label: 'Add page',
    do: (api) => api.insertPageRaw(page, index, objects),
    undo: (api) => api.removePageRaw(page.id),
  };
}

export function removePageCommand(page: Page, index: number, objects: SceneObject[]): Command {
  return {
    label: 'Remove page',
    do: (api) => api.removePageRaw(page.id),
    undo: (api) => api.insertPageRaw(page, index, objects),
  };
}

export function movePageCommand(pageId: string, fromIndex: number, toIndex: number): Command {
  return {
    label: 'Move page',
    do: (api) => api.movePageRaw(pageId, toIndex),
    undo: (api) => api.movePageRaw(pageId, fromIndex),
  };
}

export function patchPageCommand(
  pageId: string,
  before: PagePatch,
  after: PagePatch,
  label = 'Edit page'
): Command {
  return {
    label,
    do: (api) => api.patchPageRaw(pageId, after),
    undo: (api) => api.patchPageRaw(pageId, before),
  };
}

export function compositeCommand(label: string, cmds: Command[], coalesceKey?: string): Command {
  return {
    label,
    coalesceKey,
    do: (api: CommandApi) => {
      for (const cmd of cmds) cmd.do(api);
    },
    undo: (api: CommandApi) => {
      for (let i = cmds.length - 1; i >= 0; i--) cmds[i].undo(api);
    },
  };
}

export interface CommandApi {
  addRaw(obj: SceneObject, pageId: string): void;
  removeRaw(id: string): void;
  patchRaw(id: string, patch: ObjectPatch): void;
  insertPageRaw(page: Page, index: number, objects?: SceneObject[]): void;
  removePageRaw(pageId: string): void;
  movePageRaw(pageId: string, toIndex: number): void;
  patchPageRaw(pageId: string, patch: PagePatch): void;
  /** Re-parents an object to another page's object list (at `index`, default the end). Position and size are not touched. */
  movePageObjectRaw(id: string, toPageId: string, index?: number): void;
}

export interface Command {
  label: string;
  do(api: CommandApi): void;
  undo(api: CommandApi): void;
  coalesceKey?: string;
}

export function addObjectCommand(obj: SceneObject, pageId: string): Command {
  return {
    label: 'Add object',
    do: (api) => api.addRaw(obj, pageId),
    undo: (api) => api.removeRaw(obj.id),
  };
}

export function removeObjectCommand(obj: SceneObject, pageId: string): Command {
  return {
    label: 'Remove object',
    do: (api) => api.removeRaw(obj.id),
    undo: (api) => api.addRaw(obj, pageId),
  };
}

export function patchObjectCommand(
  id: string,
  before: ObjectPatch,
  after: ObjectPatch,
  label = 'Edit object',
  coalesceKey?: string
): Command {
  return {
    label,
    coalesceKey,
    do: (api) => api.patchRaw(id, after),
    undo: (api) => api.patchRaw(id, before),
  };
}

export interface PageMoveItem {
  id: string;
  fromPageId: string;
  /** Position in the source page's object list, so undo puts the object back in the same stacking spot. */
  fromIndex: number;
  before: { x: number; y: number };
  after: { x: number; y: number };
}

/** Moves objects to another page and repositions them, as one undo step. */
export function moveObjectsToPageCommand(items: PageMoveItem[], toPageId: string): Command {
  return {
    label: 'Move to page',
    do: (api) => {
      for (const item of items) {
        api.movePageObjectRaw(item.id, toPageId);
        api.patchRaw(item.id, item.after);
      }
    },
    // Ascending original index, so each object lands back where it was even though earlier ones are re-inserted first.
    undo: (api) => {
      for (const item of [...items].sort((a, b) => a.fromIndex - b.fromIndex)) {
        api.movePageObjectRaw(item.id, item.fromPageId, item.fromIndex);
        api.patchRaw(item.id, item.before);
      }
    },
  };
}
