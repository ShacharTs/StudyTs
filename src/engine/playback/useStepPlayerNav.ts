// src/engine/playback/useStepPlayerNav.ts
import { useState, useEffect, useRef } from 'react';
import { VizStep } from '@core/types/visualizationState';
import { useAutoplayTimer } from './useAutoplayTimer';

export const STEP_PLAYER_RATES: readonly number[] = [0.25, 0.5, 1, 1.25, 1.5, 2];

// Autoplay pause for a step with no animation; animated steps hold for their animation length instead.
const DEFAULT_HOLD_MS = 2000;

/** Step navigation, autoplay, playback rate, and native-fullscreen tracking for StepPlayer. */
export function useStepPlayerNav<S>(steps: VizStep<S>[] = [], initialIndex = 0, holdMsFor?: (index: number) => number | null) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, Math.min(initialIndex, Math.max(Array.isArray(steps) ? steps.length : 0, 1) - 1)),
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rate, setRate] = useState(1);
  // Counts step-play requests so the stage can seek to the step start on each one.
  const [stepRequest, setStepRequest] = useState(0);
  const stopAfterStep = useRef(false);

  const safeSteps = Array.isArray(steps) ? steps : [];
  const totalSteps = Math.max(safeSteps.length, 1);
  const currentStep = safeSteps[currentIndex] ?? {
    state: {} as S,
    whatChanged: 'Initial baseline configuration loaded.',
    why: 'Establishing baseline state before step transitions execute.',
  };

  const atLastStep = currentIndex >= totalSteps - 1;
  // The last step holds for its own animation, then stops; stopping at once would cut a one-step animation off.
  useAutoplayTimer(isPlaying, currentIndex, holdMsFor?.(currentIndex) ?? DEFAULT_HOLD_MS, rate, () => {
    if (atLastStep || stopAfterStep.current) {
      stopAfterStep.current = false;
      setIsPlaying(false);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (active) {
        document.body.classList.add('fullscreen-active');
      } else {
        document.body.classList.remove('fullscreen-active');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.body.classList.remove('fullscreen-active');
    };
  }, []);

  // The player itself goes fullscreen (not the whole page), so its stage can use the whole monitor.
  const toggleFullscreen = (target?: unknown) => {
    if (!document.fullscreenElement) {
      (target instanceof Element ? target : document.documentElement).requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, totalSteps - 1));
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleGoTo = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, totalSteps - 1)));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  // A plain play/pause: it never moves the step, so Reset and Prev are the only ways back.
  const handlePlayToggle = () => {
    stopAfterStep.current = false;
    setIsPlaying((prev) => !prev);
  };

  // Plays only the current step from its start, then stops on its own.
  const playCurrentStep = () => {
    stopAfterStep.current = true;
    setStepRequest((count) => count + 1);
    setIsPlaying(true);
  };

  const handleSelectRate = (nextRate: number) => {
    setRate(nextRate);
  };

  return {
    currentIndex,
    setCurrentIndex,
    isPlaying,
    setIsPlaying,
    isFullscreen,
    rate,
    totalSteps,
    currentStep,
    handleNext,
    handlePrev,
    handleGoTo,
    handleReset,
    handlePlayToggle,
    playCurrentStep,
    stepRequest,
    handleSelectRate,
    toggleFullscreen,
  };
}
