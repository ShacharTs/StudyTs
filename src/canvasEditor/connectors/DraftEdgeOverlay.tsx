import styles from './DraftEdgeOverlay.module.css';
import { useCanvasStore } from '@canvasStore';

export function DraftEdgeOverlay({ pageId }: { pageId: string }) {
  const draftEdge = useCanvasStore((s) => s.draftEdge);
  if (!draftEdge || draftEdge.pageId !== pageId) return null;

  return (
    <svg
      className={`${styles.overlay} print-hide`}
    >
      <line
        x1={`${draftEdge.anchor.x}mm`}
        y1={`${draftEdge.anchor.y}mm`}
        x2={`${draftEdge.cur.x}mm`}
        y2={`${draftEdge.cur.y}mm`}
        stroke="#4f46e5"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      {draftEdge.targetId ? (
        <circle
          cx={`${draftEdge.cur.x}mm`}
          cy={`${draftEdge.cur.y}mm`}
          r={4}
          fill="#22c55e"
          stroke="#ffffff"
          strokeWidth={1}
        />
      ) : null}
    </svg>
  );
}
