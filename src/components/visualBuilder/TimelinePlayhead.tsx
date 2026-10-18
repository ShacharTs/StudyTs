import { useMemo } from 'react';
import { cssVariable, pixelVariable } from './cssVariables';
import { pxOf } from './timelineGeometry';
import { usePlayheadMs, useScrubPlayhead, type PlayheadStore } from '@engine/visualStepPlayer';
import { useTranslation } from '@i18n';
import styles from './TimelinePanel.module.css';

interface TimelinePlayheadProps {
  stepMs: number;
  rulerMs: number;
  tickMs: number;
  // The store, so the head moves per frame without re-rendering the panel.
  playhead: PlayheadStore;
  pxPerSec: number;
  onScrub: (ms: number) => void;
}

// Sub-half-second ticks need two decimals: one decimal rounds 0.25 s to 0.3 s.
const tickNumber = (ms: number, tickMs: number): string => {
  if (tickMs < 500) return (ms / 1000).toFixed(2);
  if (tickMs % 1000 !== 0) return (ms / 1000).toFixed(1);
  return String(Math.round(ms / 1000));
};

export function TimelinePlayhead({ stepMs, rulerMs, tickMs, playhead, pxPerSec, onScrub }: TimelinePlayheadProps) {
  const { val } = useTranslation();
  const playheadMs = usePlayheadMs(playhead);
  // The ruler may run past the step; pointer times are clamped so the scrub stays inside the real step.
  const handlers = useScrubPlayhead(rulerMs, playheadMs, (ms) => onScrub(Math.min(ms, stepMs)));
  const ticks = useMemo(() => Array.from({ length: Math.floor(rulerMs / tickMs) + 1 }, (_, index) => index * tickMs), [rulerMs, tickMs]);
  const head = pixelVariable(pxOf(Math.min(playheadMs, rulerMs), pxPerSec));
  return (
    <>
      <div
        className={styles.ruler}
        style={cssVariable('--width', `${pxOf(rulerMs, pxPerSec)}px`)}
        role="slider"
        tabIndex={0}
        aria-label={val({ key: 'visualAuthoring.timeline.previewTime' })}
        aria-valuemin={0}
        aria-valuemax={stepMs}
        aria-valuenow={Math.round(playheadMs)}
        aria-valuetext={val({ key: 'visualAuthoring.timeline.seconds' }).replace('{value}', (playheadMs / 1000).toFixed(2))}
        {...handlers}
      >
        {ticks.map((ms) => (
          <span key={ms} style={pixelVariable(pxOf(ms, pxPerSec))}>
            {val({ key: 'visualAuthoring.timeline.tickSeconds' }).replace('{value}', tickNumber(ms, tickMs))}
          </span>
        ))}
        <i className={styles.playheadHandle} style={head} />
      </div>
      <div className={styles.playheadTrack} aria-hidden="true">
        <i className={styles.playheadLine} style={head} />
      </div>
    </>
  );
}
