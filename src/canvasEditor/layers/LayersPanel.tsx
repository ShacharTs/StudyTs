import { useCanvasStore, pageStack, patchObject, setProp, reorderOne, type SceneObject } from '@canvasStore';
import styles from './LayersPanel.module.css';
import { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown } from 'lucide-react';

function labelOf(o: SceneObject): string {
  return (o.props.name as string) || o.type;
}

export function LayerRow({ obj, selected }: { obj: SceneObject; selected: boolean }) {
  const [editing, setEditing] = useState(false);

  const commitRename = (value: string) => {
    setProp(obj.id, 'name', value, 'Rename layer');
    setEditing(false);
  };

  return (
    <div className={`${styles.row} ${selected ? styles.selected : ''}`}>
      <button
        className={styles.icon}
        title="Show / hide"
        onClick={() => patchObject(obj.id, { hidden: !obj.hidden }, 'Toggle hide')}
      >
        {obj.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <button
        className={styles.icon}
        title="Lock / unlock"
        onClick={() => patchObject(obj.id, { locked: !obj.locked }, 'Toggle lock')}
      >
        {obj.locked ? <Lock size={14} /> : <Unlock size={14} />}
      </button>
      {editing ? (
        <input
          className={styles.rename}
          autoFocus
          defaultValue={labelOf(obj)}
          onBlur={(e) => commitRename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      ) : (
        <span
          className={styles.name}
          onClick={() => useCanvasStore.getState().select([obj.id])}
          onDoubleClick={() => setEditing(true)}
        >
          {labelOf(obj)}
        </span>
      )}
      <button className={styles.icon} title="Bring forward" onClick={() => reorderOne(obj.id, 'up')}>
        <ChevronUp size={14} />
      </button>
      <button className={styles.icon} title="Send backward" onClick={() => reorderOne(obj.id, 'down')}>
        <ChevronDown size={14} />
      </button>
    </div>
  );
}

export function LayersPanel() {
  // Subscribe to the doc and page so the list re-renders on any reorder; pageStack reads the same store.
  useCanvasStore((s) => s.doc);
  useCanvasStore((s) => s.currentPageId);
  const selectedIds = useCanvasStore((s) => s.selectedIds);

  // Topmost first: higher layer, then later in the page list.
  const rows = pageStack().reverse();

  return (
    <div className={styles.panel}>
      {rows.length === 0 ? (
        <p className={styles.empty}>No objects</p>
      ) : (
        <div className={styles.list}>
          {rows.map((o) => (
            <LayerRow key={o.id} obj={o} selected={selectedIds.includes(o.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
