import type { CommandApi } from '../commands/canvasCommands';
import {
  clampBoxToPage,
  type DocState,
  type ObjectPatch,
  type Page,
  type PagePatch,
  type SceneObject,
} from '../model/sceneModel';

interface StateWithDoc {
  doc: DocState;
}

type SetDoc = (fn: (state: StateWithDoc) => Partial<StateWithDoc>) => void;

export function createCommandApi(set: SetDoc): CommandApi {
  return {
    addRaw(obj: SceneObject, pageId: string) {
      set((state) => ({
        doc: {
          ...state.doc,
          objects: { ...state.doc.objects, [obj.id]: obj },
          pages: state.doc.pages.map((p) =>
            p.id === pageId ? { ...p, objects: [...p.objects, obj.id] } : p
          ),
        },
      }));
    },
    removeRaw(id: string) {
      set((state) => {
        const restObjects = { ...state.doc.objects };
        delete restObjects[id];
        return {
          doc: {
            ...state.doc,
            objects: restObjects,
            pages: state.doc.pages.map((p) => ({
              ...p,
              objects: p.objects.filter((oid) => oid !== id),
            })),
          },
        };
      });
    },
    patchRaw(id: string, patch: ObjectPatch) {
      set((state) => {
        const existing = state.doc.objects[id];
        if (!existing) return {};
        const { props: patchProps, ...restPatch } = patch;
        const merged = { ...existing, ...restPatch };

        const touchesBox =
          patch.x !== undefined || patch.y !== undefined || patch.w !== undefined || patch.h !== undefined;
        const boxPatch = touchesBox
          ? (() => {
              const page = state.doc.pages.find((p) => p.objects.includes(id));
              if (!page) return null;
              return clampBoxToPage(
                { x: merged.x, y: merged.y, w: merged.w, h: merged.h },
                page.orientation,
                page.paperSize
              );
            })()
          : null;

        return {
          doc: {
            ...state.doc,
            objects: {
              ...state.doc.objects,
              [id]: {
                ...merged,
                ...(boxPatch ?? {}),
                props: patchProps ? { ...existing.props, ...patchProps } : existing.props,
              },
            },
          },
        };
      });
    },
    insertPageRaw(page: Page, index: number, objects: SceneObject[] = []) {
      set((state) => {
        const pages = [...state.doc.pages];
        pages.splice(index, 0, page);
        const newObjects = { ...state.doc.objects };
        for (const obj of objects) newObjects[obj.id] = obj;
        return { doc: { ...state.doc, pages, objects: newObjects } };
      });
    },
    removePageRaw(pageId: string) {
      set((state) => {
        const target = state.doc.pages.find((p) => p.id === pageId);
        const idsToRemove = new Set(target?.objects ?? []);
        const remainingObjects = Object.fromEntries(
          Object.entries(state.doc.objects).filter(([id]) => !idsToRemove.has(id))
        );
        return {
          doc: {
            ...state.doc,
            pages: state.doc.pages.filter((p) => p.id !== pageId),
            objects: remainingObjects,
          },
        };
      });
    },
    movePageRaw(pageId: string, toIndex: number) {
      set((state) => {
        const pages = [...state.doc.pages];
        const fromIndex = pages.findIndex((p) => p.id === pageId);
        if (fromIndex === -1) return {};
        const [moved] = pages.splice(fromIndex, 1);
        pages.splice(toIndex, 0, moved);
        return { doc: { ...state.doc, pages } };
      });
    },
    movePageObjectRaw(id: string, toPageId: string, index?: number) {
      set((state) => ({
        doc: {
          ...state.doc,
          pages: state.doc.pages.map((p) => {
            const rest = p.objects.filter((oid) => oid !== id);
            if (p.id !== toPageId) return rest.length === p.objects.length ? p : { ...p, objects: rest };
            rest.splice(index ?? rest.length, 0, id);
            return { ...p, objects: rest };
          }),
        },
      }));
    },
    patchPageRaw(pageId: string, patch: PagePatch) {
      set((state) => ({
        doc: {
          ...state.doc,
          pages: state.doc.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
        },
      }));
    },
  };
}
