import type { DocState } from '../model/sceneModel';
import { SCENE_CHANGED_EVENT } from '@core/canvasBlocks/sceneChangedEvent';

/** The scene version each key was last loaded or saved at, sent back so the server can refuse a save based on stale content. */
const knownVersions = new Map<string, number>();

function rememberVersion(key: string, version: unknown): void {
  if (typeof version === 'number') knownVersions.set(key, version);
}

export async function saveDoc(key: string, doc: DocState): Promise<void> {
  const res = await fetch('/api/canvas-store/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, doc, baseVersion: knownVersions.get(key) }),
  });
  if (res.status === 409) {
    // Someone else (the AI) changed the scene: drop our stale copy instead of retrying over it.
    knownVersions.delete(key);
    window.dispatchEvent(new CustomEvent(SCENE_CHANGED_EVENT, { detail: { sceneId: key } }));
  }
  if (!res.ok) throw new Error(`saveDoc failed: ${res.status}`);
  rememberVersion(key, (await res.json()).version);
}

export async function loadDoc(key: string): Promise<DocState | null> {
  const res = await fetch(`/api/canvas-store/load?key=${encodeURIComponent(key)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`loadDoc failed: ${res.status}`);
  const body = await res.json();
  rememberVersion(key, body.version);
  return body.doc;
}
