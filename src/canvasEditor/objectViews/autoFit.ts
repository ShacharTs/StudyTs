import { useCanvasStore, mmToPx, pxToMm, pageSizeMm, type SceneObject } from '@canvasStore';

/** Space between a text box's edge and its words, per side, in mm. Matches the .textRoot padding closely enough to avoid a stray wrap. */
export const AUTO_FIT_PADDING_MM = 1;
const MIN_FIT_W_MM = 8;
const MIN_FIT_H_MM = 5;
const MAX_FIT_H_MM = 1000;
const FIT_EPSILON_MM = 0.5;
// offsetWidth is rounded down to whole px; one extra px keeps the longest line from wrapping by a subpixel.
const WIDTH_SLACK_PX = 1;

/** A text box fits its words unless the user took over its size (explicit `autoFit: false`). */
export const isAutoFit = (props: SceneObject['props']): boolean => props.autoFit !== false;

export interface TextBoxMeasure {
  /** Natural width of the text under the width cap, in px. */
  widthPx: number;
  /** Height of the text laid out at that width, in px. */
  heightPx: number;
}

/**
 * Measures the real rendered text (math and RTL included): first at its natural width (up to the cap), then its
 * height at that width. Null when the element has no layout (hidden, or a test DOM), so nothing is ever fitted to zero.
 */
export function measureTextBox(el: HTMLElement, capPx: number): TextBoxMeasure | null {
  const { width: prevWidth, maxWidth: prevMaxWidth } = el.style;
  el.style.maxWidth = `${capPx}px`;
  el.style.width = 'max-content';
  const natural = el.offsetWidth;
  el.style.maxWidth = prevMaxWidth;
  const widthPx = natural + WIDTH_SLACK_PX;
  el.style.width = `${widthPx}px`;
  const heightPx = el.scrollHeight;
  el.style.width = prevWidth;
  return natural > 0 && heightPx > 0 ? { widthPx, heightPx } : null;
}

const roundUpToHalf = (mm: number): number => Math.ceil(mm * 2) / 2;
const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** The box (mm) that holds the measured text, or null when the current box already fits within half a mm. */
export function fittedBox(current: { w: number; h: number }, measure: TextBoxMeasure, capMm: number): { w: number; h: number } | null {
  const pad = AUTO_FIT_PADDING_MM * 2;
  const w = clamp(roundUpToHalf(pxToMm(measure.widthPx) + pad), MIN_FIT_W_MM, Math.max(MIN_FIT_W_MM, capMm));
  const h = clamp(roundUpToHalf(pxToMm(measure.heightPx) + pad), MIN_FIT_H_MM, MAX_FIT_H_MM);
  const same = Math.abs(w - current.w) <= FIT_EPSILON_MM && Math.abs(h - current.h) <= FIT_EPSILON_MM;
  return same ? null : { w, h };
}

/** The widest a box may grow: the width it was given (kept in props.maxWidth once it shrinks), within the room left on its page. */
export function widthCapMm(obj: SceneObject, pageWidthMm: number | null): number {
  const given = Math.max(typeof obj.props.maxWidth === 'number' ? obj.props.maxWidth : 0, obj.w);
  return pageWidthMm === null ? given : Math.max(MIN_FIT_W_MM, Math.min(given, pageWidthMm - obj.x));
}

export const contentCapPx = (capMm: number): number => mmToPx(capMm - AUTO_FIT_PADDING_MM * 2);

/** The width of the page an object sits on, for the widest box it may grow to; null when it is on none. */
export function pageWidthOf(objectId: string): number | null {
  const { doc } = useCanvasStore.getState();
  const page = doc.pages.find((p) => p.objects.includes(objectId));
  return page ? pageSizeMm(page.orientation, page.paperSize).w : null;
}

/** A width in mm that holds `naturalMm`, rounded up to half a mm and kept between the minimum and the cap. */
export function fitWidthMm(naturalMm: number, capMm: number): number {
  return clamp(roundUpToHalf(naturalMm), MIN_FIT_W_MM, Math.max(MIN_FIT_W_MM, capMm));
}

export const widthDiffers = (a: number, b: number): boolean => Math.abs(a - b) > FIT_EPSILON_MM;
