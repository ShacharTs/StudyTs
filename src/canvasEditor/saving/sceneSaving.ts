import { useEffect } from 'react';
import { saveDoc, useCanvasStore, type DocState } from '@canvasStore';
import { createAutosaver, type Autosaver } from '@canvasStore/persistence/autosaver';

const savers = new Map<string, Autosaver<DocState>>();

function saverFor(sceneId: string): Autosaver<DocState> {
  let saver = savers.get(sceneId);
  if (!saver) {
    saver = createAutosaver<DocState>({
      save: (doc) => saveDoc(sceneId, doc),
      onStatus: (status, error) => useCanvasStore.getState().setSaveStatus(status, error),
    });
    savers.set(sceneId, saver);
  }
  return saver;
}

let loadingDoc = false;

/** Puts a server document into the editor without echoing it straight back as a save (which would rewrite what was just read). */
export function loadDocWithoutAutosave(doc: DocState): void {
  loadingDoc = true;
  try {
    useCanvasStore.getState().loadDoc(doc);
  } finally {
    loadingDoc = false;
  }
}

/** Queue a debounced save of `doc` under `sceneId`. */
export function scheduleSave(sceneId: string, doc: DocState): void {
  saverFor(sceneId).schedule(doc);
}

/** Write every scene's pending change now (scene switch, unmount, page hide). */
export async function flushAllSaves(): Promise<void> {
  await Promise.all([...savers.values()].map((s) => s.flush()));
}

/** Manual save: write the current document immediately. */
export async function saveNow(): Promise<void> {
  const { sceneId, doc } = useCanvasStore.getState();
  if (!sceneId) return;
  const saver = saverFor(sceneId);
  saver.schedule(doc);
  await saver.flush();
}

/** Debounced auto-save of the open scene, flushed on scene switch, unmount and page hide. */
export function useSceneAutosave(): void {
  useEffect(() => {
    const unsubscribe = useCanvasStore.subscribe((state, prev) => {
      if (prev.sceneId && prev.sceneId !== state.sceneId) void flushAllSaves();
      if (!loadingDoc && state.sceneId && state.doc !== prev.doc && state.sceneId === prev.sceneId) {
        scheduleSave(state.sceneId, state.doc);
      }
    });
    const onHide = () => void flushAllSaves();
    window.addEventListener('pagehide', onHide);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', onHide);
      void flushAllSaves();
    };
  }, []);
}
