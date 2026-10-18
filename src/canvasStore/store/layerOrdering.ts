import { useCanvasStore } from './useCanvasStore';
import { patchObjectCommand, patchPageCommand, compositeCommand } from '../commands/canvasCommands';
import { MAX_OBJECT_LAYER, isConnectorType, stepLayer, type SceneObject } from '../model/sceneModel';

function currentPage() {
  const state = useCanvasStore.getState();
  return state.doc.pages.find((p) => p.id === state.currentPageId);
}

/** The current page's objects bottom-to-top: by layer, then by position in the page list. */
export function pageStack(): SceneObject[] {
  const { doc } = useCanvasStore.getState();
  const page = currentPage();
  if (!page) return [];
  return page.objects
    .map((id, idx) => ({ o: doc.objects[id], idx }))
    .filter((e): e is { o: SceneObject; idx: number } => Boolean(e.o))
    .sort((a, b) => a.o.zIndex - b.o.zIndex || a.idx - b.idx)
    .map((e) => e.o);
}

function selectedMovable(): SceneObject[] {
  const { doc, selectedIds } = useCanvasStore.getState();
  return selectedIds
    .map((id) => doc.objects[id])
    .filter((o): o is SceneObject => Boolean(o) && !isConnectorType(o.type));
}

/** Applies layer changes and a new page order as one undoable step. */
function commitOrder(layerTo: Map<string, number>, order: string[], label: string): void {
  const state = useCanvasStore.getState();
  const page = currentPage();
  if (!page) return;
  const cmds = [...layerTo]
    .filter(([id, to]) => state.doc.objects[id]?.zIndex !== to)
    .map(([id, to]) => patchObjectCommand(id, { zIndex: state.doc.objects[id].zIndex }, { zIndex: to }, label));
  if (order.join() !== page.objects.join()) {
    cmds.push(patchPageCommand(page.id, { objects: page.objects }, { objects: order }, label));
  }
  if (cmds.length > 0) state.execute(compositeCommand(label, cmds));
}

function withoutSelected(order: string[], ids: Set<string>): string[] {
  return order.filter((id) => !ids.has(id));
}

export function bringToFront(): void {
  const page = currentPage();
  const moving = selectedMovable();
  if (!page || moving.length === 0) return;
  const ids = new Set(moving.map((o) => o.id));
  const keep = page.objects.filter((id) => ids.has(id));
  const order = [...withoutSelected(page.objects, ids), ...keep];
  commitOrder(new Map(moving.map((o) => [o.id, MAX_OBJECT_LAYER])), order, 'Bring to front');
}

export function sendToBack(): void {
  const page = currentPage();
  const moving = selectedMovable();
  if (!page || moving.length === 0) return;
  const ids = new Set(moving.map((o) => o.id));
  const keep = page.objects.filter((id) => ids.has(id));
  const order = [...keep, ...withoutSelected(page.objects, ids)];
  commitOrder(new Map(moving.map((o) => [o.id, 1])), order, 'Send to back');
}

/** Moves `id` one slot within its own layer (toward the end for +1), if a same-layer neighbour exists. */
function nudgeInLayer(order: string[], o: SceneObject, dir: 1 | -1, moving: Set<string>): string[] {
  const { doc } = useCanvasStore.getState();
  const from = order.indexOf(o.id);
  for (let i = from + dir; i >= 0 && i < order.length; i += dir) {
    // Jump over neighbours that are moving too, or a selected pair would swap back and forth.
    if (doc.objects[order[i]]?.zIndex !== o.zIndex || moving.has(order[i])) continue;
    const next = [...order];
    [next[from], next[i]] = [next[i], next[from]];
    return next;
  }
  return order;
}

function stepSelected(dir: 1 | -1, label: string, only?: string): void {
  const page = currentPage();
  const picked = selectedMovable().filter((o) => !only || o.id === only);
  if (!page || picked.length === 0) return;
  const movingIds = new Set(picked.map((o) => o.id));
  // Walk the selection from the leading edge so each object moves past the unselected ones ahead of it.
  const moving = [...picked].sort((a, b) => (page.objects.indexOf(a.id) - page.objects.indexOf(b.id)) * -dir);
  const layerTo = new Map<string, number>();
  let order = page.objects;
  for (const o of moving) {
    const stepped = stepLayer(o.zIndex, dir);
    if (stepped !== o.zIndex) layerTo.set(o.id, stepped);
    else order = nudgeInLayer(order, o, dir, movingIds);
  }
  commitOrder(layerTo, order, label);
}

export function bringForward(): void {
  stepSelected(1, 'Bring forward');
}

export function sendBackward(): void {
  stepSelected(-1, 'Send backward');
}

export function reorderOne(id: string, direction: 'up' | 'down'): void {
  const { selectedIds, select } = useCanvasStore.getState();
  select([id]);
  stepSelected(direction === 'up' ? 1 : -1, 'Reorder');
  select(selectedIds);
}
