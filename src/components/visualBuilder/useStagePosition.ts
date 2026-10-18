import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import type { Point } from '@core/geometry/geometryPrimitives';
import { viewToStage } from '@core/visualBuilder/stageAnchor';
import type { Frame } from '@core/visualBuilder/viewMath';
import { visibleViewBox } from './visibleViewBox';

const frameOf = (element: Element): Frame => {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
};

// A point of the drawing as pixels inside the stage, measured again when the point or the window changes.
export function useStagePosition(stage: RefObject<HTMLElement>, point: Point | null, lift = 0): Point | null {
  const [position, setPosition] = useState<Point | null>(null);
  const x = point?.x;
  const y = point?.y;
  const measure = useCallback(() => {
    const stageElement = stage.current;
    const canvas = stageElement?.querySelector('svg[aria-label="Builder canvas"]');
    if (!stageElement || !canvas || x === undefined || y === undefined) {
      setPosition(null);
      return;
    }
    const next = viewToStage({ x, y }, { viewBox: visibleViewBox(canvas), canvas: frameOf(canvas), stage: frameOf(stageElement) }, lift);
    setPosition((previous) => (previous && Math.abs(previous.x - next.x) < 0.5 && Math.abs(previous.y - next.y) < 0.5 ? previous : next));
  }, [stage, x, y, lift]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    // Zoom and pan only change the canvas viewBox attribute, so it is watched too.
    const canvas = stage.current?.querySelector('svg[aria-label="Builder canvas"]');
    const observer = canvas ? new MutationObserver(measure) : null;
    if (canvas) observer?.observe(canvas, { attributes: true, attributeFilter: ['viewBox'] });
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [measure, stage]);
  return position;
}
