import type React from 'react';
import styles from './BoundEdgeSelection.module.css';
import { useLineCurveDrag, useEdgeEndpointDrag } from './useConnectorDrags';
import { curveControlPoint, bezierMidpoint } from './connectorGeometry';
import type { BoundEdgeLine } from './useBoundEdgeGeometry';

export function CurveHandleEl({
  id,
  inverseZoom,
  leftPct,
  topPct,
  curvature,
}: {
  id: string;
  inverseZoom: number;
  leftPct: number;
  topPct: number;
  curvature: number;
}) {
  const startCurveDrag = useLineCurveDrag(id);
  return (
    <div
      title="Drag to Curve Line"
      className={`${styles.handle} ${styles.curve}`}
      style={{ '--l': `${leftPct}%`, '--t': `calc(${topPct}% + ${curvature}mm)`, '--z': inverseZoom } as React.CSSProperties}
      onPointerDown={startCurveDrag}
    />
  );
}

function svgToLocalPct(minX: number, minY: number, boxW: number, boxH: number, x: number, y: number) {
  return { x: ((x - minX) / boxW) * 100, y: ((y - minY) / boxH) * 100 };
}

function EndpointHandleEl({
  id,
  end,
  inverseZoom,
  leftPct,
  topPct,
}: {
  id: string;
  end: 'source' | 'target';
  inverseZoom: number;
  leftPct: number;
  topPct: number;
}) {
  const startEndpointDrag = useEdgeEndpointDrag(id, end);
  return (
    <div
      title={end === 'source' ? 'Drag to move start point' : 'Drag to move end point'}
      className={`${styles.handle} ${styles.endpoint}`}
      style={{ '--l': `${leftPct}%`, '--t': `${topPct}%`, '--z': inverseZoom } as React.CSSProperties}
      onPointerDown={startEndpointDrag}
    />
  );
}

export function ConnectorSelection({
  id,
  inverseZoom,
  boundLine,
  curvature,
}: {
  id: string;
  inverseZoom: number;
  boundLine: BoundEdgeLine;
  curvature: number;
}) {
  const { minX, minY, boxW, boxH, startAbs, endAbs } = boundLine;

  const control = curveControlPoint(startAbs, endAbs, curvature);
  const mid = curvature ? bezierMidpoint(startAbs, control, endAbs) : control;
  const curveMidPct = svgToLocalPct(minX, minY, boxW, boxH, mid.x, mid.y);
  const startPct = svgToLocalPct(minX, minY, boxW, boxH, startAbs.x, startAbs.y);
  const endPct = svgToLocalPct(minX, minY, boxW, boxH, endAbs.x, endAbs.y);

  const d = curvature
    ? `M ${startAbs.x} ${startAbs.y} Q ${control.x} ${control.y} ${endAbs.x} ${endAbs.y}`
    : `M ${startAbs.x} ${startAbs.y} L ${endAbs.x} ${endAbs.y}`;

  return (
    <div className={`${styles.root} print-hide`}>
      <svg
        viewBox={`${minX} ${minY} ${boxW} ${boxH}`}
        preserveAspectRatio="none"
        className={styles.svg}
      >
        <path
          d={d}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={boxW / 300}
          vectorEffect="non-scaling-stroke"
          strokeDasharray="4 3"
        />
      </svg>
      <CurveHandleEl
        id={id}
        inverseZoom={inverseZoom}
        leftPct={curveMidPct.x}
        topPct={curveMidPct.y}
        curvature={0}
      />
      <EndpointHandleEl id={id} end="source" inverseZoom={inverseZoom} leftPct={startPct.x} topPct={startPct.y} />
      <EndpointHandleEl id={id} end="target" inverseZoom={inverseZoom} leftPct={endPct.x} topPct={endPct.y} />
    </div>
  );
}
