import { useCallback, useRef, useState } from 'react';
import { SELECT_MODE, reduceMode, type BuilderMode, type ModeEffect, type ModeEvent } from '@core/visualBuilder/builderMode';

export function useBuilderMode(onEffect: (effect: ModeEffect) => void) {
  const [mode, setMode] = useState<BuilderMode>(SELECT_MODE);
  const current = useRef(mode);
  const effectHandler = useRef(onEffect);
  effectHandler.current = onEffect;

  const dispatch = useCallback((event: ModeEvent) => {
    const result = reduceMode(current.current, event);
    current.current = result.mode;
    setMode(result.mode);
    if (result.effect) effectHandler.current(result.effect);
  }, []);

  return { mode, dispatch };
}
