export interface ShapePaint {
  kind: string;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  /** Stroke width. */
  sw: number;
  /** Corner radius for the "rounded" kind. */
  radius?: number;
  /** Horizontal tail position (0..1 of the width) for the "callout" kind. */
  tailX?: number;
}

/** Only painted pixels receive pointer events, so empty bounding-box corners fall through to the page. */
export const PAINTED = { pointerEvents: 'visiblePainted' } as const;
