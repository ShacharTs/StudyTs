import type { ParsedDiagram } from './diagramParsers';
import type { GraphState, GraphNode, GraphEdge } from '../../types/visualizationState';

/**
 * Deterministic layered layout: rows by topological depth (root-first),
 * columns evenly spaced within each row. Not a real auto-layout engine
 * (no edge-crossing minimization, no dagre/elk) — ponytail: readable up to
 * ~15 nodes; a dense diagram may overlap. Upgrade to a real layout library
 * only if a real AI-generated diagram needs it (this parser targets small
 * teaching-scale diagrams, not large real-world architecture dumps).
 */

interface LayoutBounds {
  width: number;
  height: number;
}

const DEFAULT_BOUNDS: LayoutBounds = { width: 800, height: 500 };
const ROW_HEIGHT = 120;
const NODE_MARGIN_TOP = 60;

function computeDepths(diagram: ParsedDiagram): Map<string, number> {
  const depth = new Map<string, number>();
  // Top-down: inheritance edge Child -> Parent means Child depends on Parent,
  // so Parent should be assigned first (lower y) — but Kahn's with from=dep puts
  // dep earlier if we treat incoming edges as prerequisites. Reverse direction
  // for inheritance convention: target of inheritance is root.
  const incoming = new Map<string, Set<string>>();
  for (const node of diagram.nodes) incoming.set(node.id, new Set());
  for (const edge of diagram.edges) {
    // For inheritance/extends, edge from Child to Parent: Parent is root, should come first.
    // We model dependency as: parent must be placed before child.
    if (edge.edgeStyle === 'extends') {
      if (incoming.has(edge.from)) incoming.get(edge.from)!.add(edge.to); // child depends on parent
    } else {
      if (incoming.has(edge.to)) incoming.get(edge.to)!.add(edge.from);
    }
  }

  const remaining = new Set(diagram.nodes.map((n) => n.id));
  let currentDepth = 0;
  let guard = diagram.nodes.length + 1;

  // Root-first: nodes with no incoming edges start at depth 0; descendants follow.
  while (remaining.size > 0 && guard > 0) {
    guard -= 1;
    // Ready = nodes whose dependencies are all already assigned (or have no incoming from remaining)
    const ready = [...remaining].filter((id) => {
      const deps = incoming.get(id) ?? new Set();
      return [...deps].every((dep) => !remaining.has(dep));
    });
    const toAssign = ready.length > 0 ? ready : [...remaining];
    for (const id of toAssign) {
      depth.set(id, currentDepth);
      remaining.delete(id);
    }
    currentDepth += 1;
  }

  return depth;
}

export function layoutNodes(diagram: ParsedDiagram, bounds: LayoutBounds = DEFAULT_BOUNDS): Map<string, { x: number; y: number }> {
  const depths = computeDepths(diagram);
  const rowCounts = new Map<number, number>();
  for (const d of depths.values()) rowCounts.set(d, (rowCounts.get(d) ?? 0) + 1);
  const rowCursor = new Map<number, number>();

  const positions = new Map<string, { x: number; y: number }>();
  const sortedNodes = [...diagram.nodes].sort((a, b) => a.id.localeCompare(b.id));

  for (const node of sortedNodes) {
    const d = depths.get(node.id) ?? 0;
    const countInRow = rowCounts.get(d) ?? 1;
    const indexInRow = rowCursor.get(d) ?? 0;
    rowCursor.set(d, indexInRow + 1);

    const colWidth = bounds.width / (countInRow + 1);
    const x = colWidth * (indexInRow + 1);
    const y = NODE_MARGIN_TOP + d * ROW_HEIGHT;

    positions.set(node.id, { x: Math.round(x), y: Math.round(y) });
  }

  return positions;
}

export function compileToGraphState(
  diagram: ParsedDiagram,
  positions: Map<string, { x: number; y: number }>
): GraphState {
  const nodes: GraphNode[] = diagram.nodes.map((n) => {
    const pos = positions.get(n.id) ?? { x: 0, y: 0 };
    return {
      id: n.id,
      label: n.label,
      x: pos.x,
      y: pos.y,
      shape: n.shape as GraphNode['shape'],
      compartmentLabels: n.compartmentLabels,
      stereotype: n.stereotype,
    };
  });

  const edges: GraphEdge[] = diagram.edges.map((e) => ({
    id: e.id,
    from: e.from,
    to: e.to,
    label: e.label,
    directed: e.directed,
    edgeStyle: e.edgeStyle,
  }));

  return { nodes, edges };
}
