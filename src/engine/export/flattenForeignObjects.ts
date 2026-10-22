/**
 * Chrome marks a canvas as tainted when it draws an SVG image that contains a foreignObject, and a tainted
 * canvas cannot become a VideoFrame. Math and bubble elements are foreignObjects, so for export each one is
 * replaced by plain SVG shapes and text that look like it. KaTeX layout is flattened to its visible text.
 */

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
// Average glyph width as a fraction of the font size; only used to decide where lines wrap.
const AVERAGE_GLYPH_WIDTH_EM = 0.55;
const LINE_HEIGHT_EM = 1.25;
const GEOMETRY_ATTRIBUTES = ['x', 'y', 'width', 'height'];
const KATEX_MATHML_SELECTOR = '.katex-mathml';

/** Breaks text into lines of at most `maxChars` characters at word boundaries; one long word stays whole. */
export function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const joined = current ? `${current} ${word}` : word;
    if (current && joined.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = joined;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// KaTeX renders each formula twice (MathML for screen readers, HTML for sight); only the visible half is drawn.
function visibleText(content: Element): string {
  const copy = content.cloneNode(true) as Element;
  copy.querySelectorAll(KATEX_MATHML_SELECTOR).forEach((node) => node.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const isTransparent = (color: string): boolean => color === 'transparent' || /^rgba\(.*,\s*0\)$/.test(color);

function numberAttribute(element: Element, name: string): number {
  return Number.parseFloat(element.getAttribute(name) ?? '') || 0;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function makeBackground(box: Box, style: CSSStyleDeclaration): SVGElement | null {
  const border = Number.parseFloat(style.borderTopWidth) || 0;
  if (isTransparent(style.backgroundColor) && border === 0) return null;
  const rect = document.createElementNS(SVG_NAMESPACE, 'rect');
  rect.setAttribute('x', String(box.x));
  rect.setAttribute('y', String(box.y));
  rect.setAttribute('width', String(box.width));
  rect.setAttribute('height', String(box.height));
  rect.setAttribute('rx', String(Number.parseFloat(style.borderTopLeftRadius) || 0));
  rect.setAttribute('fill', isTransparent(style.backgroundColor) ? 'none' : style.backgroundColor);
  if (border > 0) {
    rect.setAttribute('stroke', style.borderTopColor);
    rect.setAttribute('stroke-width', String(border));
  }
  return rect;
}

function makeText(box: Box, text: string, style: CSSStyleDeclaration): SVGElement {
  const fontSize = Number.parseFloat(style.fontSize) || 16;
  const maxChars = Math.max(1, Math.floor(box.width / (fontSize * AVERAGE_GLYPH_WIDTH_EM)));
  const lines = wrapText(text, maxChars);
  const lineHeight = fontSize * LINE_HEIGHT_EM;
  const textEl = document.createElementNS(SVG_NAMESPACE, 'text');
  textEl.setAttribute('x', String(box.x + box.width / 2));
  textEl.setAttribute('text-anchor', 'middle');
  textEl.setAttribute('fill', style.color);
  textEl.setAttribute('font-size', String(fontSize));
  textEl.setAttribute('font-family', style.fontFamily);
  textEl.setAttribute('font-weight', style.fontWeight);
  // The block of lines is centred vertically in the box.
  const firstBaseline = box.y + box.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    const tspan = document.createElementNS(SVG_NAMESPACE, 'tspan');
    tspan.setAttribute('x', String(box.x + box.width / 2));
    tspan.setAttribute('y', String(firstBaseline + index * lineHeight));
    tspan.setAttribute('dominant-baseline', 'central');
    tspan.textContent = line;
    textEl.appendChild(tspan);
  });
  return textEl;
}

// The group keeps the foreignObject's own attributes (transform, opacity, data-visual-id) so animation still applies.
function groupFor(cloneObject: Element): SVGElement {
  const group = document.createElementNS(SVG_NAMESPACE, 'g');
  for (const { name, value } of Array.from(cloneObject.attributes)) {
    if (!GEOMETRY_ATTRIBUTES.includes(name)) group.setAttribute(name, value);
  }
  return group;
}

/** Replaces every foreignObject in `clone` with SVG shapes, reading colours and fonts from the live stage. */
export function flattenForeignObjects(live: SVGSVGElement, clone: SVGSVGElement): void {
  const liveObjects = Array.from(live.querySelectorAll('foreignObject'));
  const cloneObjects = Array.from(clone.querySelectorAll('foreignObject'));
  cloneObjects.forEach((cloneObject, index) => {
    const content = liveObjects[index]?.firstElementChild;
    const group = groupFor(cloneObject);
    if (content) {
      const box: Box = {
        x: numberAttribute(cloneObject, 'x'),
        y: numberAttribute(cloneObject, 'y'),
        width: numberAttribute(cloneObject, 'width'),
        height: numberAttribute(cloneObject, 'height'),
      };
      const style = getComputedStyle(content);
      const background = makeBackground(box, style);
      if (background) group.appendChild(background);
      const text = visibleText(content);
      if (text) group.appendChild(makeText(box, text, style));
    }
    cloneObject.replaceWith(group);
  });
}
