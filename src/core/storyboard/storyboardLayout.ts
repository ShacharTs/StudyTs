import type { Point } from '../geometry/geometryPrimitives';
import type { StoryboardLayout, StoryboardNode } from './storyboard';

interface Size {
  w: number;
  h: number;
}

const MARGIN_X = 60;
const MARGIN_TOP = 60;
// The bottom of the picture is the speech bubble slot.
const BUBBLE_ZONE = 150;

interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

const areaOf = (size: Size): Area => ({ x: MARGIN_X, y: MARGIN_TOP, w: size.w - MARGIN_X * 2, h: size.h - MARGIN_TOP - BUBBLE_ZONE });

// n evenly spaced slots along a span, centred; one slot sits in the middle.
const spread = (index: number, count: number, start: number, length: number): number => start + (length * (index + 0.5)) / count;

type Slot = (index: number, count: number, area: Area) => Point;

const SLOTS: Record<StoryboardLayout, Slot> = {
  row: (index, count, area) => ({ x: spread(index, count, area.x, area.w), y: area.y + area.h / 2 }),
  column: (index, count, area) => ({ x: area.x + area.w / 2, y: spread(index, count, area.y, area.h) }),
  circle: (index, count, area) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const radius = (Math.min(area.w, area.h) / 2) * 0.85;
    return { x: area.x + area.w / 2 + radius * Math.cos(angle), y: area.y + area.h / 2 + radius * Math.sin(angle) };
  },
  grid: (index, count, area) => {
    const columns = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / columns);
    return { x: spread(index % columns, columns, area.x, area.w), y: spread(Math.floor(index / columns), rows, area.y, area.h) };
  },
};

const hasPosition = (node: StoryboardNode): node is StoryboardNode & Point => typeof node.x === 'number' && typeof node.y === 'number';

// A position for every node: the one it names, else the next slot of the layout among the nodes that name none.
export function placeNodes(nodes: StoryboardNode[], layout: StoryboardLayout, size: Size): Map<string, Point> {
  const loose = nodes.filter((node) => !hasPosition(node));
  const area = areaOf(size);
  const placed = new Map<string, Point>();
  for (const node of nodes) {
    if (hasPosition(node)) {
      placed.set(node.id, { x: node.x, y: node.y });
      continue;
    }
    const slot = SLOTS[layout](loose.indexOf(node), loose.length, area);
    placed.set(node.id, { x: Math.round(slot.x), y: Math.round(slot.y) });
  }
  return placed;
}
