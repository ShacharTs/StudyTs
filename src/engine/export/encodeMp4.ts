/**
 * Encodes canvas frames into an H.264 MP4 with WebCodecs. The muxer only accepts H.264 here, so an
 * unsupported browser fails loudly rather than producing a file the user cannot play.
 */
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

// Tried in order: High 4.0, Main 4.0, Baseline 3.1. Baseline is the widest-supported fallback.
const H264_CODEC_STRINGS = ['avc1.640028', 'avc1.4d0028', 'avc1.42001f'];
const VIDEO_BITRATE = 8000000;
// A keyframe every two seconds at 30 fps keeps seeking in the file cheap.
const KEYFRAME_INTERVAL_FRAMES = 60;
// Caps how far the encoder may fall behind the canvas; past this the frame loop waits for it to drain.
const MAX_ENCODE_QUEUE = 8;
const DRAIN_POLL_MS = 10;
const MP4_MIME = 'video/mp4';

export class Mp4UnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Mp4UnsupportedError';
  }
}

export interface Mp4EncoderOptions {
  width: number;
  height: number;
  fps: number;
}

export interface Mp4Encoder {
  addFrame(canvas: HTMLCanvasElement, timestampUs: number): Promise<void>;
  finish(): Promise<Blob>;
  /** Releases the encoder without producing a file; safe after finish or an encoder error. */
  dispose(): void;
}

async function pickH264Codec({ width, height, fps }: Mp4EncoderOptions): Promise<string> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Mp4UnsupportedError('This browser has no WebCodecs video encoder, so MP4 export is unavailable.');
  }
  for (const codec of H264_CODEC_STRINGS) {
    const support = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate: VIDEO_BITRATE, framerate: fps });
    if (support.supported) return codec;
  }
  throw new Mp4UnsupportedError('This browser cannot encode H.264 video, so MP4 export is unavailable.');
}

async function waitForDrain(encoder: VideoEncoder): Promise<void> {
  while (encoder.encodeQueueSize > MAX_ENCODE_QUEUE) {
    await new Promise((resolve) => setTimeout(resolve, DRAIN_POLL_MS));
  }
}

export async function createMp4Encoder(options: Mp4EncoderOptions): Promise<Mp4Encoder> {
  const { width, height, fps } = options;
  const codec = await pickH264Codec(options);
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: 'avc', width, height }, fastStart: 'in-memory' });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      encoderError = err;
    },
  });
  encoder.configure({ codec, width, height, bitrate: VIDEO_BITRATE, framerate: fps });

  const throwIfFailed = () => {
    if (encoderError) throw encoderError;
  };

  let frameCount = 0;
  return {
    async addFrame(canvas, timestampUs) {
      throwIfFailed();
      await waitForDrain(encoder);
      // The VideoFrame wraps the canvas pixels at this instant, so it must be closed right after encoding.
      const frame = new VideoFrame(canvas, { timestamp: timestampUs });
      try {
        encoder.encode(frame, { keyFrame: frameCount % KEYFRAME_INTERVAL_FRAMES === 0 });
      } finally {
        frame.close();
      }
      frameCount += 1;
    },
    async finish() {
      await encoder.flush();
      throwIfFailed();
      encoder.close();
      muxer.finalize();
      return new Blob([target.buffer], { type: MP4_MIME });
    },
    dispose() {
      if (encoder.state !== 'closed') encoder.close();
    },
  };
}
