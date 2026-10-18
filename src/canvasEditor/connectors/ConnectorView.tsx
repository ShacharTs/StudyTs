import { useState } from 'react';
import { isPrimaryPress } from '../interaction/isPrimaryPress';
import { useIsSelected, useObject, setProp, useCanvasStore, type SceneObject } from '@canvasStore';
import {
  computeArrowGeometry,
  readArrowStyleProps,
  dashArray,
  type StrokeStyle,
  MARKER_DEFS,
  type MarkerKind,
  MM_PER_PT,
  estimateLabelWidth,
  placeLabel,
} from './connectorGeometry';
import { LatexText } from '../objectViews/LatexText';
import styles from '../objectViews/ObjectViews.module.css';

function EdgeMarker({ id, kind, stroke, start }: { id: string; kind: MarkerKind; stroke: string; start: boolean }) {
  const def = MARKER_DEFS[kind];
  if (!def) return null;
  const fill = { stroke, surface: 'var(--bg-secondary)', none: 'none' }[def.fill];
  return (
    <marker id={id} markerWidth={def.w} markerHeight={def.h} viewBox={`0 0 ${def.w} ${def.h}`} refX={def.w} refY={def.h / 2} orient={start ? 'auto-start-reverse' : 'auto'} markerUnits="strokeWidth">
      <path d={def.path} fill={fill} stroke={stroke} strokeWidth={1} strokeLinejoin="round" />
    </marker>
  );
}

function ArrowMarkers({ startId, endId, start, end, stroke }: { startId: string; endId: string; start: MarkerKind; end: MarkerKind; stroke: string }) {
  return (
    <defs>
      <EdgeMarker id={startId} kind={start} stroke={stroke} start />
      <EdgeMarker id={endId} kind={end} stroke={stroke} start={false} />
    </defs>
  );
}

function ArrowStrokes({
  d,
  stroke,
  sw,
  strokeStyle,
  markerStart,
  markerEnd,
  markerStartId,
  markerEndId,
  onHitPointerDown,
  onContextMenu,
}: {
  d: string;
  stroke: string;
  sw: number;
  strokeStyle: StrokeStyle;
  markerStart: MarkerKind;
  markerEnd: MarkerKind;
  markerStartId: string;
  markerEndId: string;
  onHitPointerDown: (e: React.PointerEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <>
      <path
        d={d}
        stroke={stroke}
        strokeWidth={sw}
        fill="none"
        strokeLinecap="round"
        markerEnd={markerEnd !== 'none' ? `url(#${markerEndId})` : undefined}
        markerStart={markerStart !== 'none' ? `url(#${markerStartId})` : undefined}
        strokeDasharray={dashArray(strokeStyle, sw)}
        className={styles.strokeNone}
      />
      <path
        d={d}
        stroke="transparent"
        strokeWidth={Math.max(3, sw * 4)}
        fill="none"
        strokeLinecap="round"
        className={styles.strokeHit}
        onPointerDown={onHitPointerDown}
        onContextMenu={onContextMenu}
      />
    </>
  );
}

interface EdgeLabelProps {
  objId: string;
  label: string;
  x: number;
  y: number;
  /** Font size and color of the label; sizes are in user units, which are millimetres inside the edge's svg. */
  fontMm: number;
  color: string | undefined;
}

const LABEL_BOX_WIDTH_MM = 60;
const LABEL_MAX_LINES = 3;

function EdgeLabel({ objId, label, x, y, fontMm, color }: EdgeLabelProps) {
  const [editing, setEditing] = useState(false);
  const boxHeight = fontMm * 1.3 * LABEL_MAX_LINES + 2;
  // CSS lengths inside the svg are user units, so a size in `mm` here would be 3.78x larger than intended.
  const textStyle = { fontSize: `${fontMm}px`, color } as React.CSSProperties;

  const commit = (value: string) => {
    setProp(objId, 'label', value, 'Edit label');
    setEditing(false);
  };

  return (
    <foreignObject x={x - LABEL_BOX_WIDTH_MM / 2} y={y - boxHeight / 2} width={LABEL_BOX_WIDTH_MM} height={boxHeight} className={`${styles.edgeLabelBox} ${editing || label ? styles.edgeLabelActive : ''}`}>
      <div className={styles.edgeLabelRow}>
        {editing ? (
          <input
            autoFocus
            defaultValue={label}
            className={styles.edgeInput}
            style={textStyle}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
        ) : label ? (
          <span
            className={styles.edgeText}
            style={textStyle}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            <LatexText text={label} />
          </span>
        ) : null}
      </div>
    </foreignObject>
  );
}

export function ConnectorView({
  obj,
  onContextMenu,
}: {
  obj: SceneObject;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const sourceId = (obj.props.sourceId as string) || '';
  const targetId = (obj.props.targetId as string) || '';
  const sourceObj = useObject(sourceId);
  const targetObj = useObject(targetId);
  const selected = useIsSelected(obj.id);

  if (obj.type !== 'line' && obj.type !== 'edge') return null;

  const { label, stroke, sw, strokeStyle, markerStart, markerEnd, curvature, routing, labelFontSize, labelColor } = readArrowStyleProps(obj.props);
  const geometry = computeArrowGeometry(obj, sourceObj, targetObj, curvature, routing);
  const fontMm = labelFontSize * MM_PER_PT;
  const labelAt = placeLabel(geometry, estimateLabelWidth(label, fontMm), fontMm);

  const markerStartId = `arrow-start-${obj.id}`;
  const markerEndId = `arrow-end-${obj.id}`;

  const onHitPointerDown = (e: React.PointerEvent) => {
    if (!isPrimaryPress(e)) return;
    e.stopPropagation();
    useCanvasStore.getState().select([obj.id]);
  };

  return (
    <svg width="100%" height="100%" viewBox={geometry.viewBox} preserveAspectRatio="none" className={`${styles.arrowSvg} ${selected ? styles.arrowSelected : ''}`}>
      <ArrowMarkers startId={markerStartId} endId={markerEndId} start={markerStart} end={markerEnd} stroke={stroke} />
      <ArrowStrokes
        d={geometry.d}
        stroke={stroke}
        sw={sw}
        strokeStyle={strokeStyle}
        markerStart={markerStart}
        markerEnd={markerEnd}
        markerStartId={markerStartId}
        markerEndId={markerEndId}
        onHitPointerDown={onHitPointerDown}
        onContextMenu={onContextMenu}
      />
      <EdgeLabel objId={obj.id} label={label} x={labelAt.x} y={labelAt.y} fontMm={fontMm} color={labelColor} />
    </svg>
  );
}
