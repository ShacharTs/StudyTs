
/**
 * Hand-written subset parser for Mermaid classDiagram syntax. Covers class
 * blocks with attribute/method lines and the 4 standard UML relationship
 * arrows. Not a full Mermaid grammar — generics, notes, and multi-line
 * method signatures with nested brackets are not supported (ponytail:
 * upgrade to a real grammar parser only if AI-generated diagrams start
 * hitting these in practice).
 */

const RELATIONSHIP_PATTERN = /^(\S+)\s*(<\|--|\*--|o--|-->|--\|>|--)\s*(\S+)(?:\s*:\s*(.+))?$/;
const EDGE_STYLE_BY_ARROW: Record<string, ParsedEdge['edgeStyle']> = {
  '<|--': 'extends',
  '--|>': 'extends',
  '*--': 'composition',
  'o--': 'aggregation',
  '-->': 'dependency',
  '--': 'association',
};

function stripKeyword(source: string): string[] {
  return source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== 'classDiagram');
}

type NodeMap = Map<string, ParsedNode>;

function ensureNode(nodes: NodeMap, id: string): ParsedNode {
  let node = nodes.get(id);
  if (!node) {
    node = { id, label: id, shape: 'rectangle', compartmentLabels: [id, '', ''] };
    nodes.set(id, node);
  }
  return node;
}

/** A line inside a class block: a <<stereotype>>, or an attribute (compartment 1) / method (compartment 2). */
function addMember(nodes: NodeMap, className: string, line: string): void {
  const node = ensureNode(nodes, className);
  if (line.startsWith('<<')) {
    node.stereotype = line.replace(/^<<|>>$/g, '').trim();
    return;
  }
  const compartments = node.compartmentLabels ?? [className, '', ''];
  const target = /^[+\-#~]?\w+\(/.test(line) ? 2 : 1;
  compartments[target] = compartments[target] ? `${compartments[target]}\n${line}` : line;
  node.compartmentLabels = compartments;
}

function parseRelationship(nodes: NodeMap, match: RegExpMatchArray, id: string): ParsedEdge {
  const [, left, arrow, right, label] = match;
  ensureNode(nodes, left);
  ensureNode(nodes, right);
  const reversed = arrow === '<|--' || arrow === '-->';
  return {
    id,
    from: reversed ? right : left,
    to: reversed ? left : right,
    label,
    directed: arrow !== '--',
    edgeStyle: EDGE_STYLE_BY_ARROW[arrow],
  };
}

export function parseClassDiagram(source: string): ParseResult {
  if (!source || !source.trim()) return { error: 'Empty Mermaid source' };

  const nodes: NodeMap = new Map();
  const edges: ParsedEdge[] = [];
  let currentClass: string | null = null;

  for (const line of stripKeyword(source)) {
    const classOpen = line.match(/^class\s+(\S+)\s*\{?$/);
    if (classOpen) {
      currentClass = classOpen[1];
      ensureNode(nodes, currentClass);
    } else if (line === '}') {
      currentClass = null;
    } else if (currentClass) {
      addMember(nodes, currentClass, line);
    } else {
      const rel = line.match(RELATIONSHIP_PATTERN);
      if (rel) edges.push(parseRelationship(nodes, rel, `e${edges.length + 1}`));
    }
  }

  return { nodes: [...nodes.values()], edges };
}

/**
 * Hand-written subset parser for Mermaid stateDiagram-v2 syntax. Covers
 * simple states and transitions with trigger labels. Composite/nested
 * states and concurrent regions are not supported (ponytail: v1 scope is
 * flat state machines, matching what StudyTs's existing `automata` block
 * already models for Turing machines — nesting can be added if a real
 * diagram needs it).
 */

const TRANSITION_PATTERN = /^(\S+)\s*-->\s*(\S+)(?:\s*:\s*(.+))?$/;
let pseudostateCounter = 0;

function normalizeStateId(raw: string): string {
  if (raw === '[*]') {
    pseudostateCounter += 1;
    return `__pseudostate_${pseudostateCounter}`;
  }
  return raw;
}

export function parseStateDiagram(source: string): ParseResult {
  if (!source || !source.trim()) return { error: 'Empty Mermaid source' };
  pseudostateCounter = 0;

  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== 'stateDiagram-v2' && l !== 'stateDiagram');

  const nodesById = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];
  let edgeCounter = 0;

  const ensureNode = (id: string, displayLabel: string) => {
    if (!nodesById.has(id)) {
      nodesById.set(id, { id, label: displayLabel, shape: 'pill' });
    }
  };

  for (const line of lines) {
    const match = line.match(TRANSITION_PATTERN);
    if (!match) continue;
    const [, rawFrom, rawTo, label] = match;
    const fromId = normalizeStateId(rawFrom);
    const toId = normalizeStateId(rawTo);
    ensureNode(fromId, rawFrom === '[*]' ? '●' : rawFrom);
    ensureNode(toId, rawTo === '[*]' ? '●' : rawTo);
    edgeCounter += 1;
    edges.push({ id: `e${edgeCounter}`, from: fromId, to: toId, label, directed: true });
  }

  return { nodes: [...nodesById.values()], edges } as ParsedDiagram;
}

/** Intermediate representation shared by all Mermaid diagram-type parsers, before layout. */
export interface ParsedNode {
  id: string;
  label: string;
  compartmentLabels?: [string, string, string];
  shape?: 'rectangle' | 'diamond' | 'pill';
  stereotype?: string;
}

export interface ParsedEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  directed: boolean;
  edgeStyle?: 'extends' | 'implements' | 'association' | 'composition' | 'aggregation' | 'dependency' | 'realization';
}

export interface ParsedDiagram {
  nodes: ParsedNode[];
  edges: ParsedEdge[];
}

export type ParseResult = ParsedDiagram | { error: string };

/**
 * Hand-written subset parser for Mermaid flowchart/graph syntax. Covers
 * rectangle/diamond/pill node shapes and directed/undirected/labeled edges.
 * Subgraphs, styling directives (style/classDef), and click-interaction
 * syntax are not supported (ponytail: this sub-project's scope is diagram
 * topology + shape, not Mermaid's full styling surface).
 */

function shapeAndLabelFromBracket(bracket: string | undefined, fallbackId: string): { shape?: ParsedNode['shape']; label: string } {
  if (!bracket) return { label: fallbackId };
  if (bracket.startsWith('{')) return { shape: 'diamond', label: bracket.slice(1, -1) };
  if (bracket.startsWith('((')) return { shape: 'pill', label: bracket.slice(2, -2) };
  if (bracket.startsWith('(')) return { shape: 'pill', label: bracket.slice(1, -1) };
  if (bracket.startsWith('[')) return { shape: 'rectangle', label: bracket.slice(1, -1) };
  return { label: fallbackId };
}

export function parseFlowchart(source: string): ParseResult {
  if (!source || !source.trim()) return { error: 'Empty Mermaid source' };

  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^(flowchart|graph)\s+(TD|TB|LR|RL|BT)$/i.test(l));

  const nodesById = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];
  let edgeCounter = 0;

  const ensureNode = (id: string, bracket?: string) => {
    const { shape, label } = shapeAndLabelFromBracket(bracket, id);
    const existing = nodesById.get(id);
    if (existing) {
      if (shape) existing.shape = shape;
      if (bracket) existing.label = label;
      return;
    }
    nodesById.set(id, { id, label, shape });
  };

  for (const line of lines) {
    // Edge line: A[...] -->|label| B[...]
    const edgeMatch = line.match(/^(\w+)(\[.+?\]|\{.+?\}|\(\(.+?\)\)|\(.+?\))?\s*(-->|---)\s*(?:\|(.+?)\|\s*)?(\w+)(\[.+?\]|\{.+?\}|\(\(.+?\)\)|\(.+?\))?$/);
    if (edgeMatch) {
      const [, fromId, fromBracket, arrow, label, toId, toBracket] = edgeMatch;
      ensureNode(fromId, fromBracket);
      ensureNode(toId, toBracket);
      edgeCounter += 1;
      edges.push({
        id: `e${edgeCounter}`,
        from: fromId,
        to: toId,
        label,
        directed: arrow === '-->',
      });
      continue;
    }
    // Node declaration standalone
    const nodeDeclMatch = line.match(/^(\w+)(\[.+?\]|\{.+?\}|\(\(.+?\)\)|\(.+?\))?$/);
    if (nodeDeclMatch) {
      ensureNode(nodeDeclMatch[1], nodeDeclMatch[2]);
    }
  }

  return { nodes: [...nodesById.values()], edges };
}
