// Canvas sizing for text and formula boxes, in millimetres.

const GROW_EPSILON_MM = 0.5;
const MAX_GROWN_HEIGHT_MM = 1000;

/**
 * Grows height only. Width is intentionally never auto-grown: content
 * width is measured from a word-wrapped element, so its scrollWidth
 * tracks the box's own current width rather than the text's natural
 * width — comparing the two would grow the box on every render.
 *
 * Height is capped at MAX_GROWN_HEIGHT_MM as a hard backstop against a
 * bad measurement (e.g. an unconstrained content element) ballooning
 * the box to an unrecoverable size.
 */
export function computeGrownSize(
  currentW: number,
  currentH: number,
  contentW: number,
  contentH: number,
  paddingMm: number
): { w: number; h: number } | null {
  void contentW;
  const neededH = Math.min(Math.ceil((contentH + paddingMm * 2) * 2) / 2, MAX_GROWN_HEIGHT_MM);
  const overflowsH = neededH > currentH + GROW_EPSILON_MM;
  if (!overflowsH) return null;
  return { w: currentW, h: neededH };
}

const MIN_FORMULA_FONT_PX = 6;

export function fitFontSize(baseFontSize: number, w: number, h: number): number {
  // obj.w/obj.h are in mm. Mirrors PortDots.tsx's dotRadius() clamp shape (Math.min(cap,
  // min(w,h) * factor)) rather than a flat per-dimension budget, so the font actually
  // shrinks for realistic small boxes instead of only kicking in below ~5mm tall.
  const fitted = Math.min(baseFontSize, Math.min(w, h) * 0.9);
  return Math.max(MIN_FORMULA_FONT_PX, Math.floor(fitted));
}
