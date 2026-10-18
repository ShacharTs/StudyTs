import { useState } from 'react';
import { setProp, type SceneObject } from '@canvasStore';
import { BlurCommitInput } from '@components/shared/BlurCommitInput';
import { LatexText } from './LatexText';
import { themedColor } from './themeColors';
import styles from './ObjectViews.module.css';

function NodeShape({ p, w, h }: { p: SceneObject['props']; w: number; h: number }) {
  const isRect = (p.shape as string) === 'rect';
  const stroke = themedColor(p.stroke as string | undefined);
  const sw = (p.strokeWidth as number) ?? 0.4;
  const fill = (p.fill as string) ?? 'transparent';
  const inset = sw / 2;
  const common = { fill, stroke, strokeWidth: sw, style: { pointerEvents: 'visiblePainted' as const } };
  return (
  <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={styles.layerSvg}>
    {p.start ? <line x1={-h * 0.45} y1={h/2} x2={-sw} y2={h/2} stroke={stroke} strokeWidth={sw} /> : null}
    {isRect ? <rect x={inset} y={inset} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)} rx={1.5} {...common} /> : <ellipse cx={w/2} cy={h/2} rx={Math.max(0, w/2 - inset)} ry={Math.max(0, h/2 - inset)} {...common} />}
    {p.accept ? (isRect ? <rect x={inset+1.2} y={inset+1.2} width={Math.max(0,w-sw-2.4)} height={Math.max(0,h-sw-2.4)} rx={1} fill="none" stroke={stroke} strokeWidth={sw} /> : <ellipse cx={w/2} cy={h/2} rx={Math.max(0,w/2-inset-1.2)} ry={Math.max(0,h/2-inset-1.2)} fill="none" stroke={stroke} strokeWidth={sw} />) : null}
  </svg>
  );
}

function NodeLabel({ obj, p }: { obj: SceneObject; p: SceneObject['props'] }) {
  const [editing, setEditing] = useState(false);
  const label = (p.label as string) ?? '';

  return (
  <div className={`${styles.label} ${styles.labelBorderBox}`} style={{ '--c': themedColor(p.textColor as string | undefined), '--fs': `${(p.fontSize as number) ?? 11}pt` } as React.CSSProperties}>
    {editing ? (
      <BlurCommitInput
        autoFocus
        value={label}
        className={styles.labelInput}
        onCommit={(value) => setProp(obj.id, 'label', value, 'Edit label')}
        onFinish={() => setEditing(false)}
      />
    ) : (
      <span
        className={styles.labelText}
        onDoubleClick={() => setEditing(true)}
      >
        <LatexText text={label} />
      </span>
    )}
  </div>
  );
}

export function StateNodeView({ obj }: { obj: SceneObject }) {
  return (
    <div className={styles.fill}>
      <NodeShape p={obj.props} w={obj.w} h={obj.h} />
      <NodeLabel obj={obj} p={obj.props} />
    </div>
  );
}
