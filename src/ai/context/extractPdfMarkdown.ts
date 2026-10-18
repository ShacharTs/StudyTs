/**
 * Client-side PDF text extraction via bundled pdfjs-dist (no external
 * installs, works in dev and static Docker builds alike). Produces a
 * Markdown-ish digest the AI can read. Embedded images are dropped.
 */

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_OUTPUT_CHARS = 60_000;

export async function extractPdfMarkdown(file: File): Promise<string> {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('PDF exceeds 25MB limit');
  }

  // Lazy-load so pdfjs (~1MB) never lands in the main bundle
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  const parts: string[] = [`# ${file.name.replace(/\.pdf$/i, '')}`];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s{3,}/g, '\n')
      .trim();
    if (text) parts.push(`\n## Page ${pageNum}\n${text}`);

    const joined = parts.join('\n');
    if (joined.length > MAX_OUTPUT_CHARS) {
      parts.push(`\n[Truncated: ${doc.numPages - pageNum} more pages omitted]`);
      break;
    }
  }
  const markdown = parts.join('\n');
  if (markdown.trim().length < file.name.length + 5) {
    throw new Error('No extractable text found (scanned/image-only PDF)');
  }
  return markdown.slice(0, MAX_OUTPUT_CHARS);
}
