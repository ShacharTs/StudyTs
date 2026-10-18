import type { VisualSpec } from '@core/types/visualSpec';
import { duplicateStep, removeStepAt } from '@core/visualBuilder/stepEdits';
import { useTranslation } from '@i18n';
import styles from './BuilderWorkbench.module.css';

interface StepMetaProps {
  spec: VisualSpec;
  stepIndex: number;
  onStepIndex: (index: number) => void;
  onCommit: (spec: VisualSpec) => void;
}

export function StepMeta({ spec, stepIndex, onStepIndex, onCommit }: StepMetaProps) {
  const { val } = useTranslation();
  const removeStep = () => {
    onCommit(removeStepAt(spec, stepIndex));
    onStepIndex(Math.max(0, stepIndex - 1));
  };
  return (
    <div className={styles.metaButtons}>
      <button type="button" className={styles.miniButton} onClick={() => onCommit(duplicateStep(spec, stepIndex))}>
        {val({ key: 'visualAuthoring.timeline.duplicateStep' })}
      </button>
      <button type="button" className={styles.miniButton} disabled={spec.steps.length <= 1} onClick={removeStep}>
        {val({ key: 'visualAuthoring.timeline.deleteStep' })}
      </button>
    </div>
  );
}
