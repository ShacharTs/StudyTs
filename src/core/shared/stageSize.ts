export interface StageSize {
  w: number;
  h: number;
}

// The only place that names a stage size: a coordinate system for new diagrams, not a pixel size (the player scales it to any screen).
export const DEFAULT_STAGE: StageSize = { w: 800, h: 520 };

const MIN_STAGE_HEIGHT = 360;
const MAX_STAGE_HEIGHT = 640;
const HEIGHT_STEP = 10;

export function parseViewBox(viewBox: string, fallback: StageSize = DEFAULT_STAGE): StageSize {
  const [, , w, h] = viewBox.trim().split(/\s+/).map(Number);
  return { w: w > 0 ? w : fallback.w, h: h > 0 ? h : fallback.h };
}

export const viewBoxOf = (size: StageSize): string => `0 0 ${size.w} ${size.h}`;

// A new diagram gets the monitor's own aspect (16:9 on a 1080p or 1440p screen, 16:10 on a laptop), so the stage fills the screen instead of leaving bands.
export function stageForScreen(screenWidth: number, screenHeight: number): StageSize {
  if (!(screenWidth > 0 && screenHeight > 0)) return DEFAULT_STAGE;
  const height = Math.round((DEFAULT_STAGE.w * screenHeight) / screenWidth / HEIGHT_STEP) * HEIGHT_STEP;
  return { w: DEFAULT_STAGE.w, h: Math.min(MAX_STAGE_HEIGHT, Math.max(MIN_STAGE_HEIGHT, height)) };
}
