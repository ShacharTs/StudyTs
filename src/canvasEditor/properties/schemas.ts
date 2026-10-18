import type { ObjectType } from '@canvasStore';
import { MARKER_KINDS, ROUTINGS, DEFAULT_LABEL_PT } from '../connectors/connectorGeometry';

export type FieldGroup = 'General' | 'Behavior' | 'Text' | 'Appearance' | 'Transform';

export const GROUP_ORDER: FieldGroup[] = ['General', 'Behavior', 'Text', 'Appearance', 'Transform'];

interface Base {
  key: string;
  label: string;
  group: FieldGroup;
  core?: boolean;
}

export type FieldSpec =
  | (Base & { kind: 'text'; placeholder?: string })
  | (Base & { kind: 'textarea'; placeholder?: string })
  | (Base & { kind: 'number'; min?: number; max?: number; default?: number; step?: number })
  | (Base & { kind: 'select'; options: string[]; default?: string })
  | (Base & { kind: 'color'; default: string; allowNone?: boolean })
  | (Base & { kind: 'checkbox'; default?: boolean });

const TRANSFORM_SCHEMA: FieldSpec[] = [
  { kind: 'number', key: 'x', label: 'X (mm)', group: 'Transform', core: true },
  { kind: 'number', key: 'y', label: 'Y (mm)', group: 'Transform', core: true },
  { kind: 'number', key: 'w', label: 'W (mm)', group: 'Transform', core: true, min: 5 },
  { kind: 'number', key: 'h', label: 'H (mm)', group: 'Transform', core: true, min: 5 },
  { kind: 'number', key: 'rotation', label: 'Rotate', group: 'Transform', core: true },
  { kind: 'number', key: 'zIndex', label: 'Layer', group: 'Transform', core: true, min: 1, max: 3 },
];

const NODE_SCHEMA: FieldSpec[] = [
  { kind: 'select', key: 'shape', label: 'Shape', group: 'General', options: ['circle', 'rect'], default: 'circle' },
  { kind: 'checkbox', key: 'start', label: 'Start', group: 'Behavior' },
  { kind: 'checkbox', key: 'accept', label: 'Accept', group: 'Behavior' },
  { kind: 'checkbox', key: 'selfLoop', label: 'Self-Loop', group: 'Behavior' },
  { kind: 'text', key: 'label', label: 'Label', group: 'Text' },
  { kind: 'number', key: 'fontSize', label: 'Font pt', group: 'Text', min: 6, default: 11 },
  { kind: 'color', key: 'textColor', label: 'Text color', group: 'Text', default: 'var(--text-1)' },
  { kind: 'color', key: 'fill', label: 'Fill', group: 'Appearance', default: 'var(--shape-fill)' },
  { kind: 'color', key: 'stroke', label: 'Stroke', group: 'Appearance', default: 'var(--text-1)' },
  { kind: 'number', key: 'strokeWidth', label: 'Stroke mm', group: 'Appearance', min: 0, default: 0.4, step: 0.1 },
];

const SHAPE_SCHEMA: FieldSpec[] = [
  {
    kind: 'select', key: 'shape', label: 'Kind', group: 'General', default: 'rect',
    options: ['rect', 'rounded', 'ellipse', 'diamond', 'triangle', 'pentagon', 'hexagon', 'star', 'callout', 'terminator', 'parallelogram', 'cylinder', 'server', 'router', 'switch', 'firewall', 'pc', 'cloud', 'hub', 'decision', 'interface', 'package', 'actor', 'fork'],
  },
  { kind: 'text', key: 'label', label: 'Label', group: 'Text' },
  { kind: 'number', key: 'fontSize', label: 'Font pt', group: 'Text', min: 6, default: 11 },
  { kind: 'color', key: 'labelColor', label: 'Text color', group: 'Text', default: 'var(--text-1)' },
  { kind: 'color', key: 'fill', label: 'Fill', group: 'Appearance', default: 'var(--shape-fill)' },
  { kind: 'color', key: 'stroke', label: 'Stroke', group: 'Appearance', default: 'var(--text-1)' },
  { kind: 'number', key: 'strokeWidth', label: 'Stroke mm', group: 'Appearance', min: 0, default: 0.4, step: 0.1 },
  { kind: 'select', key: 'strokeStyle', label: 'Line style', group: 'Appearance', options: ['solid', 'dashed', 'dotted'], default: 'solid' },
  { kind: 'number', key: 'opacity', label: 'Opacity', group: 'Appearance', min: 0, max: 1, default: 1, step: 0.1 },
  { kind: 'number', key: 'radius', label: 'Radius mm', group: 'Appearance', min: 0, default: 3 },
  { kind: 'checkbox', key: 'doubleStroke', label: 'Double stroke', group: 'Appearance' },
  { kind: 'number', key: 'tailX', label: 'Callout tail', group: 'Appearance', min: 0.05, max: 0.95, default: 0.2, step: 0.05 },
];

const LINE_SCHEMA: FieldSpec[] = [
  { kind: 'text', key: 'label', label: 'Label', group: 'Text' },
  { kind: 'number', key: 'labelFontSize', label: 'Label pt', group: 'Text', min: 4, default: DEFAULT_LABEL_PT },
  { kind: 'color', key: 'labelColor', label: 'Label color', group: 'Text', default: 'var(--text-1)' },
  { kind: 'select', key: 'routing', label: 'Routing', group: 'Behavior', options: [...ROUTINGS], default: 'straight' },
  { kind: 'select', key: 'markerStart', label: 'Start terminal', group: 'Behavior', options: [...MARKER_KINDS], default: 'none' },
  { kind: 'select', key: 'markerEnd', label: 'End terminal', group: 'Behavior', options: [...MARKER_KINDS], default: 'filled' },
  { kind: 'select', key: 'strokeStyle', label: 'Line style', group: 'Appearance', options: ['solid', 'dashed', 'dotted'], default: 'solid' },
  { kind: 'number', key: 'curvature', label: 'Curve mm', group: 'Behavior', default: 0 },
  { kind: 'color', key: 'stroke', label: 'Stroke', group: 'Appearance', default: 'var(--text-1)' },
  { kind: 'number', key: 'strokeWidth', label: 'Width mm', group: 'Appearance', min: 0.1, default: 0.5, step: 0.1 },
];

const EDGE_ONLY_HIDDEN_TRANSFORM_KEYS = new Set(['x', 'y', 'w', 'h', 'rotation']);
const BOUND_EDGE_TRANSFORM_SCHEMA: FieldSpec[] = TRANSFORM_SCHEMA.filter(
  (f) => !EDGE_ONLY_HIDDEN_TRANSFORM_KEYS.has(f.key)
);

const FORMULA_SCHEMA: FieldSpec[] = [
  { kind: 'textarea', key: 'latex', label: 'LaTeX', group: 'Text', placeholder: 'x^2 + y^2 = r^2' },
  { kind: 'checkbox', key: 'display', label: 'Display mode', group: 'Text' },
  { kind: 'number', key: 'fontSize', label: 'Font px', group: 'Text', min: 8, default: 16 },
];

const IMAGE_SCHEMA: FieldSpec[] = [
  { kind: 'select', key: 'fit', label: 'Fit', group: 'Appearance', options: ['contain', 'cover', 'fill'], default: 'contain' },
  { kind: 'number', key: 'opacity', label: 'Opacity', group: 'Appearance', min: 0, max: 1, default: 1, step: 0.1 },
];

const TEXT_SCHEMA: FieldSpec[] = [
  { kind: 'textarea', key: 'text', label: 'Text ($math$)', group: 'Text', placeholder: 'Enter text or $x^2$' },
  { kind: 'number', key: 'fontSize', label: 'Font pt', group: 'Text', min: 6, default: 12 },
  { kind: 'color', key: 'color', label: 'Text color', group: 'Text', default: 'var(--text-1)' },
  { kind: 'select', key: 'align', label: 'Align', group: 'Text', options: ['left', 'center', 'right'], default: 'left' },
  { kind: 'color', key: 'fill', label: 'Background', group: 'Appearance', default: 'transparent', allowNone: true },
  { kind: 'checkbox', key: 'autoFit', label: 'Auto-fit size', group: 'Behavior', default: true },
];

const UML_CLASS_SCHEMA: FieldSpec[] = [
  { kind: 'text', key: 'className', label: 'Class name', group: 'Text' },
  { kind: 'textarea', key: 'attributes', label: 'Attributes', group: 'Text', placeholder: '- field: Type' },
  { kind: 'textarea', key: 'methods', label: 'Methods', group: 'Text', placeholder: '+ method(): Type' },
  { kind: 'color', key: 'fill', label: 'Fill', group: 'Appearance', default: 'var(--bg-secondary)' },
  { kind: 'color', key: 'stroke', label: 'Stroke', group: 'Appearance', default: 'var(--text-1)' },
  { kind: 'number', key: 'strokeWidth', label: 'Stroke mm', group: 'Appearance', min: 0, default: 0.4, step: 0.1 },
];

const TABLE_SCHEMA: FieldSpec[] = [
  { kind: 'number', key: 'rows', label: 'Rows', group: 'General', min: 1, max: 30, default: 2 },
  { kind: 'number', key: 'cols', label: 'Columns', group: 'General', min: 1, max: 12, default: 3 },
  { kind: 'checkbox', key: 'headerRow', label: 'Header row', group: 'General', default: true },
  { kind: 'number', key: 'fontSize', label: 'Font pt', group: 'Text', min: 6, default: 11 },
  { kind: 'color', key: 'color', label: 'Text color', group: 'Text', default: 'var(--text-1)' },
  { kind: 'color', key: 'fill', label: 'Header fill', group: 'Appearance', default: 'var(--ac-18)' },
  { kind: 'color', key: 'stroke', label: 'Border', group: 'Appearance', default: 'var(--text-1)' },
  { kind: 'number', key: 'strokeWidth', label: 'Border mm', group: 'Appearance', min: 0, default: 0.3, step: 0.1 },
  { kind: 'checkbox', key: 'autoFit', label: 'Auto-fit size', group: 'Behavior', default: true },
];

export const SCHEMAS: Partial<Record<ObjectType, FieldSpec[]>> = {
  node: [...NODE_SCHEMA, ...TRANSFORM_SCHEMA],
  shape: [...SHAPE_SCHEMA, ...TRANSFORM_SCHEMA],
  line: [...LINE_SCHEMA, ...TRANSFORM_SCHEMA],
  edge: [...LINE_SCHEMA, ...TRANSFORM_SCHEMA],
  formula: [...FORMULA_SCHEMA, ...TRANSFORM_SCHEMA],
  image: [...IMAGE_SCHEMA, ...TRANSFORM_SCHEMA],
  text: [...TEXT_SCHEMA, ...TRANSFORM_SCHEMA],
  'uml-class': [...UML_CLASS_SCHEMA, ...TRANSFORM_SCHEMA],
  table: [...TABLE_SCHEMA, ...TRANSFORM_SCHEMA],
};

export const BOUND_EDGE_SCHEMA: FieldSpec[] = [...LINE_SCHEMA, ...BOUND_EDGE_TRANSFORM_SCHEMA];
