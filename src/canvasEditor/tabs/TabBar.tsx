import { FileText, MousePointer2, Sigma, PlusSquare, LayoutGrid } from 'lucide-react';
import { useCanvasStore, type TabKind } from '@canvasStore';
import styles from './TabBar.module.css';

const TAB_ICONS: Record<TabKind, typeof FileText> = {
  File: FileText,
  Home: MousePointer2,
  Equation: Sigma,
  Insert: PlusSquare,
  Layout: LayoutGrid,
};

const TABS: TabKind[] = ['File', 'Home', 'Equation', 'Insert', 'Layout'];

export function TabBar() {
  const currentTab = useCanvasStore((s) => s.currentTab);
  const setCurrentTab = useCanvasStore((s) => s.setCurrentTab);

  return (
    <div className={`${styles.bar} print-hide`}>
      {TABS.map((tab) => {
        const Icon = TAB_ICONS[tab];
        const isActive = currentTab === tab;
        return (
          <button
            key={tab}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            onClick={() => setCurrentTab(tab)}
          >
            <Icon size={13} className={styles.tabIcon} />
            <span className={isActive ? styles.active : ''}>{tab}</span>
          </button>
        );
      })}
    </div>
  );
}
