import type { RefObject } from 'react';
import { renderStageElement } from './renderStageElement';
import type { VisualSpec } from './visualSpec';
import styles from './GenericSvgStage.module.css';

interface GenericSvgStageProps {
  spec: VisualSpec;
  svgRef: RefObject<SVGSVGElement>;
}

export function GenericSvgStage({ spec, svgRef }: GenericSvgStageProps) {
  return (
    <svg ref={svgRef} className={styles.stage} viewBox={spec.viewBox} role="img" aria-label={spec.id}>
      {spec.elements.map((element) => renderStageElement(element))}
    </svg>
  );
}
