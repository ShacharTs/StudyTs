import { useState } from 'react';
import { setProp, type SceneObject } from '@canvasStore';
import { BlurCommitInput } from '@components/shared/BlurCommitInput';
import { LatexText } from './LatexText';
import { ShapeBody, ShapeOutline, type ShapePaint } from './ShapeBody';
import { readShapeProps } from './shapeGeometry';
import { dashArray, readStrokeStyle } from '../connectors/connectorGeometry';
import styles from './ObjectViews.module.css';

/** Where a shape's label goes besides the centre: under the icon (devices) or on the top edge (zone frames). */
const LABEL_PLACEMENT_CLASS: Record<string, string> = { below: styles.labelBelow, top: styles.labelTop };

export function ShapeView({ obj }: { obj: SceneObject }) {
  const [editing, setEditing] = useState(false);
  const p = obj.props;
  const { kind, fill, stroke, sw, label, opacity, labelColor, fontSize, radius, tailX } = readShapeProps(p);
  const dash = dashArray(readStrokeStyle(p), sw);
  const labelPlacement = LABEL_PLACEMENT_CLASS[p.labelPlacement as string];
  const paint: ShapePaint = { kind, w: obj.w, h: obj.h, fill, stroke, sw, radius, tailX };

  return (
    <div className={styles.fill}>
      <svg width="100%" height="100%" viewBox={`0 0 ${paint.w} ${paint.h}`} preserveAspectRatio="none" className={styles.layerSvg} style={{ '--op': opacity } as React.CSSProperties}>
        {dash ? <g strokeDasharray={dash}><ShapeBody {...paint} /></g> : <ShapeBody {...paint} />}
        {p.doubleStroke ? <ShapeOutline {...paint} /> : null}
      </svg>
      <div className={labelPlacement ? `${styles.label} ${styles.labelPad} ${labelPlacement}` : `${styles.label} ${styles.labelPad}`} style={{ '--c': labelColor, '--fs': `${fontSize}pt` } as React.CSSProperties}>
        {editing ? (
          <BlurCommitInput
            autoFocus
            value={label}
            className={`${styles.labelInput} ${styles.labelInputWide}`}
            onCommit={(value) => setProp(obj.id, 'label', value, 'Edit label')}
            onFinish={() => setEditing(false)}
          />
        ) : (
          <span
            className={`${styles.labelText} ${styles.labelTextWide}`}
            onDoubleClick={() => setEditing(true)}
          >
            <LatexText text={label} />
          </span>
        )}
      </div>
    </div>
  );
}
