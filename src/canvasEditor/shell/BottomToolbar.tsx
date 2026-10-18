import { useCanvasStore, type ToolKind } from '@canvasStore';
import {
  MousePointer,
  Hand,
  Type,
  Square,
  Minus,
  X,
} from 'lucide-react';
import styles from './BottomToolbar.module.css';

interface ToolItem {
  id: ToolKind;
  label: string;
  icon: React.ReactNode;
}

const TOOLS: ToolItem[] = [
  { id: 'pointer', label: 'Select / Move', icon: <MousePointer size={16} /> },
  { id: 'hand', label: 'Pan Canvas', icon: <Hand size={16} /> },
  { id: 'text', label: 'Text Box', icon: <Type size={16} /> },
  { id: 'shape', label: 'Shape', icon: <Square size={16} /> },
  { id: 'line', label: 'Line / Arrow', icon: <Minus size={16} /> },
];

export function BottomToolbar() {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);

  return (
    <div className={`${styles.toolbar} print-hide`}>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`${styles.toolBtn} ${activeTool === t.id ? styles.active : ''}`}
          onClick={() => setActiveTool(t.id)}
          title={t.label}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
      <button
        className={styles.toolBtn}
        onClick={() => useCanvasStore.getState().clearSelection()}
        title="Deselect"
      >
        <X size={16} />
        <span>Deselect</span>
      </button>
    </div>
  );
}