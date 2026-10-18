import type { Point } from '../geometry/geometryPrimitives';
import { distanceToSegment, pathSegments } from '../geometry/pathSegments';
import type { BuilderSide, VisualElementSpec, VisualSpec } from '../types/visualSpec';
import { SIDES, elementBox, type GeometryBox } from './builderGeometry';
import { elementPortPoint } from './elementPortPoint';
import { hasPorts } from './connectable';

export type Hit =
  | { kind: 'handle' | 'shape' | 'link'; id: string }
  | { kind: 'port'; id: string; side: BuilderSide }
  | { kind: 'background' };

export interface HitOptions {
  selectedId: string | null;
  // The shape under the cursor, so its ports can be grabbed.
  hoverId?: string | null;
  // Ports exist only for the Arrow tool; Select never starts an arrow.
  arrow?: boolean;
  // Hit radius in view units; the canvas passes a screen-constant value.
  portRadius?: number;
}

const SLACK = 4;
const LINK_TOLERANCE = 5;
const HANDLE_RADIUS = 10;
const HANDLE_OFFSET = 4;
const DEFAULT_PORT_RADIUS = 9;
const ROUND_KINDS = ['circle', 'ellipse'];
const BACKGROUND: Hit = { kind: 'background' };

const isLink = (el: VisualElementSpec): boolean => el.builder?.link !== undefined;
// Labels belong to their shape, speech bubbles to the step script and overlays to their effect: none of them take clicks.
// If an element's parent is missing from the spec, it is an orphan and takes clicks so the user can select and delete it.
const isHelper = (el: VisualElementSpec, allIds?: Set<string>): boolean =>
  el.builder?.say === true || (el.builder?.parent !== undefined && (allIds ? allIds.has(el.builder.parent) : true)) || el.builder?.fx === true;
const isShape = (el: VisualElementSpec, allIds?: Set<string>): boolean => !isLink(el) && !isHelper(el, allIds);

function insideEllipse(point: Point, box: GeometryBox, slack: number): boolean {
  const rx = box.w / 2 + slack;
  const ry = box.h / 2 + slack;
  const dx = (point.x - box.x - box.w / 2) / rx;
  const dy = (point.y - box.y - box.h / 2) / ry;
  return dx * dx + dy * dy <= 1;
}

const insideBox = (point: Point, box: GeometryBox, slack: number): boolean =>
  point.x >= box.x - slack && point.x <= box.x + box.w + slack && point.y >= box.y - slack && point.y <= box.y + box.h + slack;

function insideShape(el: VisualElementSpec, point: Point, slack: number): boolean {
  const box = elementBox(el);
  return ROUND_KINDS.includes(el.kind) ? insideEllipse(point, box, slack) : insideBox(point, box, slack);
}

function handleHit(spec: VisualSpec, point: Point, selectedId: string | null): Hit | null {
  const allIds = new Set(spec.elements.map((e) => e.id));
  const el = spec.elements.find((candidate) => candidate.id === selectedId);
  if (!el || !isShape(el, allIds)) return null;
  const box = elementBox(el);
  const distance = Math.hypot(point.x - (box.x + box.w + HANDLE_OFFSET), point.y - (box.y + box.h + HANDLE_OFFSET));
  return distance <= HANDLE_RADIUS ? { kind: 'handle', id: el.id } : null;
}

function portHit(spec: VisualSpec, point: Point, options: HitOptions): Hit | null {
  if (!options.arrow) return null;
  const allIds = new Set(spec.elements.map((e) => e.id));
  const radius = options.portRadius ?? DEFAULT_PORT_RADIUS;
  const eligible = spec.elements.filter((el) => isShape(el, allIds) && hasPorts(el) && (el.id === options.selectedId || el.id === options.hoverId));
  for (const el of [...eligible].reverse()) {
    const side = SIDES.find((candidate) => {
      const port = elementPortPoint(el, candidate);
      return Math.hypot(point.x - port.x, point.y - port.y) <= radius;
    });
    if (side) return { kind: 'port', id: el.id, side };
  }
  return null;
}

function shapeHit(spec: VisualSpec, point: Point, slack: number, skip: (id: string) => boolean = () => false): Hit | null {
  const allIds = new Set(spec.elements.map((e) => e.id));
  const found = [...spec.elements].reverse().find((el) => isShape(el, allIds) && !skip(el.id) && insideShape(el, point, slack));
  return found ? { kind: 'shape', id: found.id } : null;
}

function distanceToLink(el: VisualElementSpec, point: Point): number {
  return Math.min(Infinity, ...pathSegments(String(el.attrs.d ?? '')).map((segment) => distanceToSegment(point, segment)));
}

function linkHit(spec: VisualSpec, point: Point): Hit | null {
  const nearest = spec.elements
    .filter(isLink)
    .map((el) => ({ id: el.id, distance: distanceToLink(el, point) }))
    .filter((candidate) => candidate.distance <= LINK_TOLERANCE)
    .sort((a, b) => a.distance - b.distance)[0];
  return nearest ? { kind: 'link', id: nearest.id } : null;
}

// What is under the pointer, by priority: a shape that is neither selected nor hovered, the resize handle, a port,
// the selected or hovered shape's inside, a shape's rim, the nearest link.
// A neighbour's inside comes before grips so a grip just outside the selected shape cannot shadow it.
// The rim comes before links so a connector running a few pixels off a shape does not steal the press from it.
export function hitTest(spec: VisualSpec, point: Point, options: HitOptions): Hit {
  const isGripOwner = (id: string): boolean => id === options.selectedId || id === options.hoverId;
  return (
    shapeHit(spec, point, 0, isGripOwner) ??
    handleHit(spec, point, options.selectedId) ??
    portHit(spec, point, options) ??
    shapeHit(spec, point, 0) ??
    shapeHit(spec, point, SLACK) ??
    linkHit(spec, point) ??
    BACKGROUND
  );
}
