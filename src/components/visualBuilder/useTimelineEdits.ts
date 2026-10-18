import { useState } from 'react';
import type { VisualSpec } from '@core/types/visualSpec';
import { removeBlock } from '@core/visualBuilder/blocks';
import { duplicateBlock } from '@core/visualBuilder/laneEdits';

interface ClipSelection {
  stepIndex: number;
  blockIndex: number;
}

interface TimelineEditContext {
  spec: VisualSpec;
  stepIndex: number;
  blockCount: number;
  onCommit: (spec: VisualSpec) => void;
}

// Selection is per step: a block index from another step must never act on this one.
export function useTimelineEdits({ spec, stepIndex, blockCount, onCommit }: TimelineEditContext) {
  const [selection, setSelection] = useState<ClipSelection | null>(null);
  const blockIndex = selection?.stepIndex === stepIndex && selection.blockIndex < blockCount ? selection.blockIndex : null;

  const select = (index: number | null) => setSelection(index === null ? null : { stepIndex, blockIndex: index });

  const duplicate = () => {
    if (blockIndex === null) return;
    onCommit(duplicateBlock(spec, stepIndex, blockIndex));
    select(blockIndex + 1);
  };
  const remove = () => {
    if (blockIndex === null) return;
    onCommit(removeBlock(spec, stepIndex, blockIndex));
    select(null);
  };

  return { blockIndex, select, duplicate, remove };
}
