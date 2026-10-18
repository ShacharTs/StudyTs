import type { ViewWindow } from '@core/visualBuilder/viewMath';

// The part of the world the canvas svg currently shows; the camera writes it into the viewBox attribute.
export function visibleViewBox(canvas: Element): ViewWindow {
  const [x, y, w, h] = (canvas.getAttribute('viewBox') ?? '0 0 0 0').trim().split(/[\s,]+/).map(Number);
  return { x, y, w, h };
}
