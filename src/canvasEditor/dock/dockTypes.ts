export type SplitAxis = 'row' | 'column';
export type WallSide = 'left' | 'right' | 'top' | 'bottom';

export interface DockStack {
  type: 'stack';
  id: string;
  panelIds: string[];
  activeId: string;
  collapsed: boolean;
  collapsible?: boolean;
  headerPlacement?: HeaderPlacement;
}

export type HeaderPlacement = 'top' | 'bottom';

export interface DockSplit {
  type: SplitAxis;
  id: string;
  children: DockNode[];
  sizes: (number | undefined)[];
  locked?: boolean;
}

export type DockNode = DockStack | DockSplit;

export interface FloatingPanel extends DockStack {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

interface PanelDef {
  title: string;
  Component: React.ComponentType;
}

export type PanelRegistry = Record<string, PanelDef>;

interface DragState {
  panelId: string;
  fromStackId: string;
  x: number;
  y: number;
}

export interface DockState {
  instanceId: string;
  root: DockNode | null;
  floating: Record<string, FloatingPanel>;
  topZ: number;
  drag: DragState | null;
  containerSize: number;

  setActiveTab: (stackId: string, panelId: string) => void;
  toggleCollapsed: (stackId: string) => void;
  resize: (splitId: string, index: number, sizePx: number) => void;
  moveFloating: (id: string, x: number, y: number) => void;
  resizeFloating: (id: string, w: number, h: number) => void;
  bringToFront: (id: string) => void;
  setContainerSize: (size: number) => void;
  openFloating: (panelId: string, w?: number, h?: number) => void;
  closeFloating: (id: string) => void;

  startDrag: (panelId: string, fromStackId: string, x: number, y: number) => void;
  updateDrag: (x: number, y: number) => void;
  endDrag: () => void;
}
