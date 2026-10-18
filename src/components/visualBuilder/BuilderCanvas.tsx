import { memo, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { BUILDER_TEXT, useTranslation } from '@i18n';
import { renderStageElement } from '@engine/visualStepPlayer';
import type { Point } from '@core/geometry/geometryPrimitives';
import type { VisualElementSpec, VisualSpec } from '@core/types/visualSpec';
import { SIDES, boxCenter, elementBox, type GeometryBox } from '@core/visualBuilder/builderGeometry';
import { elementPortPoint } from '@core/visualBuilder/elementPortPoint';
import type { BuilderMode, ModeEvent } from '@core/visualBuilder/builderMode';
import { hasPorts } from '@core/visualBuilder/connectable';
import { objectKindOf, type ObjectKind } from '@core/visualBuilder/effects';
import { hitTest, type Hit } from '@core/visualBuilder/hitTest';
import type { Lifecycle } from '@core/visualBuilder/lifecycle';
import { CANVAS_GRID_UNITS, applyDrag } from '@core/visualBuilder/dragEdits';
import { sceneAt } from '@core/visualBuilder/scene';
import { applyDragAtStep } from '@core/visualBuilder/sceneEdits';
import { parseViewBox } from '@core/shared/stageSize';
import { nearestSide } from '@core/visualBuilder/viewMath';
import { isOutside } from '@core/visualBuilder/worldBounds';
import { editingView } from './canvasView';
import { ZoomControls } from './ZoomControls';
import { MoveTrails } from './MoveTrails';
import { useCanvasDrag } from './useCanvasDrag';
import { useCanvasPointer } from './useCanvasPointer';
import { rubberBox, useVisualBuilderMarquee } from './useMarquee';
import { shapesInBox } from '@core/visualBuilder/shapesInBox';
import { useConnectDrag } from './useConnectDrag';
import { useCanvasCamera } from './useCanvasCamera';
import styles from './VisualBuilder.module.css';
import { useGridMode } from './gridPreference';

interface BuilderCanvasProps {
  spec: VisualSpec;
  selectedId: string | null;
  selectedIds?: string[];
  problemIds: string[];
  mode: BuilderMode;
  snap: boolean;
  cursor: Point | null;
  stepIndex?: number;
  ghosts: boolean;
  onSelect: (id: string | null) => void;
  onToggle?: (id: string) => void;
  onSelectMany?: (ids: string[]) => void;
  onCommit: (spec: VisualSpec) => void;
  dispatch: (event: ModeEvent) => void;
  onContextMenu?: (hit: Hit, point: Point) => void;
}

interface FrameProps {
  box: GeometryBox;
  padding: number;
  stroke: string;
  dashed?: boolean;
  extra?: Record<string, string | null>;
}

const GREEN = 'var(--accent-green)';
const isHelper = (el: VisualElementSpec): boolean => el.builder?.say === true || el.builder?.parent !== undefined || el.builder?.fx === true;
// Say bubbles and effect tokens belong to Preview; drawn here at rest they would be stray dots that the scene never moves.
const isDrawnOnCanvas = (el: VisualElementSpec): boolean => !el.builder?.say && !el.builder?.fx;
const findElement = (spec: VisualSpec, id: string | null): VisualElementSpec | undefined => spec.elements.find((el) => el.id === id);
const text = BUILDER_TEXT;

const CanvasElement = memo(function CanvasElement({ element, state }: { element: VisualElementSpec; state?: Lifecycle }) {
  const shown = useMemo(() => editingView(element, state), [element, state]);
  const drawn = renderStageElement(shown, { pointerEvents: 'none' });
  if (!state || state === 'live') return drawn;
  return <g className={styles.lifeFaint} data-lifecycle={state}>{drawn}</g>;
});

function LifecycleFrames({ elements, states }: { elements: VisualElementSpec[]; states: Map<string, Lifecycle> | null }) {
  if (!states) return null;
  const faint = elements.filter((el) => states.get(el.id) !== 'live' && !el.builder?.link && !el.builder?.parent && !el.builder?.fx);
  const faintArrows = elements.filter((el) => el.builder?.link && states.get(el.id) !== 'live');
  return (
    <>
      {faint.map((el) => (
        <Frame key={`life-${el.id}`} extra={{ className: styles.lifeFrame }} box={elementBox(el)} padding={3} stroke="currentColor" dashed />
      ))}
      {faintArrows.map((el) => (
        <path key={`life-${el.id}`} className={styles.lifeFrame} d={String(el.attrs.d ?? '')} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="5 4" pointerEvents="none" />
      ))}
    </>
  );
}

function Frame({ box, padding, stroke, dashed, extra }: FrameProps) {
  return (
    <rect
      {...extra}
      pointerEvents="none"
      x={box.x - padding}
      y={box.y - padding}
      width={box.w + padding * 2}
      height={box.h + padding * 2}
      rx={dashed ? 0 : 10}
      fill="none"
      stroke={stroke}
      strokeWidth={dashed ? 2 : 3}
      strokeDasharray={dashed ? '5 4' : undefined}
    />
  );
}

function ProblemFrames({ elements, ids }: { elements: VisualElementSpec[]; ids: string[] }) {
  return (
    <>
      {elements
        .filter((el) => ids.includes(el.id))
        .map((el) => (
          <Frame key={`problem-${el.id}`} extra={{ 'data-problem': el.id }} box={elementBox(el)} padding={5} stroke="var(--accent-danger)" dashed />
        ))}
    </>
  );
}

function GroupFrames({ spec, ids }: { spec: VisualSpec; ids: string[] }) {
  return (
    <>
      {spec.elements
        .filter((el) => ids.includes(el.id))
        .map((el) => (
          <Frame key={`group-${el.id}`} extra={{ 'data-group': el.id }} box={elementBox(el)} padding={4} stroke="var(--accent)" dashed />
        ))}
    </>
  );
}

function MarqueeFrame({ rubber }: { rubber: { start: Point; end: Point } | null }) {
  if (!rubber) return null;
  const box = rubberBox(rubber);
  return <rect data-marquee x={box.x} y={box.y} width={box.w} height={box.h} fill="var(--accent)" fillOpacity={0.08} stroke="var(--accent)" strokeDasharray="4 3" pointerEvents="none" />;
}

function SelectionOverlay({ selected, single }: { selected: VisualElementSpec | undefined; single: boolean }) {
  if (!selected) return null;
  const box = elementBox(selected);
  return (
    <>
      <Frame box={box} padding={4} stroke="var(--accent)" dashed />
      {single && !selected.builder?.link && <circle data-handle="resize" pointerEvents="none" cx={box.x + box.w + 4} cy={box.y + box.h + 4} r={8} fill="var(--accent)" />}
    </>
  );
}

const PORT_DOT_PX = 4;
const PORT_HIT_PX = 9;

// Ports belong to the Arrow tool: the hovered or selected shape shows them, and every shape while an arrow is being dragged.
function portShapeIds(spec: VisualSpec, mode: BuilderMode, selectedId: string | null, hoverId: string | null): string[] {
  if (mode.kind !== 'connect' && mode.kind !== 'drag') return [];
  const shapes = spec.elements.filter((el) => !el.builder?.link && !isHelper(el) && hasPorts(el));
  if (mode.kind === 'drag') return shapes.map((el) => el.id);
  return shapes.filter((el) => el.id === selectedId || el.id === hoverId).map((el) => el.id);
}

function Ports({ spec, ids, radius }: { spec: VisualSpec; ids: string[]; radius: number }) {
  return (
    <>
      {spec.elements
        .filter((el) => ids.includes(el.id))
        .flatMap((el) =>
          SIDES.map((side) => {
            const point = elementPortPoint(el, side);
            return <circle key={`${el.id}-${side}`} data-port={el.id} data-side={side} className={styles.port} cx={point.x} cy={point.y} r={radius} />;
          }),
        )}
    </>
  );
}

// The dashed line from the grabbed port (or the shape centre) to the cursor, or to the snapped port of the shape under it.
function RubberBand({ spec, mode, cursor }: { spec: VisualSpec; mode: BuilderMode; cursor: Point | null }) {
  if (mode.kind !== 'drag' || !cursor) return null;
  const from = findElement(spec, mode.from);
  if (!from) return null;
  const fromBox = elementBox(from);
  const start = mode.side ? elementPortPoint(from, mode.side) : boxCenter(fromBox);
  const over = mode.over ? findElement(spec, mode.over) : undefined;
  const end = over ? elementPortPoint(over, nearestSide(elementBox(over), cursor)) : cursor;
  return <path data-rubber className={styles.rubber} d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`} />;
}

function pickTargets(spec: VisualSpec, kinds: readonly ObjectKind[]): VisualElementSpec[] {
  return spec.elements.filter((el) => kinds.includes(objectKindOf(el)) && !isHelper(el));
}

// Green frames: the first shape of a click-then-click connection, the shape a dragged connection would land on, and the targets an animation can be picked from.
function ConnectFrames({ spec, mode }: { spec: VisualSpec; mode: BuilderMode }) {
  const framed = (id: string | null, marker: 'data-connect-from' | 'data-connect-target') => {
    const el = findElement(spec, id);
    return el ? <Frame key={`${marker}-${id}`} box={elementBox(el)} padding={6} stroke={GREEN} extra={{ [marker]: id }} /> : null;
  };
  if (mode.kind === 'connect') return framed(mode.from, 'data-connect-from');
  if (mode.kind === 'drag') return framed(mode.over, 'data-connect-target');
  if (mode.kind !== 'pickTarget') return null;
  return (
    <>
      {pickTargets(spec, mode.kinds).map((el) => (
        <Frame key={`pick-${el.id}`} box={elementBox(el)} padding={6} stroke={GREEN} extra={{ 'data-pick-target': el.id }} />
      ))}
    </>
  );
}

// The real stage is the spec viewBox; everything around it is hatched and never shown in the player.
function StageSurface({ width, height }: { width: number; height: number }) {
  const grid = useGridMode();
  return (
    <>
      <defs>
        <pattern id="wb-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="14" stroke="var(--border-color)" strokeWidth="3" />
        </pattern>
        <pattern id="wb-grid" width={CANVAS_GRID_UNITS} height={CANVAS_GRID_UNITS} patternUnits="userSpaceOnUse">
          <path d={`M ${CANVAS_GRID_UNITS} 0 L 0 0 0 ${CANVAS_GRID_UNITS}`} fill="none" stroke="var(--wb-grid, var(--border-subtle))" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </pattern>
        <pattern id="wb-dots" width={CANVAS_GRID_UNITS} height={CANVAS_GRID_UNITS} patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="1.2" fill="var(--wb-grid, var(--border-subtle))" />
        </pattern>
      </defs>
      <rect data-outside-surface x={-60000} y={-60000} width={120000 + width} height={120000 + height} fill="url(#wb-hatch)" pointerEvents="none" />
      <rect width={width} height={height} fill="var(--wb-canvas, var(--bg-secondary))" pointerEvents="none" />
      {grid !== 'none' && <rect width={width} height={height} fill={grid === 'dots' ? 'url(#wb-dots)' : 'url(#wb-grid)'} pointerEvents="none" />}
    </>
  );
}


function OutsideWarnings({ elements, width, height, scale }: { elements: VisualElementSpec[]; width: number; height: number; scale: number }) {
  const { val } = useTranslation();
  const outside = elements.filter((el) => !el.builder?.say && isOutside(elementBox(el), { w: width, h: height }));
  return (
    <>
      {outside.map((el) => (
        <text key={`outside-${el.id}`} data-outside={el.id} className={styles.outsideWarning} x={elementBox(el).x} y={elementBox(el).y - 6 / scale} fontSize={14 / scale}>
          {val(text.cvOutsideStage)}
        </text>
      ))}
    </>
  );
}

interface CanvasScene {
  full: VisualSpec;
  live: VisualSpec;
  states: Map<string, Lifecycle> | null;
}

// Without a step the canvas shows the base spec, as it did before scenes existed.
function sceneOf(spec: VisualSpec, stepIndex: number | undefined): CanvasScene {
  if (stepIndex === undefined) return { full: spec, live: spec, states: null };
  const entries = sceneAt(spec, stepIndex);
  const states = new Map<string, Lifecycle>(entries.map((entry) => [entry.element.id, entry.state]));
  const full: VisualSpec = { ...spec, elements: entries.map((entry) => entry.element) };
  return { full, live: liveOf(full, states), states };
}

function liveOf(spec: VisualSpec, states: Map<string, Lifecycle> | null): VisualSpec {
  if (!states) return spec;
  return { ...spec, elements: spec.elements.filter((el) => states.get(el.id) === 'live') };
}

export function BuilderCanvas(props: BuilderCanvasProps) {
  const { spec, selectedId, mode, cursor, ghosts } = props;
  const selectedIds = props.selectedIds ?? (selectedId ? [selectedId] : []);
  const { val } = useTranslation();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const { w: viewWidth, h: viewHeight } = parseViewBox(spec.viewBox);
  const view = useCanvasCamera({ w: viewWidth, h: viewHeight });
  const { toPoint, camera } = view;
  const portRadius = PORT_HIT_PX / camera.s;

  // Hit testing and every handle use the live scene only, so a removed object cannot be clicked, dragged or rubber-banded.
  const scene = useMemo(() => sceneOf(spec, props.stepIndex), [spec, props.stepIndex]);
  const { states, live: liveSpec } = scene;
  const { drag, startDrag } = useCanvasDrag(props.snap, toPoint, (finished) => props.onCommit(applyDragAtStep(spec, props.stepIndex, finished)));
  const viewSpec = drag ? applyDrag(scene.full, drag) : scene.full;
  const viewLive = liveOf(viewSpec, states);
  const shown = ghosts ? viewSpec.elements : viewLive.elements;

  const { rubber, startMarquee } = useVisualBuilderMarquee(toPoint, (area, additive) => {
    if (!area) return additive ? undefined : props.onSelect(null);
    const picked = shapesInBox(liveSpec, area);
    props.onSelectMany?.(additive ? [...new Set([...selectedIds, ...picked])] : picked);
  });
  const onPointerDown = useCanvasPointer({ spec: liveSpec, selectedId, selectedIds, hoverId, mode, toPoint, portRadius, startDrag, startMarquee, dispatch: props.dispatch, onSelect: props.onSelect, onToggle: props.onToggle ?? props.onSelect });
  useConnectDrag(liveSpec, mode, toPoint, props.dispatch);
  const onMouseDown = (event: ReactMouseEvent) => (event.button === 1 ? view.startPan(event) : onPointerDown(event));

  const onMouseMove = (event: ReactMouseEvent) => {
    const hit = hitTest(liveSpec, toPoint(event.clientX, event.clientY), { selectedId, hoverId, arrow: mode.kind === 'connect', portRadius });
    setHoverId(hit.kind === 'shape' || hit.kind === 'port' ? hit.id : null);
  };

  const onContextMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
    const point = toPoint(event.clientX, event.clientY);
    props.onContextMenu?.(hitTest(liveSpec, point, { selectedId, hoverId }), point);
  };

  const className = mode.kind === 'select' ? styles.canvas : `${styles.canvas} ${styles.canvasCrosshair}`;
  const box = view.viewBox;
  const viewBox = box ? `${box.x} ${box.y} ${box.w} ${box.h}` : spec.viewBox;
  return (
    <div ref={view.wrapRef} className={styles.canvasWrap} data-panning={view.panning ? '1' : undefined}>
      <svg className={className} viewBox={viewBox} preserveAspectRatio="none" role="img" aria-label={val(text.cvCanvasLabel)}onMouseDown={onMouseDown} onMouseMove={onMouseMove} onContextMenu={onContextMenu} onAuxClick={(event) => event.preventDefault()}>
        <StageSurface width={viewWidth} height={viewHeight} />
        <MoveTrails spec={spec} stepIndex={props.stepIndex} enabled={ghosts} />
        {shown.filter(isDrawnOnCanvas).map((el) => <CanvasElement key={el.id} element={el} state={states?.get(el.id)} />)}
        <LifecycleFrames elements={shown} states={states} />
        <ProblemFrames elements={viewLive.elements} ids={props.problemIds} />
        <GroupFrames spec={viewLive} ids={selectedIds.filter((id) => id !== selectedId)} />
        <SelectionOverlay selected={findElement(viewLive, selectedId)} single={selectedIds.length <= 1} />
        <MarqueeFrame rubber={rubber} />
        <Ports spec={viewLive} ids={portShapeIds(viewLive, mode, selectedId, hoverId)} radius={PORT_DOT_PX / camera.s} />
        <RubberBand spec={viewLive} mode={mode} cursor={cursor} />
        <ConnectFrames spec={viewLive} mode={mode} />
        <OutsideWarnings elements={viewLive.elements} width={viewWidth} height={viewHeight} scale={camera.s} />
        <rect data-boundary className={styles.boundary} width={viewWidth} height={viewHeight} />
      </svg>
      <div className={styles.canvasHud}>
        <span className={styles.canvasReadout} title={val(text.cvZoomHint)}>{val(text.cvZoomReadout).replace('{percent}', String(Math.round(camera.s * 100)))}</span>
        <ZoomControls onFit={view.fit} onActualSize={view.actualSize} onZoomIn={view.zoomIn} onZoomOut={view.zoomOut} />
      </div>
    </div>
  );
}
