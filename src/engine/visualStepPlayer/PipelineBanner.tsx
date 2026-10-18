import type { CSSProperties } from 'react';
import type { VisualPipelineSpec } from './visualSpec';
import styles from './PipelineBanner.module.css';

interface PipelineBannerProps {
  pipeline: VisualPipelineSpec;
  activeStage?: string;
}

type StageState = 'idle' | 'active' | 'done';

function stageState(index: number, activeIndex: number): StageState {
  if (index === activeIndex) return 'active';
  return index < activeIndex ? 'done' : 'idle';
}

export function PipelineBanner({ pipeline, activeStage }: PipelineBannerProps) {
  const activeIndex = pipeline.stages.findIndex((stage) => stage.id === activeStage);
  return (
    <ol className={styles.banner}>
      {pipeline.stages.map((stage, index) => {
        const state = stageState(index, activeIndex);
        // The stage colour is dynamic data, so it travels as a CSS custom property.
        const colorStyle = stage.color ? ({ '--stage-color': stage.color } as CSSProperties) : undefined;
        return (
          <li key={stage.id} className={styles.stage} style={colorStyle} data-stage={stage.id} data-state={state} dir="auto">
            <span className={styles.badge} aria-hidden="true">
              {state === 'done' ? '✓' : index + 1}
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{stage.label}</span>
              {stage.description && <span className={styles.description}>{stage.description}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
