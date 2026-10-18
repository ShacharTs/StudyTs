// Selection, step and undo/redo state for the builder.
import { useCallback, useRef, useState } from 'react';
import type { VisualSpec } from '@core/types/visualSpec';
import { finalizeBuilderSpec } from '@core/visualBuilder/builderFinalize';

const HISTORY_LIMIT = 100;

// A mode swap lives in the same history as drawing edits, so undo restores the drawing and the mode it was drawn in.
export interface BuilderModeLink {
  modeId: string;
  onModeChange: (modeId: string) => void;
}

interface Snapshot {
  spec: VisualSpec;
  modeId: string;
}

export function useVisualBuilder(spec: VisualSpec, onChange: (spec: VisualSpec) => void, mode: BuilderModeLink) {
  const [selection, setSelection] = useState<string[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [snap, setSnap] = useState(true);
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const [, setVersion] = useState(0);
  const { modeId, onModeChange } = mode;
  const [shownModeId, setShownModeId] = useState(modeId);
  // Reset during render so the old selection never paints under the new mode.
  if (shownModeId !== modeId) {
    setShownModeId(modeId);
    setSelection([]);
    setStepIndex(0);
  }

  const commit = useCallback(
    (next: VisualSpec) => {
      past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), { spec, modeId }];
      future.current = [];
      onChange(finalizeBuilderSpec(next));
      setVersion((version) => version + 1);
    },
    [spec, modeId, onChange],
  );

  const undo = useCallback(() => {
    const previous = past.current[past.current.length - 1];
    if (!previous) return;
    past.current = past.current.slice(0, -1);
    future.current = [{ spec, modeId }, ...future.current];
    if (previous.modeId !== modeId) onModeChange(previous.modeId);
    onChange(previous.spec);
    setVersion((version) => version + 1);
  }, [spec, modeId, onModeChange, onChange]);

  const redo = useCallback(() => {
    const next = future.current[0];
    if (!next) return;
    future.current = future.current.slice(1);
    past.current = [...past.current, { spec, modeId }];
    if (next.modeId !== modeId) onModeChange(next.modeId);
    onChange(next.spec);
    setVersion((version) => version + 1);
  }, [spec, modeId, onModeChange, onChange]);

  const select = useCallback((id: string | null) => setSelection(id ? [id] : []), []);
  const toggleSelect = useCallback((id: string) => setSelection((now) => (now.includes(id) ? now.filter((other) => other !== id) : [...now, id])), []);
  const existing = selection.filter((id) => spec.elements.some((el) => el.id === id));
  const selected = existing[existing.length - 1] ?? null;
  const activeStep = Math.min(stepIndex, Math.max(0, spec.steps.length - 1));

  return {
    selectedId: selected,
    selectedIds: existing,
    select,
    selectMany: setSelection,
    toggleSelect,
    stepIndex: activeStep,
    setStepIndex,
    snap,
    setSnap,
    commit,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
