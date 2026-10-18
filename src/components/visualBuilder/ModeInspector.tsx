import { useEffect, useState } from 'react';
import { BUILDER_TEXT, INSERT_GALLERY_TEXT, useTranslation } from '@i18n';
import type { VisualElementSpec, VisualSpec } from '@core/types/visualSpec';
import { elementText, resizeElement, setElementStyle, setShapeText } from '@core/visualBuilder/builderEdits';
import { reverseLink, setLinkArrow, setLinkRoute } from '@core/visualBuilder/connectors';
import { MenuButton } from './controls/MenuButton';
import { ToggleButton } from './controls/ToggleButton';
import { BEND_LIMIT, setLinkBend, setLinkLabel } from '@core/visualBuilder/connectors';
import { clearStart, isStateElement, setAccepting, setStart } from '@core/visualBuilder/domains/automaton/automatonFlags';
import { readAutomaton } from '@core/visualBuilder/domains/automaton/automatonModel';
import { elementBox } from '@core/visualBuilder/builderGeometry';
import type { WorkspaceMode } from '@core/visualBuilder/modes/workspaceMode';
import { modeToolState } from '@core/visualBuilder/modeTools/modeToolState';
import { cycleTransitionLabel, labelCycleOf } from '@core/visualBuilder/modeTools/transitionLabels';
import { CompactColorField } from './CompactColorField';
import { SizeControl } from './SizeControl';
import { COLOR_CHOICES } from '@core/visualBuilder/builderColors';
import { TextButton } from './controls/TextButton';
import { ReplaceBar } from './ReplaceBar';
import { ELEMENT_REF, membershipOf, regionCount, setIdsOf } from '@core/visualBuilder/modeTools/vennTools';
import styles from './ModeBar.module.css';
import barStyles from './BuilderWorkbench.module.css';

// Actions the selection row offers; Animate and Delete live in the top toolbar.
export interface SelectionActions {
  onConnect: () => void;
}

interface ModeInspectorProps {
  mode: WorkspaceMode;
  spec: VisualSpec;
  selectedId: string | null;
  onSpec: (spec: VisualSpec) => void;
  replace?: { pending: boolean; accept: () => void; cancel: () => void };
  actions: SelectionActions;
}

function ActionButtons({ actions, connectable }: { actions: SelectionActions; connectable: boolean }) {
  const { val } = useTranslation();
  return connectable ? <TextButton label={val(BUILDER_TEXT.cvConnect)} icon="connect" onClick={actions.onConnect} /> : null;
}

function LinkActions({ spec, id, onSpec, actions }: { spec: VisualSpec; id: string; onSpec: (spec: VisualSpec) => void; actions: SelectionActions }) {
  const { val } = useTranslation();
  const link = spec.elements.find((el) => el.id === id)?.builder?.link;
  const routes = ROUTE_CHOICES.map(({ value, text: name }) => ({ value, label: val(name) }));
  return (
    <>
      {link && <MenuButton label={`${val(BUILDER_TEXT.cvRoute)}: ${routes.find((route) => route.value === (link.route ?? 'straight'))?.label ?? ''}`} items={routes.map((route) => ({ label: route.label, checked: route.value === (link.route ?? 'straight'), onSelect: () => onSpec(setLinkRoute(spec, id, route.value)) }))} />}
      <ToggleButton label={val(BUILDER_TEXT.cvArrowHead)} pressed={link?.arrow ?? false} onClick={() => onSpec(setLinkArrow(spec, id, !(link?.arrow ?? false)))} />
      <TextButton label={val(BUILDER_TEXT.cvReverse)} onClick={() => onSpec(reverseLink(spec, id))} />
      <ActionButtons actions={actions} connectable={false} />
    </>
  );
}

const ROUTE_CHOICES = [
  { value: 'straight' as const, text: BUILDER_TEXT.cvStraight },
  { value: 'elbow' as const, text: BUILDER_TEXT.cvElbow },
  { value: 'curve' as const, text: BUILDER_TEXT.cvCurve },
];

const text = INSERT_GALLERY_TEXT;

// Commits on blur or Enter so one typing session is one undo step.
function LabelField({ value, label, onCommit }: { value: string; label: string; onCommit: (next: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft !== value && onCommit(draft);
  return (
    <label className={styles.field}>
      {label}
      <input type="text" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} />
    </label>
  );
}

function Summary({ mode, spec }: { mode: WorkspaceMode; spec: VisualSpec }) {
  const { val } = useTranslation();
  const state = modeToolState(spec);
  const sets = setIdsOf(spec).length;
  const showSets = mode.inspector.membership && sets > 0;
  const summary = showSets
    ? `${sets} ${val(text.modeSets)} · ${regionCount(sets)} ${val(text.modeRegions)}`
    : `${state.items} ${val(text.modeItems)} · ${state.links} ${val(text.modeLinks)}`;
  return (
    <>
      <span>{summary}</span>
      <span className={styles.muted}>{val(text.modeNothing)}</span>
    </>
  );
}

// Width and height as they were in the old pop-out; a circle keeps its round shape, so either slider sets both sides.
function SizeFields({ spec, id, onSpec }: { spec: VisualSpec; id: string; onSpec: (spec: VisualSpec) => void }) {
  const element = spec.elements.find((el) => el.id === id);
  if (!element) return null;
  const box = elementBox(element);
  const resize = (side: 'w' | 'h', size: number) => onSpec(resizeElement(spec, id, { ...box, ...(element.kind === 'circle' ? { w: size, h: size } : { [side]: size }) }));
  return <SizeControl width={box.w} height={box.h} onResize={resize} />;
}

// Colours this drawing uses most, then the theme colours, so the pop-out always offers a few to pick from.
function usedColoursOf(spec: VisualSpec): string[] {
  const counts = new Map<string, number>();
  for (const el of spec.elements) {
    const colour = el.style?.stroke;
    if (typeof colour === 'string' && colour !== 'none') counts.set(colour, (counts.get(colour) ?? 0) + 1);
  }
  const used = [...counts].sort((a, b) => b[1] - a[1]).map(([colour]) => colour);
  return [...new Set([...used, ...COLOR_CHOICES.map((choice) => choice.value)])].slice(0, 6);
}

function StyleField({ spec, id, onSpec }: { spec: VisualSpec; id: string; onSpec: (spec: VisualSpec) => void }) {
  const { val } = useTranslation();
  const current = spec.elements.find((el) => el.id === id)?.style?.stroke;
  return (
    <CompactColorField
      label={val(text.modeColour)}
      value={typeof current === 'string' ? current : undefined}
      usedColours={usedColoursOf(spec)}
      onChange={(value) => onSpec(setElementStyle(spec, id, { stroke: value, fill: value }))}
    />
  );
}

function Membership({ spec, id }: { spec: VisualSpec; id: string }) {
  const { val } = useTranslation();
  const inside = membershipOf(spec, id);
  const nameOf = (setId: string) => elementText(spec, setId) || setId;
  if (inside.length === 0) return <span className={styles.muted}>{val(text.modeOutside)}</span>;
  return (
    <span className={styles.pills}>
      {inside.map((setId) => <span key={setId} className={styles.pill}>{nameOf(setId)}</span>)}
    </span>
  );
}

// A drag is one undo step: the slider keeps a draft and writes once, on release or key up.
function BendField({ bend, label, onBend }: { bend: number; label: string; onBend: (next: number) => void }) {
  const [draft, setDraft] = useState<number | null>(null);
  const finish = () => {
    if (draft !== null && draft !== bend) onBend(draft);
    setDraft(null);
  };
  return (
    <label className={styles.field}>
      {label}
      <input type="range" min={-BEND_LIMIT} max={BEND_LIMIT} value={draft ?? bend} onChange={(event) => setDraft(Number(event.target.value))} onPointerUp={finish} onKeyUp={finish} onBlur={finish} />
    </label>
  );
}

const isLoopLink = (spec: VisualSpec, id: string): boolean => {
  const link = spec.elements.find((el) => el.id === id)?.builder?.link;
  return link !== undefined && link.from === link.to;
};

function BendRow({ spec, id, onSpec }: { spec: VisualSpec; id: string; onSpec: (spec: VisualSpec) => void }) {
  const { val } = useTranslation();
  const bend = spec.elements.find((el) => el.id === id)?.builder?.link?.bend ?? 0;
  return <BendField bend={bend} label={val(text.modeBend)} onBend={(next) => onSpec(setLinkBend(spec, id, next))} />;
}

function TransitionRow({ mode, spec, id, onSpec }: { mode: WorkspaceMode; spec: VisualSpec; id: string; onSpec: (spec: VisualSpec) => void }) {
  const { val } = useTranslation();
  const cycle = labelCycleOf(mode);
  const current = elementText(spec, `${id}-label`);
  return (
    <>
      <LabelField value={current} label={val(text.modeLabelField)} onCommit={(next) => onSpec(setLinkLabel(spec, id, next))} />
      {!isLoopLink(spec, id) && <BendRow spec={spec} id={id} onSpec={onSpec} />}
      {cycle.length > 0 && <TextButton label={val(text.modeNextSymbol)} onClick={() => onSpec(cycleTransitionLabel(spec, id, cycle))} />}
    </>
  );
}

// Every mode can bend a link; only modes with edge labels also get the label and symbol cycle.
function LinkFields({ mode, spec, id, onSpec, actions }: { mode: WorkspaceMode; spec: VisualSpec; id: string; onSpec: (spec: VisualSpec) => void; actions: SelectionActions }) {
  const body = mode.inspector.edgeLabel ? <TransitionRow mode={mode} spec={spec} id={id} onSpec={onSpec} /> : isLoopLink(spec, id) ? <Summary mode={mode} spec={spec} /> : <BendRow spec={spec} id={id} onSpec={onSpec} />;
  return (
    <>
      {body}
      <LinkActions spec={spec} id={id} onSpec={onSpec} actions={actions} />
    </>
  );
}

// Two flags on a state: start is the single marker placed beside it, accepting swaps the state's drawing.
function StateFlags({ spec, id, onSpec }: { spec: VisualSpec; id: string; onSpec: (spec: VisualSpec) => void }) {
  const { val } = useTranslation();
  const state = readAutomaton(spec).states.find((entry) => entry.id === id);
  return (
    <>
      <label className={styles.field}>
        <input type="checkbox" checked={readAutomaton(spec).start === id} onChange={(event) => onSpec(event.target.checked ? setStart(spec, id) : clearStart(spec))} />
        {val(text.modeStart)}
      </label>
      <label className={styles.field}>
        <input type="checkbox" checked={state?.accepting ?? false} onChange={(event) => onSpec(setAccepting(spec, id, event.target.checked))} />
        {val(text.modeAccepting)}
      </label>
    </>
  );
}

function ObjectFields({ mode, spec, selected, onSpec, actions }: { mode: WorkspaceMode; spec: VisualSpec; selected: VisualElementSpec; onSpec: (spec: VisualSpec) => void; actions: SelectionActions }) {
  const { val } = useTranslation();
  const showSize = mode.inspector.size && selected.kind !== 'path';
  const showMembers = mode.inspector.membership && selected.builder?.pack === ELEMENT_REF;
  return (
    <>
      {mode.inspector.label && <LabelField value={elementText(spec, selected.id)} label={val(BUILDER_TEXT.edText)} onCommit={(next) => onSpec(setShapeText(spec, selected.id, next))} />}
      {mode.inspector.style && <StyleField spec={spec} id={selected.id} onSpec={onSpec} />}
      {showSize && <SizeFields spec={spec} id={selected.id} onSpec={onSpec} />}
      {showMembers && <Membership spec={spec} id={selected.id} />}
      {mode.inspector.stateFlags && isStateElement(selected) && <StateFlags spec={spec} id={selected.id} onSpec={onSpec} />}
      <ActionButtons actions={actions} connectable />
    </>
  );
}

export function ModeInspector({ replace }: Pick<ModeInspectorProps, "replace">) {
  // Asking to replace the drawing takes the row, so the canvas below never moves.
  if (replace?.pending) return <ReplaceBar onReplace={replace.accept} onKeep={replace.cancel} />;
  return null;
}

// The selected object's settings, shown in the top bar so the stage keeps its size when something is selected.
export function SelectionSettings({ mode, spec, selectedId, onSpec, actions }: Omit<ModeInspectorProps, "replace">) {
  const { val } = useTranslation();
  const selected = spec.elements.find((el) => el.id === selectedId);
  if (!selected) return null;
  const isLink = selected.builder?.link !== undefined;
  return (
    <div className={barStyles.selection} aria-label={val(text.modeInspector)}>
      {isLink ? <LinkFields mode={mode} spec={spec} id={selected.id} onSpec={onSpec} actions={actions} /> : <ObjectFields mode={mode} spec={spec} selected={selected} onSpec={onSpec} actions={actions} />}
    </div>
  );
}
