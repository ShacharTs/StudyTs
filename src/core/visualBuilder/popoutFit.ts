export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface MenuPlacement {
  left: number;
  top: number;
  maxHeight: number;
}

export type MenuAlign = 'start' | 'end';

// Start offset that keeps a span of `size` inside `[0, limit]`; a span wider than the limit stays at 0.
const insideStart = (start: number, size: number, limit: number): number => Math.max(0, Math.min(start, limit - size));

// Drops the menu below its trigger, or above when the bottom has less room; a menu that fits neither side scrolls.
export function placeMenu(anchor: Box, menu: Size, viewport: Size, align: MenuAlign): MenuPlacement {
  const below = viewport.height - (anchor.top + anchor.height);
  const above = anchor.top;
  const dropsDown = below >= menu.height || below >= above;
  const maxHeight = Math.min(menu.height, Math.max(dropsDown ? below : above, 0));
  const top = dropsDown ? anchor.top + anchor.height : anchor.top - maxHeight;
  const start = align === 'end' ? anchor.left + anchor.width - menu.width : anchor.left;
  return { left: insideStart(start, menu.width, viewport.width), top, maxHeight };
}

// How far a placed pop-out must move so that it lies inside the window.
export function fitShift(rect: Box, viewport: Size): { dx: number; dy: number } {
  return {
    dx: insideStart(rect.left, rect.width, viewport.width) - rect.left,
    dy: insideStart(rect.top, rect.height, viewport.height) - rect.top,
  };
}
