import { useCanvasStore } from '@canvasStore';
import { CanvasPageView } from '../page/CanvasPageView';

/** Every page of the document currently in the editor store, laid out for print. */
export function OffscreenPages() {
  const pages = useCanvasStore((state) => state.doc.pages);
  return (
    <>
      {pages.map((page) => (
        <CanvasPageView key={page.id} pageId={page.id} printClassName="canvasPrintPage" />
      ))}
    </>
  );
}
