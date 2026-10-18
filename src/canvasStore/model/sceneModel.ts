
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export const PX_PER_MM = 96 / 25.4;

export const PAPER_SIZES_MM: Record<PaperSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  Letter: { w: 215.9, h: 279.4 },
  Legal: { w: 215.9, h: 355.6 },
  A3: { w: 297, h: 420 },
};

export const DEFAULT_PAPER_SIZE: PaperSize = 'A4';
export const GRID_MM = 5;
export const MARGIN_MM_DEFAULT = 20;

export function mmToPx(mm: number, zoom = 1): number {
  return mm * PX_PER_MM * zoom;
}

export function pxToMm(px: number, zoom = 1): number {
  return px / (PX_PER_MM * zoom);
}

export function pageSizeMm(
  orientation: Orientation,
  paperSize: PaperSize = DEFAULT_PAPER_SIZE
): { w: number; h: number } {
  const { w, h } = PAPER_SIZES_MM[paperSize];
  return orientation === 'landscape' ? { w: h, h: w } : { w, h };
}

export function clampToPage(
  x: number,
  y: number,
  w: number,
  h: number,
  orientation: Orientation,
  paperSize: PaperSize = DEFAULT_PAPER_SIZE
): { x: number; y: number } {
  const { w: pw, h: ph } = pageSizeMm(orientation, paperSize);
  return {
    x: Math.min(Math.max(x, 0), Math.max(0, pw - w)),
    y: Math.min(Math.max(y, 0), Math.max(0, ph - h)),
  };
}

/**
 * Clamps a full box (x, y, w, h) so it never extends past the page:
 * size is capped to the page's own dimensions first, then position is
 * clamped against that (possibly capped) size.
 */
export function clampBoxToPage(
  box: { x: number; y: number; w: number; h: number },
  orientation: Orientation,
  paperSize: PaperSize = DEFAULT_PAPER_SIZE
): { x: number; y: number; w: number; h: number } {
  const { w: pw, h: ph } = pageSizeMm(orientation, paperSize);
  const w = Math.min(Math.max(box.w, 0), pw);
  const h = Math.min(Math.max(box.h, 0), ph);
  const { x, y } = clampToPage(box.x, box.y, w, h, orientation, paperSize);
  return { x, y, w, h };
}

export function snapToGrid(mm: number, gridMm = GRID_MM): number {
  return Math.round(mm / gridMm) * gridMm;
}

const needsFix = (o: SceneObject) => o.type === 'line' && (o.w < 0 || o.h < 0);

/**
 * Lines drawn before direction flags existed stored a signed width/height (negative for a right-to-left or
 * bottom-to-top drag). Turn that into a positive box plus flipX/flipY. Anything else is left untouched, and a
 * document with no such line is returned as the same object.
 */
export function normalizeLines(doc: DocState): DocState {
  const broken = Object.values(doc.objects).filter(needsFix);
  if (broken.length === 0) return doc;
  const objects = { ...doc.objects };
  for (const o of broken) {
    const flips = { ...(o.w < 0 ? { flipX: true } : {}), ...(o.h < 0 ? { flipY: true } : {}) };
    objects[o.id] = { ...o, w: Math.abs(o.w), h: Math.abs(o.h), props: { ...o.props, ...flips } };
  }
  return { ...doc, objects };
}

interface TypeDefault {
  w: number;
  h: number;
  props: Record<string, unknown>;
}

export const objectTypeDefaults: Record<ObjectType, TypeDefault> = {
  shape: {
    w: 40,
    h: 30,
    props: {
      shape: 'rect',
      fill: 'var(--shape-fill)',
      stroke: 'var(--text-1)',
      strokeWidth: 0.4,
      opacity: 1,
      radius: 3,
      label: '',
      labelColor: 'var(--text-1)',
      fontSize: 11,
      doubleStroke: false,
    },
  },
  node: {
    w: 18,
    h: 18,
    props: {
      shape: 'circle',
      label: 'q',
      fill: 'transparent',
      stroke: 'var(--text-1)',
      strokeWidth: 0.4,
      textColor: 'var(--text-1)',
      fontSize: 11,
      start: false,
      accept: false,
    },
  },
  line: {
    w: 50,
    h: 0,
    props: {
      stroke: 'var(--text-1)',
      strokeWidth: 0.5,
      markerStart: 'none',
      markerEnd: 'filled',
      dash: false,
      label: '',
    },
  },
  edge: {
    w: 0,
    h: 0,
    props: {
      sourceId: '',
      targetId: '',
      sourcePort: null,
      targetPort: null,
      directed: true,
      curvature: 0,
      label: '',
      weight: '',
      stroke: 'var(--text-1)',
      strokeWidth: 0.5,
      dash: false,
    },
  },
  formula: {
    w: 60,
    h: 20,
    props: {
      latex: '\\text{formula}',
      display: false,
      fontSize: 16,
    },
  },
  image: {
    w: 60,
    h: 45,
    props: {
      src: '',
      fit: 'contain',
      opacity: 1,
    },
  },
  text: {
    w: 50,
    h: 20,
    props: {
      text: '',
      fontSize: 12,
      color: 'var(--text-1)',
      align: 'left',
    },
  },
  'uml-class': {
    w: 50,
    h: 40,
    props: {
      className: 'ClassName',
      attributes: '- field: Type',
      methods: '+ method(): ReturnType',
      fill: 'var(--bg-secondary)',
      stroke: 'var(--text-1)',
      strokeWidth: 0.4,
    },
  },
  table: {
    w: 90,
    h: 16,
    props: {
      rows: 2,
      cols: 3,
      cells: [],
      headerRow: true,
      fontSize: 11,
      color: 'var(--text-1)',
      fill: 'var(--ac-18)',
      stroke: 'var(--text-1)',
      strokeWidth: 0.3,
    },
  },
};

/** Ordinary objects live on layers 1..3; connectors sit on 4; 5 is reserved for selection chrome. */
export const MAX_OBJECT_LAYER = 3;
export const CONNECTOR_LAYER = 4;
export const OVERLAY_LAYER = 5;

export function isConnectorType(type: ObjectType): boolean {
  return type === 'edge' || type === 'line';
}

export function clampLayer(n: number): number {
  return Math.min(OVERLAY_LAYER, Math.max(1, Math.round(n)));
}

export function defaultLayerFor(type: ObjectType): number {
  return isConnectorType(type) ? CONNECTOR_LAYER : 1;
}

/** One step up/down for an ordinary object, staying inside 1..3. */
export function stepLayer(z: number, dir: 1 | -1): number {
  return Math.min(MAX_OBJECT_LAYER, Math.max(1, z + dir));
}

function normalizedLayer(o: SceneObject): number {
  return isConnectorType(o.type) ? CONNECTOR_LAYER : Math.min(MAX_OBJECT_LAYER, Math.max(1, Math.round(o.zIndex)));
}

/**
 * Brings a legacy document (unbounded z, connectors on arbitrary layers) onto the 1..4 scale.
 * The old stacking order is kept by re-sorting each page's object list by (old z, position)
 * before clamping. A document that is already valid is returned unchanged.
 */
export function normalizeLayers(doc: DocState): DocState {
  const all = Object.values(doc.objects);
  if (all.every((o) => o.zIndex === normalizedLayer(o))) return doc;

  const objects = { ...doc.objects };
  for (const o of all) objects[o.id] = { ...o, zIndex: normalizedLayer(o) };
  const pages = doc.pages.map((page) => {
    const order = page.objects
      .map((id, idx) => ({ id, idx, z: doc.objects[id]?.zIndex ?? 1 }))
      .sort((a, b) => a.z - b.z || a.idx - b.idx)
      .map((e) => e.id);
    return { ...page, objects: order };
  });
  return { ...doc, objects, pages };
}

export type ObjectType = 'shape' | 'node' | 'edge' | 'line' | 'formula' | 'image' | 'text' | 'uml-class' | 'table';

export type ShapeKind =
  | 'rect'
  | 'rounded'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'callout'
  | 'terminator'
  | 'parallelogram'
  | 'cylinder'
  | 'server'
  | 'interface'
  | 'package'
  | 'actor'
  | 'fork'
  | 'decision';

export interface SceneObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  hidden: boolean;
  anchorId: string | null;
  groupId: string | null;
  props: Record<string, unknown>;
}

export type Orientation = 'portrait' | 'landscape';
export type PaperSize = 'A4' | 'Letter' | 'Legal' | 'A3';

export interface Page {
  id: string;
  orientation: Orientation;
  paperSize: PaperSize;
  margin: number;
  objects: string[];
}

/** Page fields editable through commands; `objects` is the page's back-to-front object order. */
export type PagePatch = Partial<Pick<Page, 'orientation' | 'paperSize' | 'margin' | 'objects'>>;

export interface DocState {
  pages: Page[];
  objects: Record<string, SceneObject>;
}

export type ObjectPatch = Partial<Omit<SceneObject, 'id' | 'type'>>;


export function createPage(): Page {
  return {
    id: `page-${crypto.randomUUID()}`,
    orientation: 'portrait',
    paperSize: DEFAULT_PAPER_SIZE,
    margin: MARGIN_MM_DEFAULT,
    objects: [],
  };
}

export function createDoc(): DocState {
  return { pages: [createPage()], objects: {} };
}

export function createObject(type: ObjectType, overrides: Partial<SceneObject> = {}): SceneObject {
  const def = objectTypeDefaults[type];
  const { props: overrideProps, ...restOverrides } = overrides;
  return {
    id: `obj-${crypto.randomUUID()}`,
    type,
    x: 0,
    y: 0,
    w: def.w,
    h: def.h,
    rotation: 0,
    zIndex: defaultLayerFor(type),
    locked: false,
    hidden: false,
    anchorId: null,
    groupId: null,
    ...restOverrides,
    props: { ...def.props, ...(overrideProps ?? {}) },
  };
}
