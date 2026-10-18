import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';
import type { Point } from '@core/geometry/geometryPrimitives';
import { fitCamera, panBy, toWorld, visibleBox, zoomAround, zoomTo, type Camera } from '@core/geometry/cameraMath';
import { stepZoom } from '@core/visualBuilder/zoomSteps';
import { useElementSize } from './useElementSize';

const WHEEL_STEP = 1.1;
const PINCH_SPEED = 0.01;

const PINCH_LIMIT = 50;

// A trackpad pinch reports ctrl+wheel with small continuous deltas; a mouse wheel notch (with or without ctrl) is a large delta and gets one fixed step.
function wheelFactor(event: WheelEvent): number {
  if (event.ctrlKey && Math.abs(event.deltaY) < PINCH_LIMIT) return Math.exp(-event.deltaY * PINCH_SPEED);
  return event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
}

const FALLBACK_PAD = 12;

// The wrap pads itself by --stage-pad and its svg is absolute, so the resolved padding is the Fit margin per side.
function useStagePadding(wrapRef: RefObject<HTMLElement>, width: number): number {
  const [pad, setPad] = useState(FALLBACK_PAD);
  useLayoutEffect(() => {
    const resolved = parseFloat(getComputedStyle(wrapRef.current as Element).paddingLeft);
    setPad(resolved > 0 ? resolved : FALLBACK_PAD);
  }, [wrapRef, width]);
  return pad;
}

// A null camera is Fit, which follows the frame size; the first wheel or pan turns it into an explicit camera.
export function useCanvasCamera(world: { w: number; h: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(wrapRef);
  const [custom, setCustom] = useState<Camera | null>(null);
  const [panning, setPanning] = useState(false);
  const pad = useStagePadding(wrapRef, size.width);
  const camera = custom ?? fitCamera(world, size, pad * 2);
  const latest = useRef({ camera, size });
  latest.current = { camera, size };

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const { camera: current, size: frame } = latest.current;
      setCustom(zoomAround(current, frame, wheelFactor(event), { x: event.clientX - rect.left, y: event.clientY - rect.top }));
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, []);

  const startPan = useCallback((event: ReactMouseEvent) => {
    event.preventDefault();
    setPanning(true);
    let last = { x: event.clientX, y: event.clientY };
    const move = (next: MouseEvent) => {
      const dx = next.clientX - last.x;
      const dy = next.clientY - last.y;
      last = { x: next.clientX, y: next.clientY };
      setCustom(panBy(latest.current.camera, dx, dy));
    };
    const end = () => {
      setPanning(false);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', end);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
  }, []);

  const toPoint = useCallback((clientX: number, clientY: number): Point => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return toWorld(latest.current.camera, { width: rect.width, height: rect.height }, { x: clientX - rect.left, y: clientY - rect.top });
  }, []);

  const zoomStep = (direction: 1 | -1) => setCustom(zoomTo(camera, stepZoom(camera.s, direction)));
  return {
    wrapRef,
    camera,
    panning,
    startPan,
    toPoint,
    viewBox: size.width > 0 ? visibleBox(camera, size) : null,
    fit: () => setCustom(null),
    actualSize: () => setCustom(zoomTo(camera, 1)),
    zoomIn: () => zoomStep(1),
    zoomOut: () => zoomStep(-1),
  };
}
