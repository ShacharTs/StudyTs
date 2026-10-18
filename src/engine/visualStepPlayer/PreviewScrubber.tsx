import { useRef, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import type { PartRange } from './useStepTimeline';
import { usePlayheadMs, type PlayheadStore } from './playheadStore';
import { msFromPointer, useScrubPlayhead } from './useScrubPlayhead';
import { PLAYER_TEXT, useTranslation } from '../../i18n';
import styles from './PreviewScrubber.module.css';

interface PreviewScrubberProps {
  stepMs: number;
  // The store, not a number: this component alone re-renders per frame.
  playhead: PlayheadStore;
  onScrub: (ms: number) => void;
  part?: PartRange | null;
  loop?: boolean;
  onPart?: (part: PartRange | null) => void;
  onLoop?: (loop: boolean) => void;
}

const MIN_PART_MS = 50;
type Handle = 'startMs' | 'endMs';

// Dynamic positions reach the CSS module through custom properties, never through styled properties.
const fractionStyle = (fraction: number): CSSProperties => ({ '--at': `${fraction * 100}%` }) as CSSProperties;
// An empty step parks the head at the end, where there is nothing to scrub.
const playheadFraction = (playheadMs: number, stepMs: number): number => (stepMs === 0 ? 1 : Math.min(1, playheadMs / Math.max(stepMs, 1)));
const partStyle = (part: PartRange, length: number): CSSProperties =>
  ({ '--from': `${(part.startMs / length) * 100}%`, '--to': `${(part.endMs / length) * 100}%` }) as CSSProperties;

function nextPart(part: PartRange, handle: Handle, ms: number): PartRange {
  if (handle === 'startMs') return { ...part, startMs: Math.min(ms, part.endMs - MIN_PART_MS) };
  return { ...part, endMs: Math.max(ms, part.startMs + MIN_PART_MS) };
}

// A press on a part handle drags that handle only; it must not also move the playhead.
function useHandleDrag(stepMs: number, part: PartRange | null | undefined, onPart: ((part: PartRange | null) => void) | undefined) {
  const track = useRef<HTMLDivElement>(null);
  const dragHandle = (handle: Handle) => (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = track.current?.getBoundingClientRect();
    if (!rect || !part || !onPart) return;
    const move = (moved: MouseEvent) => onPart(nextPart(part, handle, msFromPointer(moved.clientX, rect, stepMs)));
    const end = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', end);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
  };
  return { track, dragHandle };
}

// Same time scale and same state as the lane ruler, so dragging either one moves both and the preview paints that millisecond.
export function PreviewScrubber({ stepMs, playhead, onScrub, part, loop = false, onPart, onLoop }: PreviewScrubberProps) {
  const { val } = useTranslation();
  const playheadMs = usePlayheadMs(playhead);
  const handlers = useScrubPlayhead(stepMs, playheadMs, onScrub);
  const { track, dragHandle } = useHandleDrag(stepMs, part, onPart);
  const isEmpty = stepMs === 0;
  const length = Math.max(stepMs, 1);
  const at = fractionStyle(playheadFraction(playheadMs, stepMs));
  const range = part ? partStyle(part, length) : undefined;
  const togglePart = () => onPart?.(part ? null : { startMs: Math.min(playheadMs, stepMs - MIN_PART_MS), endMs: stepMs });
  return (
    <div className={styles.scrubRow}>
      <div
        ref={track}
        className={styles.scrubber}
        role="slider"
        tabIndex={isEmpty ? -1 : 0}
        aria-label={val(PLAYER_TEXT.scrubber)}
        aria-disabled={isEmpty || undefined}
        aria-valuemin={0}
        aria-valuemax={stepMs}
        aria-valuenow={Math.round(playheadMs)}
        aria-valuetext={val(PLAYER_TEXT.seconds).replace('{value}', (playheadMs / 1000).toFixed(2))}
        {...(isEmpty ? {} : handlers)}
      >
        <span className={styles.scrubRail} />
        {part && <span className={styles.scrubPart} style={range} />}
        <span className={styles.scrubFill} style={at} />
        <i className={styles.scrubHead} style={at} />
        {part && (
          <>
            <i className={styles.scrubHandle} style={fractionStyle(part.startMs / length)} data-handle="start" onMouseDown={dragHandle('startMs')} />
            <i className={styles.scrubHandle} style={fractionStyle(part.endMs / length)} data-handle="end" onMouseDown={dragHandle('endMs')} />
          </>
        )}
      </div>
      <span className={styles.scrubTime}>{val(PLAYER_TEXT.milliseconds).replace('{value}', String(Math.round(playheadMs)))}</span>
      {onPart && (
        <button type="button" className={styles.miniButton} aria-pressed={Boolean(part)} title={val(PLAYER_TEXT.partTitle)} onClick={togglePart}>
          {val(PLAYER_TEXT.part)}
        </button>
      )}
      {part && onLoop && (
        <button type="button" className={styles.miniButton} aria-pressed={loop} title={val(PLAYER_TEXT.loopTitle)} onClick={() => onLoop(!loop)}>
          {val(PLAYER_TEXT.loop)}
        </button>
      )}
    </div>
  );
}
