import { useEffect, useState } from 'react';
import { SCENE_CHANGED_EVENT } from '@core/canvasBlocks/sceneChangedEvent';
import { loadDocFromServer, createDoc, convertSceneToDocState, useCanvasStore } from '@canvasStore';
import { loadDocWithoutAutosave } from './sceneSaving';

export async function fetchFallbackSceneDoc(sceneId: string) {
  try {
    const res = await fetch(`/api/canvas-editor/scene?sceneId=${encodeURIComponent(sceneId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.scene ? convertSceneToDocState(data.scene) : null;
  } catch {
    return null;
  }
}

export function useSceneLoad(sceneId: string): { loading: boolean; error: string | null } {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ sceneId?: string }>).detail?.sceneId === sceneId) setReloadCount((n) => n + 1);
    };
    window.addEventListener(SCENE_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(SCENE_CHANGED_EVENT, onChanged);
  }, [sceneId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    useCanvasStore.getState().setSceneId(sceneId);

    loadDocFromServer(sceneId)
      .then(async (doc) => {
        if (cancelled) return;
        if (doc) {
          loadDocWithoutAutosave(doc);
          setLoading(false);
          return;
        }

        const fallback = await fetchFallbackSceneDoc(sceneId);
        if (cancelled) return;
        loadDocWithoutAutosave(fallback ?? createDoc());
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sceneId, reloadCount]);

  return { loading, error };
}
