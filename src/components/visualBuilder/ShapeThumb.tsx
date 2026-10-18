import { createElement, type CSSProperties } from 'react';
import type { VisualElementSpec } from '@core/types/visualSpec';
import { elementBox } from '@core/visualBuilder/builderGeometry';
import { buildTemplate, templateByRef } from '@core/visualBuilder/diagramPacks/buildTemplate';
import { createPackElements } from '@core/visualBuilder/diagramPacks/packObjectElements';
import { packObjectByRef } from '@core/visualBuilder/diagramPacks/stylePackRegistry';
import type { InsertCommand } from '@core/visualBuilder/galleryModel';
import { createShapeElements, DEFAULT_VIEW_WIDTH, SHAPE_PRESETS } from '@core/visualBuilder/shapeCatalog';
import styles from './InsertGallery.module.css';

const DRAWABLE = new Set(['circle', 'ellipse', 'rect', 'path']);
const PADDING = 6;
const ORIGIN = { x: 0, y: 0 };
const TEMPLATE_GLYPH = '▦';

// The built scene of the template, so a tile previews the diagram it inserts.
function templateElements(ref: string): VisualElementSpec[] {
  const template = templateByRef(ref);
  return template ? buildTemplate(template.def, 'en').elements : [];
}

function elementsFor(command: InsertCommand): VisualElementSpec[] {
  if (command.kind === 'preset') return createShapeElements(command.shape, 'thumb', ORIGIN, DEFAULT_VIEW_WIDTH);
  if (command.kind === 'template') return templateElements(command.id);
  if (command.kind !== 'pack') return [];
  const object = packObjectByRef(command.ref);
  return object ? createPackElements(object, 'thumb', ORIGIN, DEFAULT_VIEW_WIDTH) : [];
}

function glyphFor(command: InsertCommand): string {
  const preset = command.kind === 'preset' ? SHAPE_PRESETS.find((candidate) => candidate.shape === command.shape) : undefined;
  return preset?.glyph ?? TEMPLATE_GLYPH;
}

function viewBoxOf(elements: VisualElementSpec[]): string {
  const boxes = elements.map(elementBox);
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  const width = Math.max(1, right - left) + PADDING * 2;
  const height = Math.max(1, bottom - top) + PADDING * 2;
  return `${left - PADDING} ${top - PADDING} ${width} ${height}`;
}

// Drawn from the same element builders the canvas uses, as React elements: no markup string is parsed or injected here.
export function ShapeThumb({ command }: { command: InsertCommand }) {
  const drawable = elementsFor(command).filter((element) => DRAWABLE.has(element.kind));
  if (drawable.length === 0) return <span className={styles.glyph} aria-hidden="true">{glyphFor(command)}</span>;
  return (
    <svg className={styles.thumb} viewBox={viewBoxOf(drawable)} aria-hidden="true">
      {drawable.map((element, index) => createElement(element.kind, { key: index, ...element.attrs, style: element.style as CSSProperties }))}
    </svg>
  );
}
