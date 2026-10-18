import { useLayoutEffect, type RefObject } from 'react';
import { fitShift, placeMenu, type Box, type MenuAlign } from '@core/visualBuilder/popoutFit';

interface FitOptions {
  // Menus flip to the side of their trigger; without an anchor the pop-out is only moved back inside the window.
  anchor?: RefObject<HTMLElement>;
  align?: MenuAlign;
  active?: boolean;
}

const toBox = (rect: DOMRect): Box => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });

// Pop-outs under CSS zoom report viewport pixels, but their own offsets are in local pixels.
function zoomOf(element: HTMLElement, rect: Box): number {
  return element.offsetWidth > 0 && rect.width > 0 ? rect.width / element.offsetWidth : 1;
}

// Null maxHeight means the pop-out only moved and keeps its own size.
function offsetFor(rect: Box, anchor: HTMLElement | null, align: MenuAlign): { dx: number; dy: number; maxHeight: number | null } {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  if (!anchor) return { ...fitShift(rect, viewport), maxHeight: null };
  const placed = placeMenu(toBox(anchor.getBoundingClientRect()), rect, viewport, align);
  return { dx: placed.left - rect.left, dy: placed.top - rect.top, maxHeight: placed.maxHeight };
}

function fitPopout(element: HTMLElement, anchor: HTMLElement | null, align: MenuAlign) {
  element.style.setProperty('--fit-x', '0px');
  element.style.setProperty('--fit-y', '0px');
  element.style.maxHeight = '';
  const rect = toBox(element.getBoundingClientRect());
  const zoom = zoomOf(element, rect);
  const { dx, dy, maxHeight } = offsetFor(rect, anchor, align);
  element.style.setProperty('--fit-x', `${dx / zoom}px`);
  element.style.setProperty('--fit-y', `${dy / zoom}px`);
  if (maxHeight !== null) element.style.maxHeight = `${maxHeight / zoom}px`;
}

// Runs after every render so the measurement follows content changes; the reset first keeps it idempotent.
export function usePopoutFit(popout: RefObject<HTMLElement>, options: FitOptions = {}): void {
  const { anchor, align = 'start', active = true } = options;
  useLayoutEffect(() => {
    const element = popout.current;
    if (!active || !element) return undefined;
    const fit = () => fitPopout(element, anchor?.current ?? null, align);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });
}
