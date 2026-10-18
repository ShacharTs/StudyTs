import { useObject, useCanvasStore, type SceneObject } from '@canvasStore';
import { unboundLinePad } from '../connectors/connectorGeometry';
import { useObjectResize, useObjectRotate } from '../interaction/useObjectTransform';
import { CurveHandleEl, ConnectorSelection } from '../connectors/ConnectorSelection';
import type { ResizeHandle } from '../interaction/interactionGeometry';
import type { BoundEdgeLine } from '../connectors/useBoundEdgeGeometry';
import styles from './SelectionBox.module.css';

interface HandleSpec {
  h: ResizeHandle;
  top: string;
  left: string;
  cursor: string;
}

const HANDLES: HandleSpec[] = [
  { h: 'nw', top: '0', left: '0', cursor: 'nwse-resize' },
  { h: 'n', top: '0', left: '50%', cursor: 'ns-resize' },
  { h: 'ne', top: '0', left: '100%', cursor: 'nesw-resize' },
  { h: 'e', top: '50%', left: '100%', cursor: 'ew-resize' },
  { h: 'se', top: '100%', left: '100%', cursor: 'nwse-resize' },
  { h: 's', top: '100%', left: '50%', cursor: 'ns-resize' },
  { h: 'sw', top: '100%', left: '0', cursor: 'nesw-resize' },
  { h: 'w', top: '50%', left: '0', cursor: 'ew-resize' },
];

function ResizeHandleEl({
  id,
  pageId,
  spec,
  inverseZoom,
}: {
  id: string;
  pageId: string;
  spec: HandleSpec;
  inverseZoom: number;
}) {
  const onDown = useObjectResize(id, pageId, spec.h);
  return (
    <div
      className={styles.handle}
      style={{
        top: spec.top,
        left: spec.left,
        cursor: spec.cursor,
        transform: `scale(${inverseZoom})`,
      }}
      onPointerDown={onDown}
    />
  );
}

function RotateHandleEl({ id, inverseZoom }: { id: string; inverseZoom: number }) {
  const onDown = useObjectRotate(id);
  return (
    <div
      className={styles.rotate}
      title="Rotate (Shift = 15°)"
      onPointerDown={onDown}
      style={{ transform: `scale(${inverseZoom})` }}
    />
  );
}

/** The two ends of an unbound line, positioned as percentages of its (padded) box so they sit on the line ends. */
function lineEndHandles(obj: SceneObject): HandleSpec[] {
  const pad = unboundLinePad(obj);
  const boxW = obj.w + 2 * pad.x;
  const boxH = obj.h + 2 * pad.y;
  const pct = (v: number, padding: number, size: number) => `${((padding + v) / size) * 100}%`;
  const flipX = obj.props.flipX === true;
  const flipY = obj.props.flipY === true;
  const startY = flipY ? obj.h : 0;
  const endY = flipY ? 0 : obj.h;
  const leftY = flipX ? endY : startY;
  const rightY = flipX ? startY : endY;
  return [
    { h: 'w', left: pct(0, pad.x, boxW), top: pct(leftY, pad.y, boxH), cursor: 'ew-resize' },
    { h: 'e', left: pct(obj.w, pad.x, boxW), top: pct(rightY, pad.y, boxH), cursor: 'ew-resize' },
  ];
}

const CORNER_HANDLES = new Set<ResizeHandle>(['nw', 'ne', 'se', 'sw']);
const SMALL_MM = 24;

/**
 * Lines resize from their ends; circles and small boxes keep only the corner dots on the outer frame,
 * so the edge-midpoint dots never pile up on the ring of a State node.
 */
function handlesFor(obj: SceneObject): HandleSpec[] {
  if (obj.type === 'line' || obj.type === 'edge') return lineEndHandles(obj);
  const round = obj.type === 'node' || obj.props.shape === 'ellipse';
  const small = Math.min(obj.w, obj.h) < SMALL_MM;
  return round || small ? HANDLES.filter((s) => CORNER_HANDLES.has(s.h)) : HANDLES;
}

export function SelectionBox({
  id,
  pageId,
  boundLine,
}: {
  id: string;
  pageId: string;
  boundLine?: BoundEdgeLine | null;
}) {
  const obj = useObject(id);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const inverseZoom = 1 / (zoom || 1);

  if (!obj) return null;
  const isLine = obj.type === 'line' || obj.type === 'edge';
  const outlineWidth = `${1 / (zoom || 1)}px`;
  const lineCurvature = (obj.props.curvature as number) || 0;

  if (boundLine) {
    return (
      <ConnectorSelection
        id={id}
        inverseZoom={inverseZoom}
        boundLine={boundLine}
        curvature={lineCurvature}
      />
    );
  }

  const handles = handlesFor(obj);

  return (
    <div
      className={`${styles.box} ${isLine ? styles.boxLine : ''} print-hide`}
      style={{ outlineWidth }}
    >
      {handles.map((spec) => (
        <ResizeHandleEl
          key={spec.h}
          id={id}
          pageId={pageId}
          spec={spec}
          inverseZoom={inverseZoom}
        />
      ))}
      <RotateHandleEl id={id} inverseZoom={inverseZoom} />
      {isLine && (
        <CurveHandleEl id={id} inverseZoom={inverseZoom} leftPct={50} topPct={50} curvature={lineCurvature} />
      )}
    </div>
  );
}
