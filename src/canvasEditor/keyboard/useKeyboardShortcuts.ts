import { useEffect } from 'react';
import {
  useCanvasStore,
  removeObjects,
  copySelection,
  pasteClipboard,
  duplicateSelection,
  groupSelection,
  ungroupSelection,
  patchObjectCommand,
  compositeCommand,
  type SceneObject,
} from '@canvasStore';
import { requestPrint } from '../shell/requestPrint';
import { saveNow } from '../saving/sceneSaving';
import { computeCollectiveDelta } from '../interaction/useObjectDrag';

type ShortcutAction =
  | 'undo'
  | 'redo'
  | 'copy'
  | 'paste'
  | 'duplicate'
  | 'group'
  | 'ungroup'
  | 'selectAll'
  | 'clearSelection'
  | 'nudgeUp'
  | 'nudgeDown'
  | 'nudgeLeft'
  | 'nudgeRight'
  | 'nudgeUpLarge'
  | 'nudgeDownLarge'
  | 'nudgeLeftLarge'
  | 'nudgeRightLarge'
  | 'save'
  | 'print'
  | 'delete';

interface KeyLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/** Physical key (`code`) + modifier mapping, so it works on any keyboard layout. */
const MOD_KEYS: Record<string, ShortcutAction> = {
  KeyY: 'redo',
  KeyC: 'copy',
  KeyV: 'paste',
  KeyD: 'duplicate',
  KeyA: 'selectAll',
  KeyS: 'save',
  KeyP: 'print',
};

const PLAIN_KEYS: Record<string, ShortcutAction> = {
  Delete: 'delete',
  Backspace: 'delete',
  ArrowUp: 'nudgeUp',
  ArrowDown: 'nudgeDown',
  ArrowLeft: 'nudgeLeft',
  ArrowRight: 'nudgeRight',
};

const SHIFT_ARROWS: Record<string, ShortcutAction> = {
  ArrowUp: 'nudgeUpLarge',
  ArrowDown: 'nudgeDownLarge',
  ArrowLeft: 'nudgeLeftLarge',
  ArrowRight: 'nudgeRightLarge',
};

function plainKeyAction(e: KeyLike): ShortcutAction | null {
  if (e.key === 'Escape') return 'clearSelection';
  if (e.shiftKey && SHIFT_ARROWS[e.key]) return SHIFT_ARROWS[e.key];
  return PLAIN_KEYS[e.key] ?? null;
}

function modKeyAction(e: KeyLike): ShortcutAction | null {
  if (e.code === 'KeyZ') return e.shiftKey ? 'redo' : 'undo';
  if (e.code === 'KeyG') return e.shiftKey ? 'ungroup' : 'group';
  return MOD_KEYS[e.code] ?? null;
}

export function shortcutAction(e: KeyLike): ShortcutAction | null {
  return e.ctrlKey || e.metaKey ? modKeyAction(e) : plainKeyAction(e);
}

/** True when keyboard events target a text-entry element (shortcuts must not hijack typing there). */
export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** Actions that also make sense while typing in a field (they never edit the field's own text). */
const GLOBAL_WHILE_EDITING = new Set<ShortcutAction>(['save', 'print']);

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

function selectAll(): boolean {
  const state = useCanvasStore.getState();
  const pageId = state.currentPageId ?? state.doc.pages[0]?.id;
  const page = state.doc.pages.find((p) => p.id === pageId);
  if (!page) return false;
  const hits = page.objects
    .map((id) => state.doc.objects[id])
    .filter((o): o is NonNullable<typeof o> => Boolean(o && o.type !== 'edge' && !o.hidden))
    .map((o) => o.id);
  state.select(hits);
  return true;
}

function nudge(dx: number, dy: number): boolean {
  const state = useCanvasStore.getState();
  if (state.selectedIds.length === 0) return false;
  const pageId = state.currentPageId ?? state.doc.pages[0]?.id;
  const page = state.doc.pages.find((p) => p.id === pageId);
  const orientation = page?.orientation ?? 'portrait';
  const paperSize = page?.paperSize ?? 'A4';

  const closure = anchorClosure(state.selectedIds, state.doc.objects);
  const origins = [...closure]
    .map((id) => state.doc.objects[id])
    .filter((o): o is NonNullable<typeof o> => Boolean(o))
    .map((o) => ({ id: o.id, x: o.x, y: o.y }));

  const clamped = computeCollectiveDelta(origins, state.doc.objects, dx, dy, orientation, paperSize);
  if (clamped.dx === 0 && clamped.dy === 0) return false;

  const cmds = origins.map((origin) => {
    const nextX = origin.x + clamped.dx;
    const nextY = origin.y + clamped.dy;
    return patchObjectCommand(origin.id, { x: origin.x, y: origin.y }, { x: nextX, y: nextY }, 'Nudge');
  });

  state.commit(compositeCommand('Nudge', cmds, 'nudge-selection'));
  for (const origin of origins) {
    state._api.patchRaw(origin.id, { x: origin.x + clamped.dx, y: origin.y + clamped.dy });
  }
  return true;
}

const HANDLERS: Record<ShortcutAction, () => boolean> = {
  undo: () => (useCanvasStore.getState().undo(), true),
  redo: () => (useCanvasStore.getState().redo(), true),
  save: () => (void saveNow(), true),
  print: () => (requestPrint(), true),
  paste: () => (pasteClipboard(), true),
  duplicate: () => (duplicateSelection(), true),
  group: () => (groupSelection(), true),
  ungroup: () => (ungroupSelection(), true),
  selectAll: () => selectAll(),
  clearSelection: () => (useCanvasStore.getState().clearSelection(), true),
  nudgeUp: () => nudge(0, -1),
  nudgeDown: () => nudge(0, 1),
  nudgeLeft: () => nudge(-1, 0),
  nudgeRight: () => nudge(1, 0),
  nudgeUpLarge: () => nudge(0, -10),
  nudgeDownLarge: () => nudge(0, 10),
  nudgeLeftLarge: () => nudge(-10, 0),
  nudgeRightLarge: () => nudge(10, 0),
  copy: () => {
    if (useCanvasStore.getState().selectedIds.length === 0) return false;
    copySelection();
    return true;
  },
  delete: () => {
    const { selectedIds } = useCanvasStore.getState();
    if (selectedIds.length === 0) return false;
    removeObjects([...selectedIds]);
    return true;
  },
};

/** Global editor hotkeys: Delete/Backspace, Ctrl/Cmd + C V Z Y S P D G A, Arrows. */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const action = shortcutAction(e);
      if (!action) return;
      if (isEditable(e.target) && !GLOBAL_WHILE_EDITING.has(action)) return;
      if (HANDLERS[action]()) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
