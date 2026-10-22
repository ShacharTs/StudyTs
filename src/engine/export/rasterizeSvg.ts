/**
 * Draws a live stage SVG onto a canvas. An SVG drawn as an Image cannot read the page's CSS variables,
 * so they are inlined as concrete colours first.
 */

import { flattenForeignObjects } from './flattenForeignObjects';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const SVG_MIME = 'image/svg+xml';
// Matches var(--name) and var(--name, fallback); the fallback runs to the closing parenthesis.
const CSS_VAR_PATTERN = /var\((--[\w-]+)(?:\s*,\s*([^)]*))?\)/g;

/** Replaces each var(--name[, fallback]) with the looked-up value, else its fallback, else nothing. */
export function resolveCssVars(markup: string, lookup: (name: string) => string | undefined): string {
  return markup.replace(CSS_VAR_PATTERN, (_match, name: string, fallback: string | undefined) => {
    return lookup(name) || fallback?.trim() || '';
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The stage could not be rendered to an image'));
    image.src = url;
  });
}

/**
 * Sizes a copy of the stage to the target canvas and lets the SVG's own preserveAspectRatio letterbox it,
 * so the export matches the on-screen framing without knowing the spec's aspect ratio here.
 */
function serializeStage(svg: SVGSVGElement, width: number, height: number, lookupVar: (name: string) => string): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', SVG_NAMESPACE);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  // Chrome refuses VideoFrames from a canvas that drew a foreignObject, so those are redrawn as plain SVG.
  flattenForeignObjects(svg, clone);
  return resolveCssVars(new XMLSerializer().serializeToString(clone), lookupVar);
}

export async function rasterizeSvgToCanvas(
  svg: SVGSVGElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: string,
): Promise<void> {
  const rootStyles = getComputedStyle(document.documentElement);
  const markup = serializeStage(svg, width, height, (name) => rootStyles.getPropertyValue(name).trim());
  // A blob URL keeps the image untainted, so the canvas can later be read as video frames.
  const url = URL.createObjectURL(new Blob([markup], { type: SVG_MIME }));
  try {
    const image = await loadImage(url);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
}
