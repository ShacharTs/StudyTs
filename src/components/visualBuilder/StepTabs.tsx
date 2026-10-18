import { useRef, useState, type DragEvent, type MouseEvent } from 'react';
import type { VisualSpec } from '@core/types/visualSpec';
import { setStepFields } from '@core/visualBuilder/builderSteps';
import { moveStep } from '@core/visualBuilder/stepEdits';
import { useTranslation } from '@i18n';
import { IconButton } from './controls/IconButton';
import styles from './BuilderWorkbench.module.css';

interface StepTabsProps {
  spec: VisualSpec;
  stepIndex: number;
  onSelect: (index: number) => void;
  onCommit: (spec: VisualSpec) => void;
  onNewStep: () => void;
}

// Empty data would read as step 0, so it is treated as no step at all.
const draggedStep = (event: DragEvent): number => {
  const raw = event.dataTransfer.getData('text/step');
  return raw === '' ? NaN : Number(raw);
};

// The step name is data (whatChanged). Double-click opens a small popout: Enter or blur saves, Escape cancels.
function StepName({ name, label, onRename }: { name: string; label: number; onRename: (next: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  // Enter, Escape and the blur that follows them must close and save at most once.
  const open = useRef(false);
  const start = (event: MouseEvent) => {
    event.stopPropagation();
    open.current = true;
    setDraft(name);
  };
  const finish = (save: boolean, value: string) => {
    if (!open.current) return;
    open.current = false;
    setDraft(null);
    if (save && value.trim() !== '' && value !== name) onRename(value.trim());
  };
  return (
    <>
      <span className={styles.tabNumber} onDoubleClick={start}>{label}</span>
      {draft !== null && (
        <div className={styles.renamePop} role="dialog" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
          <input
            autoFocus
            className={styles.tabInput}
            size={Math.max(8, draft.length + 1)}
            value={draft}
            aria-label={name}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => finish(true, event.currentTarget.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') finish(true, event.currentTarget.value);
              if (event.key === 'Escape') finish(false, event.currentTarget.value);
            }}
          />
        </div>
      )}
    </>
  );
}

export function StepTabs({ spec, stepIndex, onSelect, onCommit, onNewStep }: StepTabsProps) {
  const { val } = useTranslation();
  const dropOn = (event: DragEvent, index: number) => {
    event.preventDefault();
    const from = draggedStep(event);
    if (!Number.isInteger(from) || from === index) return;
    onCommit(moveStep(spec, from, index));
    onSelect(index);
  };

  return (
    <div className={styles.tabs} role="tablist" aria-label={val({ key: 'visualAuthoring.timeline.stepsLabel' })}>
      {spec.steps.map((step, index) => (
        <div
          key={step.id}
          role="tab"
          tabIndex={0}
          aria-selected={index === stepIndex}
          aria-current={index === stepIndex}
          className={styles.tab}
          title={step.whatChanged}
          draggable
          onClick={() => onSelect(index)}
          onKeyDown={(event) => event.key === 'Enter' && onSelect(index)}
          onDragStart={(event) => event.dataTransfer.setData('text/step', String(index))}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => dropOn(event, index)}
        >
          <StepName name={step.whatChanged} label={index + 1} onRename={(next) => onCommit(setStepFields(spec, index, { whatChanged: next }))} />
          {step.why && <i className={styles.dot} aria-label={val({ key: 'visualAuthoring.timeline.hasCaption' })} />}
        </div>
      ))}
      <IconButton icon="step-add" label={val({ key: 'visualAuthoring.timeline.addStep' })} shortcut="N" onClick={onNewStep} />
    </div>
  );
}
