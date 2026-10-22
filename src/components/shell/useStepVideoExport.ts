import { useState } from 'react';
import { useTranslation, HUB_TEXT } from '@i18n';
import type { VisualSpec } from '@engine/visualStepPlayer';

const MP4_EXTENSION = '.mp4';
const PERCENT_SCALE = 100;

interface StepVideoExportState {
  /** "Rendering MP4… 3/12" while running, null otherwise. */
  progress: string | null;
  error: string | null;
  exportVideo: () => Promise<void>;
}

// Revoked right after the click: the browser has already started the download from the object URL.
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Renders the whole topic (every step, stage only) to an MP4 and downloads it. */
export function useStepVideoExport(spec: VisualSpec, topicId: string): StepVideoExportState {
  const { val } = useTranslation();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportVideo = async (): Promise<void> => {
    if (progress) return;
    setError(null);
    // A frame count means nothing to the viewer, so progress is shown as a percentage.
    const status = (done: number, total: number) =>
      val(HUB_TEXT.exportingVideo).replace('{percent}', String(total > 0 ? Math.floor((done / total) * PERCENT_SCALE) : 0));
    setProgress(status(0, 0));
    try {
      // Loaded on demand: the encoder and stage renderer are only needed when someone exports.
      const { exportStepVideo } = await import('@engine/export/exportStepVideo');
      const blob = await exportStepVideo(spec, { onProgress: (done, total) => setProgress(status(done, total)) });
      downloadBlob(blob, `${topicId}${MP4_EXTENSION}`);
    } catch (cause) {
      // Logged so a failure can be diagnosed; the viewer sees the short label plus the reason.
      console.error('MP4 export failed', cause);
      const reason = cause instanceof Error && cause.message ? `: ${cause.message}` : '';
      setError(`${val(HUB_TEXT.exportVideoFailed)}${reason}`);
    } finally {
      setProgress(null);
    }
  };

  return { progress, error, exportVideo };
}
