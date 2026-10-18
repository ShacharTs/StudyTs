import '../print.css';
import './pdfExport.css';

/** One printed sheet: a divider page, or an already-rendered canvas page. */
export type SheetPart =
  | { kind: 'divider'; variant: 'cover' | 'week' | 'topic'; kicker?: string; title: string; subtitle?: string; width: string; height: string }
  | { kind: 'page'; element: HTMLElement };

const ROOT_ID = 'pdfExportRoot';
const IMAGE_WAIT_MS = 4000;

function text(tag: string, className: string, content: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  el.dir = 'auto';
  el.textContent = content;
  return el;
}

function dividerElement(part: Extract<SheetPart, { kind: 'divider' }>): HTMLElement {
  const el = document.createElement('section');
  el.className = `pdfDivider pdfDivider--${part.variant}`;
  el.style.width = part.width;
  el.style.height = part.height;
  if (part.kicker) el.append(text('p', 'pdfDividerKicker', part.kicker));
  el.append(text('h1', 'pdfDividerTitle', part.title));
  const rule = document.createElement('div');
  rule.className = 'pdfDividerRule';
  el.append(rule);
  if (part.subtitle) el.append(text('p', 'pdfDividerSubtitle', part.subtitle));
  return el;
}

/** Resolves once every image under `container` has loaded, or after a timeout so one broken image cannot hang the export. */
export async function waitForImages(container: ParentNode, timeoutMs = IMAGE_WAIT_MS): Promise<void> {
  const pending = [...container.querySelectorAll('img')]
    .filter((img) => !img.complete)
    .map((img) => new Promise<void>((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    }));
  await Promise.race([Promise.all(pending), new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}

/** Prints the parts, in order, as the only content of the document; the user picks "Save as PDF" in the print dialog. */
export async function printSheet(parts: SheetPart[], title?: string): Promise<void> {
  document.getElementById(ROOT_ID)?.remove();
  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.append(...parts.map((part) => (part.kind === 'divider' ? dividerElement(part) : part.element)));
  document.body.append(root);
  document.body.classList.add('pdfExporting');
  // The browser names the saved PDF after the document title.
  const previousTitle = document.title;
  if (title) document.title = title;

  const cleanup = () => {
    document.title = previousTitle;
    document.body.classList.remove('pdfExporting');
    root.remove();
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  try {
    await waitForImages(root);
    window.print();
  } catch (err) {
    window.removeEventListener('afterprint', cleanup);
    cleanup();
    throw err;
  }
}
