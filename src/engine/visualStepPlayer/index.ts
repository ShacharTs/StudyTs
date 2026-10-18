export { VisualStepPlayer } from './VisualStepPlayer';
export { validateVisualSpec } from '@core/validation/visualSpec/visualSpecValidation';
export { checkVisualSpec, parseVisualSpecJson, serializeVisualSpec } from '@core/validation/visualSpec/visualSpecJson';
export type { VisualSpecParseResult } from '@core/validation/visualSpec/visualSpecJson';
export { VISUAL_SPEC_KEY_PATTERN, isVisualSpecKey } from '@core/validation/visualSpec/visualSpecKey';
export { VISUAL_ELEMENT_KINDS } from '@core/types/visualSpec';
export {
  addElement,
  addStep,
  addTween,
  parseScalar,
  removeElement,
  removeEntry,
  removeStep,
  removeTween,
  renameElement,
  setEntry,
  updateElement,
  updateStep,
  updateTween,
} from '@core/visualSpec/visualSpecEdits';
export type { Scalar, ScalarRecord } from '@core/visualSpec/visualSpecEdits';
export type {
  VisualElementKind,
  VisualElementSpec,
  VisualPipelineSpec,
  VisualSpec,
  VisualStepSpec,
  VisualTweenSpec,
} from './visualSpec';
export { renderStageElement } from './renderStageElement';
export { useStepTimeline } from './useStepTimeline';
export type { PartRange } from './useStepTimeline';
export { usePlayheadState } from './usePlayheadState';
export { createPlayheadStore, usePlayheadMs, type PlayheadStore } from './playheadStore';
export { useScrubPlayhead } from './useScrubPlayhead';
export { PreviewScrubber } from './PreviewScrubber';
