import { createDockStore } from '../dock/createDockStore';
import type { DockNode } from '../dock/dockTypes';

/** One collapsed-by-default-off stack holding a single panel. */
function singlePanelStack(panelId: string): DockNode {
  return {
    type: 'stack',
    id: `stack-${crypto.randomUUID()}`,
    panelIds: [panelId],
    activeId: panelId,
    collapsed: false,
    collapsible: false,
  };
}

const leftToolboxLayout = singlePanelStack('toolbox');

// Layers and Pages share one stack so they sit as bottom tabs under Properties.
const rightPanelsLayout: DockNode = {
  type: 'column',
  id: `split-${crypto.randomUUID()}`,
  children: [
    singlePanelStack('properties'),
    {
      type: 'stack',
      id: `stack-${crypto.randomUUID()}`,
      panelIds: ['layers', 'pages'],
      activeId: 'layers',
      collapsed: false,
      collapsible: false,
      headerPlacement: 'bottom',
    },
  ],
  sizes: [340, undefined],
};

// The persistKey values are users' saved panel widths: renaming one resets them.
export const useLeftDockStore = createDockStore(leftToolboxLayout, {
  persistKey: 'dock:left-toolbox-v2',
  defaultContainerSize: 240,
  fixedLayout: true,
});

export const useRightDockStore = createDockStore(rightPanelsLayout, {
  persistKey: 'dock:right-sidebar-v4',
  defaultContainerSize: 340,
  fixedLayout: true,
});
