// A narration-only step has no tween to give it length, so both the bar and the timeline use this one timer.
const EMPTY_STEP_MS = 600;
// Long enough to read a caption, however fast the spec plays.
const MIN_EMPTY_STEP_MS = 300;

// Spec time: the timeline runs at 1/speed of it, so the floor is scaled by speed to keep the same real length.
export const emptyStepSpecMs = (speed: number): number => Math.max(MIN_EMPTY_STEP_MS * speed, EMPTY_STEP_MS);
