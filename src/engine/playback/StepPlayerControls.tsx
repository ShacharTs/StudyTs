// src/engine/playback/StepPlayerControls.tsx
/** Control rail (step ticks, transport, speed, fullscreen) for StepPlayer. */
import type { ReactNode } from 'react';
import { PLAYER_TEXT, useTranslation } from '../../i18n';
import { STEP_PLAYER_RATES } from './useStepPlayerNav';
import { SpeedMenu } from './SpeedMenu';
import styles from './StepPlayerControls.module.css';

interface StepPlayerControlsProps {
  currentIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  rate: number;
  onReset: () => void;
  onPrev: () => void;
  onPlayToggle: () => void;
  onNext: () => void;
  onSelectRate: (rate: number) => void;
  onToggleFullscreen: () => void;
  // A parent's own control, shown at the far left of the rail (the course page puts Edit here).
  leading?: ReactNode;
}

const DENSE_STEPS = 8;

export function StepPlayerControls({
  currentIndex,
  totalSteps,
  isPlaying,
  rate,
  onReset,
  onPrev,
  onPlayToggle,
  onNext,
  onSelectRate,
  onToggleFullscreen,
  leading,
}: StepPlayerControlsProps) {
  const { val } = useTranslation();
  return (
    <div className={styles.controlRail} dir="ltr" data-testid="step-control-rail">
      {leading && <div className={styles.leadingGroup}>{leading}</div>}
      <div className={styles.spacer} />

      {/* Step counter & tick marks, next to the transport */}
      <div className={styles.stepCounterGroup}>
        <span className={styles.stepCounter}>
          {`${String(currentIndex + 1).padStart(2, '0')} / ${String(totalSteps).padStart(2, '0')}`}
        </span>
        <div className={`${styles.ticksContainer} ${totalSteps > DENSE_STEPS ? styles.ticksDense : ''}`}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={`${styles.tickMark} ${currentIndex >= i ? styles.tickMarkActive : ''}`}
            />
          ))}
        </div>
      </div>

      {/* Transport controls */}
      <div className={styles.transportGroup}>
        <button
          type="button"
          className={`ib ${styles.iconButton}`}
          id="btn-reset-step"
          onClick={onReset}
          title={val(PLAYER_TEXT.reset)}
        >
          ↺
        </button>
        <button
          type="button"
          className={`ib ${styles.iconButton} ${currentIndex === 0 ? styles.disabledButton : ''}`}
          id="btn-prev-step"
          onClick={onPrev}
          disabled={currentIndex === 0}
          title={val(PLAYER_TEXT.previous)}
        >
          ‹
        </button>
        <button
          type="button"
          className={`ib ${styles.playButton}`}
          id="btn-play-pause"
          onClick={onPlayToggle}
          title={val(isPlaying ? PLAYER_TEXT.pause : PLAYER_TEXT.play)}
        >
          {isPlaying ? '❙❙' : '▶'}
        </button>
        <button
          type="button"
          className={`ib ${styles.iconButton} ${currentIndex === totalSteps - 1 ? styles.disabledButton : ''}`}
          id="btn-next-step"
          onClick={onNext}
          disabled={currentIndex === totalSteps - 1}
          title={val(PLAYER_TEXT.next)}
        >
          ›
        </button>
      </div>

      <div className={styles.spacer} />

      {/* Speed and Fullscreen */}
      <div className={styles.extraGroup}>
        <SpeedMenu rate={rate} rates={STEP_PLAYER_RATES} onSelect={onSelectRate} />
        <button
          type="button"
          className={`ib ${styles.fullscreenButton}`}
          onClick={onToggleFullscreen}
        >
          ⤢ {val(PLAYER_TEXT.fullscreen)}
        </button>
      </div>
    </div>
  );
}
