import type { BuilderShape, VisualSpec } from '@core/types/visualSpec';
import type { ModeEvent } from '@core/visualBuilder/builderMode';
import { bringInside, deleteElements, duplicateElement } from '@core/visualBuilder/builderEdits';
import type { LayoutIssueActions } from './LayoutNotes';
import { addBuilderStep } from '@core/visualBuilder/builderSteps';
import type { InsertCommand } from '@core/visualBuilder/galleryModel';
import { nameNewState, nextStatePoint } from '@core/visualBuilder/modeTools/stateNaming';
import { addPackObjectAtStep, addShapeAtStep, moveAtStep } from '@core/visualBuilder/sceneEdits';
import type { BuilderCommand } from '@core/visualBuilder/keyboardMap';
import { clampStepIndex } from '@core/visualBuilder/stepEdits';
import type { useVisualBuilder } from './useVisualBuilder';

type Builder = ReturnType<typeof useVisualBuilder>;
type CommandRunners = { [K in BuilderCommand['type']]: (command: Extract<BuilderCommand, { type: K }>) => void };

export interface WorkbenchUi {
  openEditor: () => void;
  openGallery: () => void;
  toggleHelp: () => void;
  togglePlay: () => void;
  startTemplate: (id: string) => void;
}

export function useBuilderActions(spec: VisualSpec, b: Builder, dispatch: (event: ModeEvent) => void, ui: WorkbenchUi) {
  const { selectedId, selectedIds } = b;

  const place = (added: { spec: VisualSpec; id: string }) => {
    b.commit(added.spec);
    b.select(added.id);
    dispatch({ type: 'shapeAdded' });
  };

  const addShape = (shape: BuilderShape) => place(addShapeAtStep(spec, b.stepIndex, shape));

  const insert = (command: InsertCommand) => {
    if (command.kind === 'preset') return addShape(command.shape);
    if (command.kind === 'template') return ui.startTemplate(command.id);
    const added = addPackObjectAtStep(spec, b.stepIndex, command.ref, nextStatePoint(spec, command.ref));
    if (added) place({ ...added, spec: nameNewState(added.spec, added.id) });
  };

  const removeIds = (ids: string[]) => {
    b.commit(deleteElements(spec, ids));
    b.select(null);
  };

  const remove = () => {
    if (selectedId) removeIds(selectedIds);
  };

  const duplicate = () => {
    const copy = selectedId ? duplicateElement(spec, selectedId) : null;
    if (!copy) return;
    b.commit(copy.spec);
    b.select(copy.id);
  };

  const runners: CommandRunners = {
    tool: (command) => dispatch({ type: 'tool', tool: command.tool }),
    add: (command) => addShape(command.shape),
    delete: remove,
    cancel: () => {
      dispatch({ type: 'cancel' });
      b.select(null);
    },
    finish: () => dispatch({ type: 'finish' }),
    edit: ui.openEditor,
    animate: ui.openGallery,
    duplicate,
    undo: b.undo,
    redo: b.redo,
    nudge: (command) => selectedId && b.commit(moveAtStep(spec, b.stepIndex, selectedIds, command.dx, command.dy)),
    newStep: () => b.commit(addBuilderStep(spec)),
    stepPrev: () => b.setStepIndex(clampStepIndex(spec, b.stepIndex - 1)),
    stepNext: () => b.setStepIndex(clampStepIndex(spec, b.stepIndex + 1)),
    playToggle: ui.togglePlay,
    help: ui.toggleHelp,
  };

  const run = (command: BuilderCommand) => (runners[command.type] as (command: BuilderCommand) => void)(command);

  const issueActions: LayoutIssueActions = {
    select: b.select,
    bringInside: (id) => b.commit(bringInside(spec, id)),
    remove: (id) => removeIds([id]),
  };

  return { insert, remove, duplicate, run, issueActions };
}
