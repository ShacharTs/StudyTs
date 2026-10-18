import type { Point } from '../geometry/geometryPrimitives';
import type { BuilderShape, VisualElementSpec } from '../types/visualSpec';
import { DEFAULT_STAGE } from '../shared/stageSize';
import { DEFAULT_SHAPE_COLOR, GLOW_OFF } from './builderColors';
import { MIN_SIZE, diamondPath, linePath, pointerPath, trianglePath, type GeometryBox } from './builderGeometry';

// A pack object is not a preset: its geometry comes from the pack svg, so the preset tables never list 'pack'.
export type PresetShape = Exclude<BuilderShape, 'pack'>;

export interface ShapePreset {
  shape: PresetShape;
  label: string;
  glyph: string;
}

export const SHAPE_PRESETS: ShapePreset[] = [
  { shape: 'circle', label: 'Circle', glyph: '○' },
  { shape: 'ellipse', label: 'Oval', glyph: '⬭' },
  { shape: 'box', label: 'Box', glyph: '▭' },
  { shape: 'rounded', label: 'Rounded box', glyph: '▢' },
  { shape: 'diamond', label: 'Diamond', glyph: '◇' },
  { shape: 'triangle', label: 'Triangle', glyph: '△' },
  { shape: 'line', label: 'Line', glyph: '╱' },
  { shape: 'arrow', label: 'Arrow', glyph: '→' },
  { shape: 'text', label: 'Text', glyph: 'T' },
  { shape: 'heading', label: 'Heading', glyph: 'H' },
  { shape: 'caption', label: 'Caption', glyph: 't' },
  { shape: 'note', label: 'Note', glyph: '🗨' },
];

// A template names a basic preset as 'preset/<shape>' so it never needs a pack object that only repeats one.
export function presetOfRef(ref: string): PresetShape | undefined {
  const [pack, shape] = ref.split('/');
  return pack === 'preset' ? SHAPE_PRESETS.find((preset) => preset.shape === shape)?.shape : undefined;
}

export const shapeLabel = (shape?: BuilderShape): string => SHAPE_PRESETS.find((preset) => preset.shape === shape)?.label ?? 'Shape';

export const DEFAULT_VIEW_WIDTH = DEFAULT_STAGE.w;

// 1 view unit = 1 px at 100 percent zoom; sizes are fractions of the view width so a new shape looks as big as lecture content at any view box.
const SIZE_FRACTION: Record<PresetShape, { w: number; h: number }> = {
  circle: { w: 0.09, h: 0.09 },
  ellipse: { w: 0.175, h: 0.11 },
  box: { w: 0.175, h: 0.1 },
  rounded: { w: 0.175, h: 0.1 },
  diamond: { w: 0.1625, h: 0.125 },
  triangle: { w: 0.15, h: 0.125 },
  pointer: { w: 0.03, h: 0.12 },
  line: { w: 0.2, h: 0 },
  arrow: { w: 0.2, h: 0 },
  text: { w: 0.175, h: 0.04 },
  heading: { w: 0.4, h: 0.07 },
  caption: { w: 0.2, h: 0.03 },
  note: { w: 0.325, h: 0.1 },
};

export function shapeStyle(color: string = DEFAULT_SHAPE_COLOR): Record<string, number | string> {
  return { fill: color, fillOpacity: 0.25, stroke: color, color, strokeWidth: 3, filter: GLOW_OFF, transformBox: 'fill-box', transformOrigin: 'center' };
}

const lineStyle = (color: string): Record<string, number | string> => ({ fill: 'none', stroke: color, color, strokeWidth: 3, filter: GLOW_OFF });

// Where a node's text label sits: centred, a little narrower than the node.
export function labelBox(box: GeometryBox): GeometryBox {
  const w = Math.max(MIN_SIZE, box.w - 16);
  const h = 28;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

export function createLabel(parentId: string, box: GeometryBox, text: string): VisualElementSpec {
  const place = labelBox(box);
  return {
    id: `${parentId}-label`,
    kind: 'math',
    attrs: { x: place.x, y: place.y, width: place.w, height: place.h },
    content: text,
    style: { color: 'var(--text-primary)', '--label-size': '1rem' },
    builder: { shape: 'text', parent: parentId },
  };
}

type MainFactory = (id: string, box: GeometryBox) => VisualElementSpec;

const center = (box: GeometryBox): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
const textFrame = (box: GeometryBox) => ({ x: box.x, y: box.y, width: box.w, height: box.h });

const rectFactory = (shape: PresetShape, extra: Record<string, number>): MainFactory => (id, box) => ({
  id, kind: 'rect', attrs: { ...textFrame(box), ...extra }, style: shapeStyle(), builder: { shape },
});

const pathFactory = (shape: PresetShape, draw: (box: GeometryBox) => string): MainFactory => (id, box) => ({
  id, kind: 'path', attrs: { d: draw(box) }, style: shapeStyle(), builder: { shape, box },
});

const lineFactory = (shape: PresetShape): MainFactory => (id, box) => ({
  id,
  kind: 'path',
  attrs: { d: linePath({ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y + box.h }, shape === 'arrow') },
  style: lineStyle(DEFAULT_SHAPE_COLOR),
  builder: { shape, box },
});

const textFactory = (shape: PresetShape, content: string, look: Record<string, number | string>): MainFactory => (id, box) => ({
  id, kind: 'math', attrs: textFrame(box), content, style: { color: 'var(--text-primary)', ...look }, builder: { shape },
});

const MAIN_FACTORIES: Record<PresetShape, MainFactory> = {
  circle: (id, box) => ({ id, kind: 'circle', attrs: { cx: center(box).x, cy: center(box).y, r: box.w / 2 }, style: shapeStyle(), builder: { shape: 'circle' } }),
  ellipse: (id, box) => ({ id, kind: 'ellipse', attrs: { cx: center(box).x, cy: center(box).y, rx: box.w / 2, ry: box.h / 2 }, style: shapeStyle(), builder: { shape: 'ellipse' } }),
  box: rectFactory('box', {}),
  rounded: rectFactory('rounded', { rx: 16 }),
  diamond: pathFactory('diamond', diamondPath),
  triangle: pathFactory('triangle', trianglePath),
  pointer: pathFactory('pointer', pointerPath),
  line: lineFactory('line'),
  arrow: lineFactory('arrow'),
  text: textFactory('text', 'Text', { '--label-size': '1.15rem' }),
  heading: textFactory('heading', 'Heading', { '--label-size': '2.2rem', '--label-weight': 800 }),
  caption: textFactory('caption', 'Caption', { '--label-size': '0.85rem', '--label-weight': 400 }),
  note: (id, box) => ({ id, kind: 'bubble', attrs: textFrame(box), content: '**Note** — write here', style: { '--bubble-color': DEFAULT_SHAPE_COLOR }, builder: { shape: 'note' } }),
};

// The elements for one palette click: the bare shape; a label is added on request.
export function createShapeElements(shape: BuilderShape, id: string, at: Point, viewWidth: number = DEFAULT_VIEW_WIDTH): VisualElementSpec[] {
  // A pack object draws itself from its svg (createPackElements); it has no preset geometry.
  if (shape === 'pack') return [];
  const w = Math.round(SIZE_FRACTION[shape].w * viewWidth);
  const h = Math.round(SIZE_FRACTION[shape].h * viewWidth);
  const box: GeometryBox = { x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2), w, h };
  const main = MAIN_FACTORIES[shape](id, box);
  return [main];
}
