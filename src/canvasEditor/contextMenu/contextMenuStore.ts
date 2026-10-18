import { create } from 'zustand';

/** Where on the page the menu was opened, in mm — lets "Add …" items place the new object at the click. */
export interface MenuAnchor {
  pageId: string;
  xMm: number;
  yMm: number;
}

export interface MenuItem {
  label: string;
  disabled?: boolean;
  /** Absent on an item that only opens a submenu. */
  run?: () => void;
  /** Flyout list shown beside the item on hover. */
  submenu?: MenuItem[];
}

/** A menu row: an item, or `null` for a separator. */
export type MenuEntry = MenuItem | null;

interface ContextMenuState {
  pos: { x: number; y: number } | null;
  anchor: MenuAnchor | null;
  open: (x: number, y: number, anchor?: MenuAnchor) => void;
  close: () => void;
}

export const useContextMenu = create<ContextMenuState>((set) => ({
  pos: null,
  anchor: null,
  open: (x, y, anchor) => set({ pos: { x, y }, anchor: anchor ?? null }),
  close: () => set({ pos: null, anchor: null }),
}));
