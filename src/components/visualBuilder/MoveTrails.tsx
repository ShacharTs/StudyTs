import { useMemo } from 'react';
import { renderStageElement } from '@engine/visualStepPlayer';
import type { VisualSpec } from '@core/types/visualSpec';
import { moveTrailsAt } from '@core/visualBuilder/moveTrails';
import styles from './VisualBuilder.module.css';

interface MoveTrailsProps {
  spec: VisualSpec;
  stepIndex: number | undefined;
  enabled: boolean;
}

// Drawn first so the dotted line sits under the live objects; not hit-tested, so never selectable or draggable.
export function MoveTrails({ spec, stepIndex, enabled }: MoveTrailsProps) {
  const trails = useMemo(() => (enabled && stepIndex !== undefined ? moveTrailsAt(spec, stepIndex) : []), [enabled, spec, stepIndex]);
  return (
    <>
      {trails.map((trail) => (
        <g key={`origin-${trail.id}`} className={styles.lifeFaint} data-move-origin={trail.id} pointerEvents="none">
          {renderStageElement(trail.origin, { pointerEvents: 'none' })}
        </g>
      ))}
      {trails.map((trail) => (
        <line
          key={`trail-${trail.id}`}
          data-move-trail={trail.id}
          className={styles.lifeFrame}
          x1={trail.from.x}
          y1={trail.from.y}
          x2={trail.to.x}
          y2={trail.to.y}
          stroke="currentColor"
          strokeWidth={2}
          strokeDasharray="2 4"
          strokeLinecap="round"
          pointerEvents="none"
        />
      ))}
    </>
  );
}
