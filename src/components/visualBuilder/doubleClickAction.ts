// The one place that decides what a double-click does. Every kind is 'none' for now; a kind gets an action here, not in the stage.
export type DoubleClickKind = 'shape' | 'link' | 'group' | 'background';
export type DoubleClickAction = 'none' | 'text';
export type DoubleClickTable = Readonly<Record<DoubleClickKind, DoubleClickAction>>;

export const DOUBLE_CLICK_ACTION_BY_KIND: DoubleClickTable = { shape: 'none', link: 'none', group: 'none', background: 'none' };

export function doubleClickAction(kind: DoubleClickKind, table: DoubleClickTable = DOUBLE_CLICK_ACTION_BY_KIND): DoubleClickAction {
  return table[kind];
}
