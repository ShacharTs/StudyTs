import { addObject, useCanvasStore, pxToMm } from '@canvasStore';
import { findConnectableObjectAt } from '../connectors/connectorBinding';

const DEFAULT_LINE_LENGTH_MM = 40;

/** Positive box for a drawn line; flipX/flipY remember a right-to-left or bottom-to-top drag. A near-zero drag becomes a default-length flat line. */
function lineBox(sx: number, sy: number, ex: number, ey: number) {
  const dx = ex - sx;
  const dy = ey - sy;
  if (Math.hypot(dx, dy) < 1) return { x: sx, y: sy, w: DEFAULT_LINE_LENGTH_MM, h: 0, flips: {} };
  return { x: Math.min(sx, ex), y: Math.min(sy, ey), w: Math.abs(dx), h: Math.abs(dy), flips: { flipX: dx < 0, flipY: dy < 0 } };
}

export function spawnAtPoint(
  pageId: string,
  tool: 'text' | 'shape',
  xMm: number,
  yMm: number,
  textProps?: Record<string, unknown>
): void {
  const obj =
    tool === 'text'
      ? addObject('text', { x: xMm, y: yMm, ...(textProps ? { props: textProps } : {}) }, pageId)
      : addObject('shape', { x: xMm, y: yMm, props: { shape: 'rect' } }, pageId);

  useCanvasStore.getState().select([obj.id]);
  useCanvasStore.getState().setActiveTool('pointer');
}

export function startLineDraw(
  pageId: string,
  startXMm: number,
  startYMm: number,
  pageEl: HTMLElement,
  zoom: number
): void {
  let endXMm = startXMm;
  let endYMm = startYMm;

  const state = useCanvasStore.getState();
  const page = state.doc.pages.find((p) => p.id === pageId);
  const sourceObj = page
    ? findConnectableObjectAt(state.doc.objects, page.objects, startXMm, startYMm)
    : undefined;

  const onMove = (e: PointerEvent) => {
    const rect = pageEl.getBoundingClientRect();
    endXMm = pxToMm(e.clientX - rect.left, zoom);
    endYMm = pxToMm(e.clientY - rect.top, zoom);
  };

  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);

    const finalState = useCanvasStore.getState();
    const finalPage = finalState.doc.pages.find((p) => p.id === pageId);
    const targetObj = finalPage
      ? findConnectableObjectAt(finalState.doc.objects, finalPage.objects, endXMm, endYMm)
      : undefined;

    const { x, y, w, h, flips } = lineBox(startXMm, startYMm, endXMm, endYMm);

    const isBound = Boolean(sourceObj || targetObj);
    const obj = isBound
      ? addObject(
          'edge',
          {
            x,
            y,
            w,
            h,
            props: {
              sourceId: sourceObj?.id ?? '',
              targetId: targetObj?.id ?? '',
              directed: true,
              stroke: 'var(--text-1)',
              strokeWidth: 0.5,
            },
          },
          pageId
        )
      : addObject('line', { x, y, w, h, props: flips }, pageId);

    useCanvasStore.getState().select([obj.id]);
    useCanvasStore.getState().setActiveTool('pointer');
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}
