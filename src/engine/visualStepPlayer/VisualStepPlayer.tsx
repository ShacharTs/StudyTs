import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { VizStep } from '@core/types/visualizationState';
import { stepPlayMs } from '@core/visualBuilder/laneEdits';
import { useStepPlayerNav } from '../playback/useStepPlayerNav';
import { StepPlayerControls } from '../playback/StepPlayerControls';
import { GenericSvgStage } from './GenericSvgStage';
import { PipelineBanner } from './PipelineBanner';
import { PreviewScrubber } from './PreviewScrubber';
import { stepHoldMs } from './stepHoldMs';
import { usePlayheadState } from './usePlayheadState';
import { useStepTimeline, type PartRange } from './useStepTimeline';
import { validateVisualSpec } from '@core/validation/visualSpec/visualSpecValidation';
import { usePublishAppViewContext } from '../../ai/context/usePublishAppViewContext';
import { useRegisterViewCommands } from '../../ai/context/viewCommands';
import type { VisualSpec } from './visualSpec';
import styles from './VisualStepPlayer.module.css';

interface VisualStepPlayerProps {
  spec: VisualSpec;
  stepIndex?: number;
  onStepChange?: (index: number) => void;
  // A parent that owns the playhead passes these; without them the player keeps its own.
  scrubMs?: number | null;
  onProgress?: (ms: number) => void;
  holdFrameZero?: boolean;
  // Reports play state so a parent's own Play control can show Play or Pause.
  onPlayingChange?: (playing: boolean) => void;
  // Replaces the default scrubber under the stage (the builder adds its part/loop controls here).
  belowStage?: ReactNode;
  part?: PartRange | null;
  loop?: boolean;
  // Each increment plays only the current step from its start; a parent's own "play this step" control uses it.
  playStepCount?: number;
  // Shown at the left of the transport rail; the course page puts its Edit button here.
  controlsLeading?: ReactNode;
}

function useStepPlayhead(stepIndex: number, scrubMs: number | null | undefined, onProgress: ((ms: number) => void) | undefined) {
  const playhead = usePlayheadState(stepIndex);
  return {
    playhead,
    timelineScrubMs: scrubMs === undefined ? playhead.scrubMs : scrubMs,
    timelineOnProgress: onProgress ?? playhead.follow,
  };
}

function ValidVisualStepPlayer({ spec, stepIndex, onStepChange, scrubMs, onProgress, onPlayingChange, holdFrameZero, belowStage, part, loop, playStepCount = 0, controlsLeading }: VisualStepPlayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const navSteps = useMemo<VizStep<null>[]>(
    () => spec.steps.map(({ title, whatChanged, why, concept }) => ({ state: null, title, whatChanged, why, concept })),
    [spec],
  );
  const holdMsFor = useCallback((index: number) => (spec.steps[index] ? stepHoldMs(spec.steps[index], spec.speed) : null), [spec]);
  const nav = useStepPlayerNav<null>(navSteps, stepIndex, holdMsFor);
  usePublishAppViewContext({
    kind: 'stepPlayer',
    specId: spec.id,
    stepIndex: nav.currentIndex,
    totalSteps: nav.totalSteps,
  });

  const previousStep = nav.handlePrev;
  const replayStep = nav.handleReset;
  useRegisterViewCommands(useMemo(() => ({ previousStep, replayStep }), [previousStep, replayStep]));
  const latest = useRef({ goTo: nav.handleGoTo, current: nav.currentIndex, stepIndex, onStepChange });
  latest.current = { goTo: nav.handleGoTo, current: nav.currentIndex, stepIndex, onStepChange };
  useEffect(() => {
    if (stepIndex !== undefined && stepIndex !== latest.current.current) latest.current.goTo(stepIndex);
  }, [stepIndex]);
  const playCurrentStepRef = useRef(nav.playCurrentStep);
  playCurrentStepRef.current = nav.playCurrentStep;
  useEffect(() => {
    if (playStepCount > 0) playCurrentStepRef.current();
  }, [playStepCount]);
  // Only a move inside the player reports back; reacting to a stepIndex change would echo the stale index and ping-pong with the parent.
  useEffect(() => {
    const { stepIndex: requested, onStepChange: report } = latest.current;
    if (requested !== undefined && nav.currentIndex !== requested) report?.(nav.currentIndex);
  }, [nav.currentIndex]);
  const [partPlaying, setPartPlaying] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const onPartEnd = useCallback(() => setPartPlaying(false), []);
  const { playhead, timelineScrubMs, timelineOnProgress } = useStepPlayhead(nav.currentIndex, scrubMs, onProgress);
  const releaseScrub = playhead.release;
  useEffect(() => {
    if (nav.isPlaying) releaseScrub();
  }, [nav.isPlaying, releaseScrub]);
  // A scrub takes the playhead: autoplay must not move the step or the frame while the user drags.
  const isScrubbing = timelineScrubMs != null;
  const { setIsPlaying } = nav;
  useEffect(() => {
    if (isScrubbing) setIsPlaying(false);
  }, [isScrubbing, setIsPlaying]);
  useStepTimeline(spec, svgRef, nav.currentIndex, { scrubMs: timelineScrubMs, onProgress: timelineOnProgress, holdFrameZero, isPlaying: nav.isPlaying, part, partPlaying, loop, onPartEnd, rate: nav.rate, resetCount, stepRequest: nav.stepRequest });
  // A chosen part replaces the normal autoplay: Play runs only that slice of this step.
  const playsPart = Boolean(part);
  const playing = playsPart ? partPlaying : nav.isPlaying;
  useEffect(() => {
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);

  const step = spec.steps[nav.currentIndex] ?? spec.steps[0];
  const stepMs = stepPlayMs(spec, nav.currentIndex);
  const reset = () => {
    nav.handleReset();
    setPartPlaying(false);
    setResetCount((count) => count + 1);
  };

  return (
    <div className={styles.player} ref={playerRef}>
      {spec.pipeline && <PipelineBanner pipeline={spec.pipeline} activeStage={step.activeStage} />}
      <div className={styles.canvas} data-stage-canvas>
        <GenericSvgStage spec={spec} svgRef={svgRef} />
      </div>
      {belowStage ?? <PreviewScrubber stepMs={stepMs} playhead={playhead.store} onScrub={playhead.scrub} />}
      <StepPlayerControls
        currentIndex={nav.currentIndex}
        totalSteps={nav.totalSteps}
        isPlaying={playing}
        rate={nav.rate}
        onReset={reset}
        onPrev={nav.handlePrev}
        onPlayToggle={playsPart ? () => setPartPlaying((playing) => !playing) : nav.handlePlayToggle}
        onNext={nav.handleNext}
        onSelectRate={nav.handleSelectRate}
        onToggleFullscreen={() => nav.toggleFullscreen(playerRef.current)}
        leading={controlsLeading}
      />
    </div>
  );
}

export function VisualStepPlayer({ spec, ...rest }: VisualStepPlayerProps) {
  const problems = useMemo(() => validateVisualSpec(spec), [spec]);
  if (problems.length > 0) {
    return (
      <div role="alert" className={styles.problems}>
        <strong>Invalid VisualSpec "{spec.id}"</strong>
        <ul>
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </div>
    );
  }
  return <ValidVisualStepPlayer spec={spec} {...rest} />;
}
