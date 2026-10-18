import { useCanvasStore } from './useCanvasStore';
import { createObject, type ObjectPatch, type ObjectType, type SceneObject } from '../model/sceneModel';
import {
  addObjectCommand,
  removeObjectCommand,
  patchObjectCommand,
  compositeCommand,
  type Command,
} from '../commands/canvasCommands';

const PASTE_OFFSET_MM = 5;

let buffer: SceneObject[] = [];

function deepCloneProps(props: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(props));
}

function shallow(o: SceneObject): SceneObject {
  return { ...o, props: deepCloneProps(o.props) };
}

function cloneObjects(objs: SceneObject[], offset: number): SceneObject[] {
  const idMap = new Map<string, string>();
  objs.forEach((o) => idMap.set(o.id, `obj-${crypto.randomUUID()}`));
  const groupIdMap = new Map<string, string>();
  objs.forEach((o) => {
    if (o.groupId && !groupIdMap.has(o.groupId)) {
      groupIdMap.set(o.groupId, `group-${crypto.randomUUID()}`);
    }
  });
  return objs.map((o) => {
    const props = deepCloneProps(o.props);
    if (o.type === 'edge') {
      const src = props.sourceId as string;
      const tgt = props.targetId as string;
      if (idMap.has(src)) props.sourceId = idMap.get(src);
      if (idMap.has(tgt)) props.targetId = idMap.get(tgt);
    }
    return {
      ...o,
      id: idMap.get(o.id)!,
      x: o.x + offset,
      y: o.y + offset,
      anchorId: o.anchorId && idMap.has(o.anchorId) ? idMap.get(o.anchorId)! : null,
      groupId: o.groupId ? groupIdMap.get(o.groupId)! : null,
      props,
    };
  });
}

function commit(clones: SceneObject[], pageId: string, label: string): void {
  const s = useCanvasStore.getState();
  const cmds = clones.map((o) => addObjectCommand(o, pageId));
  s.execute(compositeCommand(label, cmds));
  s.select(clones.map((o) => o.id));
}

export function copySelection(): void {
  const s = useCanvasStore.getState();
  buffer = s.selectedIds
    .map((id) => s.doc.objects[id])
    .filter((o): o is SceneObject => !!o)
    .map(shallow);
}

export function cutSelection(): void {
  const ids = useCanvasStore.getState().selectedIds;
  if (!ids.length) return;
  copySelection();
  removeObjects([...ids]);
}

export function pasteClipboard(): void {
  if (!buffer.length) return;
  const s = useCanvasStore.getState();
  const pageId = s.currentPageId ?? s.doc.pages[0].id;
  const clones = cloneObjects(buffer, PASTE_OFFSET_MM);
  commit(clones, pageId, 'Paste');
  buffer = clones.map(shallow);
}

export function duplicateSelection(): void {
  const s = useCanvasStore.getState();
  const objs = s.selectedIds
    .map((id) => s.doc.objects[id])
    .filter((o): o is SceneObject => !!o)
    .map(shallow);
  if (!objs.length) return;
  const pageId =
    s.doc.pages.find((p) => p.objects.includes(s.selectedIds[0]))?.id ??
    s.currentPageId ??
    s.doc.pages[0].id;
  commit(cloneObjects(objs, PASTE_OFFSET_MM), pageId, 'Duplicate');
}

type Axis = 'x' | 'y';
type Extent = 'w' | 'h';

function selected(): SceneObject[] {
  const s = useCanvasStore.getState();
  return s.selectedIds
    .map((id) => s.doc.objects[id])
    .filter((o): o is SceneObject => !!o);
}

function move(o: SceneObject, axis: Axis, value: number, label: string): Command {
  return patchObjectCommand(o.id, { [axis]: o[axis] }, { [axis]: value }, label);
}

function runAll(cmds: Command[], label: string): void {
  if (!cmds.length) return;
  useCanvasStore.getState().execute(compositeCommand(label, cmds));
}

function align(
  axis: Axis,
  ext: Extent,
  target: (o: SceneObject, min: number, max: number) => number,
  label: string
): void {
  const objs = selected();
  if (objs.length < 2) return;
  const min = Math.min(...objs.map((o) => o[axis]));
  const max = Math.max(...objs.map((o) => o[axis] + o[ext]));
  runAll(objs.map((o) => move(o, axis, target(o, min, max), label)), label);
}

export const alignLeft = () => align('x', 'w', (_o, min) => min, 'Align left');
export const alignRight = () => align('x', 'w', (o, _min, max) => max - o.w, 'Align right');
export const alignCenterH = () =>
  align('x', 'w', (o, min, max) => (min + max) / 2 - o.w / 2, 'Align center');
export const alignTop = () => align('y', 'h', (_o, min) => min, 'Align top');
export const alignBottom = () => align('y', 'h', (o, _min, max) => max - o.h, 'Align bottom');
export const alignMiddle = () =>
  align('y', 'h', (o, min, max) => (min + max) / 2 - o.h / 2, 'Align middle');

function distribute(axis: Axis, ext: Extent, label: string): void {
  const objs = selected().sort((a, b) => a[axis] - b[axis]);
  if (objs.length < 3) return;
  const first = objs[0];
  const last = objs[objs.length - 1];
  const span = last[axis] - first[axis] + last[ext];
  const totalExt = objs.reduce((sum, o) => sum + o[ext], 0);
  const gap = (span - totalExt) / (objs.length - 1);
  let cursor = first[axis];
  const cmds: Command[] = [];
  objs.forEach((o, i) => {
    if (i > 0 && i < objs.length - 1) cmds.push(move(o, axis, cursor, label));
    cursor += o[ext] + gap;
  });
  runAll(cmds, label);
}

export const distributeH = () => distribute('x', 'w', 'Distribute horizontally');
export const distributeV = () => distribute('y', 'h', 'Distribute vertically');

export function groupMembers(id: string): string[] {
  const state = useCanvasStore.getState();
  const target = state.doc.objects[id];
  if (!target || target.groupId === null) return [id];
  return Object.values(state.doc.objects)
    .filter((o) => o.groupId === target.groupId)
    .map((o) => o.id);
}

export function groupSelection(): void {
  const state = useCanvasStore.getState();
  if (state.selectedIds.length < 2) return;
  const newGroupId = `group-${crypto.randomUUID()}`;
  const cmds = state.selectedIds
    .map((id) => state.doc.objects[id])
    .filter(Boolean)
    .map((o) =>
      patchObjectCommand(
        o.id,
        { groupId: o.groupId },
        { groupId: newGroupId },
        'Group'
      )
    );
  state.execute(compositeCommand('Group', cmds));
}

export function ungroupSelection(): void {
  const state = useCanvasStore.getState();
  const firstSelected = state.selectedIds[0];
  if (!firstSelected) return;
  const memberIds = groupMembers(firstSelected);
  if (memberIds.length < 2) return;
  const cmds = memberIds
    .map((id) => state.doc.objects[id])
    .filter(Boolean)
    .map((o) =>
      patchObjectCommand(o.id, { groupId: o.groupId }, { groupId: null }, 'Ungroup')
    );
  state.execute(compositeCommand('Ungroup', cmds));
}

function toggleFlag(flag: 'locked' | 'hidden', label: string): void {
  const state = useCanvasStore.getState();
  const objs = state.selectedIds
    .map((id) => state.doc.objects[id])
    .filter((o): o is SceneObject => Boolean(o));
  if (objs.length === 0) return;
  const cmds = objs.map((o) =>
    patchObjectCommand(o.id, { [flag]: o[flag] }, { [flag]: !o[flag] }, label)
  );
  state.execute(compositeCommand(label, cmds));
}

export function toggleLock(): void {
  toggleFlag('locked', 'Toggle lock');
}

export function toggleHide(): void {
  toggleFlag('hidden', 'Toggle hide');
}

export function addObject(
  type: ObjectType,
  overrides: Partial<SceneObject> = {},
  pageId?: string
): SceneObject {
  const state = useCanvasStore.getState();
  const targetPageId = pageId ?? state.currentPageId;

  const centeredOverrides: Partial<SceneObject> = { ...overrides };
  if (overrides.x === undefined || overrides.y === undefined) {
    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const def = createObject(type);
    centeredOverrides.x = overrides.x ?? (pageWidthMm - def.w) / 2;
    centeredOverrides.y = overrides.y ?? (pageHeightMm - def.h) / 2;
  }

  const obj = createObject(type, centeredOverrides);
  state.execute(addObjectCommand(obj, targetPageId));
  useCanvasStore.getState().select([obj.id]);
  return obj;
}

function findOwningPageId(objId: string): string | undefined {
  const state = useCanvasStore.getState();
  return state.doc.pages.find((p) => p.objects.includes(objId))?.id;
}

function incidentEdgeIds(objId: string): string[] {
  const state = useCanvasStore.getState();
  return Object.values(state.doc.objects)
    .filter(
      (o) =>
        o.type === 'edge' &&
        (o.props.sourceId === objId || o.props.targetId === objId)
    )
    .map((o) => o.id);
}

export function removeObject(id: string): void {
  removeObjects([id]);
}

export function removeObjects(ids: string[]): void {
  const state = useCanvasStore.getState();
  const idSet = new Set(ids);
  for (const id of ids) {
    for (const edgeId of incidentEdgeIds(id)) idSet.add(edgeId);
  }
  const commands = [...idSet]
    .map((id) => {
      const obj = state.doc.objects[id];
      const pageId = findOwningPageId(id);
      if (!obj || !pageId) return null;
      return removeObjectCommand(obj, pageId);
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
  if (commands.length === 0) return;
  state.execute(compositeCommand('Remove', commands));
}

export function patchObject(id: string, patch: ObjectPatch, label = 'Edit object'): void {
  const state = useCanvasStore.getState();
  const existing = state.doc.objects[id];
  if (!existing) return;
  const before: ObjectPatch = {};
  for (const key of Object.keys(patch) as (keyof ObjectPatch)[]) {
    (before as Record<string, unknown>)[key] = existing[key as keyof SceneObject];
  }
  state.execute(patchObjectCommand(id, before, patch, label, `${id}:${label}`));
}

export function setProp(id: string, key: string, value: unknown, label = 'Edit style'): void {
  const state = useCanvasStore.getState();
  const existing = state.doc.objects[id];
  if (!existing) return;
  patchObject(id, { props: { ...existing.props, [key]: value } }, label);
}
