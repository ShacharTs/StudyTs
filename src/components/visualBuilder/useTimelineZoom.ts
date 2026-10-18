import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { DEFAULT_ZOOM, GUTTER_PX, clampTimelineZoom, fitZoom, initialZoom, pixelScale } from './timelineGeometry';

const WHEEL_FACTOR = 1.15;
const KEY_FACTOR = 1.25;

interface Anchor {
  viewX: number;
  seconds: number;
}

// The time under the pointer, or under the playhead when the mouse is elsewhere, stays put while the scale changes.
// The playhead is read on each zoom, not rendered: reading it per frame would re-render the timeline during playback.
export function useTimelineZoom(scroller: RefObject<HTMLDivElement>, readPlayheadMs: () => number, contentMs: number, viewWidth: number) {
  const [pxPerSec, setPxPerSec] = useState(DEFAULT_ZOOM);
  const placed = useRef(false);
  const mouseX = useRef<number | null>(null);
  const anchor = useRef<Anchor | null>(null);
  const latest = useRef({ pxPerSec, readPlayheadMs, contentMs });
  latest.current = { pxPerSec, readPlayheadMs, contentMs };

  const zoomTo = useCallback(
    (next: number, forced?: Anchor) => {
      const element = scroller.current;
      if (!element) return;
      const { pxPerSec: current, readPlayheadMs: readHead } = latest.current;
      const head = readHead();
      const pointerX = mouseX.current === null ? null : (mouseX.current - element.getBoundingClientRect().left) / pixelScale(element);
      const viewX = pointerX ?? GUTTER_PX + (head / 1000) * current - element.scrollLeft;
      anchor.current = forced ?? { viewX, seconds: (viewX + element.scrollLeft - GUTTER_PX) / current };
      setPxPerSec(clampTimelineZoom(next));
    },
    [scroller],
  );

  useEffect(() => {
    if (placed.current || viewWidth <= 0) return;
    placed.current = true;
    setPxPerSec(initialZoom(viewWidth, latest.current.contentMs));
  }, [viewWidth]);

  useLayoutEffect(() => {
    const element = scroller.current;
    const held = anchor.current;
    if (!element || !held) return;
    anchor.current = null;
    element.scrollLeft = Math.max(0, GUTTER_PX + held.seconds * pxPerSec - held.viewX);
  }, [pxPerSec, scroller]);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return undefined;
    const onMove = (event: MouseEvent) => {
      mouseX.current = event.clientX;
    };
    const onLeave = () => {
      mouseX.current = null;
    };
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      zoomTo(latest.current.pxPerSec * (event.deltaY < 0 ? WHEEL_FACTOR : 1 / WHEEL_FACTOR));
    };
    element.addEventListener('mousemove', onMove);
    element.addEventListener('mouseleave', onLeave);
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('mousemove', onMove);
      element.removeEventListener('mouseleave', onLeave);
      element.removeEventListener('wheel', onWheel);
    };
  }, [scroller, zoomTo]);

  const zoomIn = useCallback(() => zoomTo(latest.current.pxPerSec * KEY_FACTOR), [zoomTo]);
  const zoomOut = useCallback(() => zoomTo(latest.current.pxPerSec / KEY_FACTOR), [zoomTo]);
  const fit = useCallback(() => {
    const width = scroller.current?.clientWidth ?? 0;
    zoomTo(fitZoom(width, latest.current.contentMs), { viewX: GUTTER_PX, seconds: 0 });
  }, [scroller, zoomTo]);

  return { pxPerSec, zoomIn, zoomOut, fit };
}
