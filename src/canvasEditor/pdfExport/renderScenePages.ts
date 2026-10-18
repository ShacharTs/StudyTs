import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { loadDocFromServer } from '@canvasStore';
import { fetchFallbackSceneDoc } from '../saving/useSceneLoad';
import { loadDocWithoutAutosave } from '../saving/sceneSaving';
import { OffscreenPages } from './OffscreenPages';
import { waitForImages } from './printSheet';

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Renders a saved canvas off-screen with the real page components and returns detached copies of its pages.
 * Uses the one editor store, so it must not run while a canvas is open for editing.
 */
export async function renderScenePages(sceneId: string): Promise<HTMLElement[]> {
  const doc = (await loadDocFromServer(sceneId)) ?? (await fetchFallbackSceneDoc(sceneId));
  if (!doc) throw new Error(`Canvas "${sceneId}" could not be loaded`);
  loadDocWithoutAutosave(doc);

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;';
  document.body.append(host);
  const root = createRoot(host);
  try {
    root.render(createElement(OffscreenPages));
    await nextFrame();
    await nextFrame();
    await document.fonts?.ready;
    await waitForImages(host);
    return [...host.querySelectorAll<HTMLElement>('[data-page-id]')].map((page) => page.cloneNode(true) as HTMLElement);
  } finally {
    root.unmount();
    host.remove();
  }
}
