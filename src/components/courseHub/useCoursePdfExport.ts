import { useState } from 'react';
import { useTranslation, HUB_TEXT } from '@i18n';
import { planExport, type PlanCourse } from '@canvasEditor/pdfExport/exportPlan';
import { buildDocumentTitle } from '../../hooks/useDocumentTitle';

const textOf = (value: unknown, resolve: (v?: unknown) => string): string => (typeof value === 'string' ? value : resolve(value));

interface PdfExportState {
  /** "Preparing PDF… 3/12" while running, null otherwise. */
  progress: string | null;
  error: string | null;
  exportPdf: (weekKey?: string) => Promise<void>;
}

/** Export of a whole course, or one week of it, as a single PDF of its canvases in course order. */
export function useCoursePdfExport(course: PlanCourse): PdfExportState {
  const { val, resolveLocalized } = useTranslation();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportPdf = async (weekKey?: string): Promise<void> => {
    if (progress) return;
    setError(null);
    const sections = planExport(course, resolveLocalized, val(HUB_TEXT.exportPdfSectionLabel), weekKey);
    if (sections.length === 0) return setError(val(HUB_TEXT.exportPdfEmpty));

    const status = (done: number, total: number) =>
      val(HUB_TEXT.exportingPdf).replace('{done}', String(done)).replace('{total}', String(total));
    setProgress(status(0, sections.filter((s) => s.kind === 'topic').length));
    try {
      // Loaded on demand: the exporter pulls in the whole page renderer, which the hub does not otherwise need.
      const { exportCanvasesToPdf } = await import('@canvasEditor/pdfExport/exportCanvasesToPdf');
      const weekTitle = weekKey && sections[0]?.kind === 'week' ? sections[0].title : undefined;
      const title = buildDocumentTitle(textOf(course.title, resolveLocalized), weekTitle);
      const { failed } = await exportCanvasesToPdf(sections, { title, onProgress: (done, total) => setProgress(status(done, total)) });
      if (failed.length > 0) setError(val(HUB_TEXT.exportPdfFailed).replace('{names}', failed.join(', ')));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  };

  return { progress, error, exportPdf };
}
