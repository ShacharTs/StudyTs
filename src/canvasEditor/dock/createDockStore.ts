import { create, type StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DockNode, DockState, FloatingPanel } from './dockTypes';
import { findStack, findPanelInTree, updateStack, resizeChild, createStack, insertBeside, insertAtRoot, mergeIntoStack, removePanel } from './dockTree';
import { computeDropTarget, pointInRect, type DropTarget } from './findDropTarget';

interface DropResolutionInput {
  root: DockNode | null;
  floating: Record<string, FloatingPanel>;
  panelId: string;
  target: DropTarget;
  dropX: number;
  dropY: number;
}

interface DropResolutionResult {
  root: DockNode | null;
  floating: Record<string, FloatingPanel>;
}

export function resolveMergeIntoTree(input: DropResolutionInput): DropResolutionResult | null {
  const { root, floating, panelId, target } = input;
  if (target.kind !== 'merge' || !root || !findStack(root, target.stackId)) return null;
  return { root: mergeIntoStack(root, panelId, target.stackId), floating };
}

export function resolveMergeIntoFloating(input: DropResolutionInput): DropResolutionResult | null {
  const { root, floating, panelId, target } = input;
  if (target.kind !== 'merge' || !floating[target.stackId]) return null;
  const dest = floating[target.stackId];
  return {
    root,
    floating: {
      ...floating,
      [dest.id]: {
        ...dest,
        panelIds: [...dest.panelIds, panelId],
        activeId: panelId,
      },
    },
  };
}

export function resolveSplit(input: DropResolutionInput): DropResolutionResult | null {
  const { root, floating, panelId, target } = input;
  if (target.kind !== 'split' || !root || !findStack(root, target.stackId)) return null;
  return {
    root: insertBeside(root, target.stackId, createStack(panelId), target.side, target.axis),
    floating,
  };
}

export function resolveWall(input: DropResolutionInput): DropResolutionResult {
  const { root, floating, panelId, target } = input;
  if (target.kind !== 'wall') {
    throw new Error('resolveWall called with a non-wall target');
  }
  return {
    root: root ? insertAtRoot(root, createStack(panelId), target.side, target.axis) : createStack(panelId),
    floating,
  };
}

export function resolveRemoveFromSource(
  root: DockNode | null,
  floating: Record<string, FloatingPanel>,
  panelId: string,
  fromStackId: string
): DropResolutionResult {
  if (root && findStack(root, fromStackId)) {
    return { root: removePanel(root, panelId, fromStackId), floating };
  }
  const src = floating[fromStackId];
  if (!src) return { root, floating };

  const panelIds = src.panelIds.filter((id) => id !== panelId);
  const nextFloating = { ...floating };
  if (panelIds.length === 0) {
    delete nextFloating[fromStackId];
  } else {
    nextFloating[fromStackId] = {
      ...src,
      panelIds,
      activeId: src.activeId === panelId ? panelIds[panelIds.length - 1] : src.activeId,
    };
  }
  return { root, floating: nextFloating };
}

interface FloatDropResult extends DropResolutionResult {
  topZ: number;
}

function buildFloatDrop(
  root: DockNode | null,
  floating: Record<string, FloatingPanel>,
  panelId: string,
  topZ: number,
  x: number,
  y: number
): FloatDropResult {
  const id = `float-${crypto.randomUUID()}`;
  const z = topZ + 1;
  return {
    root,
    topZ: z,
    floating: {
      ...floating,
      [id]: {
        type: 'stack',
        id,
        panelIds: [panelId],
        activeId: panelId,
        collapsed: false,
        x: x - 90,
        y: y - 14,
        w: 300,
        h: 340,
        z,
      },
    },
  };
}

/** A fixed layout (panels cannot be dragged) must not restore an arrangement saved while they could
 * be: a saved root/floating set can have panels moved, floated or missing, with no way back.
 * Anything saved by an older version keeps only the width the user chose. */
function keepSavedWidthOnly(persisted: unknown): { containerSize?: number } {
  const size = (persisted as { containerSize?: unknown } | null)?.containerSize;
  return typeof size === 'number' ? { containerSize: size } : {};
}

/** Decides the state change when a dragged panel is released. Pure apart from reading the DOM for the drop target. */

type DropState = Pick<DockState, 'drag' | 'root' | 'floating' | 'topZ'>;
type Patch = Partial<DockState>;
type ResolverInput = Parameters<typeof resolveSplit>[0];

/** A merge or split only applies when its resolver finds somewhere to put the panel. */
function resolveOnTarget(target: DropTarget, input: ResolverInput): Patch | null {
  if (target.kind === 'merge') return resolveMergeIntoTree(input) ?? resolveMergeIntoFloating(input);
  if (target.kind === 'split') return resolveSplit(input);
  if (target.kind === 'wall') return resolveWall(input);
  return null;
}

function resolveDrop(instanceId: string, state: DropState): Patch {
  const { panelId, fromStackId, x, y } = state.drag!;
  const target = computeDropTarget(instanceId, x, y);
  if (target.kind === 'merge' && target.stackId === fromStackId) return { drag: null };

  const { root, floating } = resolveRemoveFromSource(state.root, state.floating, panelId, fromStackId);
  const float = (): Patch => ({ ...buildFloatDrop(root, floating, panelId, state.topZ, x, y), drag: null });

  if (root === null) {
    const rootEl = document.querySelector<HTMLElement>(`[data-dock-root="${instanceId}"]`);
    const inside = rootEl && pointInRect(x, y, rootEl.getBoundingClientRect());
    return inside ? { root: createStack(panelId), floating, drag: null } : float();
  }

  const resolved = resolveOnTarget(target, { root, floating, panelId, target, dropX: x, dropY: y } as ResolverInput);
  return resolved ? { ...resolved, drag: null } : float();
}

export type DockStoreHook = ReturnType<typeof createDockStore>;

interface DockStoreOptions {
  persistKey?: string;
  /** Panels cannot be moved: never restore a saved arrangement, persist only the width. */
  fixedLayout?: boolean;
  defaultContainerSize?: number;
}

export function createDockStore(initialRoot: DockNode, options: DockStoreOptions = {}) {
  const instanceId = `dock-${crypto.randomUUID()}`;
  const { persistKey, defaultContainerSize = 340, fixedLayout = false } = options;

  const stateCreator: StateCreator<DockState> = (set, get) => ({
    instanceId,
    root: initialRoot,
    floating: {},
    topZ: 1,
    drag: null,
    containerSize: defaultContainerSize,

    setActiveTab: (stackId, panelId) =>
      set((s: DockState) => {
        if (s.root && findStack(s.root, stackId))
          return {
            root: updateStack(s.root, stackId, (st) => ({ ...st, activeId: panelId })),
          };
        if (s.floating[stackId])
          return {
            floating: {
              ...s.floating,
              [stackId]: { ...s.floating[stackId], activeId: panelId },
            },
          };
        return s;
      }),

    toggleCollapsed: (stackId) =>
      set((s: DockState) => {
        if (s.root && findStack(s.root, stackId))
          return {
            root: updateStack(s.root, stackId, (st) => ({ ...st, collapsed: !st.collapsed })),
          };
        if (s.floating[stackId])
          return {
            floating: {
              ...s.floating,
              [stackId]: { ...s.floating[stackId], collapsed: !s.floating[stackId].collapsed },
            },
          };
        return s;
      }),

    resize: (splitId, index, sizePx) =>
      set((s: DockState) =>
        s.root ? { root: resizeChild(s.root, splitId, index, sizePx) } : s
      ),

    moveFloating: (id, x, y) =>
      set((s: DockState) => ({
        floating: { ...s.floating, [id]: { ...s.floating[id], x, y } },
      })),
    resizeFloating: (id, w, h) =>
      set((s: DockState) => ({
        floating: { ...s.floating, [id]: { ...s.floating[id], w, h } },
      })),
    bringToFront: (id) =>
      set((s: DockState) => {
        const z = s.topZ + 1;
        return { topZ: z, floating: { ...s.floating, [id]: { ...s.floating[id], z } } };
      }),
    setContainerSize: (size) => set({ containerSize: size }),

    openFloating: (panelId, w = 300, h = 340) =>
      set((s: DockState) => {
        if (s.root && findPanelInTree(s.root, panelId)) return s;
        const existing = Object.values(s.floating).find((f) => f.panelIds.includes(panelId));
        if (existing) {
          const z = s.topZ + 1;
          return {
            topZ: z,
            floating: {
              ...s.floating,
              [existing.id]: { ...existing, collapsed: false, activeId: panelId, z },
            },
          };
        }
        const id = `float-${crypto.randomUUID()}`;
        const z = s.topZ + 1;
        return {
          topZ: z,
          floating: {
            ...s.floating,
            [id]: {
              type: 'stack',
              id,
              panelIds: [panelId],
              activeId: panelId,
              collapsed: false,
              x: 160,
              y: 90,
              w,
              h,
              z,
            },
          },
        };
      }),

    closeFloating: (id) =>
      set((s: DockState) => {
        const next = { ...s.floating };
        delete next[id];
        return { floating: next };
      }),

    startDrag: (panelId, fromStackId, x, y) => set({ drag: { panelId, fromStackId, x, y } }),
    updateDrag: (x, y) =>
      set((s: DockState) => (s.drag ? { drag: { ...s.drag, x, y } } : s)),

    endDrag: () => {
      const { drag } = get();
      if (drag) set(resolveDrop(instanceId, get() as DropState));
    },
  });

  if (!persistKey) return create<DockState>(stateCreator);

  return create<DockState>()(
    persist(stateCreator, {
      name: persistKey,
      version: 1,
      // A fixed layout never restores a saved arrangement (it may predate fixing), only the width.
      merge: (persisted, current) => ({ ...current, ...(fixedLayout ? keepSavedWidthOnly(persisted) : (persisted as object)) }),
      storage: createJSONStorage(() => localStorage),
      partialize: (s) =>
        fixedLayout
          ? { containerSize: s.containerSize }
          : { root: s.root, floating: s.floating, topZ: s.topZ, containerSize: s.containerSize },
    })
  );
}
