import { useEffect, useRef, type RefObject } from 'react';
import { buildStepTimeline, type StepTimeline } from './buildStepTimeline';
import { applyStepPresence } from './applyStepPresence';
import type { VisualSpec } from './visualSpec';

interface TimelineControl {
  scrubMs?: number | null;
  onProgress?: (ms: number) => void;
  // The builder rests on frame 0 (before step 1's animation) until play is pressed; the lecture page autoplays step 1.
  holdFrameZero?: boolean;
  isPlaying?: boolean;
  // Plays only this slice of the current step (ms from the step start), once or looping, then calls onPartEnd.
  part?: PartRange | null;
  partPlaying?: boolean;
  loop?: boolean;
  onPartEnd?: () => void;
  // Anime.js speed multiplier; seek positions stay in step time, only the playback clock scales.
  rate?: number;
  // Each increment restarts the player at step 1 with the playhead at 0.
  resetCount?: number;
  // Each increment moves the playhead to the current step's start; playing continues only if isPlaying is set.
  stepRequest?: number;
}

export interface PartRange {
  startMs: number;
  endMs: number;
}

interface Settle {
  index: number;
  previous: number;
  restOnFrameZero: boolean;
  animatedStart: boolean;
  atRest: boolean;
  playing: boolean;
}

type SettleAction = 'frameZero' | 'playFromStart' | 'advance' | 'seek' | 'seekAndPlay';

function settleAction({ index, previous, restOnFrameZero, animatedStart, atRest, playing }: Settle): SettleAction {
  if (index === 0 && restOnFrameZero) return 'frameZero';
  if (index === 0 && animatedStart) return 'playFromStart';
  if (index !== previous + 1) return 'seek';
  if (atRest) return 'advance';
  // Next while a step still runs: the next step starts from its own start and keeps playing.
  return playing ? 'seekAndPlay' : 'seek';
}

type Timeline = StepTimeline['timeline'];

// A scrubbed-away position is not the end of the previous step, so playing on from there would stall at that boundary.
const isAtRest = (timeline: Timeline, boundary = 0): boolean => timeline.paused && Math.abs(timeline.currentTime - boundary) < 1;

function seekPaused(timeline: Timeline, ms: number): void {
  timeline.pause();
  timeline.seek(ms);
}

function runSettle(timeline: Timeline, action: SettleAction, seekMs: number): void {
  const actions: Record<SettleAction, () => void> = {
    advance: () => timeline.play(),
    frameZero: () => seekPaused(timeline, 0),
    playFromStart: () => {
      seekPaused(timeline, 0);
      timeline.play();
    },
    seek: () => seekPaused(timeline, seekMs),
    seekAndPlay: () => {
      seekPaused(timeline, seekMs);
      timeline.play();
    },
  };
  actions[action]();
}

type PartWatch ={ currentIndex: number; speed: number } & Pick<TimelineControl, 'part' | 'partPlaying' | 'loop' | 'onPartEnd'>;

// Called on every frame: when the played slice is over, jump back to its start (loop) or stop.
function watchPart(built: StepTimeline | null, state: PartWatch, ms: number): void {
  const { part, partPlaying, loop, onPartEnd, currentIndex, speed } = state;
  if (!built || !part || !partPlaying) return;
  const start = stepStartOf(built.boundaries, currentIndex);
  // The animation itself may end before the chosen end (a step is padded to a minimum length in the builder).
  if (ms < Math.min(start + part.endMs / speed, built.boundaries[currentIndex] ?? Infinity)) return;
  if (loop) {
    built.timeline.seek(start + part.startMs / speed);
    return;
  }
  built.timeline.pause();
  onPartEnd?.();
}

const stepStartOf = (boundaries: number[], index: number): number => (index > 0 ? (boundaries[index - 1] ?? 0) : 0);

// A re-rendered but equal spec must not rebuild the timeline, which would restart a running step.
function useContentStable<T>(value: T): T {
  const kept = useRef(value);
  if (JSON.stringify(kept.current) !== JSON.stringify(value)) kept.current = value;
  return kept.current;
}

interface TransportState {
  resetCount: number;
  stepRequest: number;
  rate: number;
  isPlaying: boolean;
  partPlaying: boolean;
  part: PartRange | null | undefined;
  scrubMs: number | null | undefined;
  currentIndex: number;
  spec: VisualSpec;
}

type TransportKey = keyof TransportState;

const transportChanged = (seen: TransportState | null, next: TransportState, keys: TransportKey[]): boolean =>
  !seen || keys.some((key) => seen[key] !== next[key]);

const startsStepOne = (current: StepTimeline, state: TransportState): boolean => state.currentIndex === 0 && (current.boundaries[0] ?? 0) > 0;

// Play resumes from wherever the timeline is; step 1 with its own animation starts through playStepOne instead.
function applyResume(current: StepTimeline, next: TransportState, changed: (...keys: TransportKey[]) => boolean): void {
  if (changed('isPlaying') && next.isPlaying && !startsStepOne(current, next)) current.timeline.play();
}

// Play step resumes a paused step where it stopped; it starts over only from outside the step or from its end.
function startCurrentStep(current: StepTimeline, state: TransportState): void {
  const start = stepStartOf(current.boundaries, state.currentIndex);
  const end = current.boundaries[state.currentIndex] ?? start;
  const time = current.timeline.currentTime;
  if (time < start || time >= end - 1) seekPaused(current.timeline, start);
  if (state.isPlaying) current.timeline.play();
}

// Play resumes where the timeline stopped; only Reset and the terminal end restart step 1.
function playStepOne(current: StepTimeline, state: TransportState, startedFromZero: { current: boolean }, onProgress?: (ms: number) => void): void {
  if (!state.isPlaying || state.currentIndex !== 0 || (current.boundaries[0] ?? 0) <= 0) return;
  startedFromZero.current = true;
  // Only a play from the very start reports zero; resuming keeps the progress the viewer already sees.
  if (current.timeline.currentTime < 1) onProgress?.(0);
  current.timeline.play();
}

// Reset at step 1 changes no index, so nothing else would stop the animation or return it to the start.
function restartAtStepOne(
  current: StepTimeline,
  holdFrameZero: boolean,
  startedFromZero: { current: boolean },
  previousIndex: { current: number },
  onProgress?: (ms: number) => void,
): void {
  startedFromZero.current = false;
  previousIndex.current = 0;
  const action = settleAction({
    index: 0,
    previous: 0,
    restOnFrameZero: holdFrameZero,
    animatedStart: (current.boundaries[0] ?? 0) > 0,
    atRest: false,
    playing: false,
  });
  runSettle(current.timeline, action, 0);
  onProgress?.(0);
}

function runPart(current: StepTimeline, state: TransportState, speed: number, onPartEnd?: () => void): void {
  const { part } = state;
  if (!part) return;
  if (!state.partPlaying) {
    current.timeline.pause();
    return;
  }
  if (current.timeline.duration <= 0) {
    onPartEnd?.();
    return;
  }
  seekPaused(current.timeline, stepStartOf(current.boundaries, state.currentIndex) + part.startMs / speed);
  current.timeline.play();
}

// scrubMs is in spec time; the timeline already runs at 1/speed of it.
function scrubTo(current: StepTimeline, state: TransportState, speed: number): void {
  if (state.scrubMs == null) return;
  const start = stepStartOf(current.boundaries, state.currentIndex);
  current.timeline.pause();
  const timelineMs = state.scrubMs * (1 / speed);
  current.timeline.seek(Math.min(start + timelineMs, current.boundaries[state.currentIndex] ?? start));
}

interface TransportRefs {
  startedFromZero: { current: boolean };
  previousIndex: { current: number };
  wasPlaying: { current: boolean };
  holdFrameZero: boolean;
  speed: number;
  onProgress?: (ms: number) => void;
  onPartEnd?: () => void;
}

// Rate, Reset and Play: the controls that start the timeline from a given position.
function applyStartControls(current: StepTimeline | null, next: TransportState, changed: (...keys: TransportKey[]) => boolean, refs: TransportRefs): void {
  if (!current) return;
  if (changed('rate')) current.timeline.speed = next.rate;
  if (changed('resetCount') && next.resetCount > 0) restartAtStepOne(current, refs.holdFrameZero, refs.startedFromZero, refs.previousIndex, refs.onProgress);
  if (changed('stepRequest') && next.stepRequest > 0) startCurrentStep(current, next);
  applyResume(current, next, changed);
  if (changed('isPlaying', 'currentIndex', 'spec')) playStepOne(current, next, refs.startedFromZero, refs.onProgress);
}

// Stop, part and scrub: the controls that stop or move a running timeline.
function applyStopPartScrub(current: StepTimeline | null, next: TransportState, changed: (...keys: TransportKey[]) => boolean, refs: TransportRefs): void {
  // Only a true-to-false edge pauses: an uncontrolled player (undefined isPlaying) autoplays and must not be stopped.
  if (changed('isPlaying', 'partPlaying')) {
    const stopped = refs.wasPlaying.current && !next.isPlaying;
    refs.wasPlaying.current = next.isPlaying;
    if (stopped && !next.partPlaying) current?.timeline.pause();
  }
  if (!current) return;
  if (changed('partPlaying', 'part', 'currentIndex')) runPart(current, next, refs.speed, refs.onPartEnd);
  if (changed('scrubMs', 'currentIndex', 'spec')) scrubTo(current, next, refs.speed);
}

// A spec re-render on the same step during a scrub must not seek back to the step start; the scrub effect places the frame.
const holdsScrub = (index: number, previous: number, scrubMs: number | null | undefined): boolean => index === previous && scrubMs != null;

// Places the timeline for a step change: a seek, a seek-and-play, or an advance from the step before.
function settleCurrentStep(current: StepTimeline, index: number, previous: number, startedFromZero: { current: boolean }, flags: Pick<TimelineControl, 'holdFrameZero' | 'isPlaying'>): void {
  const { timeline, boundaries } = current;
  if (index > 0) startedFromZero.current = true;
  const action = settleAction({
    index,
    previous,
    // A player whose play state is explicitly off rests on frame 0 until Play, so loading never autoplays.
    // Loading rests on frame 0 until Play; going back to step 1 while paused does the same instead of autoplaying.
    restOnFrameZero: ((Boolean(flags.holdFrameZero) || flags.isPlaying === false) && !startedFromZero.current) || (flags.isPlaying === false && index !== previous),
    animatedStart: (boundaries[0] ?? 0) > 0,
    // The builder's paused preview only runs on from a step when Play is on; a tab click just seeks there.
    atRest: (!flags.holdFrameZero || Boolean(flags.isPlaying)) && isAtRest(timeline, boundaries[previous]),
    playing: Boolean(flags.isPlaying),
  });
  runSettle(timeline, action, stepStartOf(boundaries, index));
}

export function useStepTimeline(incomingSpec: VisualSpec, svgRef: RefObject<SVGSVGElement>, currentIndex: number, control: TimelineControl = {}): void {
  const spec = useContentStable(incomingSpec);
  const built = useRef<StepTimeline | null>(null);
  const previousIndex = useRef(0);
  const hasBuilt = useRef(false);
  const startedFromZero = useRef(false);
  const speed = spec.speed ?? 1;
  const latest = useRef({ currentIndex, speed, ...control });
  latest.current = { currentIndex, speed, ...control };

  useEffect(() => {
    if (!svgRef.current) return undefined;
    let frame = 0;
    let pendingMs = 0;
    const flush = () => {
      frame = 0;
      const { onProgress, scrubMs, currentIndex: index, speed: factor } = latest.current;
      if (!onProgress || scrubMs != null) return;
      // Reported in spec time so it lines up with the scrubber.
      onProgress(Math.max(0, (pendingMs - stepStartOf(built.current?.boundaries ?? [], index)) * factor));
    };
    const onTime = (ms: number) => {
      // Record the time before a part-end pause, so the reported progress reaches the part's end.
      pendingMs = ms;
      if (!frame) frame = requestAnimationFrame(flush);
      watchPart(built.current, latest.current, ms);
    };
    const result = buildStepTimeline(svgRef.current, spec, onTime);
    built.current = result;
    // A rebuilt spec keeps the step the viewer is on; the first build starts from 0 so step 1 can autoplay.
    previousIndex.current = hasBuilt.current ? latest.current.currentIndex : 0;
    hasBuilt.current = true;
    applyStepPresence(svgRef.current, spec, latest.current.currentIndex);
    startedFromZero.current = false;
    return () => {
      cancelAnimationFrame(frame);
      result.timeline.revert();
      built.current = null;
    };
  }, [spec, svgRef]);

  useEffect(() => {
    if (svgRef.current) applyStepPresence(svgRef.current, spec, currentIndex);
    const current = built.current;
    if (!current || holdsScrub(currentIndex, previousIndex.current, latest.current.scrubMs)) return;
    settleCurrentStep(current, currentIndex, previousIndex.current, startedFromZero, latest.current);
    previousIndex.current = currentIndex;
  }, [currentIndex, spec, svgRef]);

  // Every transport input goes through one writer; a step runs only when its own inputs changed since the last run.
  const { resetCount = 0, stepRequest = 0, isPlaying, partPlaying, part, scrubMs } = control;
  const rate = control.rate ?? 1;
  const seen = useRef<TransportState | null>(null);
  const wasPlaying = useRef(false);
  useEffect(() => {
    const next: TransportState = { resetCount, stepRequest, rate, isPlaying: Boolean(isPlaying), partPlaying: Boolean(partPlaying), part, scrubMs, currentIndex, spec };
    const previous = seen.current;
    seen.current = next;
    const changed = (...keys: TransportKey[]) => transportChanged(previous, next, keys);
    const refs: TransportRefs = {
      startedFromZero,
      previousIndex,
      wasPlaying,
      holdFrameZero: Boolean(latest.current.holdFrameZero),
      speed,
      onProgress: latest.current.onProgress,
      onPartEnd: latest.current.onPartEnd,
    };
    const current = built.current;
    applyStartControls(current, next, changed, refs);
    applyStopPartScrub(current, next, changed, refs);
  }, [resetCount, stepRequest, rate, isPlaying, partPlaying, part, scrubMs, currentIndex, spec, speed]);
}
