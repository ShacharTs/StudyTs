import { create } from 'zustand';
import {
  createDocumentSlice,
  createHistorySlice,
  createSelectionSlice,
  createViewportSlice,
  createInteractionSlice,
  type EditorState,
} from './editorSlices';
import { createCommandApi } from './commandApi';
import { createDoc, type SceneObject } from '../model/sceneModel';

export function useObject(id: string): SceneObject | undefined {
  return useCanvasStore((state) => state.doc.objects[id]);
}

export function useIsSelected(id: string): boolean {
  return useCanvasStore((state) => state.selectedIds.includes(id));
}

export const useCanvasStore = create<EditorState>((set, get, api) => {
  const initialDoc = createDoc();
  const cmdApi = createCommandApi(set);
  return {
    ...createDocumentSlice(initialDoc)(set, get, api),
    ...createHistorySlice(set, get),
    ...createSelectionSlice(set, get, api),
    ...createViewportSlice(set, get, api),
    ...createInteractionSlice(set, get, api),
    _api: cmdApi,
  };
});
