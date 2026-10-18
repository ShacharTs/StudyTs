/**
 * FullscreenModal sub-component for StepPlayer.
 * High-performance full-viewport overlay rendering expanded presentation canvas & dock controls.
 * Features floating in-canvas exit button and zero top-bar clutter.
 */

import React from 'react';
import { Minimize2, ChevronLeft, Play, Pause, ChevronRight, RotateCcw } from 'lucide-react';
import { VizStep } from '../../core/types/visualizationState';
import { useTranslation, PLAYER_TEXT } from '../../i18n';
import styles from './FullscreenModal.module.css';

interface FullscreenModalProps<S> {
  steps: VizStep<S>[];
  currentIndex: number;
  currentStep: VizStep<S>;
  isPlaying: boolean;
  renderCanvas: (state: S, stepIndex: number, step?: VizStep<S>) => React.ReactNode;
  toggleFullscreen: () => void;
  handlePrev: () => void;
  handleNext: () => void;
  handleReset: () => void;
  setIsPlaying: (playing: boolean) => void;
}

export function FullscreenModal<S>({
  steps,
  currentIndex,
  currentStep,
  isPlaying,
  renderCanvas,
  toggleFullscreen,
  handlePrev,
  handleNext,
  handleReset,
  setIsPlaying,
}: FullscreenModalProps<S>) {
  const { val } = useTranslation();

  return (
    <div className={styles.modalContainer}>
      {/* Main Expansive Canvas Viewport with Floating Exit Fullscreen Button */}
      <div className={`fullscreen-canvas-box ${styles.canvasBox}`}>
        {/* Floating Exit Button in top-right corner inside canvas */}
        <button
          className={`ctrl-btn ${styles.exitButton}`}
          onClick={toggleFullscreen}
        >
          <Minimize2 size={15} />
          <span>{val(PLAYER_TEXT.exitFullscreen)}</span>
        </button>

        {renderCanvas(currentStep.state, currentIndex, currentStep)}
      </div>

      {/* Fullscreen Player Controls Dock (Always LTR) */}
      <div className={`player-controls-dock ${styles.controlsDock}`} dir="ltr">
        <div dir="ltr" className={styles.buttonsGroup}>
          <button onClick={handlePrev} disabled={currentIndex === 0} className="ctrl-btn prev-btn">
            <ChevronLeft size={22} />
          </button>
          <button onClick={() => setIsPlaying(!isPlaying)} className={`ctrl-btn play-btn ${isPlaying ? 'playing' : ''}`}>
            {isPlaying ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button onClick={handleNext} disabled={currentIndex === steps.length - 1} className="ctrl-btn next-btn">
            <ChevronRight size={22} />
          </button>
          <button onClick={handleReset} className="ctrl-btn reset-btn">
            <RotateCcw size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
