import { useCallback } from 'react';
import { isPrimaryPress } from '../interaction/isPrimaryPress';
import { useCanvasStore, addObject, pxToMm } from '@canvasStore';
import { screenToPageMm } from '../viewport/pageViewport';
import { boundaryPointToward, portPoint, CONNECTABLE_TYPES } from './connectorBinding';
import { addConnectionPoint, removeConnectionPoint } from './customPorts';
import { objectHit } from '../shapeEngine/objectOutline';
import type { Point } from '@core/geometry/geometryPrimitives';

const SNAP_PX = 16;

type Doc = ReturnType<typeof useCanvasStore.getState>['doc'];
type Obj = Doc['objects'][string];

function connectable(doc: Doc, pageObjects: string[], exceptId: string): Obj[] {
  return pageObjects
    .filter((oid) => oid !== exceptId)
    .map((oid) => doc.objects[oid])
    .filter((cand): cand is Obj => !!cand && CONNECTABLE_TYPES.has(cand.type));
}

/** The node under the pointer, else the nearest one whose border is within the snap threshold. */
function findTarget(cands: Obj[], mm: Point, threshMm: number): Obj | null {
  const hit = cands.find((c) => objectHit(c, mm));
  if (hit) return hit;
  let best: Obj | null = null;
  let bestDist = threshMm;
  for (const cand of cands) {
    const pt = boundaryPointToward(cand, mm.x, mm.y);
    const dist = Math.hypot(pt.x - mm.x, pt.y - mm.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = cand;
    }
  }
  return best;
}

type Draft = { pageId: string; sourceId: string; sourcePort: string; anchor: Point; cur: Point; targetId?: string };

function createEdge(draft: Draft, pageId: string, objId: string) {
  const state = useCanvasStore.getState();
  const targetObj = state.doc.objects[draft.targetId!];
  const sourceObj = state.doc.objects[objId];
  const startPt = draft.anchor;
  const endPt: Point = sourceObj && targetObj ? boundaryPointToward(targetObj, startPt.x, startPt.y) : draft.cur;
  const newEdge = addObject(
    'edge',
    {
      x: Math.min(startPt.x, endPt.x),
      y: Math.min(startPt.y, endPt.y),
      w: Math.max(1, Math.abs(endPt.x - startPt.x)),
      h: Math.max(1, Math.abs(endPt.y - startPt.y)),
      props: {
        sourceId: draft.sourceId,
        sourcePort: draft.sourcePort,
        targetId: draft.targetId,
        directed: true,
        stroke: 'var(--text-1)',
        strokeWidth: 0.5,
      },
    },
    pageId
  );
  state.select([newEdge.id]);
}

/** Drags an arrow from one connection point (a dot or a point placed inside the shape) to a target. */
export function startPortDrag(objId: string, pageId: string, side: string, e: React.PointerEvent, placed = false): void {
  e.stopPropagation();
  const s = useCanvasStore.getState();
  const obj = s.doc.objects[objId];
  const page = s.doc.pages.find((p) => p.id === pageId);
  if (!obj || !page) return;

  const anchor = portPoint(obj, side);
  s.setDraftEdge({ pageId: page.id, sourceId: objId, sourcePort: side, anchor, cur: anchor });

  const onMove = (ev: PointerEvent) => {
    const st = useCanvasStore.getState();
    const mm = screenToPageMm(page.id, st.doc.pages, ev.clientX, ev.clientY);
    if (!mm) return;
    const target = findTarget(connectable(st.doc, page.objects, objId), mm, pxToMm(SNAP_PX, st.viewport.zoom));
    st.setDraftEdge({
      pageId: page.id,
      sourceId: objId,
      sourcePort: side,
      anchor,
      cur: target ? boundaryPointToward(target, mm.x, mm.y) : mm,
      ...(target ? { targetId: target.id } : {}),
    });
  };

  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    const draft = useCanvasStore.getState().draftEdge as Draft | null;
    useCanvasStore.getState().setDraftEdge(null);
    if (draft?.targetId) {
      createEdge(draft, page.id, objId);
    } else if (placed) {
      // A point placed for an arrow that found no target is dropped again, so a plain click leaves nothing behind.
      const current = useCanvasStore.getState().doc.objects[objId];
      if (current) removeConnectionPoint(current, side);
    }
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

export function usePortDrag(objId: string, pageId: string) {
  return useCallback(
    (side: string) => (e: React.PointerEvent) => {
      if (!isPrimaryPress(e)) return;
      startPortDrag(objId, pageId, side, e);
    },
    [objId, pageId]
  );
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Alt-drag from a point inside a shape: the point becomes a connection point of that shape (stored as a fraction of
 * its frame, so it scales with the shape) and the arrow starts there. Returns false when the press is outside the shape.
 */
export function startInteriorArrow(objId: string, pageId: string, e: React.PointerEvent): boolean {
  const s = useCanvasStore.getState();
  const obj = s.doc.objects[objId];
  const page = s.doc.pages.find((p) => p.id === pageId);
  const mm = page ? screenToPageMm(page.id, s.doc.pages, e.clientX, e.clientY) : null;
  if (!obj || !page || !mm || obj.w <= 0 || obj.h <= 0 || !objectHit(obj, mm)) return false;
  const id = addConnectionPoint(obj, clamp01((mm.x - obj.x) / obj.w), clamp01((mm.y - obj.y) / obj.h));
  startPortDrag(objId, pageId, id, e, true);
  return true;
}
