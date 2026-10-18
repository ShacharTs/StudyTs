import { DockLayout } from '../dock/DockLayout';
import { useLeftDockStore, useRightDockStore } from './panelDockStores';
import styles from './PanelHost.module.css';
import { useWidthDrag } from './useWidthDrag';
import { Toolbox } from '../toolbox/Toolbox';
import { PagesPanel } from '../page/PagesPanel';
import { PropertiesPanel } from '../properties/PropertiesPanel';
import { LayersPanel } from '../layers/LayersPanel';

type PanelRegistry<Id extends string> = Record<Id, { title: string; Component: React.ComponentType }>;

const LEFT_PANEL_REGISTRY: PanelRegistry<'toolbox'> = {
  toolbox: { title: '', Component: Toolbox },
};

const RIGHT_PANEL_REGISTRY: PanelRegistry<'layers' | 'pages' | 'properties'> = {
  layers: { title: 'Layers', Component: LayersPanel },
  pages: { title: 'Pages', Component: PagesPanel },
  properties: { title: 'Properties', Component: PropertiesPanel },
};

export type PanelSide = 'left' | 'right';

/** `direction` is how the width changes per px the pointer moves right: the left panel grows, the right shrinks. */
const PANEL_SIDES = {
  left: { store: useLeftDockStore, registry: LEFT_PANEL_REGISTRY, min: 200, max: 480, direction: 1 },
  right: { store: useRightDockStore, registry: RIGHT_PANEL_REGISTRY, min: 240, max: 640, direction: -1 },
} as const;

/** A docked side column with a draggable divider on its inner edge. `side` never changes for a mounted host. */
export function PanelHost({ side }: { side: PanelSide }) {
  const { store, registry, min, max, direction } = PANEL_SIDES[side];
  const width = store((s) => s.containerSize);
  const setContainerSize = store((s) => s.setContainerSize);
  const startWidthDrag = useWidthDrag({ width, setWidth: setContainerSize, direction, min, max });

  const divider = <div className={styles.wDivider} onPointerDown={startWidthDrag} />;
  return (
    <div className={`${styles.wrapper} print-hide`}>
      {side === 'right' && divider}
      <div className={styles.column} style={{ width }}>
        <DockLayout store={store} registry={registry} fixedLayout />
      </div>
      {side === 'left' && divider}
    </div>
  );
}
