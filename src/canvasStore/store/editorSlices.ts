import type { StateCreator } from 'zustand';
import { normalizeLayers, normalizeLines, clampZoom, type DocState, type Page } from '../model/sceneModel';
import type { Command, CommandApi } from '../commands/canvasCommands';
import type { SaveStatus } from '../persistence/autosaver';

export type ToolKind = 'pointer' | 'hand' | 'text' | 'shape' | 'line';
export type PortSide =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-left';
export type TabKind = 'File' | 'Home' | 'Equation' | 'Insert' | 'Layout';

export interface DraftEdge {
  pageId: string;
  sourceId: string;
  /** An anchor id on the source shape, or a legacy side name. */
  sourcePort: string | null;
  anchor: { x: number; y: number };
  cur: { x: number; y: number };
  targetId?: string;
  targetPort?: string | null;
}

export interface DocumentSlice {
  doc: DocState;
  currentPageId: string;
  sceneId: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  setSaveStatus(status: SaveStatus, error?: unknown): void;
  loadDoc(doc: DocState): void;
  setCurrentPageId(id: string): void;
  setSceneId(id: string): void;
}

export interface HistorySlice {
  history: { past: Command[]; future: Command[] };
  _api: CommandApi;
  execute(cmd: Command): void;
  commit(cmd: Command): void;
  undo(): void;
  redo(): void;
}

export interface SelectionSlice {
  selectedIds: string[];
  editingId: string | null;
  select(ids: string[]): void;
  toggleSelect(id: string): void;
  clearSelection(): void;
  setEditing(id: string | null): void;
}

export interface ViewportSlice {
  viewport: { zoom: number; panX: number; panY: number };
  setViewport(patch: Partial<{ zoom: number; panX: number; panY: number }>): void;
}

export interface InteractionSlice {
  activeTool: ToolKind;
  setActiveTool(tool: ToolKind): void;
  currentTab: TabKind;
  setCurrentTab(tab: TabKind): void;
  snapEnabled: boolean;
  toggleSnap(): void;
  showGrid: boolean;
  toggleGrid(): void;
  showPrintMargins: boolean;
  togglePrintMargins(): void;
  draftEdge: DraftEdge | null;
  setDraftEdge(d: DraftEdge | null): void;
}

export type EditorState = DocumentSlice &
  HistorySlice &
  SelectionSlice &
  ViewportSlice &
  InteractionSlice;

export const createInteractionSlice: StateCreator<InteractionSlice> = (set, get) => ({
  activeTool: 'pointer',
  setActiveTool: (tool) => set({ activeTool: tool }),
  currentTab: 'Home',
  setCurrentTab: (tab) => set({ currentTab: tab }),
  snapEnabled: true,
  toggleSnap: () => set({ snapEnabled: !get().snapEnabled }),
  showGrid: true,
  toggleGrid: () => set({ showGrid: !get().showGrid }),
  showPrintMargins: false,
  togglePrintMargins: () => set({ showPrintMargins: !get().showPrintMargins }),
  draftEdge: null,
  setDraftEdge: (d) => set({ draftEdge: d }),
});

export const createViewportSlice: StateCreator<ViewportSlice> = (set, get) => ({
  viewport: { zoom: 1, panX: 0, panY: 0 },
  setViewport: (patch) => {
    const current = get().viewport;
    const next = { ...current, ...patch };
    set({ viewport: { ...next, zoom: clampZoom(next.zoom) } });
  },
});

function editingObjId(editingId: string | null): string | null {
  if (editingId === null) return null;
  const colonIndex = editingId.indexOf(':');
  return colonIndex === -1 ? editingId : editingId.slice(0, colonIndex);
}

export const createSelectionSlice: StateCreator<SelectionSlice> = (set, get) => ({
  selectedIds: [],
  editingId: null,
  select: (ids: string[]) => {
    const currentEditing = get().editingId;
    const stillValid =
      currentEditing !== null && ids.includes(editingObjId(currentEditing) as string);
    set({ selectedIds: ids, editingId: stillValid ? currentEditing : null });
  },
  toggleSelect: (id: string) => {
    const current = get().selectedIds;
    set({
      selectedIds: current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id],
    });
  },
  clearSelection: () => set({ selectedIds: [], editingId: null }),
  setEditing: (id: string | null) => set({ editingId: id }),
});

const MAX_HISTORY_ENTRIES = 200;
const COALESCE_WINDOW_MS = 600;

export function createHistorySlice(
  set: Parameters<StateCreator<HistorySlice>>[0],
  get: Parameters<StateCreator<HistorySlice>>[1]
): HistorySlice {
  let lastCoalesceKey: string | undefined;
  let lastCoalesceTime = 0;

  function pushToPast(cmd: Command) {
    const state = get();
    const now = Date.now();
    const canCoalesce =
      cmd.coalesceKey !== undefined &&
      cmd.coalesceKey === lastCoalesceKey &&
      now - lastCoalesceTime < COALESCE_WINDOW_MS &&
      state.history.past.length > 0;

    lastCoalesceKey = cmd.coalesceKey;
    lastCoalesceTime = now;

    const past = canCoalesce
      ? [...state.history.past.slice(0, -1), cmd]
      : [...state.history.past, cmd].slice(-MAX_HISTORY_ENTRIES);

    set({ history: { past, future: [] } });
  }

  return {
    history: { past: [], future: [] },
    _api: {} as HistorySlice['_api'],
    execute: (cmd: Command) => {
      cmd.do(get()._api);
      pushToPast(cmd);
    },
    commit: (cmd: Command) => {
      pushToPast(cmd);
    },
    undo: () => {
      const state = get();
      const cmd = state.history.past[state.history.past.length - 1];
      if (!cmd) return;
      cmd.undo(state._api);
      set({
        history: {
          past: state.history.past.slice(0, -1),
          future: [...state.history.future, cmd],
        },
      });
    },
    redo: () => {
      const state = get();
      const cmd = state.history.future[state.history.future.length - 1];
      if (!cmd) return;
      cmd.do(state._api);
      set({
        history: {
          past: [...state.history.past, cmd],
          future: state.history.future.slice(0, -1),
        },
      });
    },
  };
}

export function isValidDocShape(doc: unknown): doc is DocState {
  if (!doc || typeof doc !== 'object') return false;
  const d = doc as Partial<DocState>;
  return (
    Array.isArray(d.pages) &&
    typeof d.objects === 'object' &&
    d.objects !== null &&
    !Array.isArray(d.objects)
  );
}

function backfillPage(page: Page): Page {
  return { ...page, paperSize: page.paperSize ?? 'A4' };
}

export function createDocumentSlice(initialDoc: DocState): StateCreator<DocumentSlice> {
  return (set) => ({
    doc: { ...initialDoc, pages: initialDoc.pages.map(backfillPage) },
    currentPageId: initialDoc.pages[0]?.id ?? '',
    sceneId: null,
    saveStatus: 'idle',
    saveError: null,
    setSaveStatus: (status, error) =>
      set({ saveStatus: status, saveError: status === 'error' ? (error instanceof Error ? error.message : String(error)) : null }),
    setCurrentPageId: (id: string) => set({ currentPageId: id }),
    setSceneId: (id: string) => set({ sceneId: id }),
    loadDoc: (doc: DocState) => {
      if (!isValidDocShape(doc)) return;
      const normalized = normalizeLines(normalizeLayers({ ...doc, pages: doc.pages.map(backfillPage) }));
      // A new document starts with a clean history: undo must never replay the previous document's commands.
      set({ doc: normalized, currentPageId: normalized.pages[0]?.id ?? '', history: { past: [], future: [] } } as Partial<DocumentSlice>);
    },
  });
}
