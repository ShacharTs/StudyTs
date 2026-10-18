import type { Point } from '../../geometry/geometryPrimitives';
import type { VisualElementSpec } from '../../types/visualSpec';
import { DEFAULT_SHAPE_COLOR } from '../builderColors';
import { elementBox, type GeometryBox } from '../builderGeometry';
import { createShapeElements } from '../shapeCatalog';
import { createLabelSlots, labelHostBox as slotHostBox } from './packLabelSlots';
import { packDrawing, svgToElements, withStrokeWidth } from './packDrawing';
import { packFrame } from './packPlacement';
import { parseSvgTemplate } from './parseSvgTemplate';
import { PACK_COLOR_TOKENS, type PackObjectDef } from './stylePackFormat';
import { packObjectByRef } from './stylePackRegistry';

const presetBox = (object: PackObjectDef, at: Point, viewWidth: number): GeometryBox => {
  const w = Math.round(object.size.w * viewWidth);
  const h = Math.round(object.size.h * viewWidth);
  return { x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2), w, h };
};

// The first primitive is the object; the rest follow it as parented decoration. Labels sit under the drawing's frame.
export function createPackElements(object: PackObjectDef, id: string, at: Point, viewWidth: number): VisualElementSpec[] {
  if (object.svg === undefined) return object.preset ? createShapeElements(object.preset, id, at, viewWidth) : [];
  const parsed = parseSvgTemplate(object.svg);
  if (!parsed.ok) return [];
  const box = presetBox(object, at, viewWidth);
  const color = object.color ? PACK_COLOR_TOKENS[object.color] : DEFAULT_SHAPE_COLOR;
  const [main, ...decoration] = svgToElements(parsed.nodes, packDrawing(object, box), color, object.defaultStyle);
  if (!main) return [];
  const withShape = { ...main, id, builder: { ...main.builder, shape: 'pack' as const } };
  const parts = decoration.map((el, index) => ({ ...el, id: `${id}-part-${index + 1}`, builder: { ...el.builder, parent: id } }));
  return [withShape, ...parts, ...createLabelSlots(object, id, packFrame(object, box).box)];
}

// The drawing alone, for a host that paints the shape itself; the step player adds ids and labels around it.
export function packDrawingElements(object: PackObjectDef, box: GeometryBox, colorToken: string, strokeWidth?: number): VisualElementSpec[] {
  if (object.svg === undefined) return [];
  const parsed = parseSvgTemplate(object.svg);
  if (!parsed.ok) return [];
  const drawing = packDrawing(object, box);
  return svgToElements(parsed.nodes, strokeWidth === undefined ? drawing : withStrokeWidth(drawing, strokeWidth), colorToken);
}

// A preset alias is an ordinary shape; only drawn objects carry the ref, on the main element.
export function createStampedPackElements(object: PackObjectDef, ref: string, id: string, at: Point, viewWidth: number): VisualElementSpec[] {
  const elements = createPackElements(object, id, at, viewWidth);
  if (object.preset) return elements;
  return elements.map((el, index) => (index === 0 ? { ...el, builder: { ...el.builder, pack: ref } } : el));
}

// The box a label is centred in: the object itself, or the strip beside it that labelAt names.
export function elementLabelHostBox(element: VisualElementSpec): GeometryBox {
  const slot = element.builder?.pack ? packObjectByRef(element.builder.pack)?.labelAt : undefined;
  return slotHostBox(elementBox(element), slot);
}
