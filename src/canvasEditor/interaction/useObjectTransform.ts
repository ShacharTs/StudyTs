import { useCallback } from 'react';
import { isPrimaryPress } from './isPrimaryPress';
import { useCanvasStore, patchObjectCommand, clampToPage, GRID_MM, type SceneObject } from '@canvasStore';
import { screenToPageMm } from '../viewport/pageViewport';
import { toLocalDelta, resizeRotated, snapResizeBox, type ResizeHandle } from './interactionGeometry';

const SNAP_DEG = 15;

function angleTo(cx: number, cy: number, px: number, py: number): number {
  return (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
}

export function useObjectRotate(objectId: string): (e: React.PointerEvent) => void {
  return useCallback(
    (e: React.PointerEvent) => {
      if (!isPrimaryPress(e)) return;
      e.stopPropagation();
      const obj = useCanvasStore.getState().doc.objects[objectId];
      if (!obj) return;
      const parent = (e.currentTarget as HTMLElement).parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const startAngle = angleTo(cx, cy, e.clientX, e.clientY);
      const startRotation = obj.rotation;

      const onMove = (moveEvent: PointerEvent) => {
        const curAngle = angleTo(cx, cy, moveEvent.clientX, moveEvent.clientY);
        let next = startRotation + (curAngle - startAngle);
        if ((moveEvent as PointerEvent & { shiftKey?: boolean }).shiftKey) {
          next = Math.round(next / SNAP_DEG) * SNAP_DEG;
        }
        useCanvasStore.getState()._api.patchRaw(objectId, { rotation: next });
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        const finalObj = useCanvasStore.getState().doc.objects[objectId];
        if (!finalObj) return;
        useCanvasStore
          .getState()
          .commit(
            patchObjectCommand(
              objectId,
              { rotation: startRotation },
              { rotation: finalObj.rotation },
              'Rotate'
            )
          );
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [objectId]
  );
}

const VERTICAL_OR_CORNER_HANDLES: ResizeHandle[] = ['n', 's', 'ne', 'nw', 'se', 'sw'];
const SNAP_THRESHOLD_MM = 3;

/** Props a resize leaves behind: a vertical resize marks the size as manual, and any resize of a text box or table takes it off auto-fit. */
function resizedProps(obj: SceneObject, handle: ResizeHandle): SceneObject['props'] | null {
  const vertical = VERTICAL_OR_CORNER_HANDLES.includes(handle);
  const text = obj.type === 'text' || obj.type === 'table';
  if (!vertical && !text) return null;
  return { ...obj.props, ...(vertical && { manualSize: true }), ...(text && { autoFit: false }) };
}

export function useObjectResize(
  objectId: string,
  pageId: string,
  handle: ResizeHandle
): (e: React.PointerEvent) => void {
  return useCallback(
    (e: React.PointerEvent) => {
      if (!isPrimaryPress(e)) return;
      e.stopPropagation();
      const obj = useCanvasStore.getState().doc.objects[objectId];
      if (!obj) return;
      const origin = { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
      const startMm = screenToPageMm(
        pageId,
        useCanvasStore.getState().doc.pages,
        e.clientX,
        e.clientY
      );
      if (!startMm) return;

      const onMove = (moveEvent: PointerEvent) => {
        const curMm = screenToPageMm(
          pageId,
          useCanvasStore.getState().doc.pages,
          moveEvent.clientX,
          moveEvent.clientY
        );
        if (!curMm) return;
        const dxScreen = curMm.x - startMm.x;
        const dyScreen = curMm.y - startMm.y;
        const lockAspect = moveEvent.shiftKey;
        const local = toLocalDelta(dxScreen, dyScreen, obj.rotation);
        let box = resizeRotated(origin, obj.rotation, handle, local.dx, local.dy, lockAspect);

        if (obj.rotation === 0) {
          const page = useCanvasStore
            .getState()
            .doc.pages.find((p) => p.objects.includes(objectId));
          const others = (page?.objects ?? [])
            .filter((id) => id !== objectId)
            .map((id) => useCanvasStore.getState().doc.objects[id])
            .filter((o): o is NonNullable<typeof o> => Boolean(o));
          const useGrid = !moveEvent.altKey;
          const snapLines = {
            x: others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w]),
            y: others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h]),
          };
          const snapped = snapResizeBox(
            box,
            handle,
            snapLines,
            SNAP_THRESHOLD_MM,
            useGrid,
            GRID_MM
          );
          box = snapped.box;
          if (page) {
            const clampedPos = clampToPage(
              box.x,
              box.y,
              box.w,
              box.h,
              page.orientation,
              page.paperSize
            );
            box = { ...box, ...clampedPos };
          }
        }

        const api = useCanvasStore.getState()._api;
        const patch: Record<string, unknown> = { x: box.x, y: box.y, w: box.w, h: box.h };
        const props = resizedProps(obj, handle);
        if (props) patch.props = props;
        api.patchRaw(objectId, patch);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        const finalObj = useCanvasStore.getState().doc.objects[objectId];
        if (!finalObj) return;
        const after: Record<string, unknown> = {
          x: finalObj.x,
          y: finalObj.y,
          w: finalObj.w,
          h: finalObj.h,
        };
        if (resizedProps(finalObj, handle)) after.props = finalObj.props;
        useCanvasStore
          .getState()
          .commit(
            patchObjectCommand(
              objectId,
              { x: origin.x, y: origin.y, w: origin.w, h: origin.h, ...(after.props ? { props: obj.props } : {}) },
              after,
              'Resize'
            )
          );
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [objectId, pageId, handle]
  );
}
