import { useCallback } from 'react';
import {
  useCanvasStore,
  groupMembers,
  patchObjectCommand,
  compositeCommand,
  clampToPage,
  moveObjectsToPage,
  type SceneObject,
  type PaperSize,
} from '@canvasStore';
import { screenToPageMm, pageIdAtClientPoint } from '../viewport/pageViewport';
import { snapObjectToGuides, VISIBLE_GRID_MM } from './interactionGeometry';
import { computeAlignmentGuides } from './alignmentGuides';
import { useAlignmentGuides } from './alignmentGuideStore';
import { useGuidesVisibility } from '../view/viewPreferences';
import { usePageDrop, type DragGhost } from './pageDropStore';

export const MIN_DRAG_PX = 3;

export class DragThresholdController {
  private moved = false;

  hasMoved(dx: number, dy: number): boolean {
    if (this.moved) return true;
    if (dx * dx + dy * dy >= MIN_DRAG_PX * MIN_DRAG_PX) {
      this.moved = true;
    }
    return this.moved;
  }
}

interface DragOrigin {
  id: string;
  x: number;
  y: number;
}

function anchorClosure(startIds: string[], allObjects: Record<string, SceneObject>): Set<string> {
  const closure = new Set(startIds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const obj of Object.values(allObjects)) {
      if (obj.anchorId && closure.has(obj.anchorId) && !closure.has(obj.id)) {
        closure.add(obj.id);
        grew = true;
      }
    }
  }
  return closure;
}

type CanvasState = ReturnType<typeof useCanvasStore.getState>;
type OwningPage = CanvasState['doc']['pages'][number] | undefined;

/** How far to nudge the drag so the primary object snaps to neighbours / margins (zero when snapping is off). */
function snapAdjustment(
  currentState: CanvasState,
  owningPage: OwningPage,
  objectId: string,
  origins: DragOrigin[],
  closureIds: Set<string>,
  dxMm: number,
  dyMm: number
): { x: number; y: number } {
  const primaryOrigin = origins.find((o) => o.id === objectId);
  if (!currentState.snapEnabled || !primaryOrigin) return { x: 0, y: 0 };
  const primaryObj = currentState.doc.objects[objectId];
  const others = (owningPage?.objects ?? [])
    .filter((id) => id !== objectId && !closureIds.has(id))
    .map((id) => currentState.doc.objects[id])
    .filter((o): o is SceneObject => Boolean(o));
  const marginLines = owningPage ? { x: [owningPage.margin], y: [owningPage.margin] } : {};
  const proposedBox = {
    x: primaryOrigin.x + dxMm,
    y: primaryOrigin.y + dyMm,
    w: primaryObj?.w ?? 0,
    h: primaryObj?.h ?? 0,
  };
  const gridMm = currentState.showGrid ? VISIBLE_GRID_MM : null;
  const snapped = snapObjectToGuides(proposedBox, others, 3, true, marginLines, gridMm);
  return { x: snapped.x - proposedBox.x, y: snapped.y - proposedBox.y };
}

export function computeCollectiveDelta(
  origins: DragOrigin[],
  objects: Record<string, SceneObject>,
  dx: number,
  dy: number,
  orientation: 'portrait' | 'landscape',
  paperSize?: PaperSize
): { dx: number; dy: number } {
  if (origins.length === 0) return { dx, dy };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const origin of origins) {
    const obj = objects[origin.id];
    if (!obj) continue;
    minX = Math.min(minX, origin.x);
    minY = Math.min(minY, origin.y);
    maxX = Math.max(maxX, origin.x + obj.w);
    maxY = Math.max(maxY, origin.y + obj.h);
  }

  if (minX === Infinity) return { dx, dy };

  const clusterW = maxX - minX;
  const clusterH = maxY - minY;
  const clamped = clampToPage(minX + dx, minY + dy, clusterW, clusterH, orientation, paperSize);
  return { dx: clamped.x - minX, dy: clamped.y - minY };
}

/** One undo-able "Move" entry covering every dragged object that actually moved. */
function commitMove(origins: DragOrigin[]): void {
  const cmds = origins
    .map((origin) => {
      const obj = useCanvasStore.getState().doc.objects[origin.id];
      if (!obj) return null;
      return patchObjectCommand(origin.id, { x: origin.x, y: origin.y }, { x: obj.x, y: obj.y }, 'Move');
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
  if (cmds.length > 0) useCanvasStore.getState().commit(compositeCommand('Move', cmds));
}

/** Guides are judged on the final, post-snap position, so a line only shows where edges truly coincide. */
function publishAlignmentGuides(pageId: string, primary: DragOrigin | undefined, dx: number, dy: number, closureIds: Set<string>): void {
  const state = useCanvasStore.getState();
  const primaryObj = primary ? state.doc.objects[primary.id] : undefined;
  const page = state.doc.pages.find((p) => p.id === pageId);
  if (!primary || !primaryObj || !page || !useGuidesVisibility.getState().showGuides) {
    useAlignmentGuides.getState().clear();
    return;
  }
  const moving = { x: primary.x + dx, y: primary.y + dy, w: primaryObj.w, h: primaryObj.h };
  const others = page.objects
    .filter((id) => !closureIds.has(id))
    .map((id) => state.doc.objects[id])
    .filter((o): o is SceneObject => Boolean(o && o.type !== 'edge' && !o.hidden));
  useAlignmentGuides.getState().show(pageId, computeAlignmentGuides(moving, others));
}

/** Where each dragged object sits on screen when the drag starts; the preview between pages is these boxes following the pointer. */
function measureStartRects(ids: string[]): DragGhost[] {
  return ids
    .map((id) => document.querySelector(`[data-object-id="${id}"]`)?.getBoundingClientRect())
    .filter((r): r is DOMRect => Boolean(r))
    .map((r) => ({ left: r.left, top: r.top, width: r.width, height: r.height }));
}

/** Dropping on another page: put the objects back where the drag found them, then move them across as one undo step. */
function dropOnPage(targetPageId: string, origins: DragOrigin[], startMm: { x: number; y: number }, clientX: number, clientY: number): void {
  const state = useCanvasStore.getState();
  for (const origin of origins) state._api.patchRaw(origin.id, { x: origin.x, y: origin.y });
  const at = screenToPageMm(targetPageId, state.doc.pages, clientX, clientY);
  if (!at) return;
  moveObjectsToPage(origins.map((o) => o.id), targetPageId, { kind: 'delta', dx: at.x - startMm.x, dy: at.y - startMm.y });
}

export function useObjectDrag(objectId: string, pageId: string): (e: React.PointerEvent) => void {
  return useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      const state = useCanvasStore.getState();
      const clickedGroup = groupMembers(objectId);
      const alreadySelected = state.selectedIds.includes(objectId);
      const nextSelection = alreadySelected ? state.selectedIds : clickedGroup;
      if (!alreadySelected) state.select(nextSelection);

      const closureIds = anchorClosure(nextSelection, useCanvasStore.getState().doc.objects);
      const origins: DragOrigin[] = [...closureIds]
        .map((id) => useCanvasStore.getState().doc.objects[id])
        .filter((o): o is SceneObject => Boolean(o))
        .map((o) => ({ id: o.id, x: o.x, y: o.y }));

      const startMm = screenToPageMm(
        pageId,
        useCanvasStore.getState().doc.pages,
        e.clientX,
        e.clientY
      );
      if (!startMm) return;

      const threshold = new DragThresholdController();
      const startRects = measureStartRects(origins.map((o) => o.id));
      let crossPageId: string | null = null;
      let lastDxPx = 0;
      let lastDyPx = 0;

      const onMove = (moveEvent: PointerEvent) => {
        lastDxPx = moveEvent.clientX - e.clientX;
        lastDyPx = moveEvent.clientY - e.clientY;
        if (!threshold.hasMoved(lastDxPx, lastDyPx)) return;

        const hover = pageIdAtClientPoint(useCanvasStore.getState().doc.pages, moveEvent.clientX, moveEvent.clientY);
        crossPageId = hover && hover !== pageId ? hover : null;
        if (crossPageId) {
          usePageDrop.getState().set(crossPageId, startRects.map((r) => ({ ...r, left: r.left + lastDxPx, top: r.top + lastDyPx })));
          useAlignmentGuides.getState().clear();
          return;
        }
        usePageDrop.getState().clear();

        const curMm = screenToPageMm(
          pageId,
          useCanvasStore.getState().doc.pages,
          moveEvent.clientX,
          moveEvent.clientY
        );
        if (!curMm) return;
        const dxMm = curMm.x - startMm.x;
        const dyMm = curMm.y - startMm.y;

        const currentState = useCanvasStore.getState();
        const api = currentState._api;
        const owningPage = currentState.doc.pages.find((p) => p.id === pageId);
        const orientation = owningPage?.orientation ?? 'portrait';
        const paperSize = owningPage?.paperSize ?? 'A4';

        const { x: adjX, y: adjY } = snapAdjustment(currentState, owningPage, objectId, origins, closureIds, dxMm, dyMm);
        const { dx: clampedDx, dy: clampedDy } = computeCollectiveDelta(
          origins,
          currentState.doc.objects,
          dxMm + adjX,
          dyMm + adjY,
          orientation,
          paperSize
        );

        for (const origin of origins) {
          api.patchRaw(origin.id, { x: origin.x + clampedDx, y: origin.y + clampedDy });
        }
        publishAlignmentGuides(pageId, origins.find((o) => o.id === objectId), clampedDx, clampedDy, closureIds);
      };

      const onUp = (upEvent: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        usePageDrop.getState().clear();
        useAlignmentGuides.getState().clear();
        if (!threshold.hasMoved(lastDxPx, lastDyPx)) return;

        if (crossPageId) dropOnPage(crossPageId, origins, startMm, upEvent.clientX, upEvent.clientY);
        else commitMove(origins);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [objectId, pageId]
  );
}
