import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { VisualSpec } from '@core/types/visualSpec';
import type { ModeEvent } from '@core/visualBuilder/builderMode';
import { addBuilderStep } from '@core/visualBuilder/builderSteps';
import { stepPlayMs } from '@core/visualBuilder/laneEdits';
import { applyEffect, objectKindOf, type EffectDef, type EffectId, type ObjectKind } from '@core/visualBuilder/effects';
import { parseViewBox } from '@core/shared/stageSize';
import { useTranslation } from '@i18n';
import { buildTemplate, templateByRef } from '@core/visualBuilder/diagramPacks/buildTemplate';
import { STARTER_ACTION_PREFIX } from '@core/visualBuilder/modes/workspaceMode';
import { connectArrowOf } from '@core/visualBuilder/modeTools/linkStyle';
import { autoLabelCycleOf } from '@core/visualBuilder/modeTools/transitionLabels';
import { clearedSpec, runModeAction } from '@core/visualBuilder/modeTools/modeToolState';
import { AnimationGallery } from './AnimationGallery';
import { useReplaceConfirm } from './useReplaceConfirm';
import { CanvasStage } from './CanvasStage';
import { cssVariable } from './cssVariables';
import type { BuilderLayout } from './builderLayout';
import { PreviewPane } from './PreviewPane';
import { ShortcutSheet } from './ShortcutSheet';
import { TimelinePanel } from './TimelinePanel';
import { ModeInspector, SelectionSettings } from './ModeInspector';
import { ModeStarter } from './ModeStarter';
import { TopBar } from './TopBar';
import { useWorkspaceMode } from './useWorkspaceMode';
import { useBuilderActions } from './useBuilderActions';
import { useBuilderKeys } from './useBuilderKeys';
import { useBuilderMode } from './useBuilderMode';
import { useModeEffects } from './useModeEffects';
import { usePlayheadState } from '@engine/visualStepPlayer';
import { useVisualBuilder } from './useVisualBuilder';
import styles from './BuilderWorkbench.module.css';

interface BuilderWorkbenchProps {
  spec: VisualSpec;
  previewSpec: VisualSpec;
  onChange: (spec: VisualSpec) => void;
  projectSlot?: ReactNode;
  /** An action shown in the top toolbar row, such as Done editing. */
  actionSlot?: ReactNode;
  /** Keeps the canvas visible but makes every control and the stage non-interactive. */
  readOnly?: boolean;
}

const selectionKindOf = (spec: VisualSpec, id: string | null): ObjectKind | null => {
  const selected = spec.elements.find((el) => el.id === id);
  return selected ? objectKindOf(selected) : null;
};

const stageRatio = (spec: VisualSpec) => {
  const { w, h } = parseViewBox(spec.viewBox);
  return cssVariable('--stage-ratio', String(h / w));
};

type AskReplace = (run: () => void) => void;

function startFrom(ref: string, lang: string, commit: (next: VisualSpec) => void, ask: AskReplace): void {
  const template = templateByRef(ref);
  if (template) ask(() => commit(buildTemplate(template.def, lang)));
}

// A mode starter is a template or an action that builds the starting drawing itself. Choosing a mode replaces the drawing at once;
// the commit is one undo step, so nothing is lost and the mode never waits on a question.
function loadStarter(ref: string, spec: VisualSpec, lang: string, commit: (next: VisualSpec) => void): void {
  const now: AskReplace = (run) => run();
  if (!ref.startsWith(STARTER_ACTION_PREFIX)) return startFrom(ref, lang, commit, now);
  commit(runModeAction(ref.slice(STARTER_ACTION_PREFIX.length), clearedSpec(spec), lang));
}

function useGallery() {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const show = () => {
    opener.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  };
  // Focus goes back to whatever opened the gallery (the Animate button, usually).
  const close = () => {
    setOpen(false);
    opener.current?.focus();
  };
  return { open, show, close };
}

// What the gallery's cards do; each closes the gallery afterwards. Applying never restarts or plays the preview: the editor stays on the current step.
function galleryHandlers(spec: VisualSpec, b: ReturnType<typeof useVisualBuilder>, dispatch: (event: ModeEvent) => void, close: () => void) {
  const onApply = (effect: EffectId) => {
    if (b.selectedId) {
      b.commit(applyEffect(spec, b.stepIndex, effect, b.selectedId));
    }
    close();
  };
  const onPick = (effect: EffectDef) => {
    dispatch({ type: 'startPickTarget', effect: effect.id, kinds: effect.kinds });
    close();
  };
  return { onApply, onPick };
}

// React 18 types have no `inert` prop; the attribute is still rendered and honoured by browsers.
const inertWhen = (readOnly: boolean): { inert?: string } => (readOnly ? { inert: '' } : {});

export function BuilderWorkbench({ spec, previewSpec, onChange, projectSlot, actionSlot, readOnly = false }: BuilderWorkbenchProps) {
  const animateAnchor = useRef<HTMLSpanElement>(null);
  const { lang } = useTranslation();
  const workspace = useWorkspaceMode();
  const b = useVisualBuilder(spec, onChange, { modeId: workspace.mode.id, onModeChange: (id) => workspace.chooseMode(id) });
  const [insertRequest, setInsertRequest] = useState(0);
  const playhead = usePlayheadState(b.stepIndex);
  // Only play edges re-render the workbench; the timeline's Play button reads this.
  const [playing, setPlaying] = useState(false);
  const togglePreviewPlay = () => previewRef.current?.querySelector<HTMLButtonElement>('#btn-play-pause')?.click();
  const [stepPlayCount, setStepPlayCount] = useState(0);
  const { release: releaseScrub } = playhead;
  const onPreviewPlaying = useCallback((on: boolean) => {
    setPlaying(on);
    if (on) releaseScrub();
  }, [releaseScrub]);
  const playThisStep = () => setStepPlayCount((count) => count + 1);
  const onTimelinePlay = () => (playing ? togglePreviewPlay() : playThisStep());
  const { mode, dispatch } = useBuilderMode(useModeEffects(spec, b, autoLabelCycleOf(workspace.mode), connectArrowOf(workspace.mode), lang));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingModeId, setEditingModeId] = useState(workspace.mode.id);
  // Same rule as the selection: a mode change ends any open editor, so the same shape reselected later stays closed.
  if (editingModeId !== workspace.mode.id) {
    setEditingModeId(workspace.mode.id);
    setEditingId(null);
  }
  const [helpOpen, setHelpOpen] = useState(false);
  const [layout, setLayout] = useState<BuilderLayout>('split');
  const [ghosts, setGhosts] = useState(false);
  const gallery = useGallery();
  const previewRef = useRef<HTMLElement>(null);

  // The editor belongs to the shape it was opened on; selecting another shape closes it.
  const editing = editingId !== null && editingId === b.selectedId;
  const openEditor = () => setEditingId(b.selectedId);
  const toggleHelp = () => setHelpOpen((open) => !open);

  const replace = useReplaceConfirm(spec.elements.length > 0);
  const startFromRef = (ref: string) => loadStarter(ref, spec, lang, b.commit);
  const actions = useBuilderActions(spec, b, dispatch, {
    openEditor,
    openGallery: gallery.show,
    toggleHelp,
    startTemplate: (id) => startFrom(id, lang, b.commit, replace.ask),
    togglePlay: togglePreviewPlay,
  });
  useBuilderKeys({ hasSelection: b.selectedId !== null, mode: mode.kind }, actions.run, !editing && !gallery.open);

  return (
    <div className={styles.workbench} data-workbench {...inertWhen(readOnly)}>
      <TopBar
        animateAnchor={animateAnchor}
        canRemove={b.selectedId !== null}
        selectionSlot={b.selectedId === null ? undefined : <SelectionSettings mode={workspace.mode} spec={spec} selectedId={b.selectedId} onSpec={b.commit} actions={{ onConnect: () => dispatch({ type: 'startConnectFrom', id: b.selectedId ?? '' }) }} />}
        onRemove={actions.remove}
        actionSlot={actionSlot}
        tool={mode.kind === 'connect' ? 'connect' : 'select'}
        snap={b.snap}
        canUndo={b.canUndo}
        canRedo={b.canRedo}
        onTool={(tool) => dispatch({ type: 'tool', tool })}
        stepNumber={b.stepIndex + 1}
        insertRequest={insertRequest}
        onInsert={actions.insert}
        canAnimate={b.selectedId !== null}
        onAnimate={gallery.show}
        onUndo={b.undo}
        onRedo={b.redo}
        onSnap={b.setSnap}
        onHelp={toggleHelp}
        layout={layout}
        onLayout={setLayout}
        workspace={{ mode: workspace.mode, modes: workspace.modes, showAll: workspace.showAll, onMode: (id) => workspace.chooseMode(id, startFromRef), onShowAll: workspace.setShowAll }}
        projectSlot={projectSlot}
      />
      <div className={styles.bench} data-layout={layout} style={stageRatio(spec)}>
        <section className={styles.buildColumn} aria-label="Build">
          <ModeInspector replace={replace} />
          <ModeStarter mode={workspace.mode} empty={spec.elements.length === 0} onStart={startFromRef} />
          <CanvasStage
            spec={spec}
            b={b}
            mode={mode}
            stateFlags={workspace.mode.inspector.stateFlags === true}
            dispatch={dispatch}
            editing={editing}
            ghosts={ghosts}
            onEdit={openEditor}
            onCloseEdit={() => setEditingId(null)}
            onAnimate={gallery.show}
            onRemove={actions.remove}
            onDuplicate={actions.duplicate}
            onInsert={() => setInsertRequest((count) => count + 1)}
          />
        </section>
        <PreviewPane ref={previewRef} previewSpec={previewSpec} layoutSpec={spec} stepIndex={b.stepIndex} onStepChange={b.setStepIndex} scrubMs={playhead.scrubMs} onProgress={playhead.follow} onPlayingChange={onPreviewPlaying} stepMs={stepPlayMs(spec, b.stepIndex)} playhead={playhead.store} onScrub={playhead.scrub} playStepCount={stepPlayCount} issueActions={actions.issueActions} />
        <TimelinePanel spec={spec} stepIndex={b.stepIndex} selectedId={b.selectedId} onStepIndex={b.setStepIndex} onCommit={b.commit} onNewStep={() => b.commit(addBuilderStep(spec))} onSelectTarget={b.select} playhead={playhead.store} onScrub={playhead.scrub} playing={playing} onPlay={onTimelinePlay} ghosts={ghosts} onGhosts={setGhosts} />
      </div>
      {gallery.open && (
        <AnimationGallery anchor={animateAnchor} selectionKind={selectionKindOf(spec, b.selectedId)} {...galleryHandlers(spec, b, dispatch, gallery.close)} onClose={gallery.close} allowedEffects={workspace.showAll ? undefined : workspace.mode.filters.effects} />
      )}
      {helpOpen && <ShortcutSheet onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
