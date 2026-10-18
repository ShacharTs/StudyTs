import styles from './PortDots.module.css';
import { useCanvasStore, type SceneObject } from '@canvasStore';
import { usePortDrag } from './usePortDrag';
import { localAnchorsOf } from '../shapeEngine/objectOutline';

const R = 1.6;

function dotRadius(w: number, h: number): number {
  return Math.min(R, Math.min(w, h) * 0.16);
}

/**
 * Connection dots on the shape's real outline (one per engine anchor). Each dot is nudged just inside along its
 * outward normal so it stays on the contour without sitting under an outer resize handle; the connector itself
 * still starts at the exact anchor.
 */
export function PortDots({ obj, pageId, show }: { obj: SceneObject; pageId: string; show: boolean }) {
  const draftEdge = useCanvasStore((s) => s.draftEdge);
  const startDrag = usePortDrag(obj.id, pageId);
  if (!show) return null;

  const targeted = draftEdge?.targetId === obj.id ? draftEdge.targetPort : null;
  const r = dotRadius(obj.w, obj.h);
  const inset = r * 2;
  const clipId = `port-hit-clip-${obj.id}`;

  return (
    <svg
      className={`${styles.svg} print-hide`}
      width="100%"
      height="100%"
      viewBox={`0 0 ${obj.w} ${obj.h}`}
      preserveAspectRatio="none"
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <rect x={0} y={0} width={obj.w} height={obj.h} />
        </clipPath>
      </defs>
      {localAnchorsOf(obj).map((anchor) => {
        const cx = anchor.x - anchor.normal.x * inset;
        const cy = anchor.y - anchor.normal.y * inset;
        const hot = targeted === anchor.id;
        return (
          <g key={anchor.id}>
            <circle
              cx={cx}
              cy={cy}
              r={hot ? r * 1.4 : r}
              fill={hot ? '#22c55e' : '#4f46e5'}
              stroke="#ffffff"
              strokeWidth={Math.min(0.4, r * 0.3)}
              className={styles.ring}
            />
            <circle
              cx={cx}
              cy={cy}
              r={hot ? r * 1.4 : r}
              fill="transparent"
              clipPath={`url(#${clipId})`}
              className={styles.hit}
              onPointerDown={startDrag(anchor.id)}
            />
          </g>
        );
      })}
    </svg>
  );
}
