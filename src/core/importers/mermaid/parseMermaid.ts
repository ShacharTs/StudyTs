import {
  parseClassDiagram,
  parseFlowchart,
  parseStateDiagram,
  type ParseResult,
  type ParsedNode,
  type ParsedEdge,
  type ParsedDiagram,
} from './diagramParsers';

/**
 * Hand-written subset parser for Mermaid erDiagram syntax. Covers entity
 * attribute blocks and cardinality relationships. Cardinality notation
 * (||--o{ etc.) is preserved as the edge label text, not mapped to a UML
 * edgeStyle — ER cardinality is a different notation system from UML
 * connector styles (see spec: rendered as a labeled plain edge for v1).
 */

const RELATIONSHIP_PATTERN = /^(\S+)\s+[|o}{.]+--[|o}{.]+\s+(\S+)\s*:\s*(.+)$/;

export function parseErDiagram(source: string): ParseResult {
  if (!source || !source.trim()) return { error: 'Empty Mermaid source' };

  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== 'erDiagram');

  const nodesById = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];
  let currentEntity: string | null = null;
  let edgeCounter = 0;

  const ensureNode = (id: string): ParsedNode => {
    let node = nodesById.get(id);
    if (!node) {
      node = { id, label: id, shape: 'rectangle', compartmentLabels: [id, '', ''] };
      nodesById.set(id, node);
    }
    return node;
  };

  for (const line of lines) {
    const openMatch = line.match(/^(\w+)\s*\{$/);
    if (openMatch) {
      currentEntity = openMatch[1];
      ensureNode(currentEntity);
      continue;
    }
    if (line === '}') {
      currentEntity = null;
      continue;
    }
    if (currentEntity) {
      const node = ensureNode(currentEntity);
      const compartments = node.compartmentLabels ?? [currentEntity, '', ''];
      compartments[1] = compartments[1] ? `${compartments[1]}\n${line}` : line;
      node.compartmentLabels = compartments;
      continue;
    }
    const relMatch = line.match(RELATIONSHIP_PATTERN);
    if (relMatch) {
      const [, from, to, label] = relMatch;
      ensureNode(from);
      ensureNode(to);
      edgeCounter += 1;
      edges.push({ id: `e${edgeCounter}`, from, to, label, directed: false } as ParsedEdge);
    }
  }

  return { nodes: [...nodesById.values()], edges } as ParsedDiagram;
}

export type DiagramType = 'class' | 'flowchart' | 'er' | 'state';

const PARSERS: Record<DiagramType, (source: string) => ParseResult> = {
  class: parseClassDiagram,
  flowchart: parseFlowchart,
  er: parseErDiagram,
  state: parseStateDiagram,
};

export function parseMermaid(source: string, diagramType: DiagramType): ParseResult {
  const parser = PARSERS[diagramType];
  if (!parser) {
    return { error: `Diagram type "${diagramType}" is not supported. Supported types: class, flowchart, er, state. (Sequence diagrams are not yet supported.)` };
  }
  return parser(source);
}
