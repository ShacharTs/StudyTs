import { useCanvasStore } from './useCanvasStore';
import { createPage, isConnectorType, pageSizeMm, type DocState, type Page, type SceneObject } from '../model/sceneModel';
import {
  addPageCommand,
  compositeCommand,
  moveObjectsToPageCommand,
  removeObjectCommand,
  type Command,
  type PageMoveItem,
} from '../commands/canvasCommands';

/** Where moved objects land on the target page: shifted by a pointer delta, or packed at the page margin. */
export type PagePlacement = { kind: 'delta'; dx: number; dy: number } | { kind: 'margin' };

export interface PageMovePlan {
  moves: PageMoveItem[];
  /** Connectors that would end up spanning two pages; they are removed in the same undo step. */
  removed: { obj: SceneObject; pageId: string }[];
}

const boundEnds = (obj: SceneObject): string[] =>
  [obj.props.sourceId, obj.props.targetId].filter((id): id is string => typeof id === 'string' && id !== '');

function addGroupsAndAnchored(doc: DocState, ids: Set<string>): void {
  const groups = new Set([...ids].map((id) => doc.objects[id]?.groupId).filter((g): g is string => Boolean(g)));
  let grew = true;
  while (grew) {
    grew = false;
    for (const obj of Object.values(doc.objects)) {
      const pulled = ids.has(obj.id) ? false : (obj.groupId !== null && groups.has(obj.groupId)) || (obj.anchorId !== null && ids.has(obj.anchorId));
      if (pulled) {
        ids.add(obj.id);
        grew = true;
      }
    }
  }
}

/** Connectors travel with their objects when both ends move; one whose end stays behind cannot cross pages and is dropped. */
function sortConnectors(doc: DocState, ids: Set<string>): string[] {
  const dropped: string[] = [];
  for (const obj of Object.values(doc.objects)) {
    if (!isConnectorType(obj.type)) continue;
    const ends = boundEnds(obj);
    const touches = ids.has(obj.id) || ends.some((id) => ids.has(id));
    if (!touches) continue;
    if (ends.every((id) => ids.has(id))) ids.add(obj.id);
    else {
      ids.delete(obj.id);
      dropped.push(obj.id);
    }
  }
  return dropped;
}

function pageOf(doc: DocState, id: string): { page: Page; index: number } | null {
  const page = doc.pages.find((p) => p.objects.includes(id));
  return page ? { page, index: page.objects.indexOf(id) } : null;
}

/** Shifts a block of objects by (dx, dy), then back inside the page as a whole so their layout is kept. */
export function fitDeltaToPage(boxes: { x: number; y: number; w: number; h: number }[], dx: number, dy: number, page: Page): { dx: number; dy: number } {
  if (boxes.length === 0) return { dx, dy };
  const size = pageSizeMm(page.orientation, page.paperSize);
  const axis = (start: (b: (typeof boxes)[number]) => number, len: (b: (typeof boxes)[number]) => number, shift: number, limit: number) => {
    const maxEnd = Math.max(...boxes.map((b) => start(b) + len(b) + shift));
    const overflow = maxEnd > limit ? maxEnd - limit : 0;
    const minStart = Math.min(...boxes.map((b) => start(b) + shift - overflow));
    return shift - overflow + (minStart < 0 ? -minStart : 0);
  };
  return {
    dx: axis((b) => b.x, (b) => b.w, dx, size.w),
    dy: axis((b) => b.y, (b) => b.h, dy, size.h),
  };
}

/**
 * What moving `ids` to `toPageId` does: the objects to re-parent (with group members, anchored objects and connectors
 * between moved objects coming along) and the connectors that would be cut in two. Null when the target page is unknown.
 */
export function planPageMove(doc: DocState, ids: string[], toPageId: string, placement: PagePlacement): PageMovePlan | null {
  const target = doc.pages.find((p) => p.id === toPageId);
  if (!target) return null;
  const set = new Set(ids.filter((id) => doc.objects[id]));
  addGroupsAndAnchored(doc, set);
  const droppedIds = sortConnectors(doc, set);

  const movers = [...set]
    .map((id) => ({ obj: doc.objects[id], from: pageOf(doc, id) }))
    .filter((m): m is { obj: SceneObject; from: { page: Page; index: number } } => m.from !== null && m.from.page.id !== toPageId);
  const boxes = movers.map((m) => m.obj);
  const wanted = placement.kind === 'margin'
    ? { dx: target.margin - Math.min(...boxes.map((b) => b.x)), dy: target.margin - Math.min(...boxes.map((b) => b.y)) }
    : { dx: placement.dx, dy: placement.dy };
  const { dx, dy } = fitDeltaToPage(boxes, wanted.dx, wanted.dy, target);

  const moves = movers.map(({ obj, from }): PageMoveItem => ({
    id: obj.id,
    fromPageId: from.page.id,
    fromIndex: from.index,
    before: { x: obj.x, y: obj.y },
    after: { x: obj.x + dx, y: obj.y + dy },
  }));
  const removed = droppedIds
    .map((id) => ({ obj: doc.objects[id], from: pageOf(doc, id) }))
    .filter((r): r is { obj: SceneObject; from: { page: Page; index: number } } => r.from !== null)
    .map((r) => ({ obj: r.obj, pageId: r.from.page.id }));
  return { moves, removed };
}

function commandFor(plan: PageMovePlan, toPageId: string, before: Command[] = []): Command {
  return compositeCommand('Move to page', [
    ...before,
    moveObjectsToPageCommand(plan.moves, toPageId),
    ...plan.removed.map((r) => removeObjectCommand(r.obj, r.pageId)),
  ]);
}

function finish(plan: PageMovePlan, toPageId: string): void {
  const state = useCanvasStore.getState();
  state.select(plan.moves.map((m) => m.id));
  state.setCurrentPageId(toPageId);
}

/** Moves objects to another page as one undo step and keeps them selected there. Returns false when nothing moved. */
export function moveObjectsToPage(ids: string[], toPageId: string, placement: PagePlacement): boolean {
  const state = useCanvasStore.getState();
  const plan = planPageMove(state.doc, ids, toPageId, placement);
  if (!plan || plan.moves.length === 0) return false;
  state.execute(commandFor(plan, toPageId));
  finish(plan, toPageId);
  return true;
}

/** Appends a page shaped like the first object's page and moves the objects onto it, all as one undo step. */
export function moveObjectsToNewPage(ids: string[]): boolean {
  const state = useCanvasStore.getState();
  const source = ids.map((id) => pageOf(state.doc, id)).find((p) => p !== null)?.page;
  if (!source) return false;
  const page: Page = { ...createPage(), orientation: source.orientation, paperSize: source.paperSize, margin: source.margin };
  const withPage: DocState = { ...state.doc, pages: [...state.doc.pages, page] };
  const plan = planPageMove(withPage, ids, page.id, { kind: 'margin' });
  if (!plan || plan.moves.length === 0) return false;
  state.execute(commandFor(plan, page.id, [addPageCommand(page, state.doc.pages.length, [])]));
  finish(plan, page.id);
  return true;
}
