import { useMemo, useState, useRef, type RefObject } from 'react';
import type { LinkRoute, VisualSpec } from '@core/types/visualSpec';
import { canAddLabel, elementText, setShapeText } from '@core/visualBuilder/builderEdits';
import type { BuilderMode, ModeEvent } from '@core/visualBuilder/builderMode';
import { sceneSpecAt } from '@core/visualBuilder/scene';
import { centerInView } from '@core/visualBuilder/stageAnchor';
import { findLayoutIssues } from '@core/validation/visualSpec/visualSpecLayout';
import { BuilderCanvas } from './BuilderCanvas';
import { CanvasContextMenu } from './CanvasContextMenu';
import { InlineTextEditor } from './InlineTextEditor';
import { doubleClickAction, type DoubleClickKind } from './doubleClickAction';
import { QuickAddMenu } from './QuickAddMenu';
import { useVisualBuilderContextMenu } from './useContextMenu';
import { useDragCursor } from './useDragCursor';
import { useBuilderNames } from './useBuilderNames';
import { useStagePosition } from './useStagePosition';
import type { useVisualBuilder } from './useVisualBuilder';
import styles from './BuilderWorkbench.module.css';

interface CanvasStageProps {
  spec: VisualSpec;
  b: ReturnType<typeof useVisualBuilder>;
  mode: BuilderMode;
  stateFlags: boolean;
  dispatch: (event: ModeEvent) => void;
  editing: boolean;
  ghosts: boolean;
  onEdit: () => void;
  onCloseEdit: () => void;
  onAnimate: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onInsert: () => void;
}

// What sits under the pointer on a selection; a double-click uses its kind to pick the action.
export type FloatingTarget = { kind: 'shape'; color: string; canLabel: boolean } | { kind: 'link'; route: LinkRoute; arrow: boolean; label: string };



const PILL_MODE: Record<BuilderMode['kind'], string> = { select: 'select', quickAdd: 'select', connect: 'connect', drag: 'drag', walk: 'walk', pickSpot: 'walk', pickTarget: 'pick' };

function floatingTarget(spec: VisualSpec, id: string | null): FloatingTarget | null {
  const element = spec.elements.find((candidate) => candidate.id === id);
  if (!element) return null;
  const link = element.builder?.link;
  if (!link) return { kind: 'shape', color: String(element.style?.stroke ?? ''), canLabel: canAddLabel(spec, element.id) };
  const label = spec.elements.find((candidate) => candidate.id === `${id}-label`);
  return { kind: 'link', route: link.route ?? 'straight', arrow: link.arrow, label: label?.content ?? '' };
}

// The object under the selection, for a double-click: the lookup table decides what it does.
export interface Selection {
  id: string;
  target: FloatingTarget;
}

function selectionOf(spec: VisualSpec, id: string | null): Selection | null {
  const target = id ? floatingTarget(spec, id) : null;
  return id && target ? { id, target } : null;
}

// Where the quick-add menu and the text editor sit, in pixels inside the stage.
function useOverlayPlaces(stage: RefObject<HTMLElement>, { spec, b, mode }: Pick<CanvasStageProps, 'spec' | 'b' | 'mode'>, textId: string | null) {
  const quickAt = useStagePosition(stage, mode.kind === 'quickAdd' ? mode.at : null);
  const textAt = useStagePosition(stage, textId ? centerInView(spec, textId) : null);
  return { selection: selectionOf(spec, b.selectedId), quickAt, textAt };
}

// The lookup table decides what a double-click does; the stage only carries it out.
function onStageDoubleClick(selection: Selection | null, openText: (id: string) => void): void {
  const kind: DoubleClickKind = selection?.target.kind ?? 'background';
  if (selection && doubleClickAction(kind) === 'text') openText(selection.id);
}

function ContextMenuOverlay({ stage, context }: { stage: RefObject<HTMLElement>; context: ReturnType<typeof useVisualBuilderContextMenu> }) {
  const at = useStagePosition(stage, context.menu?.at ?? null);
  if (!context.menu || !at || context.items.length === 0) return null;
  return <CanvasContextMenu x={at.x} y={at.y} items={context.items} onChoose={(item) => context.choose(item.action)} onClose={context.close} />;
}

export function CanvasStage(props: CanvasStageProps) {
  const { spec, b, mode, dispatch } = props;
  const stageRef = useRef<HTMLDivElement>(null);
  const cursor = useDragCursor(mode.kind === 'drag', stageRef);
  const [textId, setTextId] = useState<string | null>(null);
  const sceneSpec = useMemo(() => sceneSpecAt(spec, b.stepIndex), [spec, b.stepIndex]);
  const { selection, quickAt, textAt } = useOverlayPlaces(stageRef, { ...props, spec: sceneSpec }, textId);
  const id = b.selectedId;
  const context = useVisualBuilderContextMenu({ spec, b, dispatch, ui: props }, mode, props.stateFlags);
  const names = useBuilderNames();

  return (
    <>
      <div className={styles.stage} ref={stageRef} onDoubleClick={() => onStageDoubleClick(selection, setTextId)}>
      {mode.kind !== 'select' && (
        <p className={styles.pill} data-mode={PILL_MODE[mode.kind]} aria-live="polite">
          {names.hintOf(mode, spec)}
        </p>
      )}
      <BuilderCanvas
        spec={spec}
        selectedId={id}
        selectedIds={b.selectedIds}
        problemIds={findLayoutIssues(spec).flatMap((issue) => issue.ids)}
        mode={mode}
        snap={b.snap}
        cursor={cursor}
        stepIndex={b.stepIndex}
        ghosts={props.ghosts}
        onSelect={b.select}
        onToggle={b.toggleSelect}
        onSelectMany={b.selectMany}
        onCommit={b.commit}
        dispatch={dispatch}
        onContextMenu={context.open}
      />
      {mode.kind === 'quickAdd' && quickAt && (
        <QuickAddMenu x={quickAt.x} y={quickAt.y} onChoose={(shape) => dispatch({ type: 'quickAddChosen', shape })} onCancel={() => dispatch({ type: 'cancel' })} />
      )}
      {textId && textAt && (
        <InlineTextEditor
          key={textId}
          x={textAt.x}
          y={textAt.y}
          initial={elementText(spec, textId)}
          onCommit={(text) => {
            b.commit(setShapeText(spec, textId, text));
            setTextId(null);
          }}
          onCancel={() => setTextId(null)}
          onFinish={() => setTextId(null)}
        />
      )}
      <ContextMenuOverlay stage={stageRef} context={context} />
      </div>
    </>
  );
}
