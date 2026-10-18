import { useCallback, useMemo, useRef, useState } from 'react';
import type { VisualSpec } from '@core/types/visualSpec';
import { blocksOf, updateBlock } from '@core/visualBuilder/blocks';
import { laneEffectId, laneLook } from '@core/visualBuilder/effects';
import { lanesOf, setBlockTiming, stepPlayMs, stepRulerMs } from '@core/visualBuilder/laneEdits';
import { packTracks } from '@core/visualBuilder/laneTracks';
import { useTranslation } from '@i18n';
import { useBuilderNames } from './useBuilderNames';
import { ToggleButton } from './controls/ToggleButton';
import { cssVariable } from './cssVariables';
import { StepMeta } from './StepMeta';
import { StepTabs } from './StepTabs';
import { TimelineClip } from './TimelineClip';
import { TimelineClipMenu } from './TimelineClipMenu';
import { TimelinePlayhead } from './TimelinePlayhead';
import { TimelineTransport } from './TimelineTransport';
import { GUTTER_PX, rulerLengthMs, tickMsFor } from './timelineGeometry';
import { useElementWidth } from './useElementWidth';
import { useTimelineEdits } from './useTimelineEdits';
import { useTimelineKeys } from './useTimelineKeys';
import { useTimelineZoom } from './useTimelineZoom';
import { createPlayheadStore, type PlayheadStore } from '@engine/visualStepPlayer';
import workbench from './BuilderWorkbench.module.css';
import styles from './TimelinePanel.module.css';

interface TimelinePanelProps {
  spec: VisualSpec;
  stepIndex: number;
  selectedId: string | null;
  onStepIndex: (index: number) => void;
  onCommit: (spec: VisualSpec) => void;
  onNewStep: () => void;
  onSelectTarget: (id: string) => void;
  playhead?: PlayheadStore;
  playing?: boolean;
  onPlay?: () => void;
  onScrub?: (ms: number) => void;
  ghosts: boolean;
  onGhosts: (on: boolean) => void;
}

const noScrub = (): void => undefined;
const idlePlayhead = createPlayheadStore();

// Only a callout carries text of its own; the field edits that block's text.
function calloutText(spec: VisualSpec, stepIndex: number, blockIndex: number | null, onCommit: (next: VisualSpec) => void) {
  const block = blockIndex === null ? undefined : blocksOf(spec.steps[stepIndex])[blockIndex];
  if (blockIndex === null || block?.action !== 'callout') return undefined;
  return { value: block.text ?? '', onCommit: (text: string) => onCommit(updateBlock(spec, stepIndex, blockIndex, { text })) };
}

export function TimelinePanel({ spec, stepIndex, selectedId, onStepIndex, onCommit, onNewStep, onSelectTarget, playhead = idlePlayhead, playing = false, onPlay = noScrub, onScrub = noScrub, ghosts, onGhosts }: TimelinePanelProps) {
  const { val } = useTranslation();
  const names = useBuilderNames();
  const scroller = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  // Playback re-renders every frame with the same spec; the lane list and packing only change when the spec does.
  const allLanes = useMemo(() => lanesOf(spec, stepIndex), [spec, stepIndex]);
  const lanes = useMemo(() => allLanes.filter((lane) => lane.action !== 'say'), [allLanes]);
  const packed = useMemo(() => packTracks(lanes), [lanes]);
  // The ruler runs past the play length for room; scrub and the preview both stop at the play length.
  const playMs = stepPlayMs(spec, stepIndex);
  const stepMs = stepRulerMs(spec, stepIndex);
  const viewWidth = useElementWidth(scroller);
  const edits = useTimelineEdits({ spec, stepIndex, blockCount: allLanes.length, onCommit });
  const zoom = useTimelineZoom(scroller, playhead.get, stepMs, viewWidth);
  const tickMs = tickMsFor(zoom.pxPerSec);
  const rulerMs = rulerLengthMs(stepMs, tickMs);
  const picked = lanes.find((lane) => lane.blockIndex === edits.blockIndex);
  const clipSelected = picked !== undefined && (picked.target === undefined || picked.target === selectedId);
  useTimelineKeys({ duplicate: edits.duplicate, remove: edits.remove, zoomIn: zoom.zoomIn, zoomOut: zoom.zoomOut, fit: zoom.fit }, clipSelected);

  if (!spec.steps[stepIndex]) return null;

  const clipText = clipSelected ? calloutText(spec, stepIndex, edits.blockIndex, onCommit) : undefined;

  const renderClip = (lane: (typeof lanes)[number]) => {
    const look = laneLook(lane.action, lane.effect);
    return (
      <TimelineClip
        key={lane.blockIndex}
        label={names.effectName(laneEffectId(lane.action, lane.effect) ?? '', look.label)}
        icon={look.icon}
        tone={look.tone}
        target={lane.target ? names.elementName(spec, lane.target) : ''}
        at={lane.at}
        duration={lane.duration}
        pxPerSec={zoom.pxPerSec}
        selected={clipSelected && lane.blockIndex === edits.blockIndex}
        dimmed={selectedId !== null && lane.target !== selectedId}
        onSelect={() => {
          edits.select(lane.blockIndex);
          if (lane.target) onSelectTarget(lane.target);
        }}
        onTiming={(timing) => onCommit(setBlockTiming(spec, stepIndex, lane.blockIndex, timing))}
        onContextMenu={(x, y) => setMenu({ x, y })}
      />
    );
  };

  return (
    <section className={`${workbench.flow} ${styles.panel}`} aria-label={val({ key: 'visualAuthoring.timeline.timelineLabel' })} style={cssVariable('--tl-gutter', `${GUTTER_PX}px`)}>
      <TimelineTransport
        playhead={playhead}
        playing={playing}
        onPlay={onPlay}
        totalMs={playMs}
        clipText={clipText}
        steps={
          <>
            <StepTabs spec={spec} stepIndex={stepIndex} onSelect={onStepIndex} onCommit={onCommit} onNewStep={onNewStep} />
            <ToggleButton label={val({ key: 'visualAuthoring.timeline.ghosts' })} pressed={ghosts} title={val({ key: 'visualAuthoring.timeline.ghostsTitle' })} onClick={() => onGhosts(!ghosts)} />
            <StepMeta spec={spec} stepIndex={stepIndex} onStepIndex={onStepIndex} onCommit={onCommit} />
          </>
        }
      />
      <div className={styles.scroller} ref={scroller}>
        <div className={styles.surface}>
          <TimelinePlayhead stepMs={playMs} rulerMs={rulerMs} tickMs={tickMs} playhead={playhead} pxPerSec={zoom.pxPerSec} onScrub={onScrub} />
          <div className={styles.tracks} role="list" aria-label={val({ key: 'visualAuthoring.timeline.animationsInStep' })} onMouseDown={(event) => event.target === event.currentTarget && edits.select(null)}>
            {packed.map((track, index) => (
              <div key={track[0].blockIndex} className={styles.track} data-n={index + 1}>
                {track.map(renderClip)}
              </div>
            ))}
            {lanes.length === 0 && <p className={workbench.empty}>{val({ key: 'visualAuthoring.timeline.noAnimation' })}</p>}
          </div>
        </div>
      </div>
      {menu && <TimelineClipMenu x={menu.x} y={menu.y} onDuplicate={edits.duplicate} onDelete={edits.remove} onClose={closeMenu} />}
    </section>
  );
}
