import type { ReactNode } from 'react';

export type PaletteChip = 'all' | 'favorites' | 'uml' | 'automata' | 'system' | 'network';

export interface ToolboxItem {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: (pageId: string) => void;
  /** Extra search words (e.g. "storage" for a database). */
  tags?: string[];
  /** Which filter chip this item belongs to. */
  chip?: PaletteChip;
}

export interface ToolboxCategory {
  id: string;
  title: string;
  items: ToolboxItem[];
}
