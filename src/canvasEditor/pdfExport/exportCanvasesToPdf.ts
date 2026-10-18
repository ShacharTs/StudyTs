import { flushAllSaves } from '../saving/sceneSaving';
import type { ExportSection } from './exportPlan';
import { renderScenePages } from './renderScenePages';
import { printSheet, type SheetPart } from './printSheet';

const A4_PORTRAIT = { width: '210mm', height: '297mm' };

export interface PdfExportResult {
  /** Titles of canvases that could not be loaded; the PDF still holds all the others. */
  failed: string[];
  pageCount: number;
}

function dividerFor(section: ExportSection, size: { width: string; height: string }): SheetPart {
  if (section.kind === 'cover') return { kind: 'divider', variant: 'cover', title: section.title, subtitle: section.subtitle, ...size };
  return { kind: 'divider', variant: section.kind, title: section.title, kicker: section.kicker, ...size };
}

/** A topic's divider takes its first page's paper size, so the printout does not mix sheet sizes. */
function sizeOf(pages: HTMLElement[]): { width: string; height: string } {
  const first = pages[0];
  return first?.style.width ? { width: first.style.width, height: first.style.height } : A4_PORTRAIT;
}

/**
 * Prints every canvas in `sections`, in order, each topic preceded by its divider page.
 * `title` becomes the document title while printing, which is the saved PDF's file name.
 * `onProgress` gets (canvases done, canvases total).
 */
export async function exportCanvasesToPdf(
  sections: ExportSection[],
  options: { title?: string; onProgress?: (done: number, total: number) => void } = {},
): Promise<PdfExportResult> {
  const { title, onProgress } = options;
  await flushAllSaves();
  const total = sections.filter((section) => section.kind === 'topic').length;
  const parts: SheetPart[] = [];
  const failed: string[] = [];
  let done = 0;

  for (const section of sections) {
    if (section.kind !== 'topic') {
      parts.push(dividerFor(section, A4_PORTRAIT));
      continue;
    }
    try {
      const pages = await renderScenePages(section.sceneId);
      parts.push(dividerFor(section, sizeOf(pages)), ...pages.map((element): SheetPart => ({ kind: 'page', element })));
    } catch {
      failed.push(section.title);
    }
    onProgress?.(++done, total);
  }

  const pageCount = parts.filter((part) => part.kind === 'page').length;
  // Yield a frame so React/browser paints the final progress update (e.g. 8/8) before window.print() blocks the thread.
  await new Promise((resolve) => setTimeout(resolve, 80));
  if (pageCount > 0) await printSheet(parts, title);
  return { failed, pageCount };
}
