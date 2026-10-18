import { useCallback } from 'react';
import { isPrimaryPress } from '../interaction/isPrimaryPress';
import { useCanvasStore, patchObject, type SceneObject, pxToMm } from '@canvasStore';
import { screenToPageMm } from '../viewport/pageViewport';
import { findConnectableObjectAt } from './connectorBinding';
import { resolveEndpoints } from './connectorGeometry';

export function useLineCurveDrag(id: string) {
  return useCallback(
    (e: React.PointerEvent) => {
      if (!isPrimaryPress(e)) return;
      e.stopPropagation();
      const s = useCanvasStore.getState();
      const obj = s.doc.objects[id];
      if (!obj || (obj.type !== 'line' && obj.type !== 'edge')) return;

      const sourceObj = s.doc.objects[(obj.props.sourceId as string) || ''];
      const targetObj = s.doc.objects[(obj.props.targetId as string) || ''];
      const isBound = Boolean(sourceObj || targetObj);
      const { a, b } = resolveEndpoints(obj, isBound, sourceObj, targetObj);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const startClient = { x: e.clientX, y: e.clientY };
      const startCurvature = (obj.props.curvature as number) || 0;
      const zoom = s.viewport.zoom;

      const onMove = (ev: PointerEvent) => {
        const dxMm = pxToMm(ev.clientX - startClient.x, zoom);
        const dyMm = pxToMm(ev.clientY - startClient.y, zoom);
        const perpDelta = dxMm * nx + dyMm * ny;
        patchObject(
          id,
          {
            props: {
              ...obj.props,
              curvature: startCurvature + perpDelta,
            },
          },
          undefined
        );
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        patchObject(
          id,
          {
            props: {
              ...useCanvasStore.getState().doc.objects[id]?.props,
            },
          },
          'Curve line'
        );
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [id]
  );
}

export function reconcileFullyUnbound(obj: SceneObject): Record<string, unknown> | null {
  const stillBound = Boolean(obj.props.sourceId || obj.props.targetId);
  if (stillBound) return null;

  const sx = (obj.props.freeSourceX as number) ?? obj.x;
  const sy = (obj.props.freeSourceY as number) ?? obj.y + obj.h / 2;
  const tx = (obj.props.freeTargetX as number) ?? obj.x + obj.w;
  const ty = (obj.props.freeTargetY as number) ?? obj.y + obj.h / 2;

  const x = Math.min(sx, tx);
  const y = Math.min(sy, ty);
  const w = Math.max(1, Math.abs(tx - sx));
  const h = Math.max(1, Math.abs(ty - sy));

  return {
    x,
    y,
    w,
    h,
    props: { ...obj.props, freeSourceX: undefined, freeSourceY: undefined, freeTargetX: undefined, freeTargetY: undefined },
  };
}

type EdgeEnd = 'source' | 'target';

const END_ID_KEY: Record<EdgeEnd, string> = { source: 'sourceId', target: 'targetId' };
const FREE_X_KEY: Record<EdgeEnd, string> = { source: 'freeSourceX', target: 'freeTargetX' };
const FREE_Y_KEY: Record<EdgeEnd, string> = { source: 'freeSourceY', target: 'freeTargetY' };

export function useEdgeEndpointDrag(edgeId: string, end: EdgeEnd) {
  return useCallback(
    (e: React.PointerEvent) => {
      if (!isPrimaryPress(e)) return;
      e.stopPropagation();
      const s = useCanvasStore.getState();
      const obj = s.doc.objects[edgeId];
      if (!obj || (obj.type !== 'line' && obj.type !== 'edge')) return;

      const page = s.doc.pages.find((p) => p.objects.includes(edgeId));
      if (!page) return;

      const idKey = END_ID_KEY[end];
      const xKey = FREE_X_KEY[end];
      const yKey = FREE_Y_KEY[end];

      const onMove = (ev: PointerEvent) => {
        const st = useCanvasStore.getState();
        const mm = screenToPageMm(page.id, st.doc.pages, ev.clientX, ev.clientY);
        if (!mm) return;
        const target = findConnectableObjectAt(st.doc.objects, page.objects, mm.x, mm.y);
        const current = st.doc.objects[edgeId];
        if (!current) return;

        const nextId = target ? target.id : '';
        const currentId = (current.props[idKey] as string) || '';
        if (target && nextId === currentId) return;

        patchObject(
          edgeId,
          {
            props: {
              ...current.props,
              [idKey]: nextId,
              [xKey]: target ? undefined : mm.x,
              [yKey]: target ? undefined : mm.y,
            },
          },
          undefined
        );
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        const finalObj = useCanvasStore.getState().doc.objects[edgeId];
        if (!finalObj) return;
        const reconciled = reconcileFullyUnbound(finalObj);
        patchObject(edgeId, reconciled ?? { props: { ...finalObj.props } }, 'Move edge endpoint');
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [edgeId, end]
  );
}
