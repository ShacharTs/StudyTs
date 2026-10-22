/**
 * Renders every step of a visual topic into one MP4. The stage is mounted off-screen rather than hidden,
 * because the SVG needs real layout before the timeline and the rasterizer can read it.
 */
import { createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { VisualSpec } from '@engine/visualStepPlayer';
import { GenericSvgStage } from '@engine/visualStepPlayer/GenericSvgStage';
import { buildStepTimeline } from '@engine/visualStepPlayer/buildStepTimeline';
import { applyStepPresence } from '@engine/visualStepPlayer/applyStepPresence';
import { planFrames } from './frameSchedule';
import { createMp4Encoder, type Mp4Encoder } from './encodeMp4';
import { rasterizeSvgToCanvas } from './rasterizeSvg';

export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const VIDEO_FPS = 30;

const MICROSECONDS_PER_SECOND = 1000000;
// Pushes the stage far left, outside the viewport, while keeping it laid out (display:none would skip layout).
const OFFSCREEN_LEFT_PX = -10000;
const STAGE_BACKGROUND_TOKEN = '--stage-bg';
const YIELD_DELAY_MS = 0;

export interface ExportStepVideoOptions {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

interface MountedStage {
  svg: SVGSVGElement;
  unmount: () => void;
}

function mountStage(spec: VisualSpec): MountedStage {
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  Object.assign(container.style, {
    position: 'fixed',
    left: `${OFFSCREEN_LEFT_PX}px`,
    top: '0',
    width: `${VIDEO_WIDTH}px`,
    height: `${VIDEO_HEIGHT}px`,
    pointerEvents: 'none',
  });
  document.body.appendChild(container);

  const root = createRoot(container);
  const svgRef = createRef<SVGSVGElement>();
  // flushSync commits synchronously, so the svg ref is set before the timeline is built from it.
  flushSync(() => root.render(createElement(GenericSvgStage, { spec, svgRef })));

  const svg = svgRef.current;
  const unmount = () => {
    root.unmount();
    container.remove();
  };
  if (!svg) {
    unmount();
    throw new Error('The step stage did not render for video export.');
  }
  return { svg, unmount };
}

// Fails loudly on a missing token: a guessed colour would silently disagree with the player's stage.
function readStageBackground(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(STAGE_BACKGROUND_TOKEN).trim();
  if (!value) throw new Error(`The stage background token ${STAGE_BACKGROUND_TOKEN} is not defined.`);
  return value;
}

// Lets the page paint between frames so a long render does not freeze the tab.
function yieldToUi(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, YIELD_DELAY_MS));
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('MP4 export was cancelled.', 'AbortError');
}

interface FrameRender {
  stage: MountedStage;
  spec: VisualSpec;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  background: string;
}

async function renderFrames(
  render: FrameRender,
  encoder: Mp4Encoder,
  options: ExportStepVideoOptions,
): Promise<void> {
  const { stage, spec, canvas, ctx, background } = render;
  const { timeline, boundaries } = buildStepTimeline(stage.svg, spec, () => {});
  try {
    const frames = planFrames(boundaries, VIDEO_FPS);
    for (const [index, frame] of frames.entries()) {
      throwIfAborted(options.signal);
      // Seeking a paused timeline is deterministic, unlike playing it and sampling, so every frame is exact.
      timeline.pause();
      timeline.seek(frame.timeMs);
      applyStepPresence(stage.svg, spec, frame.stepIndex);
      await rasterizeSvgToCanvas(stage.svg, ctx, VIDEO_WIDTH, VIDEO_HEIGHT, background);
      await encoder.addFrame(canvas, (index * MICROSECONDS_PER_SECOND) / VIDEO_FPS);
      options.onProgress?.(index + 1, frames.length);
      await yieldToUi();
    }
  } finally {
    timeline.revert();
  }
}

export async function exportStepVideo(spec: VisualSpec, options: ExportStepVideoOptions = {}): Promise<Blob> {
  // Encoder first: an unsupported browser fails before anything is mounted on the page.
  const encoder = await createMp4Encoder({ width: VIDEO_WIDTH, height: VIDEO_HEIGHT, fps: VIDEO_FPS });
  const stage = mountStage(spec);
  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_WIDTH;
  canvas.height = VIDEO_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    stage.unmount();
    encoder.dispose();
    throw new Error('A 2D canvas is unavailable, so MP4 export cannot run.');
  }

  let finished = false;
  try {
    await renderFrames({ stage, spec, canvas, ctx, background: readStageBackground() }, encoder, options);
    const blob = await encoder.finish();
    finished = true;
    return blob;
  } finally {
    stage.unmount();
    if (!finished) encoder.dispose();
  }
}
