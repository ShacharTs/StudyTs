/** Pure frame plan for the MP4 export: which timeline instant and which step each video frame shows. */

// The player waits for a click between steps; a video cannot, so each step's finished frame is held for reading.
export const STEP_HOLD_MS = 1500;
// Animations are played this many times slower than the live player, so the motion can be followed in a video.
export const EXPORT_SLOWDOWN = 2;

export interface Pacing {
  slowdown: number;
  stepHoldMs: number;
}

export const DEFAULT_PACING: Pacing = { slowdown: EXPORT_SLOWDOWN, stepHoldMs: STEP_HOLD_MS };

export interface FramePlan {
  timeMs: number;
  stepIndex: number;
}

export function planFrames(boundaries: number[], fps: number, pacing: Pacing = DEFAULT_PACING): FramePlan[] {
  const totalMs = boundaries.at(-1) ?? 0;
  if (totalMs <= 0) return [{ timeMs: 0, stepIndex: 0 }];

  // Slowing down means sampling the timeline more finely: one video frame advances the animation by less.
  const sampleMs = 1000 / fps / pacing.slowdown;
  const holdFrames = Math.round((pacing.stepHoldMs * fps) / 1000);
  const frames: FramePlan[] = [];
  boundaries.forEach((end, stepIndex) => {
    const start = stepIndex > 0 ? (boundaries[stepIndex - 1] ?? 0) : 0;
    for (let timeMs = start; timeMs < end; timeMs += sampleMs) frames.push({ timeMs, stepIndex });
    // The step index is explicit: a time exactly on a boundary would otherwise read as the next step.
    for (let i = 0; i < holdFrames; i += 1) frames.push({ timeMs: end, stepIndex });
  });
  return frames;
}
